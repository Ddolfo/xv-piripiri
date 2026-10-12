import fs from 'node:fs/promises'
import path from 'node:path'
import { DraftEngine } from './engine.js'
import { handleDraftRequest } from './http.js'
import { createFileStore } from './store.js'

function nodeToFetch(req, origin) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('error', reject)
    req.on('end', () => {
      const body = Buffer.concat(chunks)
      const headers = new Headers()
      for (const [k, v] of Object.entries(req.headers)) {
        if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v)
      }
      const init = { method: req.method, headers }
      if (body.length && req.method !== 'GET' && req.method !== 'HEAD') init.body = body
      resolve(new Request(origin + req.url, init))
    })
  })
}

export function draftVitePlugin(rootDir) {
  const dataDir = path.join(rootDir, 'data')
  const statePath = path.join(dataDir, 'draft-state.json')
  const secretPath = path.join(dataDir, '.draft-secret')

  return {
    name: 'draft-xv-api',
    configureServer(server) {
      const store = createFileStore(fs, statePath)
      let enginePromise = null

      async function getEngine() {
        if (enginePromise) return enginePromise
        enginePromise = (async () => {
          let adminPassword = process.env.DRAFT_ADMIN_PASSWORD || ''
          if (!adminPassword) {
            try {
              adminPassword = (await fs.readFile(secretPath, 'utf8')).trim()
            } catch {
              adminPassword = `xv-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
              await fs.mkdir(dataDir, { recursive: true })
              await fs.writeFile(secretPath, `${adminPassword}\n`, { encoding: 'utf8' })
              console.log(
                `\n[Draft XV] Admin ${'ddolfo.draft'} · senha inicial em data/.draft-secret (não versionar).\n`,
              )
            }
          }
          const engine = new DraftEngine({
            store,
            adminPassword,
            pbkdf2Iterations: Number(process.env.DRAFT_PBKDF2 || 100000),
          })
          await engine.tick()
          setInterval(() => {
            engine.tick().catch(() => {})
          }, 15_000).unref?.()
          return engine
        })()
        return enginePromise
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/draft')) return next()
        try {
          const engine = await getEngine()
          const origin = `http://${req.headers.host || 'localhost'}`
          const request = await nodeToFetch(req, origin)
          const response = await handleDraftRequest(request, engine)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          const buf = Buffer.from(await response.arrayBuffer())
          res.end(buf)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: err.message || 'Falha no Draft XV' }))
        }
      })
    },
  }
}
