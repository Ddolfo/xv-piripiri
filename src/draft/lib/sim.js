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

  const cardChance = (strategy) => 0.018 * (STRATEGY_MOD[strategy] || STRATEGY_MOD.equilibrada).cards

  const maybeCards = (club, lineup, strategy, fouls) => {
    for (let i = 0; i < fouls; i++) {
      if (rand() < 0.12) {
        push(uniqueMinute(), 'falta', { clubId: club.id, text: `Falta de ${club.name}` })
      }
      if (rand() < cardChance(strategy)) {
        const p = pick(rand, lineup)
        const existing = yellows.filter((y) => y.playerId === p.id).length
        if (existing >= 1 && rand() < 0.35) {
          reds.push({ clubId: club.id, playerId: p.id, playerName: p.name, reason: 'segundo_amarelo' })
          push(uniqueMinute(), 'vermelho', {
            clubId: club.id,
            playerId: p.id,
            playerName: p.name,
            text: `Vermelho para ${p.name}`,
          })
        } else if (rand() < 0.08) {
          reds.push({ clubId: club.id, playerId: p.id, playerName: p.name, reason: 'direto' })
          push(uniqueMinute(), 'vermelho', {
            clubId: club.id,
            playerId: p.id,
            playerName: p.name,
            text: `Vermelho direto para ${p.name}`,
          })
        } else {
          yellows.push({ clubId: club.id, playerId: p.id, playerName: p.name })
          push(uniqueMinute(), 'amarelo', {
            clubId: club.id,
            playerId: p.id,
            playerName: p.name,
            text: `Amarelo para ${p.name}`,
          })
        }
      }
    }
  }

  maybeCards(home, homeLineup, homeFirst, homeFouls)
  maybeCards(away, awayLineup, awayFirst, awayFouls)

  ;(homePlan?.subs || []).slice(0, maxSubs).forEach((sub, i) => {
    push(55 + i * 7, 'substituicao', {
      clubId: home.id,
      outId: sub.outId,
      inId: sub.inId,
      text: `Substituição em ${home.name}`,
    })
  })
  ;(awayPlan?.subs || []).slice(0, maxSubs).forEach((sub, i) => {
    push(56 + i * 7, 'substituicao', {
      clubId: away.id,
      outId: sub.outId,
      inId: sub.inId,
      text: `Substituição em ${away.name}`,
    })
  })

  push(45, 'intervalo', { text: 'Intervalo' })
  push(45, 'reinicio', { text: 'Início do segundo tempo' })
  push(90, 'fim', { text: 'Fim da partida' })

  events.sort((a, b) => a.minute - b.minute || String(a.type).localeCompare(b.type))

  const homeShots = homeGoals + 4 + Math.floor(rand() * 7)
  const awayShots = awayGoals + 4 + Math.floor(rand() * 7)
  const homeOnTarget = homeGoals + 1 + Math.floor(rand() * Math.max(1, homeShots - homeGoals))
  const awayOnTarget = awayGoals + 1 + Math.floor(rand() * Math.max(1, awayShots - awayGoals))
  const homePasses = 280 + Math.floor(rand() * 140)
  const awayPasses = 280 + Math.floor(rand() * 140)
  const possHome = Math.round((homePasses / (homePasses + awayPasses)) * 100)

  const perf = [...homeAfter.live, ...awayAfter.live].map((p) => {
    const goals = events.filter((e) => e.type === 'gol' && e.playerId === p.id).length
    const yellow = events.some((e) => e.type === 'amarelo' && e.playerId === p.id)
    return { playerId: p.id, playerName: p.name, clubId: p.clubId, score: p.overall + goals * 8 - (yellow ? 2 : 0) + rand() * 4 }
  })
  perf.sort((a, b) => b.score - a.score)
  const motm = perf[0] || null

  let penalties = null
  if (homeGoals === awayGoals && homePlan?.needWinner) {
    penalties = simulatePenalties(rand, home, away, homeAfter.live, awayAfter.live)
  }

  const stats = {
    home: {
      goals: homeGoals,
      shots: homeShots,
      shotsOnTarget: Math.min(homeShots, homeOnTarget),
      fouls: homeFouls,
      passes: homePasses,
      yellows: yellows.filter((y) => y.clubId === home.id).length,
      reds: reds.filter((r) => r.clubId === home.id).length,
      subs: homeAfter.used,
      possession: possHome,
    },
    away: {
      goals: awayGoals,
      shots: awayShots,
      shotsOnTarget: Math.min(awayShots, awayOnTarget),
      fouls: awayFouls,
      passes: awayPasses,
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
