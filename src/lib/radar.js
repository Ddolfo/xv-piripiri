export function takeLastTen(matches) {
  return [...(matches || [])]
    .filter((m) => m && m.id)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 10)
}

export function pulseOf(matches) {
  const list = matches || []
  const wins = list.filter((m) => m.result === 'V').length
  const ties = list.filter((m) => m.result === 'E').length
  const losses = list.filter((m) => m.result === 'D').length
  const gf = list.reduce((a, m) => a + (Number(m.usGoals) || 0), 0)
  const ga = list.reduce((a, m) => a + (Number(m.themGoals) || 0), 0)
  const shots = list.reduce((a, m) => a + (Number(m.us?.shots || m.shots) || 0), 0)
  const passes = list.reduce((a, m) => a + (Number(m.us?.passes || m.passes) || 0), 0)
  const passAttempts = list.reduce((a, m) => a + (Number(m.us?.passAttempts || m.passAttempts) || 0), 0)
  const tackles = list.reduce((a, m) => a + (Number(m.us?.tackles || m.tackles) || 0), 0)
  const fouls = list.reduce((a, m) => a + (Number(m.us?.foulsCommitted) || 0), 0)
  const corners = list.reduce((a, m) => a + (Number(m.us?.corners) || 0), 0)
  const offsides = list.reduce((a, m) => a + (Number(m.us?.offsides) || 0), 0)
  const rated = list.filter((m) => m.us?.avgRating)
  const dnf = list.filter((m) => m.winnerByDnf).length
  return {
    games: list.length,
    wins,
    ties,
    losses,
    gf,
    ga,
    gd: gf - ga,
    shots,
    passes,
    passAttempts,
    passPct: passAttempts ? Math.round((passes / passAttempts) * 100) : 0,
    tackles,
    fouls,
    corners,
    offsides,
    dnf,
    avgRating: rated.length
      ? rated.reduce((a, m) => a + m.us.avgRating, 0) / rated.length
      : 0,
  }
}

export function carryBoard(matches) {
  const map = new Map()
  ;(matches || []).forEach((m) => {
    ;(m.us?.players || []).forEach((p) => {
      const name = String(p.name || '').trim()
      if (!name) return
      const key = name.toLowerCase()
      const row = map.get(key) || {
        name,
        games: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        shots: 0,
        passOk: 0,
        passAtt: 0,
        tackles: 0,
        tackleAtt: 0,
        saves: 0,
        motm: 0,
        fouls: 0,
        ratingSum: 0,
        ratedGames: 0,
        lastArchetype: '',
        lastPos: '',
        lastRating: 0,
      }
      row.games += 1
      row.minutes += Number(p.minutes) || 0
      row.goals += Number(p.goals) || 0
      row.assists += Number(p.assists) || 0
      row.shots += Number(p.shots) || 0
      row.passOk += Number(p.passes) || 0
      row.passAtt += Number(p.passAttempts) || 0
      row.tackles += Number(p.tackles) || 0
      row.tackleAtt += Number(p.tackleAttempts) || 0
      row.saves += Number(p.saves) || 0
      row.motm += Number(p.motm) || 0
      row.fouls += Number(p.fouls) || 0
      if (p.rating) {
        row.ratingSum += p.rating
        row.ratedGames += 1
        row.lastRating = p.rating
      }
      if (p.archetype) row.lastArchetype = p.archetype
      if (p.position) row.lastPos = p.position
      map.set(key, row)
    })
  })

  return [...map.values()]
    .map((r) => {
      const passPct = r.passAtt ? Math.round((r.passOk / r.passAtt) * 100) : 0
      const certosPorJogo = r.games ? r.passOk / r.games : 0
      return {
        ...r,
        involvement: r.goals + r.assists,
        rating: r.ratedGames ? r.ratingSum / r.ratedGames : 0,
        passPct,
        certosPorJogo,
        passWeight: certosPorJogo * (passPct / 100),
        tacklePct: r.tackleAtt ? Math.round((r.tackles / r.tackleAtt) * 100) : 0,
      }
    })
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        b.involvement - a.involvement ||
        b.games - a.games ||
        a.name.localeCompare(b.name, 'pt-BR'),
    )
}

export function motmOf(match) {
  const list = match?.us?.players || []
  return list.find((p) => p.motm) || [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || null
}
