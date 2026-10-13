/**
 * Sorteio do elenco inicial respeitando a formação preferida do clube.
 *
 * Mantém as faixas de over (DRAW_BANDS) e garante pelo menos um jogador para cada
 * posição da formação. Quem cobre as posições também conta na cota da sua faixa;
 * o restante das cotas sai aleatório, de qualquer posição.
 */

// Quando não há jogador na posição exata, aceita uma posição parecida.
// O banco da EA não tem LWB/RWB e quase não tem CF.
const NEAR = {
  LWB: ['LB', 'LM'],
  RWB: ['RB', 'RM'],
  CF: ['ST', 'CAM'],
  LW: ['LM'],
  RW: ['RM'],
  LM: ['LW'],
  RM: ['RW'],
  CDM: ['CM'],
  CAM: ['CM'],
  CM: ['CDM', 'CAM'],
  ST: ['CF'],
  LB: ['LWB'],
  RB: ['RWB'],
}

export function positionTiers(code) {
  return [[code], NEAR[code] || []].filter((t) => t.length)
}

function shuffle(list, rand) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function bandOf(player, bands) {
  return bands.findIndex((b) => player.overall >= b.min && player.overall <= b.max)
}

// Escolhe uma faixa ponderada pela cota que ainda resta, entre as que têm candidato.
function pickWeighted(entries, rand) {
  const total = entries.reduce((a, e) => a + e.weight, 0)
  let r = rand() * total
  for (const e of entries) {
    r -= e.weight
    if (r < 0) return e
  }
  return entries[entries.length - 1]
}

function coverSlots(players, bands, slotCodes, rand) {
  const quota = bands.map((b) => b.count)
  const taken = new Set()
  const picked = []
  const countFor = (code) => players.filter((p) => p.position === code).length
  // Posições mais raras primeiro, com desempate aleatório.
  const order = shuffle(slotCodes, rand).sort((a, b) => countFor(a) - countFor(b))

  for (const code of order) {
    let chosen = null
    for (const tier of positionTiers(code)) {
      const byBand = new Map()
      for (const p of players) {
        if (taken.has(p.id) || !tier.includes(p.position)) continue
        const band = bandOf(p, bands)
        if (band < 0 || quota[band] <= 0) continue
        if (!byBand.has(band)) byBand.set(band, [])
        byBand.get(band).push(p)
      }
      if (!byBand.size) continue
      const entry = pickWeighted(
        [...byBand.entries()].map(([band, list]) => ({ band, list, weight: quota[band] })),
        rand,
      )
      chosen = { band: entry.band, player: entry.list[Math.floor(rand() * entry.list.length)] }
      break
    }
    if (!chosen) return { ok: false, missing: code }
    quota[chosen.band] -= 1
    taken.add(chosen.player.id)
    picked.push({ player: chosen.player, slot: code })
  }
  return { ok: true, quota, taken, picked }
}

/**
 * players: jogadores livres e disponíveis para este clube.
 * Retorna { ok: true, players, covered } ou { ok: false, reason, missing?, band? }.
 */
export function drawFormationRoster({ players, bands, slotCodes, rand = Math.random, attempts = 40 }) {
  let lastMissing = null
  for (let attempt = 0; attempt < attempts; attempt++) {
    const cover = coverSlots(players, bands, slotCodes, rand)
    if (!cover.ok) {
      lastMissing = cover.missing
      continue
    }
    const rest = []
    for (let i = 0; i < bands.length; i++) {
      if (!cover.quota[i]) continue
      const pool = players.filter((p) => !cover.taken.has(p.id) && bandOf(p, bands) === i)
      if (pool.length < cover.quota[i]) return { ok: false, reason: 'band', band: bands[i], have: pool.length, need: cover.quota[i] }
      rest.push(...shuffle(pool, rand).slice(0, cover.quota[i]))
    }
    return {
      ok: true,
      players: [...cover.picked.map((x) => x.player), ...rest],
      covered: cover.picked.map((x) => ({ slot: x.slot, playerId: x.player.id, position: x.player.position })),
    }
  }
  return { ok: false, reason: 'position', missing: lastMissing }
}
