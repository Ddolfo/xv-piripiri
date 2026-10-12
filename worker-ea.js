import { COACH_CLUBS, fixEaTree, normalizeMatches } from './src/lib/eaApi.js'
import { mergeHistory } from './src/lib/rivals.js'

const EA_ORIGIN = 'https://proclubs.ea.com'
const RETRY_STATUS = [403, 429, 500, 502, 503, 504]
const MATCH_TYPES = ['leagueMatch', 'playoffMatch', 'friendlyMatch']
const KV_TTL = 60 * 60 * 24 * 30
const CORS = { 'access-control-allow-origin': '*' }

const EA_HEADERS = {
  accept: 'application/json',
  'accept-language': 'en-US,en;q=0.9',
  'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  origin: EA_ORIGIN,
  referer: `${EA_ORIGIN}/`,
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Chaves internas do cache da borda (não são URLs reais).
const edgeKey = (scope, key) => new Request(`https://${scope}.xv-cache/${encodeURIComponent(key)}`)

// A EA (Akamai) devolve 403/429 de vez em quando para o IP da Cloudflare: tenta de novo.
async function fetchEa(target) {
  let res = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) await sleep(400 * attempt)
    try {
      res = await fetch(target.toString(), { method: 'GET', headers: EA_HEADERS, redirect: 'follow' })
    } catch {
      res = null
      continue
    }
    if (res.ok || !RETRY_STATUS.includes(res.status)) break
  }
  return res
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra },
  })
}

// Guarda a última resposta boa: no cache da borda (por datacenter) e no KV (global).
// O KV só é regravado 1x por hora por URL, para caber no limite grátis de escritas.
async function saveStale(env, key, body, contentType) {
  const cache = caches.default
  await cache.put(
    edgeKey('ea-stale', key),
    new Response(body.slice(0), {
      headers: { 'content-type': contentType, 'cache-control': 'public, max-age=86400' },
    }),
  )
  if (!env.XV_KV) return
  const mark = edgeKey('ea-kv-mark', key)
  if (await cache.match(mark)) return
  await env.XV_KV.put(`ea:${key}`, body, { expirationTtl: KV_TTL, metadata: { contentType } })
  await cache.put(mark, new Response('1', { headers: { 'cache-control': 'public, max-age=3600' } }))
}

export async function proxyEa(url, env, ctx) {
  const target = new URL(`${url.pathname.replace(/^\/ea/, '')}${url.search}`, EA_ORIGIN)
  const key = `${target.pathname}${target.search}`
  const upstream = await fetchEa(target)
  if (upstream?.ok) {
    const body = await upstream.arrayBuffer()
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8'
    ctx.waitUntil(saveStale(env, key, body, contentType).catch(() => {}))
    return new Response(body, {
      status: upstream.status,
      headers: { 'content-type': contentType, ...CORS, 'cache-control': 'public, max-age=20' },
    })
  }

  const stale = await caches.default.match(edgeKey('ea-stale', key))
  if (stale) {
    return new Response(stale.body, {
      headers: {
        'content-type': stale.headers.get('content-type') || 'application/json',
        ...CORS,
        'cache-control': 'no-store',
        'x-ea-stale': 'edge',
      },
    })
  }
  if (env.XV_KV) {
    const kv = await env.XV_KV.getWithMetadata(`ea:${key}`, { type: 'arrayBuffer' })
    if (kv?.value) {
      return new Response(kv.value, {
        headers: {
          'content-type': kv.metadata?.contentType || 'application/json',
          ...CORS,
          'cache-control': 'no-store',
          'x-ea-stale': 'kv',
        },
      })
    }
  }

  const body = upstream ? await upstream.arrayBuffer() : '{"error":"EA indisponível"}'
  return new Response(body, {
    status: upstream?.status || 502,
    headers: {
      'content-type': upstream?.headers.get('content-type') || 'application/json',
      ...CORS,
      'cache-control': 'no-store',
    },
  })
}

// ---- Histórico compartilhado: todo visitante vê os mesmos jogos acumulados ----

const historyKey = (clubId) => `history:${clubId}`

async function readHistory(env, clubId) {
  const saved = env.XV_KV ? await env.XV_KV.get(historyKey(clubId), { type: 'json' }) : null
  return {
    clubId,
    updatedAt: saved?.updatedAt || null,
    matches: Array.isArray(saved?.matches) ? saved.matches : [],
  }
}

async function pullHistory(env, club) {
  const clubId = String(club.clubId)
  const cur = await readHistory(env, clubId)
  const fresh = []
  for (const type of MATCH_TYPES) {
    const target = new URL('/api/fc/clubs/matches', EA_ORIGIN)
    target.search = new URLSearchParams({
      platform: club.platform,
      clubIds: clubId,
      matchType: type,
      maxResultCount: '10',
    }).toString()
    const res = await fetchEa(target)
    if (!res?.ok) continue
    try {
      fresh.push(...normalizeMatches(fixEaTree(await res.json()), clubId, type))
    } catch {
      /* resposta inválida da EA */
    }
  }
  const matches = mergeHistory(cur.matches, fresh)
  if (!env.XV_KV || JSON.stringify(matches) === JSON.stringify(cur.matches)) return cur
  const next = { clubId, updatedAt: new Date().toISOString(), matches }
  await env.XV_KV.put(historyKey(clubId), JSON.stringify(next))
  return next
}

export async function handleShared(request, url, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...CORS, 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': '*' },
    })
  }
  const m = url.pathname.match(/^\/shared\/history\/(\d+)$/)
  const club = m && COACH_CLUBS.find((c) => String(c.clubId) === m[1])
  if (!club) return json({ error: 'Clube desconhecido.' }, 404)

  // ?fresh=1 puxa da EA na hora, no máximo 1x a cada 90s por clube.
  if (url.searchParams.get('fresh')) {
    const mark = edgeKey('shared-pull', club.clubId)
    if (!(await caches.default.match(mark))) {
      await caches.default.put(mark, new Response('1', { headers: { 'cache-control': 'public, max-age=90' } }))
      return json(await pullHistory(env, club), 200, { 'cache-control': 'no-store' })
    }
  }
  return json(await readHistory(env, String(club.clubId)), 200, { 'cache-control': 'no-store' })
}

export async function pullAllClubs(env) {
  for (const club of COACH_CLUBS) {
    try {
      await pullHistory(env, club)
    } catch {
      /* tenta de novo no próximo agendamento */
    }
  }
}
