export class DraftError extends Error {
  constructor(message, status = 400, code = 'DRAFT') {
    super(message)
    this.name = 'DraftError'
    this.status = status
    this.code = code
  }
}

export function nid(prefix = 'id') {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}_${hex}`
}

export function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function slugName(name) {
  return normalizeName(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function sum(values) {
  return values.reduce((a, b) => a + b, 0)
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return function rand() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFromString(text) {
  let h = 2166136261
  const s = String(text)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pick(rand, list) {
  return list[Math.floor(rand() * list.length)]
}

export function shuffle(rand, list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function uniqueColors(crest) {
  const set = new Set()
  const layers = crest?.layers || []
  for (const layer of layers) {
    for (const key of ['fill', 'stroke', 'color']) {
      const value = layer[key]
      if (!value || value === 'none' || value === 'transparent') continue
      set.add(String(value).trim().toLowerCase())
    }
  }
  if (crest?.primary) set.add(String(crest.primary).trim().toLowerCase())
  if (crest?.secondary) set.add(String(crest.secondary).trim().toLowerCase())
  return [...set]
}

export function publicPlayer(player, extras = {}) {
  if (!player) return null
  return {
    id: player.id,
    name: player.name,
    overall: player.overall,
    position: player.position,
    image: player.image || null,
    nation: player.nation || null,
    club: player.club || null,
    league: player.league || null,
    pace: player.pace,
    shooting: player.shooting,
    passing: player.passing,
    dribbling: player.dribbling,
    defending: player.defending,
    physical: player.physical,
    status: player.status,
    clubId: player.clubId || null,
    custom: !!player.custom,
    ...extras,
  }
}

export function spendable(club) {
  const reserved = Object.values(club.reserves || {}).reduce((a, b) => a + Number(b || 0), 0)
  return Number(club.balance || 0) - reserved
}

export function rosterOf(state, clubId) {
  return Object.values(state.players).filter((p) => p.clubId === clubId && p.status === 'clube')
}

export function activeAuctionForPlayer(state, playerId) {
  return Object.values(state.auctions).find(
    (a) => a.playerId === playerId && a.status === 'aberto',
  )
}

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}
