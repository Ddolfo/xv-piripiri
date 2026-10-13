import { SIM_VERSION, STRATEGIES } from './constants.js'
import { mulberry32, pick, seedFromString } from './util.js'

const STRATEGY_MOD = {
  ofensiva: { attack: 1.12, defense: 0.9, cards: 1.05 },
  equilibrada: { attack: 1, defense: 1, cards: 1 },
  recuada: { attack: 0.88, defense: 1.12, cards: 0.92 },
}

function elevenStrength(players) {
  if (!players.length) return 60
  const sum = players.reduce((a, p) => a + Number(p.overall || 60), 0)
  return sum / players.length
}

function attackRating(players, strategy) {
  const atk = players.filter((p) => ['ST', 'LW', 'RW', 'CAM', 'CF'].includes(p.position))
  const mid = players.filter((p) => ['CM', 'LM', 'RM', 'CDM'].includes(p.position))
  const base =
    0.55 * elevenStrength(atk.length ? atk : players) +
    0.3 * elevenStrength(mid.length ? mid : players) +
    0.15 * elevenStrength(players)
  return base * (STRATEGY_MOD[strategy] || STRATEGY_MOD.equilibrada).attack
}

function defenseRating(players, strategy) {
  const def = players.filter((p) => ['CB', 'LB', 'RB', 'LWB', 'RWB', 'GK', 'CDM'].includes(p.position))
  const base =
    0.6 * elevenStrength(def.length ? def : players) + 0.4 * elevenStrength(players)
  return base * (STRATEGY_MOD[strategy] || STRATEGY_MOD.equilibrada).defense
}

function expectedGoals(atk, def) {
  const diff = atk - def
  const xg = 1.15 + diff * 0.045
  return Math.max(0.25, Math.min(3.6, xg))
}

function poisson(rand, lambda) {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k += 1
    p *= rand()
  } while (p > L)
  return k - 1
}

function scorers(rand, lineup, goals) {
  const pool = lineup.filter((p) => p.position !== 'GK')
  const weighted = pool.map((p) => {
    const w =
      (['ST', 'CF'].includes(p.position) ? 4 : ['LW', 'RW', 'CAM'].includes(p.position) ? 2.4 : 1) *
      (p.overall / 80)
    return { p, w }
  })
  const out = []
  for (let i = 0; i < goals; i++) {
    const total = weighted.reduce((a, x) => a + x.w, 0)
    let r = rand() * total
    let chosen = weighted[0]?.p
    for (const row of weighted) {
      r -= row.w
      if (r <= 0) {
        chosen = row.p
        break
      }
    }
    const assistPool = pool.filter((p) => p.id !== chosen?.id)
    out.push({
      playerId: chosen?.id || null,
      playerName: chosen?.name || null,
      assistId: assistPool.length ? pick(rand, assistPool).id : null,
    })
  }
  return out
}

function applySubs(lineup, planned, maxSubs) {
  const live = [...lineup]
  const used = []
  const steps = (planned || []).slice(0, maxSubs)
  for (const sub of steps) {
    const outIdx = live.findIndex((p) => p.id === sub.outId)
    if (outIdx < 0) continue
    if (used.includes(sub.outId) || used.includes(sub.inId)) continue
    const incoming = sub.inPlayer
    if (!incoming) continue
    live[outIdx] = incoming
    used.push(sub.outId, sub.inId)
  }
  return { live, used: used.length / 2 }
}

/**
 * Simula uma partida oficial uma única vez. O seed fica gravado no resultado.
 */
export function simulateMatch({
  matchId,
  home,
  away,
  homeLineup,
  awayLineup,
  homePlan,
  awayPlan,
  maxSubs = 5,
  seed,
}) {
  const rngSeed = seed || seedFromString(`${matchId}:${home.id}:${away.id}`)
  const rand = mulberry32(rngSeed)
  const events = []
  const push = (minute, type, payload) => {
    events.push({ minute, type, ...payload })
  }

  push(0, 'inicio', { text: 'Início da partida' })

  const homeFirst = homePlan?.first || 'equilibrada'
  const awayFirst = awayPlan?.first || 'equilibrada'
  const homeSecond = homePlan?.second || homeFirst
  const awaySecond = awayPlan?.second || awayFirst

  const homeAfter = applySubs(homeLineup, homePlan?.subs, maxSubs)
  const awayAfter = applySubs(awayLineup, awayPlan?.subs, maxSubs)

  const hxg1 = expectedGoals(attackRating(homeLineup, homeFirst), defenseRating(awayLineup, awayFirst))
  const axg1 = expectedGoals(attackRating(awayLineup, awayFirst), defenseRating(homeLineup, homeFirst))
  const hxg2 = expectedGoals(attackRating(homeAfter.live, homeSecond), defenseRating(awayAfter.live, awaySecond))
  const axg2 = expectedGoals(attackRating(awayAfter.live, awaySecond), defenseRating(homeAfter.live, homeSecond))

  let homeGoals = poisson(rand, (hxg1 + hxg2) / 2)
  let awayGoals = poisson(rand, (axg1 + axg2) / 2)

  const homeScorers = scorers(rand, homeAfter.live, homeGoals)
  const awayScorers = scorers(rand, awayAfter.live, awayGoals)

  const minutes = new Set()
  const uniqueMinute = () => {
    let m = 1 + Math.floor(rand() * 90)
    while (minutes.has(m)) m = 1 + Math.floor(rand() * 90)
    minutes.add(m)
    return m
  }

  homeScorers.forEach((g) => {
    push(uniqueMinute(), 'gol', {
      clubId: home.id,
      playerId: g.playerId,
      playerName: g.playerName,
      assistId: g.assistId,
      text: `Gol de ${g.playerName || home.name}`,
    })
  })
  awayScorers.forEach((g) => {
    push(uniqueMinute(), 'gol', {
      clubId: away.id,
      playerId: g.playerId,
      playerName: g.playerName,
      assistId: g.assistId,
      text: `Gol de ${g.playerName || away.name}`,
    })
  })

  const homeFouls = 6 + Math.floor(rand() * 8)
  const awayFouls = 6 + Math.floor(rand() * 8)
  const yellows = []
  const reds = []
  const fouls = []
  const sentOff = new Set()

  // ~3 amarelos por jogo com ~19 faltas, como no futebol de verdade.
  const cardChance = (strategy) => 0.15 * (STRATEGY_MOD[strategy] || STRATEGY_MOD.equilibrada).cards

  // Quem comete a falta: defensores e volantes mais, goleiro quase nunca.
  const FOUL_WEIGHT = { GK: 0.3, CB: 3, LB: 2.6, RB: 2.6, LWB: 2.4, RWB: 2.4, CDM: 3, CM: 2, CAM: 1.3, LM: 1.5, RM: 1.5 }
  const pickFouler = (players) => {
    const weights = players.map((p) => FOUL_WEIGHT[p.position] ?? 1)
    let r = rand() * weights.reduce((x, y) => x + y, 0)
    for (let i = 0; i < players.length; i++) {
      r -= weights[i]
      if (r < 0) return players[i]
    }
    return players[players.length - 1]
  }

  // Faltas em ordem de tempo; o cartão vai para quem fez a falta e o expulso sai do jogo.
  const maybeCards = (club, lineup, strategy, foulCount) => {
    const foulMinutes = Array.from({ length: foulCount }, () => uniqueMinute()).sort((x, y) => x - y)
    for (const minute of foulMinutes) {
      const onPitch = lineup.filter((p) => !sentOff.has(p.id))
      if (!onPitch.length) break
      const p = pickFouler(onPitch)
      fouls.push({ clubId: club.id, playerId: p.id, playerName: p.name, minute })
      const card = rand() < cardChance(strategy)
      if (!card) {
        if (rand() < 0.12) push(minute, 'falta', { clubId: club.id, playerId: p.id, playerName: p.name, text: `Falta de ${p.name}` })
        continue
      }
      const already = yellows.filter((y) => y.playerId === p.id).length
      if (already >= 1) {
        yellows.push({ clubId: club.id, playerId: p.id, playerName: p.name, minute, second: true })
        push(minute, 'amarelo', { clubId: club.id, playerId: p.id, playerName: p.name, second: true, text: `Segundo amarelo para ${p.name}` })
        reds.push({ clubId: club.id, playerId: p.id, playerName: p.name, reason: 'segundo_amarelo', minute })
        push(minute, 'vermelho', { clubId: club.id, playerId: p.id, playerName: p.name, reason: 'segundo_amarelo', text: `${p.name} expulso por dois amarelos` })
        sentOff.add(p.id)
      } else if (rand() < 0.03) {
        reds.push({ clubId: club.id, playerId: p.id, playerName: p.name, reason: 'direto', minute })
        push(minute, 'vermelho', { clubId: club.id, playerId: p.id, playerName: p.name, reason: 'direto', text: `Vermelho direto para ${p.name}` })
        sentOff.add(p.id)
      } else {
        yellows.push({ clubId: club.id, playerId: p.id, playerName: p.name, minute })
        push(minute, 'amarelo', { clubId: club.id, playerId: p.id, playerName: p.name, text: `Amarelo para ${p.name}` })
      }
    }
  }

  maybeCards(home, homeLineup, homeFirst, homeFouls)
  maybeCards(away, awayLineup, awayFirst, awayFouls)

  const subMinute = {}
  const pushSubs = (club, plan, lineup, offset) => {
    ;(plan?.subs || []).slice(0, maxSubs).forEach((sub, i) => {
      const out = lineup.find((p) => p.id === sub.outId)
      if (!out || !sub.inPlayer || sentOff.has(out.id)) return
      const minute = offset + i * 7
      subMinute[sub.outId] = { off: minute }
      subMinute[sub.inId] = { on: minute }
      push(minute, 'substituicao', {
        clubId: club.id,
        outId: sub.outId,
        inId: sub.inId,
        outName: out.name,
        inName: sub.inPlayer.name,
        text: `Entra ${sub.inPlayer.name}, sai ${out.name}`,
      })
    })
  }
  pushSubs(home, homePlan, homeLineup, 58)
  pushSubs(away, awayPlan, awayLineup, 61)

  // Ninguém marca nem dá assistência depois de expulso: o gol vai para antes da expulsão.
  const redAt = Object.fromEntries(reds.map((r) => [r.playerId, r.minute]))
  for (const e of events) {
    if (e.type !== 'gol') continue
    const limit = Math.min(redAt[e.playerId] ?? 99, redAt[e.assistId] ?? 99)
    if (e.minute >= limit) e.minute = Math.max(1, Math.floor(rand() * Math.max(1, limit - 1)) + 1)
  }

  push(45, 'intervalo', { text: 'Intervalo' })
  push(45, 'reinicio', { text: 'Início do segundo tempo' })
  push(90, 'fim', { text: 'Fim da partida' })

  events.sort((a, b) => a.minute - b.minute || String(a.type).localeCompare(b.type))

  const midOf = (players) => elevenStrength(players.filter((p) => ['CM', 'CDM', 'CAM', 'LM', 'RM'].includes(p.position))) || elevenStrength(players)
  const stratTilt = { ofensiva: 3, equilibrada: 0, recuada: -4 }
  const possHome = Math.round(
    Math.max(30, Math.min(70, 50 + (midOf(homeLineup) - midOf(awayLineup)) * 1.1 + (stratTilt[homeFirst] || 0) - (stratTilt[awayFirst] || 0) + (rand() - 0.5) * 10)),
  )
  const side = (goals, strategy, lineup, poss, oppGoals) => {
    const shots = goals + 5 + Math.floor(rand() * 8) + (strategy === 'ofensiva' ? 2 : strategy === 'recuada' ? -2 : 0)
    const onTarget = Math.min(shots, goals + Math.floor(rand() * Math.max(1, (shots - goals) * 0.55)) + (goals ? 0 : 1))
    const xg = Math.round((shots * 0.085 + onTarget * 0.07 + goals * 0.12 + rand() * 0.25) * 100) / 100
    const passes = Math.round((780 + Math.floor(rand() * 200)) * (poss / 100))
    const accuracy = Math.round(Math.max(68, Math.min(92, 74 + (midOf(lineup) - 72) * 0.55 + (rand() - 0.5) * 6)))
    return {
      shots: Math.max(shots, goals),
      shotsOnTarget: Math.max(onTarget, goals),
      xg,
      corners: Math.floor(1 + shots * 0.32 + rand() * 3),
      offsides: Math.floor(rand() * 4) + (strategy === 'ofensiva' ? 1 : 0),
      passes,
      passesCompleted: Math.round(passes * (accuracy / 100)),
      passAccuracy: accuracy,
      tackles: 11 + Math.floor(rand() * 9) + (strategy === 'recuada' ? 3 : 0),
      oppGoals,
    }
  }
  const hs = side(homeGoals, homeFirst, homeLineup, possHome, awayGoals)
  const as = side(awayGoals, awayFirst, awayLineup, 100 - possHome, homeGoals)
  hs.saves = Math.max(0, as.shotsOnTarget - awayGoals)
  as.saves = Math.max(0, hs.shotsOnTarget - homeGoals)

  // Nota de 0 a 10 por jogador que entrou em campo.
  const result = (clubId) => (homeGoals === awayGoals ? 0 : (clubId === home.id) === homeGoals > awayGoals ? 1 : -1)
  const playerLines = []
  const addLine = (p, club, starter, saves, conceded) => {
    const goals = events.filter((e) => e.type === 'gol' && e.playerId === p.id).length
    const assists = events.filter((e) => e.type === 'gol' && e.assistId === p.id).length
    const yellow = events.filter((e) => e.type === 'amarelo' && e.playerId === p.id).length
    const red = events.some((e) => e.type === 'vermelho' && e.playerId === p.id)
    const on = starter ? 0 : subMinute[p.id]?.on ?? 90
    const off = red ? redAt[p.id] : subMinute[p.id]?.off ?? 90
    const minutes = Math.max(0, off - on)
    const defender = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)
    let rating =
      6.3 +
      (Number(p.overall || 75) - 75) * 0.025 +
      goals * 1.0 +
      assists * 0.6 -
      yellow * 0.35 -
      (red ? 2 : 0) +
      result(club.id) * 0.3 +
      (defender && conceded === 0 ? 0.5 : defender ? -0.15 * conceded : 0) +
      (p.position === 'GK' ? saves * 0.15 : 0) +
      (rand() - 0.5) * (starter ? 1 : 0.6)
    if (!starter) rating = 6 + (rating - 6.3) * 0.7
    playerLines.push({
      playerId: p.id,
      name: p.name,
      position: p.position,
      clubId: club.id,
      starter,
      minutes,
      goals,
      assists,
      yellows: yellow,
      red,
      rating: Math.round(Math.max(3.5, Math.min(10, rating)) * 10) / 10,
    })
  }
  homeLineup.forEach((p) => addLine(p, home, true, hs.saves, awayGoals))
  awayLineup.forEach((p) => addLine(p, away, true, as.saves, homeGoals))
  for (const e of events.filter((x) => x.type === 'substituicao')) {
    const club = e.clubId === home.id ? home : away
    const plan = club === home ? homePlan : awayPlan
    const incoming = (plan?.subs || []).find((x) => x.inId === e.inId)?.inPlayer
    if (incoming) addLine(incoming, club, false, club === home ? hs.saves : as.saves, club === home ? awayGoals : homeGoals)
  }
  const motmLine = [...playerLines].sort((x, y) => y.rating - x.rating)[0] || null
  const motm = motmLine ? { playerId: motmLine.playerId, playerName: motmLine.name, clubId: motmLine.clubId, rating: motmLine.rating } : null
  const halfTime = {
    home: events.filter((e) => e.type === 'gol' && e.clubId === home.id && e.minute <= 45).length,
    away: events.filter((e) => e.type === 'gol' && e.clubId === away.id && e.minute <= 45).length,
  }

  let penalties = null
  if (homeGoals === awayGoals && homePlan?.needWinner) {
    penalties = simulatePenalties(rand, home, away, homeAfter.live, awayAfter.live)
  }

  const pack = (st) => {
    const { oppGoals: _ignored, ...rest } = st
    return rest
  }
  const stats = {
    home: {
      ...pack(hs),
      goals: homeGoals,
      fouls: homeFouls,
      yellows: yellows.filter((y) => y.clubId === home.id).length,
      reds: reds.filter((r) => r.clubId === home.id).length,
      subs: homeAfter.used,
      possession: possHome,
    },
    away: {
      ...pack(as),
      goals: awayGoals,
      fouls: awayFouls,
      yellows: yellows.filter((y) => y.clubId === away.id).length,
      reds: reds.filter((r) => r.clubId === away.id).length,
      subs: awayAfter.used,
      possession: 100 - possHome,
    },
  }

  return {
    version: SIM_VERSION,
    seed: rngSeed,
    homeGoals,
    awayGoals,
    events,
    stats,
    scorers: { home: homeScorers, away: awayScorers },
    yellows,
    reds,
    fouls,
    players: playerLines,
    halfTime,
    motm,
    penalties,
    strategies: { home: { first: homeFirst, second: homeSecond }, away: { first: awayFirst, second: awaySecond } },
  }
}

export function simulatePenalties(rand, home, away, homeLineup, awayLineup) {
  const takers = (lineup) => lineup.filter((p) => p.position !== 'GK').slice(0, 5)
  const gk = (lineup) => lineup.find((p) => p.position === 'GK') || lineup[0]
  const success = (taker, keeper) => {
    const chance = 0.72 + (taker.overall - keeper.overall) * 0.006
    return rand() < Math.max(0.45, Math.min(0.92, chance))
  }
  const rounds = []
  let hs = 0
  let as_ = 0
  const ht = takers(homeLineup)
  const at = takers(awayLineup)
  const hg = gk(homeLineup)
  const ag = gk(awayLineup)
  for (let i = 0; i < 5; i++) {
    const hOk = ht[i] ? success(ht[i], ag) : false
    const aOk = at[i] ? success(at[i], hg) : false
    if (hOk) hs += 1
    if (aOk) as_ += 1
    rounds.push({ index: i + 1, home: hOk, away: aOk })
    const remain = 4 - i
    if (hs > as_ + remain || as_ > hs + remain) break
  }
  let i = 5
  while (hs === as_) {
    i += 1
    const hPlayer = pick(rand, homeLineup)
    const aPlayer = pick(rand, awayLineup)
    const hOk = success(hPlayer, ag)
    const aOk = success(aPlayer, hg)
    if (hOk) hs += 1
    if (aOk) as_ += 1
    rounds.push({ index: i, home: hOk, away: aOk, suddenDeath: true })
    if (i > 20) break
  }
  return { home: hs, away: as_, rounds, winnerClubId: hs > as_ ? home.id : away.id }
}

export function strategyFromPreset(id) {
  if (STRATEGIES.includes(id)) return { first: id, second: id }
  return null
}
