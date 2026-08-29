const KEY = 'xv-piripiri-coach-v1'

const empty = () => ({
  players: [],
  formation: '4-2-3-1',
  lineup: {},
  club: {
    name: 'XV de PiriPiri',
    clubId: '',
    platform: 'common-gen5',
    lastSync: null,
    currentDivision: null,
  },
  ea: {
    overall: null,
    info: null,
    playoffs: [],
    matches: [],
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
      club: { ...base.club, ...parsed.club },
      ea: { ...base.ea, ...parsed.ea },
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
