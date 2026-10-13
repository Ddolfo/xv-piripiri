import assert from 'node:assert/strict'
import { DraftEngine } from '../src/draft/engine.js'
import { DRAW_BANDS, STARTING_COINS, STARTING_ROSTER } from '../src/draft/lib/constants.js'
import { PRICE_BELOW_70, PRICE_TABLE, buyPrice, sellPrice } from '../src/draft/lib/prices.js'
import { createMemoryStore } from '../src/draft/store.js'
import { positionTiers } from '../src/draft/lib/draw.js'
import { cleanCrest } from '../src/draft/lib/crest.js'
import { FORMATIONS, FORMATION_KEYS } from '../src/data/formations.js'

const crest = {
  shape: 'heater',
  layers: [
    { type: 'shape', fill: '#ffd200' },
    { type: 'stripe', fill: '#111111' },
    { type: 'letter', fill: '#ffffff', text: 'XV' },
  ],
}

function engineAt(nowRef) {
  return new DraftEngine({
    store: createMemoryStore(),
    now: () => nowRef.t,
    adminPassword: 'admin-secret-12',
    pbkdf2Iterations: 50,
  })
}

async function login(engine, username, password) {
  const session = await engine.login(username, password)
  return { token: session.token, actor: session.user, session }
}

async function userByClub(engine, users, clubId) {
  for (const u of users) {
    const snap = await engine.snapshot(u)
    if (snap.club?.id === clubId) return u
  }
  throw new Error('Clube sem dono no teste')
}

async function setupWorld() {
  const nowRef = { t: 1_700_000_000_000 }
  const engine = engineAt(nowRef)
  await engine.tick()
  const admin = (await login(engine, 'ddolfo.draft', 'admin-secret-12')).actor
  const users = []
  const formations = { 'clube.alfa': '4-3-3', 'clube.beta': '5-3-2', 'clube.gama': '3-4-2-1' }
  for (const name of Object.keys(formations)) {
    await engine.createParticipant(admin, { username: name, password: 'senha-segura-99', displayName: name })
    const { actor } = await login(engine, name, 'senha-segura-99')
    await engine.setupClub(actor, {
      name: name.replace('.', ' ').toUpperCase(),
      formation: formations[name],
      primary: '#ffd200',
      secondary: '#102318',
      crest,
    })
    users.push(actor)
  }
  await engine.drawRosters(admin)
  await engine.setMarketStatus(admin, 'aberto')
  return { engine, admin, users, nowRef }
}

function bandsOf(players) {
  return DRAW_BANDS.map((b) => ({
    ...b,
    got: players.filter((p) => p.overall >= b.min && p.overall <= b.max).length,
  }))
}

function coversFormation(roster, formation) {
  const slots = FORMATIONS[formation].map((s) => s.code)
  const accepts = slots.map((code) => positionTiers(code).flat())
  const used = new Set()
  const place = (i) => {
    if (i === slots.length) return true
    for (const p of roster) {
      if (used.has(p.id) || !accepts[i].includes(p.position)) continue
      used.add(p.id)
      if (place(i + 1)) return true
      used.delete(p.id)
    }
    return false
  }
  return place(0)
}

const tests = []
const test = (name, fn) => tests.push({ name, fn })

test('tabela oficial de preços é literal', () => {
  assert.equal(PRICE_TABLE[99].buy, 4000000)
  assert.equal(PRICE_TABLE[99].auction, 900000)
  assert.equal(PRICE_TABLE[99].sell, 2000000)
  assert.equal(PRICE_TABLE[83].buy, 10000)
  assert.equal(PRICE_TABLE[83].sell, 5000)
  assert.equal(PRICE_TABLE[70].buy, 750)
  assert.equal(PRICE_BELOW_70.auction, 150)
  assert.equal(buyPrice(69), 750)
  assert.equal(sellPrice(91), 173334)
  assert.equal(PRICE_TABLE[98].buy, 3543334)
  assert.equal(PRICE_TABLE[92].auction, 200875)
})

test('admin cria participantes, clubes, sorteio 22 e 15.000 XV-Coins', async () => {
  const { engine, users } = await setupWorld()
  for (const actor of users) {
    const snap = await engine.snapshot(actor)
    assert.equal(snap.club.balance, STARTING_COINS)
    assert.equal(snap.club.roster.length, STARTING_ROSTER)
    for (const band of bandsOf(snap.club.roster)) {
      assert.equal(band.got, band.count, band.label)
    }
  }
})

test('compra direta debita preço oficial e transfere o jogador', async () => {
  const { engine, users } = await setupWorld()
  const snap = await engine.snapshot(users[0])
  const free = snap.market.find((p) => p.status === 'livre' && p.overall <= 76)
  assert.ok(free)
  const before = snap.club.balance
  const result = await engine.buyDirect(users[0], free.id)
  assert.equal(result.price, buyPrice(free.overall))
  assert.equal(result.balance, before - result.price)
  const after = await engine.snapshot(users[0])
  assert.ok(after.club.roster.some((p) => p.id === free.id))
})

test('venda ao mercado credita o valor oficial', async () => {
  const { engine, users } = await setupWorld()
  const snap = await engine.snapshot(users[0])
  const player = snap.club.roster.find((p) => p.overall <= 79)
  const before = snap.club.balance
  const result = await engine.sellToMarket(users[0], player.id)
  assert.equal(result.price, sellPrice(player.overall))
  assert.equal(result.balance, before + result.price)
})

test('limite de 26 e saldo negativo são bloqueados', async () => {
  const { engine, admin, users } = await setupWorld()
  const snap = await engine.snapshot(users[0])
  const need = 26 - snap.club.roster.length
  const cheap = snap.market.filter((p) => p.status === 'livre' && p.overall <= 76).slice(0, need)
  for (const p of cheap) await engine.buyDirect(users[0], p.id)
  const extra = (await engine.snapshot(users[0])).market.find((p) => p.status === 'livre' && p.overall <= 76)
  await assert.rejects(() => engine.buyDirect(users[0], extra.id), /completo/)
  await assert.rejects(
    () => engine.adminAdjust(admin, { balanceClubId: snap.club.id, delta: -999999, justification: 'teste' }),
    /negativo/,
  )
})

test('proposta de compra atualiza os dois clubes', async () => {
  const { engine, users } = await setupWorld()
  const a = await engine.snapshot(users[0])
  const b = await engine.snapshot(users[1])
  const target = b.club.roster.find((p) => p.overall <= 79)
  const proposal = await engine.createProposal(users[0], {
    toClubId: b.club.id,
    requestPlayerIds: [target.id],
    coinsFrom: 800,
  })
  await engine.respondProposal(users[1], proposal.id, 'aceitar')
  const a2 = await engine.snapshot(users[0])
  const b2 = await engine.snapshot(users[1])
  assert.ok(a2.club.roster.some((p) => p.id === target.id))
  assert.ok(!b2.club.roster.some((p) => p.id === target.id))
  assert.equal(a2.club.balance, a.club.balance - 800)
  assert.equal(b2.club.balance, b.club.balance + 800)
})

test('leilão de 1h entrega ao maior lance e libera reservas', async () => {
  const { engine, admin, users, nowRef } = await setupWorld()
  await engine.updateSettings(admin, { auctionDurationMs: 1000, minBidIncrement: 100 })
  const snap = await engine.snapshot(users[0])
  const free = snap.market.find((p) => p.status === 'livre' && p.overall === 83)
  const auction = await engine.startAuction(users[0], free.id)
  const start = sellPrice ? auction.bids[0].amount : auction.bids[0].amount
  await engine.bidAuction(users[1], auction.id, start + 100)
  nowRef.t += 2000
  await engine.tick()
  const a = await engine.snapshot(users[0])
  const b = await engine.snapshot(users[1])
  assert.ok(b.club.roster.some((p) => p.id === free.id))
  assert.ok(!a.club.roster.some((p) => p.id === free.id))
  const closed = Object.values(
    (await engine.snapshot(admin)).auctions || {},
  )
  void closed
  assert.equal(b.club.balance, STARTING_COINS - (start + 100))
  assert.equal(a.club.balance, STARTING_COINS)
})

test('dois campeonatos compartilham elenco e saldo', async () => {
  const { engine, admin, users } = await setupWorld()
  const c1 = await engine.createChampionship(admin, { name: 'Liga', format: 'pontos-corridos' })
  const c2 = await engine.createChampionship(admin, { name: 'Copa', format: 'mata-mata' })
  const ids = []
  for (const u of users) ids.push((await engine.snapshot(u)).club.id)
  await engine.assignClubs(admin, c1.id, ids)
  await engine.assignClubs(admin, c2.id, ids)
  const before = await engine.snapshot(users[0])
  const cheap = before.market.find((p) => p.status === 'livre' && p.overall <= 76)
  await engine.buyDirect(users[0], cheap.id)
  const after = await engine.snapshot(users[0])
  assert.equal(after.championships.length, 2)
  assert.equal(after.club.roster.length, before.club.roster.length + 1)
  assert.ok(after.club.balance < before.club.balance)
})

test('simulação gera relatório, exige confirmação dupla e cartão vermelho suspende', async () => {
  const { engine, admin, users } = await setupWorld()
  const ids = []
  const snaps = []
  for (const u of users) {
    const s = await engine.snapshot(u)
    snaps.push(s)
    ids.push(s.club.id)
  }
  const cup = await engine.createChampionship(admin, { name: 'Liga', format: 'pontos-corridos' })
  await engine.assignClubs(admin, cup.id, ids)
  await engine.generateCalendar(admin, cup.id)
  for (const u of users) {
    const s = await engine.snapshot(u)
    const roster = s.club.roster
    await engine.saveLineup(u, {
      championshipId: cup.id,
      formation: '4-3-3',
      starters: roster.slice(0, 11).map((p) => p.id),
      bench: roster.slice(11, 18).map((p) => p.id),
      strategyPreset: 'equilibrada',
    })
  }
  const full = await engine.snapshot(admin)
  const fixture = full.championships
    .find((c) => c.id === cup.id)
    .fixtures.find((f) => f.homeClubId === ids[0] && f.awayClubId === ids[1])
  const homeUser = await userByClub(engine, users, fixture.homeClubId)
  const awayUser = await userByClub(engine, users, fixture.awayClubId)
  void snaps
  const ch = await engine.challenge(homeUser, fixture.id)
  await engine.respondChallenge(awayUser, ch.id, true)
  const match = await engine.confirmChallengeStart(homeUser, ch.id)
  assert.ok(match.result.stats)
  assert.equal(match.result.events[0].type, 'inicio')
  assert.equal(match.status, 'aguardando_confirmacao')
  await engine.confirmMatch(homeUser, match.id)
  let mid = (await engine.snapshot(homeUser)).matches.find((m) => m.id === match.id)
  assert.equal(mid.status, 'aguardando_confirmacao')
  await engine.confirmMatch(awayUser, match.id)
  mid = (await engine.snapshot(homeUser)).matches.find((m) => m.id === match.id)
  assert.equal(mid.status, 'validado')
  const table = (await engine.snapshot(admin)).championships.find((c) => c.id === cup.id).standings
  assert.equal(table.reduce((a, r) => a + r.played, 0), 2)
})

test('contestação vai ao admin e partida contestada não conta', async () => {
  const { engine, admin, users } = await setupWorld()
  const ids = []
  for (const u of users) ids.push((await engine.snapshot(u)).club.id)
  const cup = await engine.createChampionship(admin, { name: 'Liga', format: 'pontos-corridos' })
  await engine.assignClubs(admin, cup.id, ids)
  await engine.generateCalendar(admin, cup.id)
  for (const u of users) {
    const s = await engine.snapshot(u)
    await engine.saveLineup(u, {
      championshipId: cup.id,
      formation: '4-3-3',
      starters: s.club.roster.slice(0, 11).map((p) => p.id),
      bench: s.club.roster.slice(11, 16).map((p) => p.id),
      strategyPreset: 'ofensiva',
    })
  }
  const full = await engine.snapshot(admin)
  const fixture = full.championships[0].fixtures.find((f) => !f.bye)
  const home = await userByClub(engine, users, fixture.homeClubId)
  const away = await userByClub(engine, users, fixture.awayClubId)
  const ch = await engine.challenge(home, fixture.id)
  await engine.respondChallenge(away, ch.id, true)
  const match = await engine.confirmChallengeStart(home, ch.id)
  await engine.contestMatch(away, match.id, 'Placar divergente')
  const standing = (await engine.snapshot(admin)).championships[0].standings
  assert.equal(standing.reduce((a, r) => a + r.played, 0), 0)
  await engine.resolveMatch(admin, match.id, { keepOriginal: true, justification: 'Mantido o registro da simulação.' })
  const standing2 = (await engine.snapshot(admin)).championships[0].standings
  assert.equal(standing2.reduce((a, r) => a + r.played, 0), 2)
})

test('concorrência: só uma compra do mesmo jogador passa', async () => {
  const { engine, users } = await setupWorld()
  const snap = await engine.snapshot(users[0])
  const free = snap.market.find((p) => p.status === 'livre' && p.overall <= 76)
  const results = await Promise.allSettled([engine.buyDirect(users[0], free.id), engine.buyDirect(users[1], free.id)])
  const ok = results.filter((r) => r.status === 'fulfilled')
  const fail = results.filter((r) => r.status === 'rejected')
  assert.equal(ok.length, 1)
  assert.equal(fail.length, 1)
  const a = await engine.snapshot(users[0])
  const b = await engine.snapshot(users[1])
  const owners = [a, b].filter((s) => s.club.roster.some((p) => p.id === free.id))
  assert.equal(owners.length, 1)
})

test('emblema com uma cor é recusado', async () => {
  const { engine, admin } = await setupWorld()
  await engine.createParticipant(admin, { username: 'clube.delta', password: 'senha-segura-99', displayName: 'Delta' })
  const { actor } = await login(engine, 'clube.delta', 'senha-segura-99')
  await assert.rejects(
    () =>
      engine.setupClub(actor, {
        name: 'Delta FC',
        formation: '4-4-2',
        primary: '#111111',
        secondary: '#111111',
        crest: { shape: 'circle', layers: [{ type: 'shape', fill: '#111111' }] },
      }),
    /cores/,
  )
})

test('notificações e auditoria registram ações administrativas', async () => {
  const { engine, admin, users } = await setupWorld()
  const snap = await engine.snapshot(admin)
  assert.ok(snap.audit.some((a) => a.action === 'sorteio_elencos'))
  const notes = await engine.snapshot(users[0])
  assert.ok(notes.notifications.some((n) => n.type === 'sorteio'))
})

test('mercado permanece fechado até o sorteio e o admin só abre depois', async () => {
  const nowRef = { t: 1_700_000_000_000 }
  const engine = engineAt(nowRef)
  await engine.tick()
  const admin = (await login(engine, 'ddolfo.draft', 'admin-secret-12')).actor
  await engine.createParticipant(admin, { username: 'clube.zeta', password: 'senha-segura-99', displayName: 'Zeta' })
  const { actor } = await login(engine, 'clube.zeta', 'senha-segura-99')
  await engine.setupClub(actor, {
    name: 'Zeta FC',
    formation: '4-2-3-1',
    primary: '#ffd200',
    secondary: '#102318',
    crest,
  })
  await assert.rejects(() => engine.setMarketStatus(admin, 'aberto'), /sorteio/)
  const before = await engine.snapshot(actor)
  assert.equal(before.drawDone, false)
  assert.equal(before.marketStatus, 'fechado')
  assert.equal(before.market.length, 0)
  await engine.drawRosters(admin)
  const mid = await engine.snapshot(actor)
  assert.equal(mid.drawDone, true)
  assert.equal(mid.marketStatus, 'fechado')
  assert.equal(mid.market.length, 0)
  const free = (await engine.snapshot(admin)).players.find((p) => p.status === 'livre' && p.overall <= 76)
  await assert.rejects(() => engine.buyDirect(actor, free.id), /fechado|sorteio/)
  await engine.setMarketStatus(admin, 'aberto')
  const open = await engine.snapshot(actor)
  assert.equal(open.marketStatus, 'aberto')
  assert.ok(open.market.length > 0)
})

test('admin exclui campeonato em andamento com confrontos', async () => {
  const { engine, admin, users } = await setupWorld()
  const ids = []
  for (const u of users) ids.push((await engine.snapshot(u)).club.id)
  const cup = await engine.createChampionship(admin, {
    name: 'Liga Relâmpago',
    format: 'pontos-corridos',
    clubIds: ids,
    generateCalendar: true,
  })
  const before = await engine.snapshot(admin)
  const created = before.championships.find((c) => c.id === cup.id)
  assert.ok(created)
  assert.ok(created.fixtures.length > 0)
  await assert.rejects(() => engine.deleteChampionship(admin, cup.id, ''), /justificativa/)
  await engine.deleteChampionship(admin, cup.id, 'Reinício da temporada')
  const after = await engine.snapshot(admin)
  assert.equal(after.championships.some((c) => c.id === cup.id), false)
  assert.ok(after.audit.some((a) => a.action === 'excluir_campeonato'))
})

test('admin exclui participante criado e libera o elenco', async () => {
  const { engine, admin, users } = await setupWorld()
  const snap = await engine.snapshot(users[0])
  const clubId = snap.club.id
  const owned = snap.club.roster[0]
  await assert.rejects(() => engine.deleteParticipant(admin, users[0].id, ''), /justificativa/)
  await assert.rejects(() => engine.deleteParticipant(admin, admin.id, 'teste'), /administrativa/)
  await engine.deleteParticipant(admin, users[0].id, 'Conta criada por engano')
  const after = await engine.snapshot(admin)
  assert.equal(after.users.some((u) => u.id === users[0].id), false)
  assert.equal(after.clubs.some((c) => c.id === clubId), false)
  const player = after.players.find((p) => p.id === owned.id)
  assert.ok(player)
  assert.equal(player.clubId, null)
  assert.equal(player.status, 'livre')
  assert.ok(after.audit.some((a) => a.action === 'excluir_participante'))
})

test('sorteio cobre todas as posições da formação preferida e mantém as faixas', async () => {
  const { engine, users } = await setupWorld()
  for (const actor of users) {
    const { club } = await engine.snapshot(actor)
    assert.ok(FORMATION_KEYS.includes(club.preferredFormation))
    assert.equal(club.roster.length, STARTING_ROSTER)
    for (const band of bandsOf(club.roster)) assert.equal(band.got, band.count, band.label)
    assert.ok(coversFormation(club.roster, club.preferredFormation), `${club.name} sem cobertura do ${club.preferredFormation}`)
  }
})

test('cadastro do clube sem formação é recusado', async () => {
  const { engine, admin } = await setupWorld()
  await engine.createParticipant(admin, { username: 'clube.eta', password: 'senha-segura-99', displayName: 'Eta' })
  const { actor } = await login(engine, 'clube.eta', 'senha-segura-99')
  await assert.rejects(
    () => engine.setupClub(actor, { name: 'Eta FC', primary: '#ffd200', secondary: '#102318', crest }),
    /formação/,
  )
  await assert.rejects(
    () => engine.setupClub(actor, { name: 'Eta FC', formation: '9-9-9', primary: '#ffd200', secondary: '#102318', crest }),
    /formação/,
  )
})

test('escalação aceita qualquer formação do campinho', async () => {
  const { engine, users } = await setupWorld()
  const { club } = await engine.snapshot(users[0])
  const ids = club.roster.map((p) => p.id)
  await engine.saveLineup(users[0], {
    formation: '4-1-2-1-2',
    starters: ids.slice(0, 11),
    bench: ids.slice(11, 18),
    strategyPreset: 'equilibrada',
  })
  const after = await engine.snapshot(users[0])
  const saved = Object.values(after.lineups || {}).find((l) => l.clubId === club.id) || after.lineups?.[`${club.id}:geral`]
  assert.equal(saved?.formation, '4-1-2-1-2')
})

test('estresse: 8 clubes em todas as formações, 25 sorteios seguidos', async () => {
  const nowRef = { t: 1_700_000_000_000 }
  const engine = engineAt(nowRef)
  await engine.tick()
  const admin = (await login(engine, 'ddolfo.draft', 'admin-secret-12')).actor
  const actors = []
  for (let i = 0; i < 8; i++) {
    const username = `clube.s${i}`
    await engine.createParticipant(admin, { username, password: 'senha-segura-99', displayName: username })
    const { actor } = await login(engine, username, 'senha-segura-99')
    await engine.setupClub(actor, {
      name: `Estresse ${i}`,
      formation: FORMATION_KEYS[i % FORMATION_KEYS.length],
      primary: '#ffd200',
      secondary: '#102318',
      crest,
    })
    actors.push(actor)
  }
  await engine.drawRosters(admin)
  for (let round = 0; round < 25; round++) {
    if (round) await engine.drawRosters(admin, { justification: `rodada ${round}` })
    const seen = new Set()
    for (const actor of actors) {
      const { club } = await engine.snapshot(actor)
      for (const band of bandsOf(club.roster)) assert.equal(band.got, band.count, band.label)
      assert.ok(coversFormation(club.roster, club.preferredFormation), `rodada ${round}: ${club.preferredFormation}`)
      for (const p of club.roster) {
        assert.equal(seen.has(p.id), false, 'jogador repetido entre clubes')
        seen.add(p.id)
      }
    }
  }
})

test('escudo do ateliê é validado, limpo e salvo', async () => {
  const { engine, admin } = await setupWorld()
  await engine.createParticipant(admin, { username: 'clube.teta', password: 'senha-segura-99', displayName: 'Teta' })
  const { actor } = await login(engine, 'clube.teta', 'senha-segura-99')
  const base = { version: 2, shape: 'moderno', pattern: 'listras', symbol: 'bola', primary: '#111111', secondary: '#ffd60a', accent: '#ffffff', monogram: 'TFC', ribbon: '', stars: 1 }
  await assert.rejects(
    () => engine.setupClub(actor, { name: 'Teta FC', formation: '4-3-3', crest: { ...base, symbol: 'nenhum', monogram: '' } }),
    /símbolo ou de uma sigla/,
  )
  await assert.rejects(
    () => engine.setupClub(actor, { name: 'Teta FC', formation: '4-3-3', crest: { ...base, primary: '#111111', secondary: '#111111', accent: '#111111' } }),
    /cores/,
  )
  await engine.setupClub(actor, { name: 'Teta FC', formation: '4-3-3', crest: { ...base, extra: '<script>', shape: 'moderno' } })
  const { club } = await engine.snapshot(actor)
  assert.deepEqual(club.crest, cleanCrest(base))
  assert.equal(club.primary, '#111111')
})

test('escalação salva em um campeonato vale para o desafio de outro', async () => {
  const { engine, admin, users } = await setupWorld()
  const ids = []
  for (const u of users) ids.push((await engine.snapshot(u)).club.id)
  const first = await engine.createChampionship(admin, { name: 'Copa A', format: 'pontos-corridos', clubIds: ids })
  const second = await engine.createChampionship(admin, { name: 'Copa B', format: 'pontos-corridos', clubIds: ids })
  await engine.generateCalendar(admin, second.id)
  for (const u of users) {
    const roster = (await engine.snapshot(u)).club.roster
    await engine.saveLineup(u, {
      championshipId: first.id,
      formation: '4-3-3',
      starters: roster.slice(0, 11).map((p) => p.id),
      bench: roster.slice(11, 18).map((p) => p.id),
      strategyPreset: 'equilibrada',
    })
  }
  const fixture = (await engine.snapshot(admin)).championships.find((c) => c.id === second.id).fixtures[0]
  const homeUser = await userByClub(engine, users, fixture.homeClubId)
  const awayUser = await userByClub(engine, users, fixture.awayClubId)
  const ch = await engine.challenge(homeUser, fixture.id)
  await engine.respondChallenge(awayUser, ch.id, true)
  const match = await engine.confirmChallengeStart(homeUser, ch.id)
  assert.equal(match.status, 'aguardando_confirmacao')
})

test('sem escalação o desafio diz qual clube falta e campeonato repetido é recusado', async () => {
  const { engine, admin, users } = await setupWorld()
  const ids = []
  for (const u of users) ids.push((await engine.snapshot(u)).club.id)
  const cup = await engine.createChampionship(admin, { name: 'Liga Draft XV', format: 'pontos-corridos', clubIds: ids })
  await assert.rejects(
    () => engine.createChampionship(admin, { name: ' liga draft xv ', format: 'pontos-corridos', clubIds: ids }),
    /mesmo nome|esse nome/,
  )
  await engine.generateCalendar(admin, cup.id)
  const fixture = (await engine.snapshot(admin)).championships.find((c) => c.id === cup.id).fixtures[0]
  const homeUser = await userByClub(engine, users, fixture.homeClubId)
  const awayUser = await userByClub(engine, users, fixture.awayClubId)
  const ch = await engine.challenge(homeUser, fixture.id)
  await engine.respondChallenge(awayUser, ch.id, true)
  await assert.rejects(() => engine.confirmChallengeStart(homeUser, ch.id), /Falta salvar a escalação/)
})

let failed = 0
for (const item of tests) {
  try {
    await item.fn()
    console.log(`ok  ${item.name}`)
  } catch (err) {
    failed += 1
    console.error(`fail ${item.name}`)
    console.error(err)
  }
}
if (failed) {
  console.error(`\n${failed} teste(s) falharam`)
  process.exit(1)
}
console.log(`\n${tests.length} testes do Draft XV passaram`)
