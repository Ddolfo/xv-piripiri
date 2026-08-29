import { fixEaText, fixEaTree } from './eaApi'

const KEY = 'xv-piripiri-coach-v1'

const empty = () => ({
  players: [],
  formation: '4-2-3-1',
  lineup: {},
  club: {
    name: 'XV de PiriPiri',
    clubId: '14693',
    platform: 'common-gen5',
    lastSync: null,
    currentDivision: null,
  },
  ea: {
    overall: null,
    info: null,
    playoffs: [],
    matches: [],
    recent: null,
    season: null,
    board: null,
    positionCount: null,
  },
})

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw)
    const base = empty()
    return {
      ...base,
      ...parsed,
      club: {
        ...base.club,
        ...parsed.club,
        name: fixEaText(parsed.club?.name || base.club.name),
        clubId: parsed.club?.clubId || base.club.clubId,
      },
      ea: fixEaTree({ ...base.ea, ...parsed.ea }),
      players: (parsed.players || []).map((p) => ({
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
