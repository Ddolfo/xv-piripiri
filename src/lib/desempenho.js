import { POS_LINE_LABEL } from './eaApi'

const REGULAR_GAMES = 40

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function pct(part, whole) {
  if (!whole) return null
  return Math.round((part / whole) * 100)
}

function rateMiss(successPct) {
  const s = Number(successPct)
  if (!Number.isFinite(s)) return null
  return Math.max(0, Math.round(100 - s))
}

function worst(list, key, dir = 'asc') {
  const rows = list.filter((p) => p[key] != null)
  if (!rows.length) return null
  return [...rows].sort((a, b) => (dir === 'asc' ? a[key] - b[key] : b[key] - a[key]))[0]
}

export function analyzeDesempenho(players, matches, history) {
  const roster = (players || []).filter((p) => p.stats)
  const regulars = roster
    .filter((p) => n(p.stats.games) >= REGULAR_GAMES)
    .map((p) => {
      const s = p.stats
      const games = n(s.games)
      const passes = n(s.passes)
      const passMissPct = rateMiss(s.passSuccess)
      const tackles = n(s.tackles)
      const tklMissPct = rateMiss(s.tackleSuccess)
      const shotMissPct = rateMiss(s.shotSuccess)
      return {
        id: p.id,
        name: p.name,
        line: POS_LINE_LABEL[s.favoritePosition] || s.favoritePosition || '—',
        games,
        rating: s.rating,
        winRate: s.winRate,
        redCards: n(s.redCards),
        redPerGame: games ? n(s.redCards) / games : 0,
        passSuccess: s.passSuccess,
        passMissPct,
        passMiss: passMissPct != null ? Math.round((passes * passMissPct) / 100) : 0,
        tackleSuccess: s.tackleSuccess,
        tklMissPct,
        shotSuccess: s.shotSuccess,
        shotMissPct,
        goals: n(s.goals),
        assists: n(s.assists),
      }
    })

  const recent = (matches || []).filter((m) => m && m.result)
  let passOk = 0
  let passTry = 0
  let tklOk = 0
  let tklTry = 0
  let shots = 0
  let gf = 0
  let ga = 0
  let short = 0
  let dnf = 0
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
    if (m.winnerByDnf) dnf += 1
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

  const hist = history || []
  const histWins = hist.filter((m) => m.result === 'V').length
  const histDraws = hist.filter((m) => m.result === 'E').length
  const histLosses = hist.filter((m) => m.result === 'D').length

  const lines = {}
  regulars.forEach((p) => {
    const key = p.line || 'Outros'
    if (!lines[key]) {
      lines[key] = { line: key, n: 0, passMiss: 0, tklMiss: 0, shotMiss: 0, rating: 0, red: 0 }
    }
    const L = lines[key]
    L.n += 1
    L.passMiss += p.passMissPct || 0
    L.tklMiss += p.tklMissPct || 0
    L.shotMiss += p.shotMissPct || 0
    L.rating += p.rating || 0
    L.red += p.redCards
  })
  const lineRows = Object.values(lines).map((L) => ({
    line: L.line,
    players: L.n,
    passMiss: L.n ? Math.round(L.passMiss / L.n) : 0,
    tklMiss: L.n ? Math.round(L.tklMiss / L.n) : 0,
    shotMiss: L.n ? Math.round(L.shotMiss / L.n) : 0,
    rating: L.n ? L.rating / L.n : 0,
    red: L.red,
  }))

  const passMissPct = pct(passTry - passOk, passTry)
  const tklMissPct = pct(tklTry - tklOk, tklTry)
  const shotMissPct = pct(shots - gf, shots)
  const shortPct = pct(short, recent.length)

  const insights = []
  if (recent.length && shortPct >= 40) {
    insights.push(
      `Em ${short} dos últimos ${recent.length} jogos o XV entrou com menos de 7 em campo. Esse é o furo mais claro das súmulas.`,
    )
  }
  if (tklMissPct != null && tklMissPct >= 55) {
    insights.push(
      `Nas súmulas recentes o time erra ${tklMissPct}% dos desarmes. O chão é o setor que mais sangra.`,
    )
  }
  if (passMissPct != null && passMissPct <= 20) {
    insights.push(
      `O passe aguenta: só ${passMissPct}% de erro nas súmulas recentes. O problema não está na troca de bola.`,
    )
  } else if (passMissPct != null && passMissPct >= 25) {
    insights.push(`O passe anda sujo: ${passMissPct}% das tentativas recentes não chegam.`)
  }
  const noGk = roster.every((p) => p.stats?.favoritePosition !== 'goalkeeper')
  if (noGk) {
    insights.push('Ninguém do elenco está marcado como goleiro na EA. A meta fica descoberta no papel.')
  }
  const worstPass = worst(regulars, 'passSuccess', 'asc')
  if (worstPass && (worstPass.passSuccess || 100) <= 80) {
    insights.push(
      `${worstPass.name} é quem mais suja o passe entre os regulares (${worstPass.passSuccess}% de acerto).`,
    )
  }
  const worstTkl = worst(regulars, 'tackleSuccess', 'asc')
  if (worstTkl && (worstTkl.tackleSuccess || 100) <= 20) {
    insights.push(
      `${worstTkl.name} acerta só ${worstTkl.tackleSuccess}% dos desarmes na carreira do clube.`,
    )
  }
  const buckets = Object.entries(byCount)
    .map(([key, b]) => ({
      key,
      ...b,
      winPct: pct(b.wins, b.games),
    }))
    .sort((a, b) => {
      if (a.key === '7+') return -1
      if (b.key === '7+') return 1
      return Number(b.key) - Number(a.key)
    })

  return {
    regulars,
    recentCount: recent.length,
    histCount: hist.length,
    histRecord: { wins: histWins, draws: histDraws, losses: histLosses },
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
      shotMissPct,
      short,
      shortPct,
      dnf,
      conversion: pct(gf, shots),
    },
    buckets,
    matchRows,
    lineRows,
    worst: {
      pass: worst(regulars, 'passSuccess', 'asc'),
      tackle: worst(regulars, 'tackleSuccess', 'asc'),
      shot: worst(regulars, 'shotSuccess', 'asc'),
      rating: worst(regulars, 'rating', 'asc'),
      winRate: worst(regulars, 'winRate', 'asc'),
      red: worst(regulars, 'redPerGame', 'desc'),
    },
    insights: insights.slice(0, 5),
  }
}
