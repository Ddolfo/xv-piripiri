export function compactMatch(m) {
  if (!m) return null
  const id = String(m.id || '')
  if (!id) return null
  return {
    id,
    type: m.type || '',
    timestamp: Number(m.timestamp) || 0,
    opponent: String(m.opponent || 'Adversário').trim() || 'Adversário',
    opponentId: String(m.opponentId || ''),
    usGoals: Number(m.usGoals) || 0,
    themGoals: Number(m.themGoals) || 0,
    result: m.result === 'V' || m.result === 'E' || m.result === 'D' ? m.result : '',
    winnerByDnf: Boolean(m.winnerByDnf),
  }
}

export function mergeHistory(...lists) {
  const map = new Map()
  lists.flat().forEach((raw) => {
    const row = compactMatch(raw)
    if (!row) return
    const prev = map.get(row.id)
    if (!prev) {
      map.set(row.id, row)
      return
    }
    map.set(row.id, {
      ...prev,
      ...row,
      opponent:
        row.opponent && row.opponent !== 'Adversário' ? row.opponent : prev.opponent,
      opponentId: row.opponentId || prev.opponentId,
      timestamp: Math.max(prev.timestamp || 0, row.timestamp || 0),
    })
  })
  return [...map.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || b.id.localeCompare(a.id))
}

export async function loadSeedHistory() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}historico-rivais.json`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.matches) ? data.matches : []
  } catch {
    return []
  }
}

function rivalKey(m) {
  return m.opponentId ? `id:${m.opponentId}` : `n:${String(m.opponent || '').trim().toLowerCase()}`
}

export function summarizeRivals(history) {
  const by = {}
  ;(history || []).forEach((m) => {
    const key = rivalKey(m)
    if (!key || key === 'n:' || key === 'n:adversário') return
    if (!by[key]) {
      by[key] = {
        key,
        id: m.opponentId || '',
        name: m.opponent || 'Adversário',
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        lastTs: 0,
      }
    }
    const r = by[key]
    if (m.opponent && m.opponent !== 'Adversário') r.name = m.opponent
    if (m.opponentId) r.id = m.opponentId
    r.games += 1
    r.gf += Number(m.usGoals) || 0
    r.ga += Number(m.themGoals) || 0
    if (m.result === 'V') r.wins += 1
    else if (m.result === 'E') r.draws += 1
    else if (m.result === 'D') r.losses += 1
    r.lastTs = Math.max(r.lastTs, Number(m.timestamp) || 0)
  })

  const list = Object.values(by)
    .map((r) => ({
      ...r,
      diff: r.wins - r.losses,
      gd: r.gf - r.ga,
      winPct: r.games ? Math.round((r.wins / r.games) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name, 'pt-BR'))

  const pato = [...list].filter((r) => r.wins > 0).sort((a, b) => b.wins - a.wins || b.gd - a.gd || b.games - a.games)[0] || null
  const algoz = [...list].filter((r) => r.losses > 0).sort((a, b) => b.losses - a.losses || a.gd - b.gd || b.games - a.games)[0] || null
  const maisJogado = list[0] || null
  const disputado =
    [...list]
      .filter((r) => r.games >= 2)
      .sort((a, b) => {
        const closeA = Math.abs(a.wins - a.losses)
        const closeB = Math.abs(b.wins - b.losses)
        if (closeA !== closeB) return closeA - closeB
        if (a.games !== b.games) return b.games - a.games
        return Math.abs(a.gd) - Math.abs(b.gd)
      })[0] || null

  return {
    list,
    pato,
    algoz,
    maisJogado,
    disputado,
    total: (history || []).length,
  }
}
