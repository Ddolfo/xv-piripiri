import {
  ADMIN_USERNAME,
  BENCH_COUNT,
  CREST_COLOR_MAX,
  CREST_COLOR_MIN,
  CLUB_NAME_MAX,
  CLUB_NAME_MIN,
  DEFAULT_SETTINGS,
  DRAW_BANDS,
  DEFAULT_FORMATION,
  FORMATION_IDS,
  LOGIN_LOCK_MS,
  LOGIN_MAX_ATTEMPTS,
  MARKET_STATUS,
  MAX_ACTIVE_CHAMPIONSHIPS,
  MAX_ROSTER,
  MAX_SUBS,
  MIN_ROSTER,
  PBKDF2_ITERATIONS,
  PLAYER_STATUS,
  SESSION_TTL_MS,
  STARTERS_COUNT,
  STARTING_COINS,
  STARTING_ROSTER,
  YELLOW_CARD_LIMIT,
  REWARD_DRAW,
  REWARD_WIN,
  STRATEGY_PRESETS,
} from './lib/constants.js'
import { hashPassword, randomToken, sha256B64, verifyPassword } from './lib/crypto.js'
import { auctionStartPrice, buyPrice, priceTableRows, sellPrice } from './lib/prices.js'
import { FORMATIONS } from '../data/formations.js'
import { cleanCrest, validateCrest } from './lib/crest.js'
import { drawFormationRoster } from './lib/draw.js'
import { PLAYER_BANK_VERSION, buildPlayerBank } from './lib/seed-players.js'
import { simulateMatch } from './lib/sim.js'
import { computeLeaders, computeStandings, knockoutBracket, roundRobinFixtures } from './lib/standings.js'
import {
  DraftError,
  activeAuctionForPlayer,
  cloneJson,
  nid,
  normalizeName,
  publicPlayer,
  rosterOf,
  slugName,
  spendable,
  uniqueColors,
} from './lib/util.js'

function emptyState() {
  return {
    meta: { version: 1, createdAt: 0 },
    settings: { ...DEFAULT_SETTINGS },
    marketStatus: MARKET_STATUS.CLOSED,
    users: {},
    sessions: {},
    clubs: {},
    players: {},
    ledger: [],
    championships: {},
    fixtures: {},
    matches: {},
    auctions: {},
    proposals: {},
    challenges: {},
    lineups: {},
    suspensions: {},
    notifications: [],
    audit: [],
    draws: [],
  }
}

function liveUser(state, actor) {
  const user = actor?.id ? state.users[actor.id] : null
  if (!user) throw new DraftError('Sessão inválida ou expirada.', 401, 'AUTH')
  return user
}

function requireAdmin(actor, state) {
  const user = state ? liveUser(state, actor) : actor
  if (!user || user.role !== 'admin') throw new DraftError('Acesso restrito ao administrador.', 403, 'FORBIDDEN')
  if (user.status !== 'ativo') throw new DraftError('Conta administrativa inativa.', 403, 'FORBIDDEN')
  return user
}

function requireParticipant(actor, state) {
  const user = state ? liveUser(state, actor) : actor
  if (!user || user.role !== 'participante') throw new DraftError('Ação exclusiva de participante.', 403, 'FORBIDDEN')
  if (user.status !== 'ativo') throw new DraftError('Conta bloqueada.', 403, 'BLOCKED')
  return user
}

function clubOf(state, actor) {
  const user = liveUser(state, actor)
  const club = user.clubId ? state.clubs[user.clubId] : null
  if (!club) throw new DraftError('Conclua a criação do clube para continuar.', 400, 'NO_CLUB')
  return club
}

function notify(state, userId, type, title, body, extra = {}) {
  const item = {
    id: nid('nt'),
    userId,
    type,
    title,
    body,
    extra,
    read: false,
    at: state._now,
  }
  state.notifications.push(item)
  return item
}

function notifyClub(state, clubId, type, title, body, extra) {
  const club = state.clubs[clubId]
  if (club) notify(state, club.userId, type, title, body, extra)
}

function audit(state, actor, action, details) {
  state.audit.push({
    id: nid('au'),
    at: state._now,
    userId: actor?.id || null,
    username: actor?.username || 'sistema',
    action,
    details,
  })
}

function ledger(state, clubId, amount, reason, related) {
  const club = state.clubs[clubId]
  const entry = {
    id: nid('ld'),
    at: state._now,
    clubId,
    amount,
    balanceAfter: club.balance,
    reason,
    related,
  }
  state.ledger.push(entry)
  return entry
}

function setReserve(club, key, amount) {
  club.reserves = club.reserves || {}
  if (!amount) delete club.reserves[key]
  else club.reserves[key] = amount
}

function credit(state, clubId, amount, reason, related) {
  const club = state.clubs[clubId]
  club.balance += amount
  return ledger(state, clubId, amount, reason, related)
}

function debit(state, clubId, amount, reason, related, reserveKey) {
  const club = state.clubs[clubId]
  if (reserveKey && club.reserves?.[reserveKey]) {
    const reserved = club.reserves[reserveKey]
    if (reserved < amount) throw new DraftError('Reserva insuficiente para concluir o pagamento.', 409)
    setReserve(club, reserveKey, 0)
  } else if (spendable(club) < amount) {
    throw new DraftError('Saldo insuficiente em XV-Coins.', 400, 'NO_FUNDS')
  }
  if (club.balance < amount) throw new DraftError('Saldo insuficiente em XV-Coins.', 400, 'NO_FUNDS')
  club.balance -= amount
  if (club.balance < 0) throw new DraftError('Saldo não pode ficar negativo.', 409, 'NEGATIVE')
  return ledger(state, clubId, -amount, reason, related)
}

function transferPlayer(state, player, toClubId, reason) {
  const from = player.clubId
  player.history = player.history || []
  player.history.push({ at: state._now, from, to: toClubId, reason })
  player.clubId = toClubId
  player.status = toClubId ? PLAYER_STATUS.OWNED : PLAYER_STATUS.FREE
}

function officialDrawDone(state) {
  return Array.isArray(state.draws) && state.draws.length > 0
}

function assertMarketOpen(state) {
  if (!officialDrawDone(state)) {
    throw new DraftError('O mercado da bola abre depois do sorteio oficial dos elencos.', 400, 'MARKET_CLOSED')
  }
  if (state.marketStatus !== MARKET_STATUS.OPEN) {
    throw new DraftError('O mercado da bola está fechado ou pausado.', 400, 'MARKET_CLOSED')
  }
}

function cancelOpenAuction(state, auction, result = 'cancelado_admin') {
  if (!auction || auction.status !== 'aberto') return auction
  auction.status = 'cancelado'
  auction.closedAt = state._now
  auction.result = result
  for (const bid of auction.bids || []) {
    const club = state.clubs[bid.clubId]
    if (club) setReserve(club, `auction:${auction.id}`, 0)
  }
  const player = state.players[auction.playerId]
  if (player && player.status === PLAYER_STATUS.AUCTION) {
    player.status = player.clubId ? PLAYER_STATUS.OWNED : PLAYER_STATUS.FREE
  }
  return auction
}

function cancelOpenProposal(state, proposal, status = 'cancelada_admin') {
  if (!proposal || !['pendente', 'contraproposta'].includes(proposal.status)) return proposal
  proposal.status = status
  proposal.updatedAt = state._now
  if (proposal.fromClubId && state.clubs[proposal.fromClubId]) {
    setReserve(state.clubs[proposal.fromClubId], `proposal:${proposal.id}`, 0)
  }
  if (proposal.toClubId && state.clubs[proposal.toClubId]) {
    setReserve(state.clubs[proposal.toClubId], `proposal:${proposal.id}`, 0)
  }
  return proposal
}

function stripPlayerFromLineups(state, playerId) {
  for (const lineup of Object.values(state.lineups)) {
    lineup.starters = (lineup.starters || []).filter((id) => id !== playerId)
    lineup.bench = (lineup.bench || []).filter((id) => id !== playerId)
    lineup.subs = (lineup.subs || []).filter((s) => s.inId !== playerId && s.outId !== playerId)
    if (lineup.captainId === playerId) lineup.captainId = lineup.starters[0] || null
  }
}

function dissolveClub(state, club, reason) {
  if (!club) return
  const clubId = club.id
  for (const player of rosterOf(state, clubId)) {
    transferPlayer(state, player, null, reason)
  }
  for (const auction of Object.values(state.auctions)) {
    if (auction.status !== 'aberto') continue
    const involved =
      auction.starterClubId === clubId || (auction.bids || []).some((bid) => bid.clubId === clubId)
    if (involved) cancelOpenAuction(state, auction, reason)
  }
  for (const proposal of Object.values(state.proposals)) {
    if (proposal.fromClubId === clubId || proposal.toClubId === clubId) {
      cancelOpenProposal(state, proposal, 'cancelada_participante_excluido')
    }
  }
  for (const cup of Object.values(state.championships)) {
    cup.clubIds = (cup.clubIds || []).filter((id) => id !== clubId)
  }
  for (const [id, fixture] of Object.entries(state.fixtures)) {
    if (fixture.homeClubId === clubId || fixture.awayClubId === clubId) delete state.fixtures[id]
  }
  for (const [id, match] of Object.entries(state.matches)) {
    if (match.homeClubId === clubId || match.awayClubId === clubId) delete state.matches[id]
  }
  for (const [id, challenge] of Object.entries(state.challenges)) {
    if (challenge.fromClubId === clubId || challenge.toClubId === clubId) delete state.challenges[id]
  }
  for (const key of Object.keys(state.lineups)) {
    if (key.startsWith(`${clubId}:`)) delete state.lineups[key]
  }
  for (const sus of Object.values(state.suspensions)) {
    if (sus.clubId === clubId && sus.status === 'ativa') {
      sus.status = 'cancelada_admin'
      sus.consumedAt = state._now
    }
  }
  delete state.clubs[clubId]
}

function playerLocked(state, playerId) {
  if (activeAuctionForPlayer(state, playerId)) return 'leilao'
  const pending = Object.values(state.proposals).find(
    (p) =>
      ['pendente', 'contraproposta'].includes(p.status) &&
      (p.offerPlayerIds || []).concat(p.requestPlayerIds || []).includes(playerId),
  )
  if (pending) return 'negociacao'
  return null
}

function defaultLineup() {
  return {
    formation: '4-3-3',
    starters: [],
    bench: [],
    captainId: null,
    strategyPreset: 'equilibrada',
    first: 'equilibrada',
    second: 'equilibrada',
    subs: [],
  }
}

function consumeSuspensions(state, clubId, matchId) {
  const applied = []
  for (const sus of Object.values(state.suspensions)) {
    if (sus.clubId !== clubId || sus.status !== 'ativa') continue
    sus.status = 'cumprida'
    sus.consumedMatchId = matchId
    sus.consumedAt = state._now
    applied.push(sus)
  }
  return applied
}

// Confere quem é dono de cada jogador e se os termos fazem sentido.
function checkProposalTerms(state, from, to, terms, proposalId = null) {
  const { requestPlayerIds = [], offerPlayerIds = [], coinsFrom = 0, coinsTo = 0 } = terms
  if (!requestPlayerIds.length && !offerPlayerIds.length) throw new DraftError('Inclua pelo menos um jogador na negociação.')
  if (coinsFrom < 0 || coinsTo < 0 || !Number.isFinite(coinsFrom) || !Number.isFinite(coinsTo)) throw new DraftError('Valores inválidos.')
  if (coinsFrom && coinsTo) throw new DraftError('Só um dos clubes paga a diferença.')
  const all = [...requestPlayerIds, ...offerPlayerIds]
  if (new Set(all).size !== all.length) throw new DraftError('Jogador repetido na negociação.')
  const lockedElsewhere = (id) => {
    const lock = playerLocked(state, id)
    if (!lock) return false
    if (lock !== 'negociacao' || !proposalId) return true
    return Object.values(state.proposals).some(
      (x) => x.id !== proposalId && ['pendente', 'contraproposta'].includes(x.status) && [...x.requestPlayerIds, ...x.offerPlayerIds].includes(id),
    )
  }
  for (const id of requestPlayerIds) {
    const p = state.players[id]
    if (!p || p.clubId !== to.id) throw new DraftError(`${p?.name || 'Jogador'} não é do ${to.name}.`)
    if (lockedElsewhere(id)) throw new DraftError(`${p.name} está em outra negociação ou leilão.`)
  }
  for (const id of offerPlayerIds) {
    const p = state.players[id]
    if (!p || p.clubId !== from.id) throw new DraftError(`${p?.name || 'Jogador'} não é do ${from.name}.`)
    if (lockedElsewhere(id)) throw new DraftError(`${p.name} está em outra negociação ou leilão.`)
  }
}

function activeSuspensions(state, clubId) {
  return Object.values(state.suspensions).filter((s) => s.clubId === clubId && s.status === 'ativa')
}

function publicClub(state, club, { privateView = false } = {}) {
  const roster = rosterOf(state, club.id).map((p) =>
    publicPlayer(p, {
      buy: buyPrice(p.overall),
      sell: sellPrice(p.overall),
      auction: auctionStartPrice(p.overall),
    }),
  )
  const user = state.users[club.userId]
  const base = {
    id: club.id,
    name: club.name,
    primary: club.primary,
    secondary: club.secondary,
    crest: club.crest,
    preferredFormation: club.preferredFormation || DEFAULT_FORMATION,
    setupComplete: club.setupComplete,
    rosterCount: roster.length,
    maxRoster: state.settings.maxRoster || MAX_ROSTER,
    participantName: user?.displayName || user?.username || '',
    championshipIds: Object.values(state.championships)
      .filter((c) => c.clubIds.includes(club.id) && c.status === 'ativo')
      .map((c) => c.id),
  }
  if (!privateView) return { ...base, roster }
  return {
    ...base,
    balance: club.balance,
    reserved: Object.values(club.reserves || {}).reduce((a, b) => a + b, 0),
    spendable: spendable(club),
    roster,
    ledger: state.ledger.filter((l) => l.clubId === club.id).slice(-80),
    suspensions: activeSuspensions(state, club.id),
  }
}

function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    clubId: user.clubId || null,
    createdAt: user.createdAt,
  }
}

function expireProposals(state) {
  const ttl = state.settings.proposalTtlMs
  for (const p of Object.values(state.proposals)) {
    if (!['pendente', 'contraproposta'].includes(p.status)) continue
    if (state._now - p.updatedAt < ttl) continue
    p.status = 'expirada'
    if (p.coinsFrom && p.fromClubId) setReserve(state.clubs[p.fromClubId], `proposal:${p.id}`, 0)
    if (p.coinsTo && p.toClubId) setReserve(state.clubs[p.toClubId], `proposal:${p.id}`, 0)
  }
}

function closeAuction(state, auction) {
  if (auction.status !== 'aberto') return auction
  auction.status = 'encerrado'
  auction.closedAt = state._now
  const bids = [...auction.bids].sort((a, b) => b.amount - a.amount || a.at - b.at)
  const winner = bids[0]
  const player = state.players[auction.playerId]
  for (const bid of bids) {
    const club = state.clubs[bid.clubId]
    if (club) setReserve(club, `auction:${auction.id}`, 0)
  }
  if (!winner || !player) {
    if (player && player.status === PLAYER_STATUS.AUCTION) {
      player.status = PLAYER_STATUS.FREE
      player.clubId = null
    }
    auction.result = 'sem_lances'
    return auction
  }
  const club = state.clubs[winner.clubId]
  const roster = rosterOf(state, club.id)
  try {
    if (roster.length >= (state.settings.maxRoster || MAX_ROSTER)) {
      throw new DraftError('Vencedor sem espaço no elenco.', 409)
    }
    setReserve(club, `auction:${auction.id}`, winner.amount)
    debit(state, club.id, winner.amount, 'leilao_vencedor', { auctionId: auction.id, playerId: player.id }, `auction:${auction.id}`)
    transferPlayer(state, player, club.id, 'leilao')
    auction.result = 'vendido'
    auction.winnerClubId = club.id
    auction.finalAmount = winner.amount
    notifyClub(state, club.id, 'leilao_encerrado', 'Leilão vencido', `${player.name} chegou ao seu clube por ${winner.amount} XV-Coins.`)
    for (const bid of bids) {
      if (bid.clubId !== club.id) {
        notifyClub(state, bid.clubId, 'leilao_encerrado', 'Leilão encerrado', `${player.name} foi arrematado por outro clube.`)
      }
    }
  } catch (err) {
    player.status = PLAYER_STATUS.FREE
    player.clubId = null
    auction.result = 'falha_entrega'
    auction.error = err.message
  }
  return auction
}

function closeExpiredAuctions(state) {
  for (const auction of Object.values(state.auctions)) {
    if (auction.status === 'aberto' && state._now >= auction.endsAt) closeAuction(state, auction)
  }
}

export class DraftEngine {
  constructor({ store, now, adminPassword, pbkdf2Iterations } = {}) {
    this.store = store
    this.now = now || (() => Date.now())
    this.adminPassword = adminPassword || ''
    this.pbkdf2Iterations = pbkdf2Iterations || PBKDF2_ITERATIONS
  }

  async tx(fn) {
    return this.store.transaction(async (state) => {
      if (!state.meta) Object.assign(state, emptyState())
      state._now = this.now()
      await this.ensureBootstrap(state)
      expireProposals(state)
      closeExpiredAuctions(state)
      const result = await fn(state)
      delete state._now
      return result
    })
  }

  async ensureBootstrap(state) {
    if (!state.meta.createdAt) state.meta.createdAt = this.now()
    // Configurações novas entram com o valor padrão sem apagar o que o admin já ajustou.
    state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) }
    if (!Object.keys(state.players).length || state.meta.playerBankVersion !== PLAYER_BANK_VERSION) {
      state.players = {}
      for (const p of buildPlayerBank()) state.players[p.id] = p
      state.auctions = {}
      state.proposals = {}
      state.lineups = {}
      state.meta.playerBankVersion = PLAYER_BANK_VERSION
    }
    const admin = Object.values(state.users).find((u) => u.username === ADMIN_USERNAME)
    if (!admin && this.adminPassword) {
      const secret = await hashPassword(this.adminPassword, null, this.pbkdf2Iterations)
      const id = nid('usr')
      state.users[id] = {
        id,
        username: ADMIN_USERNAME,
        displayName: 'Administrador Draft XV',
        role: 'admin',
        status: 'ativo',
        password: secret,
        clubId: null,
        createdAt: this.now(),
        failedLogins: 0,
        lockedUntil: 0,
      }
    }
  }

  async tick() {
    return this.tx(() => ({ ok: true, at: this.now() }))
  }

  async login(username, password) {
    return this.tx(async (state) => {
      const user = Object.values(state.users).find((u) => u.username === String(username || '').trim())
      if (!user) throw new DraftError('Credenciais inválidas.', 401, 'AUTH')
      if (user.lockedUntil && state._now < user.lockedUntil) {
        throw new DraftError('Conta temporariamente bloqueada por tentativas inválidas.', 429, 'LOCKED')
      }
      if (user.status !== 'ativo') throw new DraftError('Conta bloqueada.', 403, 'BLOCKED')
      const ok = await verifyPassword(password, user.password)
      if (!ok) {
        user.failedLogins = (user.failedLogins || 0) + 1
        if (user.failedLogins >= LOGIN_MAX_ATTEMPTS) user.lockedUntil = state._now + LOGIN_LOCK_MS
        throw new DraftError('Credenciais inválidas.', 401, 'AUTH')
      }
      user.failedLogins = 0
      user.lockedUntil = 0
      const token = randomToken()
      const tokenHash = await sha256B64(token)
      state.sessions[tokenHash] = {
        tokenHash,
        userId: user.id,
        createdAt: state._now,
        expiresAt: state._now + SESSION_TTL_MS,
      }
      return { token, user: publicUser(user) }
    })
  }

  async logout(token) {
    return this.tx(async (state) => {
      const tokenHash = await sha256B64(token)
      delete state.sessions[tokenHash]
      return { ok: true }
    })
  }

  async actorFromToken(token) {
    if (!token) return null
    return this.tx(async (state) => {
      const tokenHash = await sha256B64(token)
      const session = state.sessions[tokenHash]
      if (!session || session.expiresAt < state._now) {
        if (session) delete state.sessions[tokenHash]
        return null
      }
      const user = state.users[session.userId]
      if (!user || user.status !== 'ativo') return null
      return { ...publicUser(user) }
    })
  }

  async createParticipant(actor, { username, password, displayName }) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const name = String(username || '').trim()
      if (!name || name.length < 3) throw new DraftError('Identificador do participante inválido.')
      if (name === ADMIN_USERNAME) throw new DraftError('Identificador reservado.')
      if (Object.values(state.users).some((u) => u.username === name)) {
        throw new DraftError('Já existe uma conta com esse identificador.')
      }
      if (!password || String(password).length < 8) throw new DraftError('A senha precisa ter pelo menos 8 caracteres.')
      const secret = await hashPassword(password, null, this.pbkdf2Iterations)
      const id = nid('usr')
      state.users[id] = {
        id,
        username: name,
        displayName: normalizeName(displayName || name),
        role: 'participante',
        status: 'ativo',
        password: secret,
        clubId: null,
        createdAt: state._now,
        failedLogins: 0,
        lockedUntil: 0,
      }
      audit(state, actor, 'criar_participante', { userId: id, username: name })
      return publicUser(state.users[id])
    })
  }

  async setUserPassword(actor, userId, password) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const user = state.users[userId]
      if (!user) throw new DraftError('Usuário não encontrado.', 404)
      if (!password || String(password).length < 8) throw new DraftError('A senha precisa ter pelo menos 8 caracteres.')
      user.password = await hashPassword(password, null, this.pbkdf2Iterations)
      user.failedLogins = 0
      user.lockedUntil = 0
      for (const [hash, session] of Object.entries(state.sessions)) {
        if (session.userId === userId) delete state.sessions[hash]
      }
      audit(state, actor, 'redefinir_senha', { userId })
      return { ok: true }
    })
  }

  async setUserStatus(actor, userId, status) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const user = state.users[userId]
      if (!user) throw new DraftError('Usuário não encontrado.', 404)
      if (!['ativo', 'bloqueado'].includes(status)) throw new DraftError('Situação inválida.')
      user.status = status
      audit(state, actor, 'status_usuario', { userId, status })
      return publicUser(user)
    })
  }

  async deleteParticipant(actor, userId, justification) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const reason = normalizeName(justification) || 'Excluído pelo administrador'
      const user = state.users[userId]
      if (!user) throw new DraftError('Participante não encontrado.', 404)
      if (user.role === 'admin' || user.username === ADMIN_USERNAME) {
        throw new DraftError('A conta administrativa não pode ser excluída.')
      }
      const clubId = user.clubId || null
      const club = clubId ? state.clubs[clubId] : null
      for (const [hash, session] of Object.entries(state.sessions)) {
        if (session.userId === user.id) delete state.sessions[hash]
      }
      state.notifications = state.notifications.filter((n) => n.userId !== user.id)
      dissolveClub(state, club, 'participante_excluido')
      delete state.users[user.id]
      audit(state, actor, 'excluir_participante', {
        userId: user.id,
        username: user.username,
        clubId,
        justification: reason,
      })
      return { ok: true, userId: user.id }
    })
  }

  async setupClub(actor, payload) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      const user = state.users[actor.id]
      if (user.clubId && state.clubs[user.clubId]?.setupComplete) {
        throw new DraftError('O clube já foi criado.')
      }
      const name = normalizeName(payload.name)
      if (name.length < CLUB_NAME_MIN || name.length > CLUB_NAME_MAX) {
        throw new DraftError(`O nome do clube deve ter entre ${CLUB_NAME_MIN} e ${CLUB_NAME_MAX} caracteres.`)
      }
      const slug = slugName(name)
      const existing = Object.values(state.clubs).find((c) => slugName(c.name) === slug && c.id !== user.clubId)
      if (existing) throw new DraftError('Já existe um clube com esse nome.')
      const formation = payload.formation
      if (!FORMATION_IDS.includes(formation)) throw new DraftError('Escolha a formação preferida do clube.')
      const studio = payload.crest?.version === 2
      if (studio) {
        const problem = validateCrest(payload.crest)
        if (problem) throw new DraftError(problem)
      }
      const crest = studio ? cleanCrest(payload.crest) : payload.crest
      const primary = studio ? crest.primary : payload.primary || '#ffd200'
      const secondary = studio ? crest.secondary : payload.secondary || '#111111'
      if (!studio && (!crest || !Array.isArray(crest.layers) || !crest.layers.length)) {
        throw new DraftError('Crie um emblema antes de concluir.')
      }
      const colors = uniqueColors({ ...crest, primary, secondary })
      if (colors.length < CREST_COLOR_MIN || colors.length > CREST_COLOR_MAX) {
        throw new DraftError(`O emblema deve usar entre ${CREST_COLOR_MIN} e ${CREST_COLOR_MAX} cores distintas.`)
      }
      let club = user.clubId ? state.clubs[user.clubId] : null
      if (!club) {
        club = {
          id: nid('clb'),
          userId: user.id,
          name,
          primary,
          secondary,
          crest,
          preferredFormation: formation,
          setupComplete: true,
          balance: STARTING_COINS,
          reserves: {},
          createdAt: state._now,
        }
        state.clubs[club.id] = club
        user.clubId = club.id
        ledger(state, club.id, STARTING_COINS, 'saldo_inicial', {})
      } else {
        club.name = name
        club.primary = primary
        club.secondary = secondary
        club.crest = crest
        club.preferredFormation = formation
        club.setupComplete = true
      }
      audit(state, actor, 'criar_clube', { clubId: club.id, name, formation })
      return publicClub(state, club, { privateView: true })
    })
  }

  async drawRosters(actor, { justification } = {}) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const clubs = Object.values(state.clubs).filter((c) => c.setupComplete)
      if (!clubs.length) throw new DraftError('Nenhum clube concluído para o sorteio.')
      const unfinished = Object.values(state.users).filter(
        (u) => u.role === 'participante' && u.status === 'ativo' && (!u.clubId || !state.clubs[u.clubId]?.setupComplete),
      )
      if (unfinished.length) {
        throw new DraftError(
          `Todos os participantes ativos precisam concluir o clube antes do sorteio. Pendentes: ${unfinished.map((u) => u.username).join(', ')}.`,
        )
      }
      const already = clubs.filter((c) => rosterOf(state, c.id).length > 0)
      if (already.length && !justification) justification = 'Novo sorteio feito pelo administrador'
      if (already.length) {
        for (const club of already) {
          for (const p of rosterOf(state, club.id)) {
            p.clubId = null
            p.status = PLAYER_STATUS.FREE
          }
        }
      }
      const allowShare = state.settings.allowSharedPlayers
      const used = new Set()
      const result = []
      const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
      for (const club of clubs) {
        const formation = FORMATION_IDS.includes(club.preferredFormation) ? club.preferredFormation : DEFAULT_FORMATION
        const slotCodes = FORMATIONS[formation].map((slot) => slot.code)
        const available = Object.values(state.players).filter(
          (p) => p.status === PLAYER_STATUS.FREE && !p.clubId && (allowShare || !used.has(p.id)),
        )
        const drawn = drawFormationRoster({ players: available, bands: DRAW_BANDS, slotCodes, rand })
        if (!drawn.ok && drawn.reason === 'band') {
          throw new DraftError(
            `Banco insuficiente na faixa ${drawn.band.label}: preciso de ${drawn.need}, há ${drawn.have}.`,
            409,
            'BANK',
          )
        }
        if (!drawn.ok) {
          throw new DraftError(
            `Não há jogadores livres para cobrir a posição ${drawn.missing} do ${formation} de ${club.name} dentro das faixas do sorteio.`,
            409,
            'BANK',
          )
        }
        const taken = []
        for (const player of drawn.players) {
          transferPlayer(state, player, club.id, 'sorteio')
          used.add(player.id)
          taken.push(player.id)
        }
        if (taken.length !== STARTING_ROSTER) throw new DraftError('Sorteio não fechou 22 jogadores.', 500)
        result.push({ clubId: club.id, name: club.name, formation, playerIds: taken, covered: drawn.covered })
        notifyClub(state, club.id, 'sorteio', 'Elenco sorteado', 'O administrador sorteou os 22 jogadores iniciais do seu clube.')
      }
      const draw = { id: nid('drw'), at: state._now, actorId: actor.id, justification: justification || null, result }
      state.draws.push(draw)
      audit(state, actor, 'sorteio_elencos', { drawId: draw.id, clubs: result.map((r) => r.clubId), justification })
      return draw
    })
  }

  async setMarketStatus(actor, status) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      if (!Object.values(MARKET_STATUS).includes(status)) throw new DraftError('Situação de mercado inválida.')
      if (status === MARKET_STATUS.OPEN && !officialDrawDone(state)) {
        throw new DraftError('Abra o mercado só depois do sorteio oficial dos elencos.')
      }
      state.marketStatus = status
      audit(state, actor, 'mercado_status', { status })
      return { marketStatus: status }
    })
  }

  async updateSettings(actor, patch) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const allowed = [
        'allowSharedPlayers',
        'auctionDurationMs',
        'minBidIncrement',
        'proposalTtlMs',
        'auctionOvertime',
        'minRoster',
        'maxRoster',
        'startersCount',
        'benchCount',
        'maxSubs',
        'yellowCardLimit',
        'rewardWin',
        'rewardDraw',
        'suspensionScope',
      ]
      for (const key of allowed) {
        if (patch[key] !== undefined) state.settings[key] = patch[key]
      }
      audit(state, actor, 'configuracao', patch)
      return state.settings
    })
  }

  async upsertPlayer(actor, payload) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const id = payload.id || nid('p')
      const prev = state.players[id]
      if (!payload.name || payload.overall == null) throw new DraftError('Nome e over são obrigatórios.')
      state.players[id] = {
        id,
        name: normalizeName(payload.name),
        overall: Number(payload.overall),
        position: payload.position || 'CM',
        image: payload.image || null,
        nation: payload.nation || null,
        club: payload.club || prev?.club || null,
        league: payload.league || prev?.league || null,
        pace: payload.pace ?? Number(payload.overall),
        shooting: payload.shooting ?? Number(payload.overall),
        passing: payload.passing ?? Number(payload.overall),
        dribbling: payload.dribbling ?? Number(payload.overall),
        defending: payload.defending ?? Number(payload.overall),
        physical: payload.physical ?? Number(payload.overall),
        status: prev?.status || PLAYER_STATUS.FREE,
        clubId: prev?.clubId || null,
        history: prev?.history || [],
        custom: prev ? !!prev.custom : true,
      }
      audit(state, actor, 'jogador_banco', { playerId: id })
      return publicPlayer(state.players[id])
    })
  }

  async deletePlayer(actor, playerId, justification) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const reason = normalizeName(justification)
      if (!reason) throw new DraftError('Informe a justificativa para excluir o jogador.')
      const player = state.players[playerId]
      if (!player) throw new DraftError('Jogador não encontrado.', 404)
      const ownerId = player.clubId
      const auction = activeAuctionForPlayer(state, playerId)
      if (auction) cancelOpenAuction(state, auction, 'jogador_excluido')
      for (const proposal of Object.values(state.proposals)) {
        const involved = (proposal.offerPlayerIds || []).concat(proposal.requestPlayerIds || []).includes(playerId)
        if (involved) cancelOpenProposal(state, proposal, 'cancelada_jogador_excluido')
      }
      stripPlayerFromLineups(state, playerId)
      for (const sus of Object.values(state.suspensions)) {
        if (sus.playerId === playerId && sus.status === 'ativa') {
          sus.status = 'cancelada_admin'
          sus.consumedAt = state._now
        }
      }
      if (ownerId) {
        notifyClub(
          state,
          ownerId,
          'jogador_excluido',
          'Jogador removido do banco',
          `${player.name} foi excluído pelo administrador. ${reason}`,
          { playerId, justification: reason },
        )
      }
      delete state.players[playerId]
      audit(state, actor, 'excluir_jogador', { playerId, name: player.name, ownerId, justification: reason })
      return { ok: true, playerId }
    })
  }

  async importPlayers(actor, list) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      if (!Array.isArray(list) || !list.length) throw new DraftError('Lista de jogadores vazia.')
      let n = 0
      for (const row of list) {
        await this._writePlayer(state, row)
        n += 1
      }
      audit(state, actor, 'importar_jogadores', { count: n })
      return { imported: n }
    })
  }

  async _writePlayer(state, payload) {
    const id = payload.id || nid('p')
    const prev = state.players[id]
    state.players[id] = {
      id,
      name: normalizeName(payload.name),
      overall: Number(payload.overall),
      position: payload.position || 'CM',
      image: payload.image || null,
      nation: payload.nation || null,
      pace: payload.pace ?? Number(payload.overall),
      shooting: payload.shooting ?? Number(payload.overall),
      passing: payload.passing ?? Number(payload.overall),
      dribbling: payload.dribbling ?? Number(payload.overall),
      defending: payload.defending ?? Number(payload.overall),
      physical: payload.physical ?? Number(payload.overall),
      status: prev?.status || PLAYER_STATUS.FREE,
      clubId: prev?.clubId || null,
      history: prev?.history || [],
    }
    return state.players[id]
  }

  async buyDirect(actor, playerId) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      assertMarketOpen(state)
      const club = clubOf(state, actor)
      const player = state.players[playerId]
      if (!player) throw new DraftError('Jogador não encontrado.', 404)
      if (player.status !== PLAYER_STATUS.FREE || player.clubId) {
        throw new DraftError('Esse jogador não está mais disponível no mercado.')
      }
      if (activeAuctionForPlayer(state, playerId)) {
        throw new DraftError('Jogador em leilão ativo. Use a sala de lances.')
      }
      const roster = rosterOf(state, club.id)
      if (roster.length >= (state.settings.maxRoster || MAX_ROSTER)) {
        throw new DraftError(`Elenco completo (${roster.length}/${state.settings.maxRoster || MAX_ROSTER}).`)
      }
      const price = buyPrice(player.overall)
      debit(state, club.id, price, 'compra_direta', { playerId })
      transferPlayer(state, player, club.id, 'compra_direta')
      notify(state, actor.id, 'compra', 'Jogador contratado', `${player.name} chegou por ${price} XV-Coins.`)
      return { player: publicPlayer(player), price, balance: club.balance }
    })
  }

  async sellToMarket(actor, playerId) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      assertMarketOpen(state)
      const club = clubOf(state, actor)
      const player = state.players[playerId]
      if (!player || player.clubId !== club.id) throw new DraftError('Esse jogador não pertence ao seu clube.')
      const lock = playerLocked(state, playerId)
      if (lock) throw new DraftError('Jogador bloqueado por outra operação.')
      const roster = rosterOf(state, club.id)
      const min = state.settings.minRoster || MIN_ROSTER
      if (roster.length - 1 < min) {
        throw new DraftError(`A venda deixaria o elenco abaixo do mínimo (${min} jogadores).`)
      }
      const price = sellPrice(player.overall)
      transferPlayer(state, player, null, 'venda_mercado')
      credit(state, club.id, price, 'venda_mercado', { playerId })
      notify(state, actor.id, 'venda', 'Venda ao mercado', `${player.name} foi vendido por ${price} XV-Coins.`)
      return { player: publicPlayer(player), price, balance: club.balance }
    })
  }

  async startAuction(actor, playerId) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      assertMarketOpen(state)
      const club = clubOf(state, actor)
      const player = state.players[playerId]
      if (!player || player.status !== PLAYER_STATUS.FREE) throw new DraftError('Jogador indisponível para leilão.')
      if (activeAuctionForPlayer(state, playerId)) throw new DraftError('Já existe leilão aberto para este jogador.')
      const roster = rosterOf(state, club.id)
      if (roster.length >= (state.settings.maxRoster || MAX_ROSTER)) throw new DraftError('Sem espaço no elenco para arrematar.')
      const amount = auctionStartPrice(player.overall)
      if (spendable(club) < amount) throw new DraftError('Saldo insuficiente para o lance inicial.')
      const auction = {
        id: nid('auc'),
        playerId,
        starterClubId: club.id,
        status: 'aberto',
        startedAt: state._now,
        endsAt: state._now + (state.settings.auctionDurationMs || 3600000),
        bids: [],
      }
      setReserve(club, `auction:${auction.id}`, amount)
      auction.bids.push({ id: nid('bid'), clubId: club.id, amount, at: state._now })
      player.status = PLAYER_STATUS.AUCTION
      state.auctions[auction.id] = auction
      for (const other of Object.values(state.clubs)) {
        if (other.id === club.id) continue
        notifyClub(
          state,
          other.id,
          'leilao_iniciado',
          'Novo leilão',
          `${player.name} (${player.overall}) · lance inicial ${amount} XV-Coins · ${club.name}`,
          { auctionId: auction.id, playerId, endsAt: auction.endsAt },
        )
      }
      return auction
    })
  }

  async bidAuction(actor, auctionId, amount) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      assertMarketOpen(state)
      const club = clubOf(state, actor)
      const auction = state.auctions[auctionId]
      if (!auction || auction.status !== 'aberto') throw new DraftError('Leilão encerrado ou inexistente.')
      if (state._now >= auction.endsAt) {
        closeAuction(state, auction)
        throw new DraftError('Este leilão já encerrou.')
      }
      const player = state.players[auction.playerId]
      const roster = rosterOf(state, club.id)
      if (roster.length >= (state.settings.maxRoster || MAX_ROSTER)) throw new DraftError('Sem espaço no elenco.')
      const value = Number(amount)
      if (!Number.isFinite(value) || value <= 0) throw new DraftError('Lance inválido.')
      const current = auction.bids[auction.bids.length - 1]
      const minInc = state.settings.minBidIncrement || 100
      const minValue = current ? current.amount + minInc : auctionStartPrice(player.overall)
      if (value < minValue) throw new DraftError(`O lance mínimo agora é ${minValue} XV-Coins.`)
      const previousMine = auction.bids.filter((b) => b.clubId === club.id).pop()
      const extra = value - (previousMine && previousMine === current ? current.amount : 0)
      const available = spendable(club) + (club.reserves?.[`auction:${auction.id}`] || 0)
      if (available < value) throw new DraftError('Saldo insuficiente para este lance.')
      if (current) setReserve(state.clubs[current.clubId], `auction:${auction.id}`, 0)
      setReserve(club, `auction:${auction.id}`, value)
      auction.bids.push({ id: nid('bid'), clubId: club.id, amount: value, at: state._now })
      if (current && current.clubId !== club.id) {
        notifyClub(state, current.clubId, 'lance_superado', 'Lance superado', `Seu lance em ${player.name} foi superado.`, {
          auctionId,
        })
      }
      void extra
      return auction
    })
  }

  async createProposal(actor, payload) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      assertMarketOpen(state)
      const from = clubOf(state, actor)
      const to = state.clubs[payload.toClubId]
      if (!to || to.id === from.id) throw new DraftError('Clube destinatário inválido.')
      const requestPlayerIds = payload.requestPlayerIds || (payload.playerId ? [payload.playerId] : [])
      const offerPlayerIds = payload.offerPlayerIds || []
      const coinsFrom = Number(payload.coinsFrom || payload.amount || 0)
      const coinsTo = Number(payload.coinsTo || 0)
      checkProposalTerms(state, from, to, { requestPlayerIds, offerPlayerIds, coinsFrom, coinsTo })
      if (coinsFrom && spendable(from) < coinsFrom) throw new DraftError('Saldo insuficiente para a proposta.')
      const proposal = {
        id: nid('prp'),
        fromClubId: from.id,
        toClubId: to.id,
        requestPlayerIds,
        offerPlayerIds,
        coinsFrom,
        coinsTo,
        status: 'pendente',
        awaitingClubId: to.id,
        createdAt: state._now,
        updatedAt: state._now,
        versions: [],
      }
      if (coinsFrom) setReserve(from, `proposal:${proposal.id}`, coinsFrom)
      state.proposals[proposal.id] = proposal
      notifyClub(state, to.id, 'proposta', 'Nova proposta', `${from.name} enviou uma proposta de negociação.`, {
        proposalId: proposal.id,
      })
      return proposal
    })
  }

  async respondProposal(actor, proposalId, action, patch = {}) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      const club = clubOf(state, actor)
      const p = state.proposals[proposalId]
      if (!p) throw new DraftError('Proposta não encontrada.', 404)
      if (!['pendente', 'contraproposta'].includes(p.status)) throw new DraftError('Essa proposta não aceita resposta.')
      const isDest = p.toClubId === club.id
      const isFrom = p.fromClubId === club.id
      if (!isDest && !isFrom) throw new DraftError('Essa proposta não é do seu clube.')
      const awaiting = p.awaitingClubId || (p.status === 'pendente' ? p.toClubId : p.fromClubId)
      const other = isDest ? p.fromClubId : p.toClubId
      if (action === 'cancelar') {
        // Quem fez a última oferta pode retirá-la enquanto espera a resposta.
        if (club.id === awaiting) throw new DraftError('Para encerrar, recuse a proposta.')
        p.status = 'cancelada'
        p.updatedAt = state._now
        setReserve(state.clubs[p.fromClubId], `proposal:${p.id}`, 0)
        setReserve(state.clubs[p.toClubId], `proposal:${p.id}`, 0)
        return p
      }
      if (club.id !== awaiting) throw new DraftError('Aguarde a resposta do outro clube.')
      if (action === 'recusar') {
        p.status = 'recusada'
        p.updatedAt = state._now
        setReserve(state.clubs[p.fromClubId], `proposal:${p.id}`, 0)
        setReserve(state.clubs[p.toClubId], `proposal:${p.id}`, 0)
        notifyClub(state, other, 'proposta_recusada', 'Proposta recusada', `${club.name} recusou a negociação.`, { proposalId: p.id })
        return p
      }
      if (action === 'contraproposta') {
        const terms = {
          requestPlayerIds: patch.requestPlayerIds || p.requestPlayerIds,
          offerPlayerIds: patch.offerPlayerIds || p.offerPlayerIds,
          coinsFrom: Number(patch.coinsFrom ?? p.coinsFrom) || 0,
          coinsTo: Number(patch.coinsTo ?? p.coinsTo) || 0,
        }
        checkProposalTerms(state, state.clubs[p.fromClubId], state.clubs[p.toClubId], terms, p.id)
        p.versions.push(cloneJson({ ...p, versions: undefined }))
        Object.assign(p, terms)
        p.status = 'contraproposta'
        p.awaitingClubId = other
        p.lastOfferClubId = club.id
        p.updatedAt = state._now
        setReserve(state.clubs[p.fromClubId], `proposal:${p.id}`, 0)
        setReserve(state.clubs[p.toClubId], `proposal:${p.id}`, 0)
        // Reserva só o que quem fez a oferta se comprometeu a pagar; o outro lado paga ao aceitar.
        const myPay = isFrom ? p.coinsFrom : p.coinsTo
        if (myPay) {
          if (spendable(club) < myPay) throw new DraftError('Saldo insuficiente para essa contraproposta.')
          setReserve(club, `proposal:${p.id}`, myPay)
        }
        notifyClub(state, other, 'contraproposta', 'Contraproposta recebida', `${club.name} mudou os termos da negociação.`, { proposalId: p.id })
        return p
      }
      if (action === 'aceitar') {
        this._settleProposal(state, p)
        return p
      }
      throw new DraftError('Ação inválida.')
    })
  }

  _settleProposal(state, p) {
    const from = state.clubs[p.fromClubId]
    const to = state.clubs[p.toClubId]
    const max = state.settings.maxRoster || MAX_ROSTER
    const min = state.settings.minRoster || MIN_ROSTER
    for (const id of [...p.requestPlayerIds, ...p.offerPlayerIds]) {
      if (playerLocked(state, id) && playerLocked(state, id) !== 'negociacao') {
        p.status = 'invalidada'
        throw new DraftError('A proposta ficou inválida. Envie outra.')
      }
    }
    const fromRoster = rosterOf(state, from.id)
    const toRoster = rosterOf(state, to.id)
    const fromFinal = fromRoster.length - p.offerPlayerIds.length + p.requestPlayerIds.length
    const toFinal = toRoster.length - p.requestPlayerIds.length + p.offerPlayerIds.length
    if (fromFinal > max || toFinal > max) throw new DraftError('A troca estouraria o limite de 26 jogadores.')
    if (fromFinal < min || toFinal < min) throw new DraftError('A troca deixaria um elenco abaixo do mínimo.')
    if (p.coinsFrom) debit(state, from.id, p.coinsFrom, 'negociacao', { proposalId: p.id }, `proposal:${p.id}`)
    else setReserve(from, `proposal:${p.id}`, 0)
    if (p.coinsTo) debit(state, to.id, p.coinsTo, 'negociacao', { proposalId: p.id }, `proposal:${p.id}`)
    else setReserve(to, `proposal:${p.id}`, 0)
    if (p.coinsFrom) credit(state, to.id, p.coinsFrom, 'negociacao_recebida', { proposalId: p.id })
    if (p.coinsTo) credit(state, from.id, p.coinsTo, 'negociacao_recebida', { proposalId: p.id })
    for (const id of p.requestPlayerIds) transferPlayer(state, state.players[id], from.id, 'negociacao')
    for (const id of p.offerPlayerIds) transferPlayer(state, state.players[id], to.id, 'negociacao')
    p.status = 'aceita'
    p.updatedAt = state._now
    p.awaitingClubId = null
    notifyClub(state, from.id, 'proposta_aceita', 'Negociação concluída', `Negócio fechado com ${to.name}.`, { proposalId: p.id })
    notifyClub(state, to.id, 'proposta_aceita', 'Negociação concluída', `Negócio fechado com ${from.name}.`, { proposalId: p.id })
  }

  async saveLineup(actor, payload) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      const club = clubOf(state, actor)
      const championshipId = payload.championshipId || 'geral'
      const formation = FORMATION_IDS.includes(payload.formation) ? payload.formation : club.preferredFormation || DEFAULT_FORMATION
      const starters = payload.starters || []
      const bench = payload.bench || []
      if (starters.length !== (state.settings.startersCount || STARTERS_COUNT)) {
        throw new DraftError(`A escalação precisa de ${state.settings.startersCount || STARTERS_COUNT} titulares.`)
      }
      if (bench.length > (state.settings.benchCount || BENCH_COUNT)) {
        throw new DraftError('Banco acima do permitido.')
      }
      const ids = [...starters, ...bench]
      if (new Set(ids).size !== ids.length) throw new DraftError('Jogador repetido na escalação.')
      const suspended = new Set(activeSuspensions(state, club.id).map((s) => s.playerId))
      for (const id of ids) {
        const p = state.players[id]
        if (!p || p.clubId !== club.id) throw new DraftError('Jogador fora do elenco.')
        if (suspended.has(id)) throw new DraftError(`${p.name} está suspenso e não pode ser escalado.`)
      }
      const preset = STRATEGY_PRESETS.find((s) => s.id === payload.strategyPreset)
      const lineup = {
        formation,
        starters,
        bench,
        captainId: payload.captainId || starters[0],
        strategyPreset: payload.strategyPreset || 'equilibrada',
        first: preset?.first || payload.first || 'equilibrada',
        second: preset?.second || payload.second || 'equilibrada',
        subs: (payload.subs || []).slice(0, state.settings.maxSubs || MAX_SUBS),
        savedAt: state._now,
      }
      state.lineups[`${club.id}:${championshipId}`] = lineup
      return lineup
    })
  }

  async createChampionship(actor, payload) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const active = Object.values(state.championships).filter((c) => c.status === 'ativo')
      if (active.length >= MAX_ACTIVE_CHAMPIONSHIPS) {
        throw new DraftError('Já existem dois campeonatos ativos.')
      }
      const wanted = String(payload.name || '').trim().toLowerCase()
      if (wanted && active.some((c) => String(c.name || '').trim().toLowerCase() === wanted)) {
        throw new DraftError('Já existe um campeonato ativo com esse nome.')
      }
      const format = payload.format === 'mata-mata' ? 'mata-mata' : 'pontos-corridos'
      const id = nid('cmp')
      const clubIds = [...new Set(payload.clubIds || [])]
      for (const clubId of clubIds) {
        if (!state.clubs[clubId]?.setupComplete) throw new DraftError('Selecione apenas clubes com cadastro concluído.')
      }
      state.championships[id] = {
        id,
        name: normalizeName(payload.name || 'Campeonato Draft XV'),
        format,
        status: 'ativo',
        startAt: payload.startAt || state._now,
        clubIds,
        championClubId: null,
        createdAt: state._now,
      }
      audit(state, actor, 'criar_campeonato', { id, format, clubIds })
      if (payload.generateCalendar) {
        if (clubIds.length < 2) throw new DraftError('Selecione ao menos dois participantes para gerar o calendário.')
        await this._fillCalendar(state, state.championships[id])
      }
      return state.championships[id]
    })
  }

  async assignClubs(actor, championshipId, clubIds) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const cup = state.championships[championshipId]
      if (!cup || cup.status !== 'ativo') throw new DraftError('Campeonato inválido.')
      const ids = [...new Set(clubIds || [])]
      for (const id of ids) {
        if (!state.clubs[id]?.setupComplete) throw new DraftError('Clube inválido na lista.')
      }
      cup.clubIds = ids
      audit(state, actor, 'inscrever_clubes', { championshipId, clubIds: ids })
      return cup
    })
  }

  _fillCalendar(state, cup) {
    const existing = Object.values(state.fixtures).filter((f) => f.championshipId === cup.id)
    for (const f of existing) delete state.fixtures[f.id]
    let rows = []
    if (cup.format === 'pontos-corridos') {
      rows = roundRobinFixtures(cup.clubIds)
    } else {
      const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
      rows = knockoutBracket(cup.clubIds, rand).fixtures
    }
    for (const row of rows) {
      const id = nid('fx')
      state.fixtures[id] = {
        id,
        championshipId: cup.id,
        ...row,
        status: row.bye ? 'bye' : 'pendente',
        matchId: null,
      }
    }
    return Object.values(state.fixtures).filter((f) => f.championshipId === cup.id)
  }

  async generateCalendar(actor, championshipId) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const cup = state.championships[championshipId]
      if (!cup) throw new DraftError('Campeonato não encontrado.')
      if (cup.clubIds.length < 2) throw new DraftError('Inscreva ao menos dois clubes.')
      const fixtures = this._fillCalendar(state, cup)
      audit(state, actor, 'gerar_calendario', { championshipId, count: fixtures.length })
      return fixtures
    })
  }

  async challenge(actor, fixtureId) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      const club = clubOf(state, actor)
      const fixture = state.fixtures[fixtureId]
      if (!fixture || fixture.status !== 'pendente') throw new DraftError('Confronto indisponível.')
      if (fixture.homeClubId !== club.id && fixture.awayClubId !== club.id) {
        throw new DraftError('Seu clube não está neste confronto.')
      }
      if (fixture.homeClubId !== club.id) throw new DraftError('Só o mandante convida para a partida.')
      const notReady = this._lineupProblem(state, club, fixture.championshipId)
      if (notReady) throw new DraftError(notReady)
      const dup = Object.values(state.challenges).find(
        (c) => c.fixtureId === fixtureId && ['pendente', 'aceito', 'aguardando_inicio'].includes(c.status),
      )
      if (dup) throw new DraftError('Já existe um desafio para este confronto.')
      const busy = Object.values(state.matches).find(
        (m) =>
          ['aguardando_confirmacao', 'em_andamento'].includes(m.status) &&
          (m.homeClubId === club.id || m.awayClubId === club.id),
      )
      if (busy) throw new DraftError('Seu clube já tem uma partida em andamento.')
      const targetId = fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId
      const challenge = {
        id: nid('chl'),
        fixtureId,
        championshipId: fixture.championshipId,
        fromClubId: club.id,
        toClubId: targetId,
        status: 'pendente',
        createdAt: state._now,
      }
      state.challenges[challenge.id] = challenge
      notifyClub(state, targetId, 'desafio', 'Convite para partida', `${club.name} convidou seu clube para jogar. Aceite para a partida acontecer.`, { challengeId: challenge.id })
      return challenge
    })
  }

  async respondChallenge(actor, challengeId, accept) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      const club = clubOf(state, actor)
      const ch = state.challenges[challengeId]
      if (!ch || ch.toClubId !== club.id) throw new DraftError('Desafio inválido.')
      if (ch.status !== 'pendente') throw new DraftError('Este convite já foi respondido.')
      ch.respondedAt = state._now
      if (!accept) {
        ch.status = 'recusado'
        notifyClub(state, ch.fromClubId, 'desafio_recusado', 'Convite recusado', `${club.name} recusou o convite.`, { challengeId: ch.id })
        return ch
      }
      const match = this._playChallenge(state, ch)
      return { ...ch, match }
    })
  }

  async confirmChallengeStart(actor, challengeId) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      const club = clubOf(state, actor)
      const ch = state.challenges[challengeId]
      if (!ch || ch.fromClubId !== club.id) throw new DraftError('Só o desafiante confirma o início.')
      if (ch.status !== 'aceito') throw new DraftError('O convite ainda não foi aceito.')
      return this._playChallenge(state, ch)
    })
  }

  // Convites aceitos antes desta mudança ainda podem ser jogados pelo mandante.
  _playChallenge(state, ch) {
    const fixture = state.fixtures[ch.fixtureId]
    if (!fixture) throw new DraftError('Confronto não encontrado.', 404)
    const match = this._simulateOfficial(state, fixture, ch)
    this._validateMatch(state, match)
    ch.status = 'concluido'
    ch.matchId = match.id
    return match
  }

  _lineupProblem(state, club, championshipId) {
    const pack = this._lineupPlayers(state, club.id, championshipId)
    if (pack.starters.length !== STARTERS_COUNT) {
      return `${club.name} precisa salvar a escalação com 11 titulares antes da partida.`
    }
    const suspended = new Set(activeSuspensions(state, club.id).map((s) => s.playerId))
    const out = pack.starters.filter((p) => suspended.has(p.id)).map((p) => p.name)
    if (out.length) {
      return `${club.name} escalou jogador suspenso (${out.join(', ')}). Troque na Formação e Escalação.`
    }
    return null
  }

  _lineupPlayers(state, clubId, championshipId) {
    // Ordem: escalação do campeonato, a geral, a última salva pelo clube em qualquer campeonato.
    const latest = Object.entries(state.lineups)
      .filter(([key]) => key.startsWith(`${clubId}:`))
      .map(([, l]) => l)
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0]
    const lineup =
      state.lineups[`${clubId}:${championshipId}`] || state.lineups[`${clubId}:geral`] || latest || defaultLineup()
    const starters = lineup.starters.map((id) => state.players[id]).filter(Boolean)
    const bench = lineup.bench.map((id) => state.players[id]).filter(Boolean)
    return { lineup, starters, bench }
  }

  _simulateOfficial(state, fixture, challenge) {
    if (fixture.matchId && state.matches[fixture.matchId]) {
      return state.matches[fixture.matchId]
    }
    const home = state.clubs[fixture.homeClubId]
    const away = state.clubs[fixture.awayClubId]
    if (!home || !away) throw new DraftError('Confronto incompleto.')
    const otherLive = Object.values(state.matches).find(
      (m) =>
        m.status === 'aguardando_confirmacao' &&
        ([m.homeClubId, m.awayClubId].includes(home.id) || [m.homeClubId, m.awayClubId].includes(away.id)),
    )
    if (otherLive) throw new DraftError('Há partida simultânea. Definição administrativa necessária.', 409)
    const homePack = this._lineupPlayers(state, home.id, fixture.championshipId)
    const awayPack = this._lineupPlayers(state, away.id, fixture.championshipId)
    const problem = this._lineupProblem(state, home, fixture.championshipId) || this._lineupProblem(state, away, fixture.championshipId)
    if (problem) throw new DraftError(problem)
    const cup = state.championships[fixture.championshipId]
    const matchId = nid('mt')
    const result = simulateMatch({
      matchId,
      home,
      away,
      homeLineup: homePack.starters.map((p) => ({ ...p, clubId: home.id })),
      awayLineup: awayPack.starters.map((p) => ({ ...p, clubId: away.id })),
      homePlan: {
        first: homePack.lineup.first,
        second: homePack.lineup.second,
        subs: homePack.lineup.subs.map((s) => ({
          ...s,
          inPlayer: homePack.bench.find((p) => p.id === s.inId),
        })),
        needWinner: cup.format === 'mata-mata',
      },
      awayPlan: {
        first: awayPack.lineup.first,
        second: awayPack.lineup.second,
        subs: awayPack.lineup.subs.map((s) => ({
          ...s,
          inPlayer: awayPack.bench.find((p) => p.id === s.inId),
        })),
        needWinner: cup.format === 'mata-mata',
      },
      maxSubs: state.settings.maxSubs || MAX_SUBS,
    })
    let homeGoals = result.homeGoals
    let awayGoals = result.awayGoals
    if (cup.format === 'mata-mata' && homeGoals === awayGoals && result.penalties) {
      homeGoals = result.homeGoals
      awayGoals = result.awayGoals
    }
    const match = {
      id: matchId,
      kind: 'oficial',
      championshipId: cup.id,
      fixtureId: fixture.id,
      challengeId: challenge?.id || null,
      homeClubId: home.id,
      awayClubId: away.id,
      homeGoals,
      awayGoals,
      penalties: result.penalties,
      status: 'aguardando_confirmacao',
      confirmations: {},
      contest: null,
      frozenLineups: {
        home: cloneJson(homePack.lineup),
        away: cloneJson(awayPack.lineup),
      },
      result,
      createdAt: state._now,
    }
    state.matches[match.id] = match
    fixture.matchId = match.id
    fixture.status = 'aguardando_confirmacao'
    consumeSuspensions(state, home.id, match.id)
    consumeSuspensions(state, away.id, match.id)
    return match
  }

  async confirmMatch(actor, matchId) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      const club = clubOf(state, actor)
      const match = state.matches[matchId]
      if (!match) throw new DraftError('Partida não encontrada.', 404)
      if (match.homeClubId !== club.id && match.awayClubId !== club.id) throw new DraftError('Partida de outro clube.')
      if (match.status === 'contestada' || match.status === 'analise') {
        throw new DraftError('Partida em contestação. Aguarde o administrador.')
      }
      match.confirmations[club.id] = { at: state._now, userId: actor.id }
      if (match.confirmations[match.homeClubId] && match.confirmations[match.awayClubId]) {
        this._validateMatch(state, match)
      }
      return match
    })
  }

  _validateMatch(state, match) {
    if (match.status === 'validado') return
    match.status = 'validado'
    match.validatedAt = state._now
    const fixture = state.fixtures[match.fixtureId]
    if (fixture) fixture.status = 'concluido'
    const cup = state.championships[match.championshipId]
    if (cup?.format === 'mata-mata') this._advanceKnockout(state, cup, match)
    this._applyCardRules(state, match)
    const prizes = this._payMatchRewards(state, match)
    const home = state.clubs[match.homeClubId]
    const away = state.clubs[match.awayClubId]
    const line = `${home?.name || 'Mandante'} ${match.homeGoals} x ${match.awayGoals} ${away?.name || 'Visitante'}`
    const prizeText = (clubId) => (prizes[clubId] ? ` Prêmio: ${prizes[clubId].toLocaleString('pt-BR')} XV-Coins.` : '')
    notifyClub(state, match.homeClubId, 'resultado', 'Partida jogada', `${line}. O resultado já está na tabela.${prizeText(match.homeClubId)}`, { matchId: match.id })
    notifyClub(state, match.awayClubId, 'resultado', 'Partida jogada', `${line}. O resultado já está na tabela.${prizeText(match.awayClubId)}`, { matchId: match.id })
  }

  // Prêmio em XV-Coins por vitória e empate, pago uma única vez por partida.
  _payMatchRewards(state, match) {
    if (match.rewardsPaid) return match.rewardsPaid
    const win = Math.max(0, Number(state.settings.rewardWin ?? REWARD_WIN) || 0)
    const draw = Math.max(0, Number(state.settings.rewardDraw ?? REWARD_DRAW) || 0)
    const paid = {}
    const pay = (clubId, amount, reason) => {
      if (!amount || !state.clubs[clubId]) return
      credit(state, clubId, amount, reason, { matchId: match.id })
      paid[clubId] = amount
    }
    if (match.homeGoals === match.awayGoals) {
      pay(match.homeClubId, draw, 'premio_empate')
      pay(match.awayClubId, draw, 'premio_empate')
    } else {
      const winner = match.homeGoals > match.awayGoals ? match.homeClubId : match.awayClubId
      pay(winner, win, 'premio_vitoria')
    }
    match.rewardsPaid = paid
    return paid
  }

  /**
   * Regras de cartões:
   * - vermelho direto ou dois amarelos no jogo: suspensão na próxima partida oficial;
   * - a cada N amarelos acumulados no mesmo campeonato (padrão 3): suspensão na próxima partida.
   * Os amarelos de uma expulsão por dois amarelos não contam para o acúmulo.
   */
  _applyCardRules(state, match) {
    if (match.cardRulesApplied) return
    match.cardRulesApplied = true
    const result = match.result || {}
    const suspend = (playerId, clubId, playerName, reason, text) => {
      const id = nid('sus')
      state.suspensions[id] = { id, playerId, clubId, sourceMatchId: match.id, reason, status: 'ativa', createdAt: state._now }
      notifyClub(state, clubId, 'suspensao', 'Jogador suspenso', text || `${playerName} cumpre suspensão na próxima partida oficial.`)
    }
    const sentOff = new Set()
    for (const red of result.reds || []) {
      sentOff.add(red.playerId)
      const why = red.reason === 'segundo_amarelo' ? 'dois amarelos' : 'vermelho direto'
      suspend(red.playerId, red.clubId, red.playerName, red.reason === 'segundo_amarelo' ? 'dois_amarelos' : 'vermelho', `${red.playerName} foi expulso (${why}) e cumpre suspensão na próxima partida oficial.`)
    }
    const limit = Number(state.settings.yellowCardLimit) || YELLOW_CARD_LIMIT
    const here = new Map()
    for (const y of result.yellows || []) {
      if (sentOff.has(y.playerId)) continue
      here.set(y.playerId, y)
    }
    if (!here.size) return
    const done = Object.values(state.matches).filter(
      (m) => m.championshipId === match.championshipId && m.status === 'validado' && m.kind === 'oficial',
    )
    for (const [playerId, y] of here) {
      let total = 0
      for (const m of done) {
        const expelled = (m.result?.reds || []).some((r) => r.playerId === playerId)
        if (expelled) continue
        total += (m.result?.yellows || []).filter((x) => x.playerId === playerId).length
      }
      if (total > 0 && total % limit === 0) {
        suspend(playerId, y.clubId, y.playerName, 'acumulo_amarelos', `${y.playerName} chegou a ${total} amarelos no campeonato e cumpre suspensão na próxima partida oficial.`)
      }
    }
  }

  _advanceKnockout(state, cup, match) {
    const fixture = state.fixtures[match.fixtureId]
    if (!fixture) return
    let winner = match.homeGoals === match.awayGoals ? match.penalties?.winnerClubId : match.homeGoals > match.awayGoals ? match.homeClubId : match.awayClubId
    fixture.winnerClubId = winner
    const round = fixture.round
    const same = Object.values(state.fixtures).filter((f) => f.championshipId === cup.id && f.round === round)
    if (same.some((f) => f.status !== 'concluido' && f.status !== 'bye')) return
    const winners = same
      .sort((a, b) => (a.bracketIndex || 0) - (b.bracketIndex || 0))
      .map((f) => f.winnerClubId || f.homeClubId)
      .filter(Boolean)
    if (winners.length === 1) {
      cup.championClubId = winners[0]
      cup.status = 'encerrado'
      return
    }
    for (let i = 0; i < winners.length; i += 2) {
      const id = nid('fx')
      state.fixtures[id] = {
        id,
        championshipId: cup.id,
        round: round + 1,
        homeClubId: winners[i],
        awayClubId: winners[i + 1],
        leg: 1,
        bracketIndex: i / 2,
        status: winners[i + 1] ? 'pendente' : 'bye',
        bye: !winners[i + 1],
        winnerClubId: winners[i + 1] ? null : winners[i],
        matchId: null,
      }
    }
  }

  async contestMatch(actor, matchId, reason) {
    return this.tx(async (state) => {
      requireParticipant(actor, state)
      const club = clubOf(state, actor)
      const match = state.matches[matchId]
      if (!match) throw new DraftError('Partida não encontrada.', 404)
      if (match.homeClubId !== club.id && match.awayClubId !== club.id) throw new DraftError('Partida de outro clube.')
      if (match.status === 'validado') throw new DraftError('Resultado já validado não pode ser contestado pelo participante.')
      match.status = 'contestada'
      match.contest = { clubId: club.id, reason: normalizeName(reason || 'Divergência de resultado'), at: state._now }
      const fixture = state.fixtures[match.fixtureId]
      if (fixture) fixture.status = 'contestada'
      const admins = Object.values(state.users).filter((u) => u.role === 'admin')
      for (const admin of admins) {
        notify(state, admin.id, 'contestacao', 'Partida contestada', `${club.name} contestou ${match.id}.`, { matchId })
      }
      return match
    })
  }

  async resolveMatch(actor, matchId, payload) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const match = state.matches[matchId]
      if (!match) throw new DraftError('Partida não encontrada.', 404)
      if (!payload.justification) throw new DraftError('Informe a justificativa da correção.')
      if (payload.keepOriginal) {
        match.status = 'corrigido_admin'
        this._validateMatch(state, match)
        match.status = 'validado'
      } else {
        if (payload.homeGoals != null) match.homeGoals = Number(payload.homeGoals)
        if (payload.awayGoals != null) match.awayGoals = Number(payload.awayGoals)
        match.status = 'corrigido_admin'
        this._validateMatch(state, match)
      }
      match.adminResolution = { at: state._now, userId: actor.id, justification: payload.justification }
      audit(state, actor, 'resolver_partida', { matchId, justification: payload.justification, payload })
      notifyClub(state, match.homeClubId, 'decisao_admin', 'Decisão administrativa', payload.justification)
      notifyClub(state, match.awayClubId, 'decisao_admin', 'Decisão administrativa', payload.justification)
      return match
    })
  }

  async setChampionshipStatus(actor, championshipId, status, justification) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const cup = state.championships[championshipId]
      if (!cup) throw new DraftError('Campeonato não encontrado.')
      if (!['ativo', 'encerrado', 'arquivado'].includes(status)) throw new DraftError('Situação inválida.')
      cup.status = status
      audit(state, actor, 'campeonato_status', { championshipId, status, justification })
      return cup
    })
  }

  async deleteChampionship(actor, championshipId, justification) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      const reason = normalizeName(justification) || 'Excluído pelo administrador'
      const cup = state.championships[championshipId]
      if (!cup) throw new DraftError('Campeonato não encontrado.', 404)
      const fixtureIds = new Set()
      const matchIds = new Set()
      for (const [id, fixture] of Object.entries(state.fixtures)) {
        if (fixture.championshipId === cup.id) {
          fixtureIds.add(id)
          if (fixture.matchId) matchIds.add(fixture.matchId)
          delete state.fixtures[id]
        }
      }
      for (const [id, match] of Object.entries(state.matches)) {
        if (match.championshipId === cup.id || matchIds.has(id)) {
          matchIds.add(id)
          delete state.matches[id]
        }
      }
      for (const [id, challenge] of Object.entries(state.challenges)) {
        if (challenge.championshipId === cup.id || fixtureIds.has(challenge.fixtureId) || matchIds.has(challenge.matchId)) {
          delete state.challenges[id]
        }
      }
      for (const key of Object.keys(state.lineups)) {
        if (key.endsWith(`:${cup.id}`)) delete state.lineups[key]
      }
      for (const clubId of cup.clubIds || []) {
        notifyClub(
          state,
          clubId,
          'campeonato_excluido',
          'Campeonato excluído',
          `${cup.name} foi excluído pelo administrador. ${reason}`,
          { championshipId: cup.id, justification: reason },
        )
      }
      delete state.championships[cup.id]
      audit(state, actor, 'excluir_campeonato', {
        championshipId: cup.id,
        name: cup.name,
        status: cup.status,
        fixtures: fixtureIds.size,
        matches: matchIds.size,
        justification: reason,
      })
      return { ok: true, championshipId: cup.id }
    })
  }

  async adminAdjust(actor, payload) {
    return this.tx(async (state) => {
      requireAdmin(actor, state)
      if (!payload.justification) throw new DraftError('Justificativa obrigatória.')
      if (payload.balanceClubId && payload.delta) {
        const club = state.clubs[payload.balanceClubId]
        if (!club) throw new DraftError('Clube não encontrado.')
        const next = club.balance + Number(payload.delta)
        if (next < 0) throw new DraftError('Saldo não pode ficar negativo.')
        if (payload.delta > 0) credit(state, club.id, Number(payload.delta), 'ajuste_admin', { justification: payload.justification })
        else debit(state, club.id, -Number(payload.delta), 'ajuste_admin', { justification: payload.justification })
      }
      if (payload.clearSuspensionId) {
        const sus = state.suspensions[payload.clearSuspensionId]
        if (sus) sus.status = 'cancelada_admin'
      }
      audit(state, actor, 'ajuste_admin', payload)
      return { ok: true }
    })
  }

  async markNotifications(actor, ids) {
    return this.tx(async (state) => {
      const set = new Set(ids || [])
      for (const n of state.notifications) {
        if (n.userId === actor.id && (set.has(n.id) || !ids)) n.read = true
      }
      return { ok: true }
    })
  }

  async snapshot(actor) {
    return this.tx(async (state) => {
      const prices = priceTableRows()
      const settings = state.settings
      const drawDone = officialDrawDone(state)
      if (!actor) {
        return { me: null, prices, settings, marketStatus: state.marketStatus, drawDone }
      }
      const live = liveUser(state, actor)
      const notifications = state.notifications.filter((n) => n.userId === live.id).slice(-80)
      if (live.role === 'admin') {
        return {
          me: publicUser(live),
          prices,
          settings,
          marketStatus: state.marketStatus,
          drawDone,
          users: Object.values(state.users).map(publicUser),
          clubs: Object.values(state.clubs).map((c) => publicClub(state, c, { privateView: true })),
          players: Object.values(state.players).map((p) =>
            publicPlayer(p, { buy: buyPrice(p.overall), sell: sellPrice(p.overall), auction: auctionStartPrice(p.overall) }),
          ),
          championships: this._cups(state),
          auctions: Object.values(state.auctions),
          proposals: Object.values(state.proposals),
          matches: Object.values(state.matches),
          challenges: Object.values(state.challenges),
          ledger: state.ledger.slice(-200),
          audit: state.audit.slice(-200),
          draws: state.draws,
          notifications,
          suspensions: Object.values(state.suspensions),
        }
      }
      const club = live.clubId ? state.clubs[live.clubId] : null
      const myCups = Object.values(state.championships).filter(
        (c) => c.status === 'ativo' && (!club || c.clubIds.includes(club.id) || !c.clubIds.length),
      )
      const peerIds = new Set()
      for (const cup of myCups) for (const id of cup.clubIds) peerIds.add(id)
      const marketOpen = drawDone && state.marketStatus === MARKET_STATUS.OPEN
      return {
        me: publicUser(live),
        prices,
        settings,
        marketStatus: state.marketStatus,
        drawDone,
        club: club ? publicClub(state, club, { privateView: true }) : null,
        clubs: Object.values(state.clubs)
          // Todos os clubes do Draft aparecem para negociar, mesmo sem campeonato em comum.
          .filter((c) => c.setupComplete || peerIds.has(c.id) || c.id === club?.id)
          .map((c) => publicClub(state, c, { privateView: c.id === club?.id })),
        market: marketOpen
          ? Object.values(state.players)
              .filter((p) => p.status === PLAYER_STATUS.FREE || p.status === PLAYER_STATUS.AUCTION)
              .map((p) =>
                publicPlayer(p, { buy: buyPrice(p.overall), sell: sellPrice(p.overall), auction: auctionStartPrice(p.overall) }),
              )
          : [],
        auctions: marketOpen
          ? Object.values(state.auctions).filter((a) => a.status === 'aberto' || a.starterClubId === club?.id || a.winnerClubId === club?.id)
          : [],
        proposals: marketOpen
          ? Object.values(state.proposals).filter((p) => p.fromClubId === club?.id || p.toClubId === club?.id)
          : [],
        championships: this._cups(state).filter((c) => !club || c.clubIds.includes(club.id)),
        matches: Object.values(state.matches).filter((m) => m.homeClubId === club?.id || m.awayClubId === club?.id),
        challenges: Object.values(state.challenges).filter((c) => c.fromClubId === club?.id || c.toClubId === club?.id),
        lineups: Object.fromEntries(Object.entries(state.lineups).filter(([k]) => k.startsWith(`${club?.id}:`))),
        notifications,
        suspensions: club ? activeSuspensions(state, club.id) : [],
      }
    })
  }

  _cups(state) {
    return Object.values(state.championships).map((cup) => ({
      ...cup,
      fixtures: Object.values(state.fixtures).filter((f) => f.championshipId === cup.id),
      standings: cup.format === 'pontos-corridos' ? computeStandings(cup, Object.values(state.matches), state.clubs, state.settings) : [],
      leaders: computeLeaders(cup, Object.values(state.matches), state.players, state.clubs),
    }))
  }
}

export { emptyState }
