import { FORMATIONS } from '../../data/formations.js'
import { positionTiers } from './draw.js'

const best = (list) => [...list].sort((a, b) => b.overall - a.overall || String(a.name).localeCompare(String(b.name), 'pt-BR'))[0] || null

/**
 * Monta a escalação mais forte para a formação: o melhor jogador de cada posição
 * (ou de posição parecida) entre os titulares e os melhores restantes no banco,
 * sempre com um goleiro reserva quando houver.
 *
 * keepStarters/keepBench preservam escolhas que ainda valem (alinhadas às posições).
 * Devolve { formation, starters, bench }, com starters na ordem das posições da formação.
 */
export function autoLineup(roster, formation, { suspendedIds = new Set(), benchSize = 5, keepStarters = [], keepBench = [] } = {}) {
  const slots = FORMATIONS[formation] || FORMATIONS['4-3-3']
  const available = (roster || []).filter((p) => !suspendedIds.has(p.id))
  const byId = new Map(available.map((p) => [p.id, p]))
  const taken = new Set()

  const starters = slots.map((_, i) => {
    const id = keepStarters[i]
    if (id && byId.has(id) && !taken.has(id)) {
      taken.add(id)
      return id
    }
    return null
  })

  const free = () => available.filter((p) => !taken.has(p.id))
  const exactCount = (code) => free().filter((p) => p.position === code).length
  // Posições com menos opções primeiro, para não gastar o único lateral num buraco do meio.
  const empty = slots.map((_, i) => i).filter((i) => !starters[i])
  empty.sort((a, b) => exactCount(slots[a].code) - exactCount(slots[b].code))

  for (const i of empty) {
    const code = slots[i].code
    let pick = null
    for (const tier of positionTiers(code)) {
      pick = best(free().filter((p) => tier.includes(p.position)))
      if (pick) break
    }
    if (!pick) {
      const outfield = free().filter((p) => p.position !== 'GK')
      pick = code === 'GK' ? best(free()) : best(outfield) || best(free())
    }
    if (pick) {
      starters[i] = pick.id
      taken.add(pick.id)
    }
  }

  const bench = []
  for (const id of keepBench) {
    if (bench.length >= benchSize) break
    if (id && byId.has(id) && !taken.has(id)) {
      bench.push(id)
      taken.add(id)
    }
  }
  if (bench.length < benchSize && !bench.some((id) => byId.get(id)?.position === 'GK')) {
    const gk = best(free().filter((p) => p.position === 'GK'))
    if (gk) {
      bench.push(gk.id)
      taken.add(gk.id)
    }
  }
  for (const p of [...free()].sort((a, b) => b.overall - a.overall)) {
    if (bench.length >= benchSize) break
    bench.push(p.id)
    taken.add(p.id)
  }

  return { formation: FORMATIONS[formation] ? formation : '4-3-3', starters, bench }
}
