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

async function settled(promise) {
  try {
    return await promise
  } catch {
    return null
  }
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

export async function getPlayoffAchievements(clubId, platform = 'common-gen5') {
  return getJson(`${BASE}/club/playoffAchievements`, { platform, clubId })
}

export async function getClubMatches(
  clubId,
  matchType = 'leagueMatch',
  platform = 'common-gen5',
  maxResultCount = 10,
) {
  return getJson(`${BASE}/clubs/matches`, {
    platform,
    clubIds: clubId,
    matchType,
    maxResultCount,
  })
}

export async function loadClubBundle(clubId, platform = 'common-gen5') {
  const id = String(clubId)
  const [
    membersPayload,
    careerPayload,
    overallPayload,
    infoPayload,
    playoffsPayload,
    league,
    playoff,
    friendly,
  ] = await Promise.all([
    settled(getMembersStats(id, platform)),
    settled(getMembersCareer(id, platform)),
    settled(getClubOverall(id, platform)),
    settled(getClubInfo(id, platform)),
    settled(getPlayoffAchievements(id, platform)),
    settled(getClubMatches(id, 'leagueMatch', platform, 10)),
    settled(getClubMatches(id, 'playoffMatch', platform, 5)),
    settled(getClubMatches(id, 'friendlyMatch', platform, 5)),
  ])

  const members = normalizeMembers(membersPayload)
  const career = normalizeCareer(careerPayload)
  const careerByName = Object.fromEntries(career.map((m) => [m.name.toLowerCase(), m]))
  const merged = members.map((m) => ({
    ...m,
    career: careerByName[m.name.toLowerCase()] || null,
  }))
  if (!merged.length) {
    career.forEach((c) => merged.push({ ...c, career: c }))
  }

  return {
    members: merged,
    overall: normalizeOverall(overallPayload, id),
    info: normalizeInfo(infoPayload, id),
    playoffs: normalizePlayoffs(playoffsPayload),
    matches: [
      ...normalizeMatches(league, id, 'leagueMatch'),
      ...normalizeMatches(playoff, id, 'playoffMatch'),
      ...normalizeMatches(friendly, id, 'friendlyMatch'),
    ].sort((a, b) => b.timestamp - a.timestamp),
    positionCount: membersPayload?.positionCount || careerPayload?.positionCount || null,
  }
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
      psn: m.proName || m.name || m.gamertag || name,
      games: num(m.gamesPlayed ?? m.games ?? m.gamesPlayedClub),
      winRate: num(m.winRate),
      goals: num(m.goals ?? m.goalsClub),
      assists: num(m.assists ?? m.assistsClub),
      rating: num(m.ratingAve ?? m.ratingAverage ?? m.rating),
      motm: num(m.manOfTheMatch ?? m.motm),
      cleanSheetsDef: num(m.cleanSheetsDef),
      cleanSheetsGK: num(m.cleanSheetsGK),
      shotSuccess: num(m.shotSuccessRate),
      passes: num(m.passesMade),
      passSuccess: num(m.passSuccessRate),
      tackles: num(m.tacklesMade),
      tackleSuccess: num(m.tackleSuccessRate),
      redCards: num(m.redCards),
      proOverall: num(m.proOverall ?? m.proOverallStr),
      proHeight: num(m.proHeight),
      favoritePosition: m.favoritePosition || m.position || '',
      raw: m,
    }
  })
}

function normalizeCareer(payload) {
  if (!payload) return []
  const list = payload.members || (Array.isArray(payload) ? payload : [])
  return list.map((m) => ({
    name: m.name || m.proName || '',
    games: num(m.gamesPlayed),
    goals: num(m.goals),
    assists: num(m.assists),
    motm: num(m.manOfTheMatch),
    rating: num(m.ratingAve),
    favoritePosition: m.favoritePosition || '',
  }))
}

function normalizeOverall(payload, clubId) {
  const row = Array.isArray(payload)
    ? payload[0]
    : payload?.[clubId] || payload?.clubs?.[clubId] || payload
  if (!row || typeof row !== 'object') return null
  return {
    wins: num(row.wins),
    ties: num(row.ties),
    losses: num(row.losses),
    games: num(row.gamesPlayed),
    leagueGames: num(row.leagueAppearances),
    playoffGames: num(row.gamesPlayedPlayoff),
    goals: num(row.goals),
    goalsAgainst: num(row.goalsAgainst),
    promotions: num(row.promotions),
    relegations: num(row.relegations),
    bestDivision: num(row.bestDivision),
    skillRating: num(row.skillRating),
    reputation: num(row.reputationtier),
    winStreak: num(row.wstreak),
    unbeatenStreak: num(row.unbeatenstreak),
    form: Array.from({ length: 10 }, (_, i) => formCode(row[`lastMatch${i}`])).filter(Boolean),
  }
}

function normalizeInfo(payload, clubId) {
  const row = payload?.[clubId] || payload?.[String(clubId)] || payload
  if (!row || typeof row !== 'object') return null
  return {
    name: row.name || row.clubName || '',
    stadium: row.customKit?.stadName || '',
    teamId: row.teamId,
  }
}

function normalizePlayoffs(payload) {
  const list = Array.isArray(payload) ? payload : []
  return list.map((p) => ({
    seasonId: String(p.seasonId || ''),
    seasonName: String(p.seasonName || '').replace('CLUBS_LEAGUE_SEASON_', 'Temporada '),
    bestDivision: num(p.bestDivision),
    bestFinishGroup: num(p.bestFinishGroup),
  }))
}

function normalizeMatches(payload, clubId, type) {
  const list = Array.isArray(payload) ? payload : []
  const us = String(clubId)
  return list.map((m) => {
    const clubs = m.clubs || {}
    const ours = clubs[us] || {}
    const oppId = Object.keys(clubs).find((k) => k !== us) || ''
    const theirs = clubs[oppId] || {}
    const result = matchResult(ours)
    return {
      id: String(m.matchId || `${type}-${m.timestamp}`),
      type,
      timestamp: num(m.timestamp),
      timeAgo: m.timeAgo || null,
      usGoals: num(ours.goals ?? ours.score),
      themGoals: num(theirs.goals ?? theirs.score),
      opponent: theirs.details?.name || oppId || 'Adversário',
      result,
    }
  })
}

function matchResult(ours) {
  if (!ours) return ''
  if (num(ours.wins) === 1 || String(ours.result) === '1') return 'V'
  if (num(ours.ties) === 1) return 'E'
  if (num(ours.losses) === 1 || String(ours.result) === '2') return 'D'
  const gf = num(ours.goals ?? ours.score)
  const ga = num(ours.goalsAgainst)
  if (gf > ga) return 'V'
  if (gf < ga) return 'D'
  if (gf === ga && (ours.goals != null || ours.score != null)) return 'E'
  return ''
}

function formCode(v) {
  const n = Number(v)
  if (n === 1) return 'V'
  if (n === 2) return 'D'
  if (n === 3) return 'E'
  return ''
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

export function pickCurrentDivision(entry) {
  return num(entry?.currentDivision)
}

export const MATCH_TYPE_LABEL = {
  leagueMatch: 'Liga',
  playoffMatch: 'Playoff',
  friendlyMatch: 'Amistoso',
}

export const POS_LINE_LABEL = {
  forward: 'Ataque',
  midfielder: 'Meio',
  defender: 'Defesa',
  goalkeeper: 'Goleiro',
}
