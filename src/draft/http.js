import { DraftError } from './lib/util.js'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'Authorization, Content-Type',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  })
}

function bearer(request) {
  const h = request.headers.get('authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : ''
}

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return {}
  const text = await request.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new DraftError('JSON inválido.', 400)
  }
}

async function requireActor(engine, request) {
  const token = bearer(request)
  const actor = await engine.actorFromToken(token)
  if (!actor) throw new DraftError('Sessão inválida ou expirada.', 401, 'AUTH')
  return actor
}

export async function handleDraftRequest(request, engine) {
  const url = new URL(request.url)
  let path = url.pathname
  const idx = path.indexOf('/draft')
  if (idx >= 0) path = path.slice(idx + '/draft'.length) || '/'
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  try {
    const body = await readBody(request)

    if (request.method === 'GET' && path === '/health') {
      return json({ ok: true, name: 'Draft XV' })
    }

    if (request.method === 'POST' && path === '/tick') {
      return json(await engine.tick())
    }

    if (request.method === 'POST' && path === '/auth/login') {
      return json(await engine.login(body.username, body.password))
    }

    if (request.method === 'POST' && path === '/auth/logout') {
      await engine.logout(bearer(request))
      return json({ ok: true })
    }

    if (request.method === 'GET' && path === '/snapshot') {
      const token = bearer(request)
      const actor = token ? await engine.actorFromToken(token) : null
      return json(await engine.snapshot(actor))
    }

    const actor = await requireActor(engine, request)

    if (request.method === 'POST' && path === '/club') return json(await engine.setupClub(actor, body))
    if (request.method === 'POST' && path === '/market/buy') return json(await engine.buyDirect(actor, body.playerId))
    if (request.method === 'POST' && path === '/market/sell') return json(await engine.sellToMarket(actor, body.playerId))
    if (request.method === 'POST' && path === '/auctions') return json(await engine.startAuction(actor, body.playerId))
    if (request.method === 'POST' && (path.match(/^\/auctions\/([^/]+)\/bid$/) || [])[1]) {
      const id = path.split('/')[2]
      return json(await engine.bidAuction(actor, id, body.amount))
    }
    if (request.method === 'POST' && path === '/proposals') return json(await engine.createProposal(actor, body))
    if (request.method === 'POST' && path.startsWith('/proposals/') && path.endsWith('/respond')) {
      const id = path.split('/')[2]
      return json(await engine.respondProposal(actor, id, body.action, body))
    }
    if (request.method === 'POST' && path === '/lineup') return json(await engine.saveLineup(actor, body))
    if (request.method === 'POST' && path === '/challenges') return json(await engine.challenge(actor, body.fixtureId))
    if (request.method === 'POST' && path.startsWith('/challenges/') && path.endsWith('/respond')) {
      const id = path.split('/')[2]
      return json(await engine.respondChallenge(actor, id, !!body.accept))
    }
    if (request.method === 'POST' && path.startsWith('/challenges/') && path.endsWith('/start')) {
      const id = path.split('/')[2]
      return json(await engine.confirmChallengeStart(actor, id))
    }
    if (request.method === 'POST' && path.startsWith('/matches/') && path.endsWith('/confirm')) {
      return json(await engine.confirmMatch(actor, path.split('/')[2]))
    }
    if (request.method === 'POST' && path.startsWith('/matches/') && path.endsWith('/contest')) {
      return json(await engine.contestMatch(actor, path.split('/')[2], body.reason))
    }
    if (request.method === 'POST' && path === '/notifications/read') {
      return json(await engine.markNotifications(actor, body.ids))
    }

    if (request.method === 'POST' && path === '/admin/users') return json(await engine.createParticipant(actor, body))
    if (request.method === 'POST' && path.startsWith('/admin/users/') && path.endsWith('/password')) {
      return json(await engine.setUserPassword(actor, path.split('/')[3], body.password))
    }
    if (request.method === 'POST' && path.startsWith('/admin/users/') && path.endsWith('/status')) {
      return json(await engine.setUserStatus(actor, path.split('/')[3], body.status))
    }
    if (request.method === 'POST' && path.startsWith('/admin/users/') && path.endsWith('/delete')) {
      return json(await engine.deleteParticipant(actor, path.split('/')[3], body.justification))
    }
    if (request.method === 'POST' && path === '/admin/draw') return json(await engine.drawRosters(actor, body))
    if (request.method === 'POST' && path === '/admin/market') return json(await engine.setMarketStatus(actor, body.status))
    if (request.method === 'POST' && path === '/admin/settings') return json(await engine.updateSettings(actor, body))
    if (request.method === 'POST' && path === '/admin/players') return json(await engine.upsertPlayer(actor, body))
    if (request.method === 'POST' && path === '/admin/players/import') {
      return json(await engine.importPlayers(actor, body.players || body))
    }
    if (request.method === 'POST' && path.startsWith('/admin/players/') && path.endsWith('/delete')) {
      return json(await engine.deletePlayer(actor, path.split('/')[3], body.justification))
    }
    if (request.method === 'POST' && path === '/admin/championships') return json(await engine.createChampionship(actor, body))
    if (request.method === 'POST' && path.startsWith('/admin/championships/') && path.endsWith('/assign')) {
      return json(await engine.assignClubs(actor, path.split('/')[3], body.clubIds))
    }
    if (request.method === 'POST' && path.startsWith('/admin/championships/') && path.endsWith('/calendar')) {
      return json(await engine.generateCalendar(actor, path.split('/')[3]))
    }
    if (request.method === 'POST' && path.startsWith('/admin/championships/') && path.endsWith('/status')) {
      return json(await engine.setChampionshipStatus(actor, path.split('/')[3], body.status, body.justification))
    }
    if (request.method === 'POST' && path.startsWith('/admin/championships/') && path.endsWith('/delete')) {
      return json(await engine.deleteChampionship(actor, path.split('/')[3], body.justification))
    }
    if (request.method === 'POST' && path.startsWith('/admin/matches/') && path.endsWith('/resolve')) {
      return json(await engine.resolveMatch(actor, path.split('/')[3], body))
    }
    if (request.method === 'POST' && path === '/admin/adjust') return json(await engine.adminAdjust(actor, body))

    return json({ error: 'Rota não encontrada.' }, 404)
  } catch (err) {
    const status = err.status || 500
    return json({ error: err.message || 'Erro interno.', code: err.code || 'ERROR' }, status)
  }
}
