import { POS_LINE_LABEL } from './eaApi'

const REGULAR_GAMES = 40
const RECENT_MIN = 3

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function dec(v, digits = 1) {
  const x = Number(v)
  return Number.isFinite(x) ? x.toFixed(digits) : '—'
}

function rosterList(players) {
  if (Array.isArray(players)) return players
  if (players && typeof players === 'object') return Object.values(players)
  return []
}

function pct(part, whole) {
  if (!whole) return null
  return Math.round((part / whole) * 100)
}

function avg(list, key) {
  const rows = list.filter((p) => p[key] != null && Number.isFinite(p[key]))
  if (!rows.length) return null
  return rows.reduce((a, p) => a + p[key], 0) / rows.length
}

function attemptsFrom(made, successPct) {
  const ok = n(made)
  const rate = n(successPct)
  if (!ok) return 0
  if (!rate) return ok
  return Math.round(ok / (rate / 100))
}

function keyName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
}

function scale(value, from, to) {
  if (value == null || !Number.isFinite(value)) return 0
  const t = (value - from) / (to - from)
  return Math.max(0, Math.min(100, t * 100))
}

function deltaTone(delta, dead = 0.15) {
  if (delta == null || !Number.isFinite(delta)) return 'ausente'
  if (delta >= dead) return 'sobe'
  if (delta <= -dead) return 'cai'
  return 'estavel'
}

function packCareer(p) {
  const s = p.stats || {}
  const games = n(s.games)
  const passOk = n(s.passes)
  const passPct = n(s.passSuccess)
  const passTry = attemptsFrom(passOk, passPct)
  const tklOk = n(s.tackles)
  const tklPct = n(s.tackleSuccess)
  const tklTry = attemptsFrom(tklOk, tklPct)
  const goals = n(s.goals)
  const assists = n(s.assists)
  const motm = n(s.motm)
  const rating = n(s.rating)
  const passPg = games ? passOk / games : 0
  const passMissPg = games ? Math.max(0, passTry - passOk) / games : 0
  const tklPg = games ? tklOk / games : 0
  const tklMissPg = games ? Math.max(0, tklTry - tklOk) / games : 0
  const involvement = goals + assists
  const gaPg = games ? involvement / games : 0
  const motmRate = games ? motm / games : 0
  return {
    id: p.id,
    name: p.name,
    player: p,
    line: POS_LINE_LABEL[s.favoritePosition] || s.favoritePosition || '—',
    lineKey: s.favoritePosition || '',
    games,
    rating,
    winRate: n(s.winRate),
    redCards: n(s.redCards),
    goals,
    assists,
    involvement,
    motm,
    gaPg,
    motmRate,
    passOk,
    passTry,
    passPct,
    passPg,
    passMissPg,
    passIndex: passPg * (passPct / 100),
    tklOk,
    tklTry,
    tklPct,
    tklPg,
    tklMissPg,
    tklIndex: tklPg * (tklPct / 100),
    shotPct: n(s.shotSuccess),
  }
}

function emptyRecent() {
  return {
    games: 0,
    ratingSum: 0,
    goals: 0,
    assists: 0,
    motm: 0,
    passOk: 0,
    passTry: 0,
    tklOk: 0,
    tklTry: 0,
    shots: 0,
    minutes: 0,
  }
}

function closeRecent(raw) {
  const games = raw.games
  const passPct = pct(raw.passOk, raw.passTry)
  const tklPct = pct(raw.tklOk, raw.tklTry)
  const passPg = games ? raw.passOk / games : 0
  const passMissPg = games ? Math.max(0, raw.passTry - raw.passOk) / games : 0
  const tklPg = games ? raw.tklOk / games : 0
  const tklMissPg = games ? Math.max(0, raw.tklTry - raw.tklOk) / games : 0
  const involvement = raw.goals + raw.assists
  const gaPg = games ? involvement / games : 0
  const rating = games ? raw.ratingSum / games : null
  return {
    ...raw,
    rating,
    passPct,
    tklPct,
    passPg,
    passMissPg,
    tklPg,
    tklMissPg,
    involvement,
    gaPg,
    passIndex: passPg * ((passPct || 0) / 100),
    tklIndex: tklPg * ((tklPct || 0) / 100),
    motmRate: games ? raw.motm / games : 0,
  }
}

function collectRecent(matches) {
  const byName = {}
  const list = (matches || []).filter((m) => m && m.us)
  list.forEach((m) => {
    rosterList(m.us.players).forEach((pl) => {
      const key = keyName(pl.name)
      if (!key) return
      const row = byName[key] || emptyRecent()
      row.games += 1
      row.ratingSum += n(pl.rating)
      row.goals += n(pl.goals)
      row.assists += n(pl.assists)
      row.motm += n(pl.motm)
      row.passOk += n(pl.passes)
      row.passTry += n(pl.passAttempts)
      row.tklOk += n(pl.tackles)
      row.tklTry += n(pl.tackleAttempts)
      row.shots += n(pl.shots)
      row.minutes += n(pl.minutes)
      byName[key] = row
    })
  })
  return byName
}

function overallScore(p) {
  const rating = scale(p.rating, 6, 9)
  const output = scale(p.gaPg, 0, 2)
  const motm = scale(p.motmRate, 0, 0.2)
  const win = scale(p.winRate, 40, 70)
  const pass = scale(p.passIndex, 8, 28)
  return Math.round(rating * 0.32 + output * 0.35 + motm * 0.15 + win * 0.08 + pass * 0.1)
}

function momentScore(p) {
  if (!p.recent || p.recent.games < RECENT_MIN) return null
  const r = p.recent
  const rating = scale(r.rating, 6, 9)
  const output = scale(r.gaPg, 0, 2.5)
  const volume = scale(r.involvement, 0, 20)
  const motm = scale(r.motmRate, 0, 0.3)
  return Math.round(rating * 0.32 + output * 0.38 + volume * 0.18 + motm * 0.12)
}

function top(list, fn) {
  const rows = list.filter((p) => {
    const v = fn(p)
    return v != null && Number.isFinite(v)
  })
  if (!rows.length) return null
  return [...rows].sort((a, b) => fn(b) - fn(a))[0]
}

const EMPTY_STUDY = {
  regulars: [],
  everyone: [],
  recentCount: 0,
  rankedCareer: [],
  rankedMoment: [],
  rankedInvolvement: [],
  rankedInvolvementCareer: [],
  passers: [],
  tacklers: [],
  form: [],
  crowns: {},
  avg: {},
  teamRecent: {},
  buckets: [],
  matchRows: [],
  insights: [],
  minGames: REGULAR_GAMES,
  recentMin: RECENT_MIN,
}

export function analyzeDesempenho(players, matches) {
  try {
    return buildStudy(players, matches)
  } catch (err) {
    return { ...EMPTY_STUDY, insights: [], error: String(err?.message || err) }
  }
}

function buildStudy(players, matches) {
  const roster = (players || []).filter((p) => p.stats)
  const recentByName = collectRecent(matches)
  const everyone = roster.map((p) => {
    const career = packCareer(p)
    const raw = recentByName[keyName(p.name)]
    const recent = raw ? closeRecent(raw) : null
    const ratingDelta = recent?.games ? recent.rating - career.rating : null
    const passDelta = recent?.passPct != null && career.passPct ? recent.passPct - career.passPct : null
    const tklDelta = recent?.tklPct != null && career.tklPct ? recent.tklPct - career.tklPct : null
    const row = {
      ...career,
      recent,
      ratingDelta,
      passDelta,
      tklDelta,
      form: recent?.games ? deltaTone(ratingDelta) : 'ausente',
    }
    row.overall = overallScore(row)
    row.moment = momentScore(row)
    return row
  })

  const regulars = everyone.filter((p) => p.games >= REGULAR_GAMES)
  const inWindow = everyone.filter((p) => p.recent?.games)
  const rankedMoment = [...inWindow.filter((p) => p.recent.games >= RECENT_MIN)].sort(
    (a, b) => (b.moment || 0) - (a.moment || 0) || (b.recent.rating || 0) - (a.recent.rating || 0),
  )
  const rankedCareer = [...regulars].sort((a, b) => b.overall - a.overall || b.rating - a.rating)

  const passers = regulars.filter((p) => p.passTry >= p.games * 8)
  const tacklers = regulars.filter((p) => p.tklTry >= p.games * 2)
  const bestPassPct = top(passers, (p) => p.passPct)
  const bestPassIndex = top(passers, (p) => p.passIndex)
  const worstPassMiss = top(passers, (p) => p.passMissPg)
  const bestTklIndex = top(tacklers, (p) => p.tklIndex)
  const worstTklMiss = top(tacklers, (p) => p.tklMissPg)
  const bestOutput = top(regulars, (p) => p.gaPg)
  const bestInvolvement = top(
    inWindow.filter((p) => p.recent.games >= RECENT_MIN),
    (p) => p.recent.involvement + p.recent.gaPg / 100,
  )
  const rankedInvolvement = [...inWindow]
    .filter((p) => p.recent.games)
    .sort(
      (a, b) =>
        b.recent.involvement - a.recent.involvement ||
        b.recent.gaPg - a.recent.gaPg ||
        (b.recent.rating || 0) - (a.recent.rating || 0),
    )
  const rankedInvolvementCareer = [...regulars].sort((a, b) => b.gaPg - a.gaPg || b.involvement - a.involvement)
  const bestRating = top(regulars, (p) => p.rating)
  const risers = [...inWindow.filter((p) => p.recent.games >= RECENT_MIN && p.ratingDelta != null)].sort(
    (a, b) => b.ratingDelta - a.ratingDelta,
  )
  const fallers = [...risers].sort((a, b) => a.ratingDelta - b.ratingDelta)

  const recent = (matches || []).filter((m) => m && m.result)
  let passOk = 0
  let passTry = 0
  let tklOk = 0
  let tklTry = 0
  let shots = 0
  let gf = 0
  let ga = 0
  let short = 0
  const byCount = {}
  const matchRows = recent.map((m) => {
    const count = n(m.us?.playerCount ?? m.playersOnPitch)
    const passAttempts = n(m.us?.passAttempts ?? m.passAttempts)
    const passes = n(m.us?.passes ?? m.passes)
    const tackleAttempts = n(m.us?.tackleAttempts ?? m.tackleAttempts)
    const tackles = n(m.us?.tackles ?? m.tackles)
    const sh = n(m.us?.shots ?? m.shots)
    const usG = n(m.usGoals)
    const themG = n(m.themGoals)
    passOk += passes
    passTry += passAttempts
    tklOk += tackles
    tklTry += tackleAttempts
    shots += sh
    gf += usG
    ga += themG
    if (count && count < 7) short += 1
    const bucket = !count ? 's/n' : count >= 7 ? '7+' : String(count)
    if (!byCount[bucket]) byCount[bucket] = { games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 }
    byCount[bucket].games += 1
    byCount[bucket].gf += usG
    byCount[bucket].ga += themG
    if (m.result === 'V') byCount[bucket].wins += 1
    else if (m.result === 'E') byCount[bucket].draws += 1
    else if (m.result === 'D') byCount[bucket].losses += 1
    return {
      id: m.id,
      opponent: m.opponent,
      result: m.result,
      usGoals: usG,
      themGoals: themG,
      count,
      passMiss: Math.max(0, passAttempts - passes),
      passAttempts,
      tklMiss: Math.max(0, tackleAttempts - tackles),
      tackleAttempts,
      shots: sh,
    }
  })

  const buckets = Object.entries(byCount)
    .map(([key, b]) => ({ key, ...b, winPct: pct(b.wins, b.games) }))
    .sort((a, b) => {
      if (a.key === '7+') return -1
      if (b.key === '7+') return 1
      return Number(b.key) - Number(a.key)
    })

  const passMissPct = pct(passTry - passOk, passTry)
  const tklMissPct = pct(tklTry - tklOk, tklTry)
  const avgPassIndex = avg(passers, 'passIndex')
  const avgTklMiss = avg(tacklers, 'tklMissPg')

  everyone.forEach((p) => {
    if (p.recent && gf) p.recent.share = pct(p.recent.involvement, gf)
  })

  const insights = []
  if (bestInvolvement?.recent) {
    const p = bestInvolvement
    const share = p.recent.share != null ? `, ${p.recent.share}% dos gols do XV` : ''
    insights.push(
      `${p.name} é quem mais participa de jogadas de gol: ${p.recent.involvement} participações (${p.recent.goals} gols + ${p.recent.assists} assistências) em ${p.recent.games} súmulas${share}.`,
    )
  }
  if (rankedMoment[0] && rankedMoment[0].id !== bestInvolvement?.id) {
    const p = rankedMoment[0]
    insights.push(
      `${p.name} fecha o restante do jogo: nota ${dec(p.recent.rating, 2)} nos últimos ${p.recent.games}.`,
    )
  }
  if (rankedCareer[0] && rankedCareer[0].name !== rankedMoment[0]?.name) {
    const p = rankedCareer[0]
    insights.push(
      `Na carreira do clube o pilar continua ${p.name}: nota ${dec(p.rating, 1)}, ${dec(p.gaPg, 2)} participações em gol por jogo.`,
    )
  }
  if (bestPassPct && bestPassIndex && bestPassPct.id !== bestPassIndex.id) {
    insights.push(
      `${bestPassPct.name} ganha no % de passe (${bestPassPct.passPct}%), mas isso engana: o índice quantidade × qualidade aponta ${bestPassIndex.name} (${dec(bestPassIndex.passPg, 1)} certos/jogo × ${bestPassIndex.passPct}%).`,
    )
  } else if (bestPassIndex) {
    insights.push(
      `No passe, quantidade e qualidade juntas apontam ${bestPassIndex.name}: ${dec(bestPassIndex.passPg, 1)} certos por jogo com ${bestPassIndex.passPct}% de acerto.`,
    )
  }
  if (worstTklMiss && (worstTklMiss.tklMissPg >= 3.5 || (worstTklMiss.tklPct || 100) <= 30)) {
    insights.push(
      `${worstTklMiss.name} é quem mais erra o bote: ${dec(worstTklMiss.tklMissPg, 1)} desarmes falhos por jogo, só ${worstTklMiss.tklPct}% de acerto.`,
    )
  }
  const luthro = regulars.find((p) => /luthromero/i.test(p.name))
  if (
    luthro &&
    worstTklMiss &&
    luthro.id !== worstTklMiss.id &&
    luthro.tklMissPg >= 3.5 &&
    (luthro.tklPct || 100) <= 32
  ) {
    insights.push(
      `${luthro.name} parece sólido no % de passe (${luthro.passPct}%), mas circula pouco (${dec(luthro.passPg, 1)} certos/jogo) e erra ${dec(luthro.tklMissPg, 1)} botes por jogo.`,
    )
  }
  if (risers[0] && risers[0].ratingDelta >= 0.25) {
    insights.push(
      `${risers[0].name} subiu de verdade: nota ${dec(risers[0].rating, 1)} na carreira → ${dec(risers[0].recent.rating, 2)} na janela recente.`,
    )
  }
  if (fallers[0] && fallers[0].ratingDelta <= -0.25) {
    insights.push(
      `${fallers[0].name} esfriou: ${dec(fallers[0].rating, 1)} na carreira, ${dec(fallers[0].recent.rating, 2)} agora.`,
    )
  }
  const missing = regulars.filter((p) => !p.recent?.games && p.games >= 200)
  if (missing.length) {
    insights.push(
      `${missing.map((p) => p.name).join(', ')} não entrou nos últimos ${recent.length} jogos. A forma recente não cobre o elenco inteiro.`,
    )
  }
  if (recent.length && pct(short, recent.length) >= 40) {
    insights.push(
      `Em ${short} dos últimos ${recent.length} jogos o XV entrou com menos de 7 em campo.`,
    )
  }

  return {
    regulars,
    everyone,
    recentCount: recent.length,
    rankedCareer,
    rankedMoment,
    rankedInvolvement,
    rankedInvolvementCareer,
    passers: [...passers].sort((a, b) => b.passIndex - a.passIndex),
    tacklers: [...tacklers].sort((a, b) => b.tklMissPg - a.tklMissPg),
    form: [...everyone]
      .filter((p) => p.games >= 6)
      .sort((a, b) => {
        if ((b.recent?.games || 0) !== (a.recent?.games || 0)) return (b.recent?.games || 0) - (a.recent?.games || 0)
        return b.overall - a.overall
      }),
    crowns: {
      moment: rankedMoment[0] || null,
      career: rankedCareer[0] || null,
      output: bestOutput,
      involvement: bestInvolvement,
      passIndex: bestPassIndex,
      passPct: bestPassPct,
      passMiss: worstPassMiss,
      tklIndex: bestTklIndex,
      tklMiss: worstTklMiss,
      rise: risers[0] && risers[0].ratingDelta > 0 ? risers[0] : null,
      fall: fallers[0] && fallers[0].ratingDelta < 0 ? fallers[0] : null,
      rating: bestRating,
    },
    avg: {
      passIndex: avgPassIndex,
      passPct: avg(passers, 'passPct'),
      tklMiss: avgTklMiss,
      tklPct: avg(tacklers, 'tklPct'),
      rating: avg(regulars, 'rating'),
    },
    teamRecent: {
      passOk,
      passTry,
      passMissPct,
      tklOk,
      tklTry,
      tklMissPct,
      shots,
      gf,
      ga,
      short,
      shortPct: pct(short, recent.length),
    },
    buckets,
    matchRows,
    insights: insights.slice(0, 7),
    minGames: REGULAR_GAMES,
    recentMin: RECENT_MIN,
  }
}
