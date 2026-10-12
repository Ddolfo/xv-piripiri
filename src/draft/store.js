import { emptyState } from './engine.js'
import { cloneJson } from './lib/util.js'

export function createMemoryStore(initial) {
  let state = initial ? cloneJson(initial) : emptyState()
  let queue = Promise.resolve()
  return {
    snapshot() {
      return cloneJson(state)
    },
    replace(next) {
      state = cloneJson(next)
    },
    transaction(fn) {
      const run = queue.then(async () => {
        const draft = cloneJson(state)
        const result = await fn(draft)
        state = draft
        return result
      })
      queue = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    },
  }
}

export function createFileStore(fs, path) {
  let memory = null
  let queue = Promise.resolve()

  async function load() {
    if (memory) return memory
    try {
      const raw = await fs.readFile(path, 'utf8')
      memory = JSON.parse(raw)
    } catch {
      memory = emptyState()
    }
    return memory
  }

  async function persist(state) {
    memory = state
    const dir = path.replace(/[\\/][^\\/]+$/, '')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path, JSON.stringify(state))
  }

  return {
    async snapshot() {
      return cloneJson(await load())
    },
    transaction(fn) {
      const run = queue.then(async () => {
        const current = await load()
        const draft = cloneJson(current)
        const result = await fn(draft)
        await persist(draft)
        return result
      })
      queue = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    },
  }
}

export function createDurableStore(storage) {
  let memory = null
  return {
    async snapshot() {
      if (memory) return cloneJson(memory)
      memory = (await storage.get('state', { type: 'json' })) || emptyState()
      return cloneJson(memory)
    },
    transaction: async (fn) => {
      const current = (await storage.get('state', { type: 'json' })) || emptyState()
      const draft = cloneJson(current)
      const result = await fn(draft)
      await storage.put('state', draft)
      memory = draft
      return result
    },
  }
}
