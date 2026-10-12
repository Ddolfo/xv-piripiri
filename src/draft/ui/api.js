const TOKEN_KEY = 'draft-xv-token'

export function draftApiBase() {
  if (typeof window === 'undefined') return '/draft'
  if (window.location.hostname.endsWith('github.io')) {
    return 'https://xv-piripiri.resisted-lycra.workers.dev/draft'
  }
  return '/draft'
}

export function getDraftToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setDraftToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export async function draftFetch(path, { method = 'GET', body } = {}) {
  const headers = { accept: 'application/json' }
  const token = getDraftToken()
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(`${draftApiBase()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Falha ${res.status}`)
  return data
}

export const draftApi = {
  login: (username, password) => draftFetch('/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => draftFetch('/auth/logout', { method: 'POST', body: {} }),
  snapshot: () => draftFetch('/snapshot'),
  setupClub: (payload) => draftFetch('/club', { method: 'POST', body: payload }),
  buy: (playerId) => draftFetch('/market/buy', { method: 'POST', body: { playerId } }),
  sell: (playerId) => draftFetch('/market/sell', { method: 'POST', body: { playerId } }),
  startAuction: (playerId) => draftFetch('/auctions', { method: 'POST', body: { playerId } }),
  bid: (id, amount) => draftFetch(`/auctions/${id}/bid`, { method: 'POST', body: { amount } }),
  propose: (payload) => draftFetch('/proposals', { method: 'POST', body: payload }),
  respondProposal: (id, payload) => draftFetch(`/proposals/${id}/respond`, { method: 'POST', body: payload }),
  saveLineup: (payload) => draftFetch('/lineup', { method: 'POST', body: payload }),
  challenge: (fixtureId) => draftFetch('/challenges', { method: 'POST', body: { fixtureId } }),
  respondChallenge: (id, accept) => draftFetch(`/challenges/${id}/respond`, { method: 'POST', body: { accept } }),
  startChallenge: (id) => draftFetch(`/challenges/${id}/start`, { method: 'POST', body: {} }),
  confirmMatch: (id) => draftFetch(`/matches/${id}/confirm`, { method: 'POST', body: {} }),
  contestMatch: (id, reason) => draftFetch(`/matches/${id}/contest`, { method: 'POST', body: { reason } }),
  readNotes: (ids) => draftFetch('/notifications/read', { method: 'POST', body: { ids } }),
  adminUsers: (payload) => draftFetch('/admin/users', { method: 'POST', body: payload }),
  adminPassword: (id, password) => draftFetch(`/admin/users/${id}/password`, { method: 'POST', body: { password } }),
  adminStatus: (id, status) => draftFetch(`/admin/users/${id}/status`, { method: 'POST', body: { status } }),
  deleteUser: (id, justification) =>
    draftFetch(`/admin/users/${id}/delete`, { method: 'POST', body: { justification } }),
  draw: (justification) => draftFetch('/admin/draw', { method: 'POST', body: { justification } }),
  marketStatus: (status) => draftFetch('/admin/market', { method: 'POST', body: { status } }),
  createCup: (payload) => draftFetch('/admin/championships', { method: 'POST', body: payload }),
  assignCup: (id, clubIds) => draftFetch(`/admin/championships/${id}/assign`, { method: 'POST', body: { clubIds } }),
  calendar: (id) => draftFetch(`/admin/championships/${id}/calendar`, { method: 'POST', body: {} }),
  cupStatus: (id, status, justification) =>
    draftFetch(`/admin/championships/${id}/status`, { method: 'POST', body: { status, justification } }),
  deleteCup: (id, justification) =>
    draftFetch(`/admin/championships/${id}/delete`, { method: 'POST', body: { justification } }),
  resolveMatch: (id, payload) => draftFetch(`/admin/matches/${id}/resolve`, { method: 'POST', body: payload }),
  adjust: (payload) => draftFetch('/admin/adjust', { method: 'POST', body: payload }),
  upsertPlayer: (payload) => draftFetch('/admin/players', { method: 'POST', body: payload }),
  deletePlayer: (id, justification) =>
    draftFetch(`/admin/players/${id}/delete`, { method: 'POST', body: { justification } }),
  settings: (payload) => draftFetch('/admin/settings', { method: 'POST', body: payload }),
}

export function coins(n) {
  return `${Number(n || 0).toLocaleString('pt-BR')} XV-Coins`
}

export function overallTone(ovr) {
  if (ovr >= 89) return 'ovr-elite'
  if (ovr >= 85) return 'ovr-gold'
  if (ovr >= 80) return 'ovr-rare'
  if (ovr >= 74) return 'ovr-silver'
  return 'ovr-bronze'
}
