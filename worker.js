import { DraftEngine } from './src/draft/engine.js'
import { handleDraftRequest } from './src/draft/http.js'
import { createDurableStore, createMemoryStore } from './src/draft/store.js'

export class DraftRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
  }

  engine() {
    return new DraftEngine({
      store: createDurableStore(this.ctx.storage),
      adminPassword: this.env.DRAFT_ADMIN_PASSWORD || '',
    })
  }

  async fetch(request) {
    const response = await handleDraftRequest(request, this.engine())
    try {
      await this.ctx.storage.setAlarm(Date.now() + 20_000)
    } catch {
      /* alarme indisponível no runtime local */
    }
    return response
  }

  async alarm() {
    await this.engine().tick()
    try {
      await this.ctx.storage.setAlarm(Date.now() + 30_000)
    } catch {
      /* ignore */
    }
  }
}

const memoryFallback = createMemoryStore()

const EA_HEADERS = {
  accept: 'application/json',
  'accept-language': 'en-US,en;q=0.9',
  'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  origin: 'https://proclubs.ea.com',
  referer: 'https://proclubs.ea.com/',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/ea')) {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': '*',
        },
      })
    }

    if (url.pathname === '/futdb' || url.pathname.startsWith('/futdb/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, OPTIONS',
            'access-control-allow-headers': '*',
          },
        })
      }
      if (!env.FUTDB_TOKEN) {
        return new Response(JSON.stringify({ error: 'FUTDB_TOKEN não configurado no worker.' }), {
          status: 501,
          headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        })
      }
      const target = new URL(`${url.pathname.replace(/^\/futdb/, '')}${url.search}`, 'https://futdb.app/api/')
      const upstream = await fetch(target.toString(), {
        headers: { accept: 'application/json', 'X-AUTH-TOKEN': env.FUTDB_TOKEN },
      })
      const body = await upstream.arrayBuffer()
      return new Response(body, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/json',
          'access-control-allow-origin': '*',
        },
      })
    }

    if (url.pathname === '/draft' || url.pathname.startsWith('/draft/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'access-control-allow-headers': 'Authorization, Content-Type',
          },
        })
      }
      if (env.DRAFT) {
        const id = env.DRAFT.idFromName('draft-xv')
        return env.DRAFT.get(id).fetch(request)
      }
      const engine = new DraftEngine({
        store: memoryFallback,
        adminPassword: env.DRAFT_ADMIN_PASSWORD || '',
      })
      return handleDraftRequest(request, engine)
    }

    if (url.pathname === '/ea' || url.pathname.startsWith('/ea/')) {
      const target = new URL(
        `${url.pathname.replace(/^\/ea/, '')}${url.search}`,
        'https://proclubs.ea.com',
      )
      const upstream = await fetch(target.toString(), {
        method: 'GET',
        headers: EA_HEADERS,
        redirect: 'follow',
      })
      const body = await upstream.arrayBuffer()
      const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8'
      return new Response(body, {
        status: upstream.status,
        headers: {
          'content-type': contentType,
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=20',
        },
      })
    }

    return env.ASSETS.fetch(request)
  },
}
