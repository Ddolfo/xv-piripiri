import { COACH_CLUBS, XV_CLUB, applyRecorte, fixEaText, fixEaTree, isXvClubId } from './eaApi'

const XV_KEY = 'xv-piripiri-coach-v5'
const STALE_CLUB_IDS = ['14693']

function clubKey(clubId) {
  return isXvClubId(clubId) ? XV_KEY : `xv-coach-club-${clubId}`
}

function emptyEa(clubId) {
  const id = String(clubId)
  const blank = {
    clubId: id,
    overall: null,
    info: null,
    playoffs: [],
    matches: [],
    recent: null,
    season: null,
    board: null,
    positionCount: null,
    recorteAt: null,
  }
  if (isXvClubId(id)) return applyRecorte(blank)
  return blank
}

export function emptyClubState(club = XV_CLUB) {
  return {
    players: [],
    formation: '4-2-3-1',
    lineup: {},
    club: {
      name: club.name,
      clubId: String(club.clubId),
      platform: club.platform || 'common-gen5',
      lastSync: null,
      currentDivision: null,
    },
    ea: emptyEa(club.clubId),
    history: [],
  }
}

export function empty() {
  return emptyClubState(XV_CLUB)
}

export function loadClubState(club) {
  const def = club || XV_CLUB
  const base = emptyClubState(def)
  try {
    const raw = localStorage.getItem(clubKey(def.clubId))
    if (!raw) return base
    const parsed = JSON.parse(raw)
    const parsedId = String(parsed.club?.clubId || '')
    const stale = STALE_CLUB_IDS.includes(parsedId)
    const keepId = stale ? String(def.clubId) : parsedId || String(def.clubId)
    const xv = isXvClubId(def.clubId)
    return {
      ...base,
      ...parsed,
      club: {
        ...base.club,
        ...(stale ? {} : parsed.club),
        name: xv ? XV_CLUB.name : parsed.club?.name || def.name,
        clubId: keepId,
        platform: parsed.club?.platform || def.platform || base.club.platform,
      },
      ea: stale
        ? emptyEa(def.clubId)
        : xv
          ? applyRecorte(fixEaTree({ ...base.ea, ...parsed.ea, clubId: keepId }))
          : fixEaTree({ ...base.ea, ...parsed.ea, clubId: keepId }),
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
    return base
  }
}

export function loadState() {
  return loadClubState(XV_CLUB)
}

export function saveClubState(club, state) {
  localStorage.setItem(clubKey(club.clubId), JSON.stringify(state))
}

export function saveState(state) {
  saveClubState(XV_CLUB, state)
}

export function loadAllClubStates() {
  const bags = {}
  for (const club of COACH_CLUBS) {
    bags[String(club.clubId)] = loadClubState(club)
  }
  return bags
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
