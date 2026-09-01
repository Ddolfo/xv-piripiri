const EA_HOST =
  typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')
    ? 'https://xv-piripiri.resisted-lycra.workers.dev'
    : ''

const BASE = `${EA_HOST}/ea/api/fc`

export const XV_CLUB = {
  name: 'XV de PiriPiri',
  clubId: '14693',
  platform: 'common-gen5',
}

const MOJIBAKE_PAIRS = [
  ['Ã¡', 'á'],
  ['Ã©', 'é'],
  ['Ã­', 'í'],
  ['Ã³', 'ó'],
  ['Ãº', 'ú'],
  ['Ã£', 'ã'],
  ['Ãµ', 'õ'],
  ['Ã¢', 'â'],
  ['Ãª', 'ê'],
  ['Ã´', 'ô'],
  ['Ã§', 'ç'],
  ['Ã\u00AD', 'í'],
  ['Ã\u00A0', 'à'],
  ['Ã\u00A1', 'á'],
  ['Ã‰', 'É'],
  ['Ã“', 'Ó'],
  ['Ãš', 'Ú'],
  ['Ã‡', 'Ç'],
  ['Ãƒ', 'Ã'],
  ['Âº', 'º'],
  ['Âª', 'ª'],
  ['EstÃdio', 'Estádio'],
  ['nÃvel', 'nível'],
]

/**
 * EA sometimes returns UTF-8 text already misread as Latin-1/Windows-1252
 * ("EstÃdio de nÃvel 3" → "Estádio de nível 3").
 */
export function fixEaText(value) {
  if (typeof value !== 'string' || !value) return value || ''
  let out = value
  for (let n = 0; n < 2 && /[ÃÂ]/.test(out); n += 1) {
    try {
      const bytes = new Uint8Array(out.length)
      for (let i = 0; i < out.length; i += 1) {
        const code = out.charCodeAt(i)
        if (code > 255) break
        bytes[i] = code
      }
      if (bytes.every((_, i) => out.charCodeAt(i) <= 255)) {
        out = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        continue
      }
    } catch {
      /* cai no dicionário abaixo */
    }
    break
  }
  if (/[ÃÂ]/.test(out)) {
    MOJIBAKE_PAIRS.forEach(([from, to]) => {
      if (out.includes(from)) out = out.split(from).join(to)
    })
  }
  return out
}

export function fixEaTree(value) {
  if (typeof value === 'string') return fixEaText(value)
  if (Array.isArray(value)) return value.map(fixEaTree)
  if (value && typeof value === 'object') {
    const out = {}
    Object.entries(value).forEach(([k, v]) => {
      out[k] = fixEaTree(v)
    })
    return out
  }
  return value
}

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
  return fixEaTree(await res.json())
}

async function settled(promise) {
  try {
    return await promise
  } catch {
    return null
  }
}

function asList(data) {
  if (Array.isArray(data)) return data
  if (data?.clubs) return data.clubs
  return data ? [data] : []
}

export async function searchClubs(clubName, platform = 'common-gen5') {
  return asList(
    await getJson(`${BASE}/allTimeLeaderboard/search`, {
      platform,
      clubName,
    }),
  )
}

export async function searchSeasonClubs(clubName, platform = 'common-gen5') {
  return asList(
    await getJson(`${BASE}/currentSeasonLeaderboard/search`, {
      platform,
      clubName,
    }),
  )
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

export async function loadClubBundle(clubId, platform = 'common-gen5', clubName = '') {
  const id = String(clubId)
  const name = clubName || XV_CLUB.name
  const [
    membersPayload,
    careerPayload,
    overallPayload,
    infoPayload,
    playoffsPayload,
    league,
    playoff,
    friendly,
    seasonList,
    boardList,
  ] = await Promise.all([
    settled(getMembersStats(id, platform)),
    settled(getMembersCareer(id, platform)),
    settled(getClubOverall(id, platform)),
    settled(getClubInfo(id, platform)),
    settled(getPlayoffAchievements(id, platform)),
    settled(getClubMatches(id, 'leagueMatch', platform, 10)),
    settled(getClubMatches(id, 'playoffMatch', platform, 10)),
    settled(getClubMatches(id, 'friendlyMatch', platform, 10)),
    settled(searchSeasonClubs(name, platform)),
    settled(searchClubs(name, platform)),
  ])

  const members = normalizeMembers(membersPayload)
  const career = normalizeCareer(careerPayload)
  const careerByName = Object.fromEntries(career.map((m) => [m.name.toLowerCase(), m]))
  const builds = collectBuilds([league, playoff, friendly], id)
  const merged = members.map((m) => ({
    ...m,
    career: careerByName[m.name.toLowerCase()] || null,
    build: builds[(m.name || '').trim().toLowerCase()] || null,
  }))
  if (!merged.length) {
    career.forEach((c) =>
      merged.push({
        ...c,
        career: c,
        build: builds[(c.name || '').trim().toLowerCase()] || null,
      }),
    )
  }

  const info = normalizeInfo(infoPayload, id)
  const matches = [
    ...normalizeMatches(league, id, 'leagueMatch'),
    ...normalizeMatches(playoff, id, 'playoffMatch'),
    ...normalizeMatches(friendly, id, 'friendlyMatch'),
  ].sort((a, b) => b.timestamp - a.timestamp)

  return {
    members: merged,
    overall: normalizeOverall(overallPayload, id),
    info,
    playoffs: normalizePlayoffs(playoffsPayload),
    matches,
    recent: summarizeMatches(matches),
    season: normalizeBoard(pickFromSearch(seasonList, id)),
    board: normalizeBoard(pickFromSearch(boardList, id)),
    builds,
    positionCount: membersPayload?.positionCount || careerPayload?.positionCount || null,
  }
}

export function bundleToEa(bundle) {
  return {
    overall: bundle.overall,
    info: bundle.info,
    playoffs: bundle.playoffs,
    matches: bundle.matches,
    recent: bundle.recent,
    season: bundle.season,
    board: bundle.board,
    builds: bundle.builds || {},
    positionCount: bundle.positionCount,
  }
}

function collectBuilds(payloads, clubId) {
  const us = String(clubId)
  const byName = {}
  payloads.forEach((payload) => {
    const list = Array.isArray(payload) ? payload : []
    list.forEach((m) => {
      const roster = m.players?.[us] || {}
      const ts = num(m.timestamp)
      Object.values(roster).forEach((p) => {
        const name = fixEaText(p.playername || p.name || '').trim()
        const key = name.toLowerCase()
        const id = num(p.archetypeid)
        if (!key || !id) return
        const row = byName[key] || { name, lastId: 0, lastTs: 0, counts: {} }
        row.counts[id] = (row.counts[id] || 0) + 1
        if (ts >= row.lastTs) {
          row.lastTs = ts
          row.lastId = id
        }
        byName[key] = row
      })
    })
  })
  const out = {}
  Object.entries(byName).forEach(([key, row]) => {
    out[key] = packBuild(row.lastId, row.counts)
  })
  return out
}

function packBuild(lastId, counts) {
  const history = Object.entries(counts)
    .map(([id, games]) => ({
      id: Number(id),
      label: archetypeLabel(id),
      line: ARCHETYPE_LINE[Number(id)] || '',
      games,
    }))
    .sort((a, b) => b.games - a.games || a.id - b.id)
  const games = history.reduce((a, h) => a + h.games, 0)
  return {
    lastId,
    lastLabel: archetypeLabel(lastId),
    lastLine: ARCHETYPE_LINE[lastId] || '',
    games,
    history,
  }
}

export function summarizePlayerBuild(matches) {
  const counts = {}
  let lastId = 0
  let lastTs = 0
  ;(matches || []).forEach((m) => {
    const id = Number(m.archetypeId)
    if (!id) return
    counts[id] = (counts[id] || 0) + 1
    if ((m.timestamp || 0) >= lastTs) {
      lastTs = m.timestamp || 0
      lastId = id
    }
  })
  if (!lastId) return null
  return packBuild(lastId, counts)
}

export function buildHistoryHint(build) {
  if (!build?.lastLabel) return ''
  const others = (build.history || []).filter((h) => h.id !== build.lastId)
  if (!others.length) {
    return `${build.games} partida${build.games === 1 ? '' : 's'} recente${build.games === 1 ? '' : 's'}`
  }
  return `Última vista · também ${others.map((h) => `${h.label} (${h.games})`).join(', ')}`
}

export function normalizeMembers(payload) {
  if (!payload) return []
  const list =
    payload.members ||
    payload.memberList ||
    payload.players ||
    (Array.isArray(payload) ? payload : [])
  return list.map((m) => {
    const name = fixEaText(
      m.name || m.playerName || m.memberName || m.proName || m.gamertag || '',
    )
    const lastTenGoals = lastTenFrom(m)
    return {
      name,
      psn: fixEaText(m.proName || m.name || m.gamertag || name),
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
      proNationality: m.proNationality,
      proPos: num(m.proPos),
      proStyle: num(m.proStyle),
      favoritePosition: m.favoritePosition || m.position || '',
      lastTenGoals,
      lastTenSum: lastTenGoals.reduce((a, n) => a + n, 0),
      raw: m,
    }
  })
}

function normalizeCareer(payload) {
  if (!payload) return []
  const list = payload.members || (Array.isArray(payload) ? payload : [])
  return list.map((m) => {
    const lastTenGoals = lastTenFrom(m)
    return {
      name: fixEaText(m.name || m.proName || ''),
      games: num(m.gamesPlayed),
      goals: num(m.goals),
      assists: num(m.assists),
      motm: num(m.manOfTheMatch),
      rating: num(m.ratingAve),
      proPos: num(m.proPos),
      favoritePosition: m.favoritePosition || '',
      lastTenGoals,
      lastTenSum: lastTenGoals.reduce((a, n) => a + n, 0),
    }
  })
}

function normalizeOverall(payload, clubId) {
  const row = Array.isArray(payload)
    ? payload[0]
    : payload?.[clubId] || payload?.clubs?.[clubId] || payload
  if (!row || typeof row !== 'object') return null
  const wins = num(row.wins)
  const ties = num(row.ties)
  const losses = num(row.losses)
  const games = num(row.gamesPlayed)
  const goals = num(row.goals)
  const goalsAgainst = num(row.goalsAgainst)
  return {
    wins,
    ties,
    losses,
    games,
    leagueGames: num(row.leagueAppearances),
    playoffGames: num(row.gamesPlayedPlayoff),
    goals,
    goalsAgainst,
    goalDiff: goals - goalsAgainst,
    winPct: games ? Math.round((wins / games) * 100) : 0,
    pointsClassic: wins * 3 + ties,
    goalsPerGame: games ? goals / games : 0,
    concededPerGame: games ? goalsAgainst / games : 0,
    promotions: num(row.promotions),
    relegations: num(row.relegations),
    bestDivision: num(row.bestDivision),
    bestFinishGroup: num(row.bestFinishGroup),
    skillRating: num(row.skillRating),
    reputation: num(row.reputationtier),
    winStreak: num(row.wstreak),
    unbeatenStreak: num(row.unbeatenstreak),
    finishes: [1, 2, 3, 4, 5, 6].map((d) => ({
      code: d,
      label: divisionLabel(d),
      titles: num(row[`finishesInDivision${d}Group1`]),
    })),
    lastOpponentIds: Array.from({ length: 10 }, (_, i) => String(row[`lastOpponent${i}`] || '')).filter(
      (v) => v && v !== '0',
    ),
    form: Array.from({ length: 10 }, (_, i) => formCode(row[`lastMatch${i}`])).filter(Boolean),
  }
}

function normalizeInfo(payload, clubId) {
  const row = payload?.[clubId] || payload?.[String(clubId)] || payload
  if (!row || typeof row !== 'object') return null
  const kit = row.customKit || {}
  return {
    name: fixEaText(row.name || row.clubName || ''),
    stadium: fixEaText(kit.stadName || ''),
    clubId: String(row.clubId || clubId || ''),
    teamId: row.teamId,
    regionId: row.regionId,
    kit: {
      home: [kit.kitColor1, kit.kitColor2, kit.kitColor3, kit.kitColor4].map(eaColor).filter(Boolean),
      away: [kit.kitAColor1, kit.kitAColor2, kit.kitAColor3, kit.kitAColor4].map(eaColor).filter(Boolean),
      third: [kit.kitThrdColor1, kit.kitThrdColor2, kit.kitThrdColor3, kit.kitThrdColor4]
        .map(eaColor)
        .filter(Boolean),
    },
  }
}

function normalizePlayoffs(payload) {
  const list = Array.isArray(payload) ? payload : []
  return list.map((p) => {
    const bestDivision = num(p.bestDivision)
    const bestFinishGroup = num(p.bestFinishGroup)
    return {
      seasonId: String(p.seasonId || ''),
      seasonName: String(p.seasonName || '').replace('CLUBS_LEAGUE_SEASON_', 'Temporada '),
      bestDivision,
      bestDivisionLabel: divisionLabel(bestDivision),
      bestFinishGroup,
      bestFinishLabel: groupFinishLabel(bestFinishGroup),
    }
  })
}

function playerSaves(line) {
  return (
    num(line?.saves) +
    num(line?.ballDiveSaves) +
    num(line?.crossSaves) +
    num(line?.parrySaves) +
    num(line?.punchSaves) +
    num(line?.reflexSaves) +
    num(line?.goodDirectionSaves)
  )
}

function normalizeMatchPlayer(line, playerId) {
  const passes = num(line?.passesmade)
  const passAttempts = num(line?.passattempts)
  const tackles = num(line?.tacklesmade)
  const tackleAttempts = num(line?.tackleattempts)
  const goals = num(line?.goals)
  const assists = num(line?.assists)
  const saves = playerSaves(line)
  const secondsPlayed = num(line?.secondsPlayed || line?.gameTime)
  return {
    id: String(playerId || line?.playername || ''),
    name: fixEaText(line?.playername || line?.name || ''),
    position: line?.pos || '',
    archetypeId: num(line?.archetypeid),
    archetype: archetypeLabel(line?.archetypeid),
    goals,
    assists,
    involvement: goals + assists,
    shots: num(line?.shots),
    rating: num(line?.rating),
    motm: num(line?.mom),
    passes,
    passAttempts,
    passPct: passAttempts ? Math.round((passes / passAttempts) * 100) : null,
    tackles,
    tackleAttempts,
    tacklePct: tackleAttempts ? Math.round((tackles / tackleAttempts) * 100) : null,
    saves,
    saveBreakdown: {
      total: num(line?.saves),
      dive: num(line?.ballDiveSaves),
      cross: num(line?.crossSaves),
      parry: num(line?.parrySaves),
      punch: num(line?.punchSaves),
      reflex: num(line?.reflexSaves),
      direction: num(line?.goodDirectionSaves),
    },
    redCards: num(line?.redcards),
    minutes: Math.round(secondsPlayed / 60),
    secondsPlayed,
    idle: num(line?.realtimeidle),
    cleanSheet:
      num(line?.cleansheetsany) === 1 ||
      num(line?.cleansheetsdef) === 1 ||
      num(line?.cleansheetsgk) === 1,
    goalsConceded: num(line?.goalsconceded),
    isKeeper: String(line?.pos || '').toLowerCase() === 'goalkeeper' || saves > 0,
  }
}

function kitFromDetails(details) {
  const kit = details?.customKit || {}
  return [kit.kitColor1, kit.kitColor2, kit.kitColor3, kit.kitColor4].map(eaColor).filter(Boolean)
}

function normalizeMatchSide(clubId, clubs, players, aggregate) {
  const id = String(clubId || '')
  const club = clubs?.[id] || {}
  const details = club.details || {}
  const agg = aggregate?.[id] || {}
  const rosterObj = players?.[id] || {}
  const roster = Object.entries(rosterObj)
    .map(([pid, p]) => normalizeMatchPlayer(p, pid))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name, 'pt-BR'))
  const rated = roster.filter((p) => p.rating)
  const passes = num(agg.passesmade)
  const passAttempts = num(agg.passattempts)
  const tackles = num(agg.tacklesmade)
  const tackleAttempts = num(agg.tackleattempts)
  return {
    clubId: id,
    name: fixEaText(details.name || '') || id,
    stadium: fixEaText(details.customKit?.stadName || ''),
    kit: kitFromDetails(details),
    goals: num(club.goals ?? club.score),
    goalsAgainst: num(club.goalsAgainst),
    result: matchResult(club),
    winnerByDnf: num(club.winnerByDnf) === 1,
    seasonId: club.season_id != null ? String(club.season_id) : '',
    shots: num(agg.shots),
    assists: num(agg.assists),
    passes,
    passAttempts,
    passPct: passAttempts ? Math.round((passes / passAttempts) * 100) : 0,
    tackles,
    tackleAttempts,
    tacklePct: tackleAttempts ? Math.round((tackles / tackleAttempts) * 100) : 0,
    saves: playerSaves(agg),
    redCards: num(agg.redcards),
    motm: num(agg.mom),
    goalsConceded: num(agg.goalsconceded),
    secondsPlayed: num(agg.secondsPlayed || agg.gameTime),
    avgRating: rated.length
      ? rated.reduce((a, p) => a + p.rating, 0) / rated.length
      : roster.length && num(agg.rating)
        ? num(agg.rating) / roster.length
        : 0,
    players: roster,
    playerCount: roster.length,
  }
}

function normalizeMatches(payload, clubId, type) {
  const list = Array.isArray(payload) ? payload : []
  const us = String(clubId)
  return list.map((m) => {
    const clubs = m.clubs || {}
    const oppId = Object.keys(clubs).find((k) => k !== us) || ''
    const ours = normalizeMatchSide(us, clubs, m.players, m.aggregate)
    const theirs = oppId
      ? normalizeMatchSide(oppId, clubs, m.players, m.aggregate)
      : normalizeMatchSide('', {}, {}, {})
    return {
      id: String(m.matchId || `${type}-${m.timestamp}`),
      type,
      timestamp: num(m.timestamp),
      timeAgo: m.timeAgo || null,
      usGoals: ours.goals,
      themGoals: theirs.goals,
      opponent: theirs.name || 'Adversário',
      opponentId: oppId,
      result: ours.result,
      winnerByDnf: ours.winnerByDnf,
      seasonId: ours.seasonId,
      shots: ours.shots,
      assists: ours.assists,
      passAttempts: ours.passAttempts,
      passes: ours.passes,
      tackles: ours.tackles,
      tackleAttempts: ours.tackleAttempts,
      saves: ours.saves,
      redCards: ours.redCards,
      motm: ours.motm,
      playersOnPitch: ours.playerCount,
      avgRating: ours.avgRating,
      us: ours,
      them: theirs,
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

function lastTenFrom(m) {
  const arr = []
  for (let i = 1; i <= 10; i += 1) {
    const key = `prevGoals${i}`
    if (m[key] == null || m[key] === '') continue
    arr.push(num(m[key]))
  }
  return arr
}

export function eaColor(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `#${n.toString(16).padStart(6, '0')}`
}

function pickFromSearch(list, clubId) {
  const arr = Array.isArray(list) ? list : []
  const id = String(clubId)
  return arr.find((x) => String(pickClubId(x)) === id) || arr[0] || null
}

function normalizeBoard(row) {
  if (!row || typeof row !== 'object') return null
  const wins = num(row.wins)
  const ties = num(row.ties)
  const losses = num(row.losses)
  const games = num(row.gamesPlayed)
  const goals = num(row.goals)
  const goalsAgainst = num(row.goalsAgainst)
  return {
    wins,
    ties,
    losses,
    games,
    playoffGames: num(row.gamesPlayedPlayoff),
    goals,
    goalsAgainst,
    goalDiff: goals - goalsAgainst,
    cleanSheets: num(row.cleanSheets),
    points: num(row.points),
    pointsClassic: wins * 3 + ties,
    winPct: games ? Math.round((wins / games) * 100) : 0,
    goalsPerGame: games ? goals / games : 0,
    concededPerGame: games ? goalsAgainst / games : 0,
    promotions: num(row.promotions),
    relegations: num(row.relegations),
    bestDivision: num(row.bestDivision),
    currentDivision: num(row.currentDivision),
    reputation: num(row.reputationtier),
    name: pickClubName(row),
  }
}

function summarizeMatches(matches) {
  const list = matches || []
  if (!list.length) return null
  const wins = list.filter((m) => m.result === 'V').length
  const ties = list.filter((m) => m.result === 'E').length
  const losses = list.filter((m) => m.result === 'D').length
  const gf = list.reduce((a, m) => a + (m.usGoals || 0), 0)
  const ga = list.reduce((a, m) => a + (m.themGoals || 0), 0)
  const shots = list.reduce((a, m) => a + (m.shots || 0), 0)
  const passes = list.reduce((a, m) => a + (m.passes || 0), 0)
  const passAttempts = list.reduce((a, m) => a + (m.passAttempts || 0), 0)
  const tackles = list.reduce((a, m) => a + (m.tackles || 0), 0)
  return {
    games: list.length,
    wins,
    ties,
    losses,
    goals: gf,
    goalsAgainst: ga,
    goalDiff: gf - ga,
    shots,
    passes,
    passAttempts,
    passPct: passAttempts ? Math.round((passes / passAttempts) * 100) : 0,
    tackles,
    avgRating:
      list.filter((m) => m.avgRating).reduce((a, m) => a + m.avgRating, 0) /
        (list.filter((m) => m.avgRating).length || 1) || 0,
  }
}

function namesMatch(a, b) {
  const na = String(a || '').trim().toLowerCase()
  const nb = String(b || '').trim().toLowerCase()
  return na && nb && (na === nb || na.includes(nb) || nb.includes(na))
}

function emptyStats() {
  return {
    games: 0,
    winRate: 0,
    goals: 0,
    assists: 0,
    rating: 0,
    motm: 0,
    cleanSheetsDef: 0,
    cleanSheetsGK: 0,
    shotSuccess: 0,
    passes: 0,
    passSuccess: 0,
    tackles: 0,
    tackleSuccess: 0,
    redCards: 0,
    proOverall: 0,
    favoritePosition: '',
  }
}

function diffStats(career, club) {
  if (!career) return null
  const c = club || emptyStats()
  const games = Math.max(0, (career.games || 0) - (c.games || 0))
  if (games <= 0) return null
  return {
    games,
    goals: Math.max(0, (career.goals || 0) - (c.goals || 0)),
    assists: Math.max(0, (career.assists || 0) - (c.assists || 0)),
    motm: Math.max(0, (career.motm || 0) - (c.motm || 0)),
    rating: career.rating || c.rating || 0,
    favoritePosition: career.favoritePosition || c.favoritePosition || '',
    estimated: true,
  }
}

function playerFromMatches(payload, clubId, playerName, type) {
  const list = Array.isArray(payload) ? payload : []
  const us = String(clubId)
  return list
    .map((m) => {
      const clubs = m.clubs || {}
      const ours = clubs[us] || {}
      const oppId = Object.keys(clubs).find((k) => k !== us) || ''
      const theirs = clubs[oppId] || {}
      const roster = m.players?.[us] || {}
      const entry = Object.entries(roster).find(([, p]) =>
        namesMatch(p.playername || p.name, playerName),
      )
      if (!entry) return null
      const line = normalizeMatchPlayer(entry[1], entry[0])
      return {
        ...line,
        id: String(m.matchId || `${type}-${m.timestamp}`),
        type,
        timestamp: num(m.timestamp),
        timeAgo: m.timeAgo || null,
        opponent: fixEaText(theirs.details?.name || '') || oppId || 'Adversário',
        usGoals: num(ours.goals ?? ours.score),
        themGoals: num(theirs.goals ?? theirs.score),
        result: matchResult(ours),
        winnerByDnf: num(ours.winnerByDnf) === 1,
      }
    })
    .filter(Boolean)
}

export async function loadPlayerDossier(playerName, clubId, clubName, platform = 'common-gen5') {
  const id = String(clubId)
  const [membersPayload, careerPayload, league, playoff, friendly] = await Promise.all([
    settled(getMembersStats(id, platform)),
    settled(getMembersCareer(id, platform)),
    settled(getClubMatches(id, 'leagueMatch', platform, 10)),
    settled(getClubMatches(id, 'playoffMatch', platform, 10)),
    settled(getClubMatches(id, 'friendlyMatch', platform, 10)),
  ])

  const club =
    normalizeMembers(membersPayload).find((m) => namesMatch(m.name, playerName) || namesMatch(m.psn, playerName)) ||
    null
  const career =
    normalizeCareer(careerPayload).find((m) => namesMatch(m.name, playerName)) || null
  const others = diffStats(career, club)
  const matches = [
    ...playerFromMatches(league, id, playerName, 'leagueMatch'),
    ...playerFromMatches(playoff, id, playerName, 'playoffMatch'),
    ...playerFromMatches(friendly, id, playerName, 'friendlyMatch'),
  ].sort((a, b) => b.timestamp - a.timestamp)

  const clubs = []
  if (club) {
    clubs.push({
      id,
      label: clubName || 'XV de PiriPiri',
      hint: 'Clube atual',
      stats: club,
      current: true,
    })
  }
  clubs.push({
    id: 'geral',
    label: 'Geral',
    hint: 'Todos os times',
    stats: career || club,
  })
  if (others) {
    clubs.push({
      id: 'outros',
      label: 'Passagens anteriores',
      hint: 'Sem nome na API da EA',
      stats: others,
      estimated: true,
    })
  }

  const rated = matches.filter((m) => m.rating)
  const passAttempts = matches.reduce((a, m) => a + (m.passAttempts || 0), 0)
  const passes = matches.reduce((a, m) => a + (m.passes || 0), 0)
  const tackleAttempts = matches.reduce((a, m) => a + (m.tackleAttempts || 0), 0)
  const tackles = matches.reduce((a, m) => a + (m.tackles || 0), 0)
  const recent = {
    games: matches.length,
    goals: matches.reduce((a, m) => a + (m.goals || 0), 0),
    assists: matches.reduce((a, m) => a + (m.assists || 0), 0),
    involvement: matches.reduce((a, m) => a + (m.involvement || 0), 0),
    motm: matches.reduce((a, m) => a + (m.motm || 0), 0),
    shots: matches.reduce((a, m) => a + (m.shots || 0), 0),
    tackles,
    tackleAttempts,
    saves: matches.reduce((a, m) => a + (m.saves || 0), 0),
    minutes: matches.reduce((a, m) => a + (m.minutes || 0), 0),
    passes,
    passAttempts,
    passPct: passAttempts ? Math.round((passes / passAttempts) * 100) : null,
    redCards: matches.reduce((a, m) => a + (m.redCards || 0), 0),
    rating: rated.length ? rated.reduce((a, m) => a + m.rating, 0) / rated.length : 0,
  }

  return {
    clubs,
    matches,
    club,
    career,
    recent,
    build: summarizePlayerBuild(matches),
    raw: club?.raw || null,
  }
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
  return fixEaText(
    entry?.clubName ||
      entry?.name ||
      entry?.clubInfo?.name ||
      entry?.clubInfo?.clubName ||
      'Clube',
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
  any: 'QQ',
  forward: 'Ataque',
  midfielder: 'Meio',
  defender: 'Defesa',
  goalkeeper: 'Goleiro',
}

/** FC 26 Clubs: 13 arquétipos, na ordem do player builder. */
export const ARCHETYPE_LABEL = {
  1: 'Shot Stopper',
  2: 'Sweeper Keeper',
  3: 'Progressor',
  4: 'Boss',
  5: 'Engine',
  6: 'Marauder',
  7: 'Recycler',
  8: 'Maestro',
  9: 'Creator',
  10: 'Spark',
  11: 'Magician',
  12: 'Finisher',
  13: 'Target',
}

export const ARCHETYPE_LINE = {
  1: 'Goleiro',
  2: 'Goleiro',
  3: 'Defesa',
  4: 'Defesa',
  5: 'Defesa',
  6: 'Defesa',
  7: 'Meio',
  8: 'Meio',
  9: 'Meio',
  10: 'Meio',
  11: 'Ataque',
  12: 'Ataque',
  13: 'Ataque',
}

export function archetypeLabel(id) {
  const n = Number(id)
  if (!Number.isFinite(n) || n <= 0) return ''
  return ARCHETYPE_LABEL[n] || `Arquétipo ${n}`
}

/**
 * Código da EA: 1 = Elite, 2 = Divisão 1, 3 = Divisão 2, 4 = Divisão 3…
 * No XV (14693) a temporada atual vem 4 (= 3ª) e o pico da carreira 2 (= 1ª).
 */
export function divisionLabel(code) {
  const n = Number(code)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n === 1) return 'Elite'
  return `Divisão ${n - 1}`
}

export function groupFinishLabel(group) {
  const n = Number(group)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `${n}º do grupo`
}

export const PRO_POS_LABEL = {
  0: 'GOL',
  2: 'ALA D',
  3: 'LD',
  4: 'ZAG D',
  5: 'ZAG',
  6: 'ZAG E',
  7: 'LE',
  8: 'ALA E',
  9: 'VOL D',
  10: 'VOL',
  11: 'VOL E',
  12: 'MD',
  13: 'MC D',
  14: 'MC',
  15: 'MC E',
  16: 'ME',
  17: 'MEI D',
  18: 'MEI',
  19: 'MEI E',
  20: 'PD',
  21: 'SA',
  22: 'PE',
  23: 'PD',
  24: 'CA D',
  25: 'CA',
  26: 'CA E',
  27: 'PE',
}

export const NATIONS = {
  14: 'Inglaterra',
  18: 'França',
  21: 'Alemanha',
  27: 'Itália',
  38: 'Portugal',
  45: 'Espanha',
  52: 'Argentina',
  54: 'Brasil',
  70: 'Holanda',
}

const NATION_ISO = {
  14: 'gb-eng',
  18: 'fr',
  21: 'de',
  27: 'it',
  38: 'pt',
  45: 'es',
  52: 'ar',
  54: 'br',
  70: 'nl',
}

export function nationFlagUrl(id) {
  const iso = NATION_ISO[Number(id)]
  if (!iso) return ''
  return `https://flagcdn.com/w80/${iso}.png`
}

export function playerInitials(name) {
  const parts = String(name || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return String(name || 'XV').slice(0, 2).toUpperCase()
}
