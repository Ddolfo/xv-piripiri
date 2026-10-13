/** Regras oficiais e padrões do Draft XV. Valores da tabela de preços ficam em prices.js. */

import { FORMATION_KEYS } from '../../data/formations.js'

export const ADMIN_USERNAME = 'ddolfo.draft'

export const STARTING_COINS = 15000
export const STARTING_ROSTER = 22
export const MAX_ROSTER = 26
export const MIN_ROSTER = 11
export const MAX_ACTIVE_CHAMPIONSHIPS = 2

export const AUCTION_DURATION_MS = 60 * 60 * 1000
export const MIN_BID_INCREMENT = 100
export const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const LOGIN_MAX_ATTEMPTS = 8
export const LOGIN_LOCK_MS = 15 * 60 * 1000
export const PBKDF2_ITERATIONS = 100_000

export const MAX_SUBS = 5
export const STARTERS_COUNT = 11
export const BENCH_COUNT = 7

export const CLUB_NAME_MIN = 3
export const CLUB_NAME_MAX = 32
export const CREST_COLOR_MIN = 2
export const CREST_COLOR_MAX = 5

export const DRAW_BANDS = [
  { count: 1, min: 89, max: 91, label: 'Over 89–91' },
  { count: 2, min: 85, max: 87, label: 'Over 85–87' },
  { count: 4, min: 83, max: 83, label: 'Over 83' },
  { count: 10, min: 74, max: 79, label: 'Over 74–79' },
  { count: 5, min: 65, max: 73, label: 'Over 65–73' },
]

export const STRATEGIES = ['ofensiva', 'equilibrada', 'recuada']

export const STRATEGY_PRESETS = [
  { id: 'ofensiva', label: 'Ofensiva desde o início', first: 'ofensiva', second: 'ofensiva' },
  { id: 'equilibrada', label: 'Equilibrada durante todo o jogo', first: 'equilibrada', second: 'equilibrada' },
  { id: 'recuada', label: 'Recuada durante todo o jogo', first: 'recuada', second: 'recuada' },
  { id: 'recuada-ofensiva', label: '1º tempo recuado e 2º ofensivo', first: 'recuada', second: 'ofensiva' },
  { id: 'equilibrada-ofensiva', label: '1º tempo equilibrado e 2º ofensivo', first: 'equilibrada', second: 'ofensiva' },
  { id: 'ofensiva-recuada', label: '1º tempo ofensivo e 2º recuado', first: 'ofensiva', second: 'recuada' },
]

export const FORMATION_IDS = FORMATION_KEYS
export const DEFAULT_FORMATION = '4-3-3'

export const PLAYER_STATUS = {
  FREE: 'livre',
  OWNED: 'clube',
  AUCTION: 'leilao',
  UNAVAILABLE: 'indisponivel',
}

export const MARKET_STATUS = {
  OPEN: 'aberto',
  PAUSED: 'pausado',
  CLOSED: 'fechado',
}

export const SIM_VERSION = 'draft-xv-sim-1'

export const DEFAULT_SETTINGS = {
  allowSharedPlayers: false,
  auctionDurationMs: AUCTION_DURATION_MS,
  minBidIncrement: MIN_BID_INCREMENT,
  proposalTtlMs: PROPOSAL_TTL_MS,
  auctionOvertime: false,
  minRoster: MIN_ROSTER,
  maxRoster: MAX_ROSTER,
  startersCount: STARTERS_COUNT,
  benchCount: BENCH_COUNT,
  maxSubs: MAX_SUBS,
  suspensionScope: 'next_official_any_championship',
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
}

export const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST']
