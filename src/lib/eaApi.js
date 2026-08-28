const BASE = '/ea/api/fc'

async function getJson(path, params = {}) {
  const url = new URL(path, window.location.origin)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  const res = await fetch(url.toString())
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`EA API ${res.status}: ${text.slice(0, 180)}`)
  }
  return res.json()
}

export async function searchClubs(clubName, platform = 'common-gen5') {
  const data = await getJson(`${BASE}/allTimeLeaderboard/search`, {
    platform,
    clubName,
  })
  if (Array.isArray(data)) return data
  if (data?.clubs) return data.clubs
  return data ? [data] : []
}

export async function getClubInfo(clubId, platform = 'common-gen5') {
  return getJson(`${BASE}/clubs/info`, { platform, clubIds: clubId })
}

export async function getClubOverall(clubId, platform = 'common-gen5') {
  return getJson(`${BASE}/clubs/overallStats`, { platform, clubIds: clubId })
}

export async function getMembersStats(clubId, platform = 'common-gen5') {
  return getJson(`${BASE}/members/stats`, { platform, clubId })
}

export async function getMembersCareer(clubId, platform = 'common-gen5') {
  return getJson(`${BASE}/members/career/stats`, { platform, clubId })
}

export function normalizeMembers(payload) {
  if (!payload) return []
  const list =
    payload.members ||
    payload.memberList ||
    payload.players ||
    (Array.isArray(payload) ? payload : [])
  return list.map((m) => {
    const name =
      m.name || m.playerName || m.memberName || m.proName || m.gamertag || ''
    return {
      name,
      psn: m.platform || m.blazeId || name,
      games: num(m.gamesPlayed ?? m.games ?? m.gamesPlayedClub),
      goals: num(m.goals ?? m.goalsClub),
      assists: num(m.assists ?? m.assistsClub),
      rating: num(m.ratingAve ?? m.ratingAverage ?? m.rating),
      motm: num(m.manOfTheMatch ?? m.motm),
      favoritePosition: m.favoritePosition || m.position || '',
      raw: m,
    }
  })
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function pickClubId(entry) {
  return (
    entry?.clubId ||
    entry?.clubInfo?.clubId ||
    entry?.clubIds ||
    entry?.id ||
    ''
  )
}

export function pickClubName(entry) {
  return (
    entry?.clubName ||
    entry?.name ||
    entry?.clubInfo?.name ||
    entry?.clubInfo?.clubName ||
    'Clube'
  )
}
