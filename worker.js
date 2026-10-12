import { DraftEngine } from './src/draft/engine.js'
import { handleDraftRequest } from './src/draft/http.js'
import { createDurableStore, createMemoryStore } from './src/draft/store.js'
import { handleShared, proxyEa, pullAllClubs } from './worker-ea.js'

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

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(pullAllClubs(env))
  },

  async fetch(request, env, ctx) {
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

    if (url.pathname.startsWith('/shared/')) {
      return handleShared(request, url, env)
    }

    if (url.pathname === '/ea' || url.pathname.startsWith('/ea/')) {
      return proxyEa(url, env, ctx)
    }

    return env.ASSETS.fetch(request)
  },
}
