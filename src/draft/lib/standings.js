function emptyRow(club) {
  return {
    clubId: club.id,
    name: club.name,
    crest: club.crest || null,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    fouls: 0,
    yellows: 0,
    reds: 0,
  }
}

export function computeStandings(championship, matches, clubs, settings) {
  const rows = {}
  for (const clubId of championship.clubIds) {
    const club = clubs[clubId]
    if (club) rows[clubId] = emptyRow(club)
  }

  const winPts = settings.pointsWin ?? 3
  const drawPts = settings.pointsDraw ?? 1
  const validated = matches.filter(
    (m) =>
      m.championshipId === championship.id &&
      m.status === 'validado' &&
      m.kind === 'oficial',
  )

  const h2h = {}
  const key = (a, b) => [a, b].sort().join(':')

  for (const match of validated) {
    const home = rows[match.homeClubId]
    const away = rows[match.awayClubId]
    if (!home || !away) continue
    home.played += 1
    away.played += 1
    home.gf += match.homeGoals
    home.ga += match.awayGoals
    away.gf += match.awayGoals
    away.ga += match.homeGoals
    const st = match.result?.stats
    if (st) {
      home.fouls += st.home?.fouls || 0
      home.yellows += st.home?.yellows || 0
      home.reds += st.home?.reds || 0
      away.fouls += st.away?.fouls || 0
      away.yellows += st.away?.yellows || 0
      away.reds += st.away?.reds || 0
    }
    const hk = key(match.homeClubId, match.awayClubId)
    if (!h2h[hk]) h2h[hk] = { [match.homeClubId]: 0, [match.awayClubId]: 0 }
    if (match.homeGoals > match.awayGoals) {
      home.wins += 1
      away.losses += 1
      home.points += winPts
      h2h[hk][match.homeClubId] += winPts
    } else if (match.homeGoals < match.awayGoals) {
      away.wins += 1
      home.losses += 1
      away.points += winPts
      h2h[hk][match.awayClubId] += winPts
    } else {
      home.draws += 1
      away.draws += 1
      home.points += drawPts
      away.points += drawPts
      h2h[hk][match.homeClubId] += drawPts
      h2h[hk][match.awayClubId] += drawPts
    }
  }

  for (const row of Object.values(rows)) {
    row.gd = row.gf - row.ga
  }

  const list = Object.values(rows)
  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gd !== a.gd) return b.gd - a.gd
    if (b.gf !== a.gf) return b.gf - a.gf
    if (b.wins !== a.wins) return b.wins - a.wins
    const k = key(a.clubId, b.clubId)
    const table = h2h[k]
    if (table) {
      const ha = table[a.clubId] || 0
      const hb = table[b.clubId] || 0
      if (hb !== ha) return hb - ha
    }
    return a.name.localeCompare(b.name, 'pt-BR')
  })

  return list.map((row, i) => ({ ...row, position: i + 1 }))
}

export function roundRobinFixtures(clubIds) {
  const teams = [...clubIds]
  if (teams.length < 2) return []
  const bye = teams.length % 2 === 1
  if (bye) teams.push(null)
  const n = teams.length
  const first = []
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i]
      const away = teams[n - 1 - i]
      if (home && away) {
        first.push({ round: round + 1, homeClubId: home, awayClubId: away, leg: 1 })
      }
    }
    const last = teams.pop()
    teams.splice(1, 0, last)
  }
  const second = first.map((f) => ({
    round: f.round + (n - 1),
    homeClubId: f.awayClubId,
    awayClubId: f.homeClubId,
    leg: 2,
  }))
  return [...first, ...second]
}

export function knockoutBracket(clubIds, rand) {
  const shuffled = [...clubIds]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(2, shuffled.length))))
  const byes = size - shuffled.length
  const slots = [...shuffled]
  for (let i = 0; i < byes; i++) slots.push(null)
  const fixtures = []
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i]
    const b = slots[i + 1]
    if (a && b) {
      fixtures.push({ round: 1, homeClubId: a, awayClubId: b, leg: 1, bracketIndex: i / 2 })
    } else {
      fixtures.push({
        round: 1,
        homeClubId: a || b,
        awayClubId: null,
        bye: true,
        leg: 1,
        bracketIndex: i / 2,
      })
    }
  }
  return { size, byes, fixtures }
}

/**
 * Números por jogador nas partidas validadas do campeonato:
 * gols, assistências, faltas, amarelos e vermelhos.
 */
export function computeLeaders(championship, matches, players, clubs) {
  const rows = {}
  const row = (playerId, clubId) => {
    if (!playerId) return null
    if (!rows[playerId]) {
      const p = players[playerId]
      rows[playerId] = {
        playerId,
        name: p?.name || 'Jogador',
        position: p?.position || '',
        clubId,
        clubName: clubs[clubId]?.name || '',
        goals: 0,
        assists: 0,
        fouls: 0,
        yellows: 0,
        reds: 0,
      }
    }
    return rows[playerId]
  }
  const done = matches.filter((m) => m.championshipId === championship.id && m.status === 'validado' && m.kind === 'oficial')
  for (const match of done) {
    const r = match.result || {}
    for (const e of r.events || []) {
      if (e.type === 'gol') {
        const scorer = row(e.playerId, e.clubId)
        if (scorer) scorer.goals += 1
        const helper = row(e.assistId, e.clubId)
        if (helper) helper.assists += 1
      } else if (e.type === 'amarelo') {
        const p = row(e.playerId, e.clubId)
        if (p) p.yellows += 1
      } else if (e.type === 'vermelho') {
        const p = row(e.playerId, e.clubId)
        if (p) p.reds += 1
      }
    }
    for (const f of r.fouls || []) {
      const p = row(f.playerId, f.clubId)
      if (p) p.fouls += 1
    }
  }
  return Object.values(rows)
}
