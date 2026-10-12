import { useState } from 'react'
import { FORMATIONS } from '../../data/formations.js'
import { STRATEGY_PRESETS } from '../lib/constants.js'
import { draftApi, overallTone } from './api.js'

const DRAG = 'application/x-draft-xv-player'

function pad(list, n) {
  const next = [...(list || [])]
  while (next.length < n) next.push(null)
  return next.slice(0, n)
}

function withoutId(list, id) {
  return (list || []).map((x) => (x === id ? null : x))
}

export default function LineupView({ snap, run }) {
  const club = snap.club
  const roster = club.roster || []
  const cupId = snap.championships?.[0]?.id || 'geral'
  const saved = snap.lineups?.[`${club.id}:${cupId}`] || snap.lineups?.[`${club.id}:geral`]
  const [formation, setFormation] = useState(saved?.formation || '4-3-3')
  const slots = FORMATIONS[formation] || FORMATIONS['4-3-3']
  const [starters, setStarters] = useState(() => pad(saved?.starters, slots.length))
  const [bench, setBench] = useState(() => pad(saved?.bench, 7))
  const [preset, setPreset] = useState(saved?.strategyPreset || 'equilibrada')
  const [pick, setPick] = useState(null)
  const [over, setOver] = useState(null)
  const [q, setQ] = useState('')
  const suspended = new Set((snap.suspensions || []).map((s) => s.playerId))
  const used = new Set([...starters, ...bench].filter(Boolean))

  const term = q.trim().toLowerCase()
  const visible = [...roster]
    .sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name, 'pt-BR'))
    .filter((p) => {
      if (!term) return true
      return p.name.toLowerCase().includes(term) || String(p.position).toLowerCase().includes(term) || String(p.overall) === term
    })

  function playerById(id) {
    return roster.find((p) => p.id === id)
  }

  function changeFormation(nextId) {
    const nextSlots = FORMATIONS[nextId] || FORMATIONS['4-3-3']
    const keep = starters.filter(Boolean)
    setFormation(nextId)
    setStarters(pad(keep, nextSlots.length))
  }

  function placeStarter(index, playerId) {
    if (!playerId || suspended.has(playerId)) return
    const fromStart = starters.indexOf(playerId)
    const fromBench = bench.indexOf(playerId)
    const occupant = starters[index] || null
    let nextS = pad(starters, slots.length)
    let nextB = pad(bench, 7)
    nextS[index] = playerId
    if (fromStart >= 0 && fromStart !== index) nextS[fromStart] = occupant
    else if (fromBench >= 0) {
      nextB[fromBench] = occupant
      nextB = pad(nextB.filter(Boolean), 7)
    }
    setStarters(nextS)
    setBench(nextB)
    setPick(null)
  }

  function placeBench(index, playerId) {
    if (!playerId || suspended.has(playerId)) return
    const fromStart = starters.indexOf(playerId)
    const fromBench = bench.indexOf(playerId)
    const occupant = bench[index] || null
    let nextS = pad(starters, slots.length)
    let nextB = pad(bench, 7)
    nextB[index] = playerId
    if (fromBench >= 0 && fromBench !== index) nextB[fromBench] = occupant
    else if (fromStart >= 0) {
      nextS[fromStart] = occupant
    }
    setStarters(nextS)
    setBench(nextB)
    setPick(null)
  }

  function removePlayer(playerId) {
    setStarters((s) => withoutId(pad(s, slots.length), playerId))
    setBench((b) => pad(withoutId(b, playerId).filter(Boolean), 7))
    if (pick === playerId) setPick(null)
  }

  function onDragStart(e, playerId) {
    if (suspended.has(playerId)) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData(DRAG, playerId)
    e.dataTransfer.setData('text/plain', playerId)
    e.dataTransfer.effectAllowed = 'move'
    setPick(playerId)
  }

  function readDrag(e) {
    return e.dataTransfer.getData(DRAG) || e.dataTransfer.getData('text/plain')
  }

  function onSlotClick(kind, index, occupantId) {
    if (pick) {
      if (kind === 'starter') placeStarter(index, pick)
      else placeBench(index, pick)
      return
    }
    if (occupantId) setPick(occupantId)
  }

  if (!roster.length) {
    return (
      <div className="card">
        <h3>Formação e Escalação</h3>
        <p className="muted">Seu elenco aparece aqui depois do sorteio oficial. Até lá o campinho fica vazio.</p>
      </div>
    )
  }

  return (
    <div className="lineup-board">
      <div className="card lineup-roster">
        <h3>Elenco ({roster.length})</h3>
        <p className="lineup-hint">
          Clique no jogador e depois na posição, ou arraste até o campinho. O X no nome tira da escalação.
        </p>
        <input className="lineup-search" placeholder="Buscar no elenco" value={q} onChange={(e) => setQ(e.target.value)} />
        <div
          className={`lineup-list${over === 'list' ? ' drop-on' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setOver('list')
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => {
            e.preventDefault()
            const id = readDrag(e)
            if (id) removePlayer(id)
            setOver(null)
          }}
        >
          {visible.map((p) => {
            const onField = used.has(p.id)
            const blocked = suspended.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                className={`lineup-row${pick === p.id ? ' picked' : ''}${onField ? ' on-pitch' : ''}${blocked ? ' blocked' : ''}`}
                draggable={!blocked}
                onDragStart={(e) => onDragStart(e, p.id)}
                onClick={() => {
                  if (blocked) return
                  setPick((cur) => (cur === p.id ? null : p.id))
                }}
              >
                {p.image ? <img src={p.image} alt="" /> : <span className="lineup-face" />}
                <span className={`ovr ${overallTone(p.overall)}`}>{p.overall}</span>
                <span className="lineup-row-text">
                  <b>{p.name}</b>
                  <small>
                    {p.position}
                    {onField ? (starters.includes(p.id) ? ' · titular' : ' · banco') : ' · disponível'}
                    {blocked ? ' · suspenso' : ''}
                  </small>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div className="filters">
          <select value={formation} onChange={(e) => changeFormation(e.target.value)}>
            {Object.keys(FORMATIONS).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {STRATEGY_PRESETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            className="btn"
            onClick={() =>
              run(
                () =>
                  draftApi.saveLineup({
                    championshipId: cupId,
                    formation,
                    starters: starters.filter(Boolean).slice(0, 11),
                    bench: bench.filter(Boolean).slice(0, 7),
                    strategyPreset: preset,
                    captainId: starters.find(Boolean),
                  }),
                'Escalação salva.',
              )
            }
          >
            Salvar escalação
          </button>
        </div>
        <p className="muted">
          Titulares {starters.filter(Boolean).length}/11 · Banco {bench.filter(Boolean).length}/7
          {pick ? ` · selecionado: ${playerById(pick)?.name || ''}` : ''}
        </p>
        <div className="draft-pitch">
          {slots.map((slot, i) => {
            const player = playerById(starters[i])
            const ready = pick && !player
            return (
              <div key={slot.id} className="draft-slot" style={{ left: `${slot.x}%`, top: `${100 - slot.y}%` }}>
                <div
                  className={`draft-chip${player ? ' filled' : ''}${over === `s${i}` ? ' over' : ''}${ready ? ' ready' : ''}${pick && player?.id === pick ? ' picked' : ''}`}
                  draggable={Boolean(player)}
                  onDragStart={(e) => player && onDragStart(e, player.id)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOver(`s${i}`)
                  }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = readDrag(e)
                    if (id) placeStarter(i, id)
                    setOver(null)
                  }}
                  onClick={() => onSlotClick('starter', i, player?.id)}
                >
                  {player ? (
                    <button
                      type="button"
                      className="draft-x"
                      title="Remover da posição"
                      onClick={(e) => {
                        e.stopPropagation()
                        removePlayer(player.id)
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                  <span className="draft-pos">{slot.code}</span>
                  <b>{player ? player.name : 'vazio'}</b>
                </div>
              </div>
            )
          })}
        </div>
        <h4 className="bench-title">Banco</h4>
        <div className="draft-bench">
          {pad(bench, 7).map((id, i) => {
            const player = playerById(id)
            return (
              <div
                key={`b${i}`}
                className={`draft-chip bench${player ? ' filled' : ''}${over === `b${i}` ? ' over' : ''}${pick && !player ? ' ready' : ''}`}
                draggable={Boolean(player)}
                onDragStart={(e) => player && onDragStart(e, player.id)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver(`b${i}`)
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  const idDrop = readDrag(e)
                  if (idDrop) placeBench(i, idDrop)
                  setOver(null)
                }}
                onClick={() => onSlotClick('bench', i, player?.id)}
              >
                {player ? (
                  <button
                    type="button"
                    className="draft-x"
                    title="Remover do banco"
                    onClick={(e) => {
                      e.stopPropagation()
                      removePlayer(player.id)
                    }}
                  >
                    ×
                  </button>
                ) : null}
                <span className="draft-pos">{i + 12}</span>
                <b>{player ? player.name : 'banco'}</b>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
