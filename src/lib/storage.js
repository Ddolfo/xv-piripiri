import { applyRecorte, fixEaText, fixEaTree } from './eaApi'

const KEY = 'xv-piripiri-coach-v5'
const STALE_CLUB_IDS = ['14693']

const emptyEa = () =>
  applyRecorte({
    clubId: '51895',
    overall: null,
    info: null,
    playoffs: [],
    matches: [],
    recent: null,
    season: null,
    board: null,
    positionCount: null,
    recorteAt: null,
  })

const empty = () => ({
  players: [],
  formation: '4-2-3-1',
  lineup: {},
  club: {
    name: 'XV de PiriPiri',
    clubId: '51895',
    platform: 'common-gen5',
    lastSync: null,
    currentDivision: null,
  },
  ea: emptyEa(),
  history: [],
})

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw)
    const base = empty()
    const parsedId = String(parsed.club?.clubId || '')
    const stale = STALE_CLUB_IDS.includes(parsedId)
    return {
      ...base,
      ...parsed,
      club: {
        ...base.club,
        ...(stale ? {} : parsed.club),
        name: 'XV de PiriPiri',
        clubId: stale ? base.club.clubId : parsedId || base.club.clubId,
      },
      ea: stale
        ? emptyEa()
        : applyRecorte(fixEaTree({ ...base.ea, ...parsed.ea, clubId: parsedId || base.club.clubId })),
      history: stale ? [] : Array.isArray(parsed.history) ? parsed.history : [],
      players: stale
        ? []
        : (parsed.players || []).map((p) => ({
            ...p,
            name: fixEaText(p.name || ''),
            psn: p.psn ? fixEaText(p.psn) : p.psn,
          })),
    }
  } catch {
    return empty()
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
