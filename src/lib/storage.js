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
  },
})

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    return { ...empty(), ...JSON.parse(raw) }
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
