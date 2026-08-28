import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toPng } from 'html-to-image'
import { FORMATION_KEYS } from '../data/formations'
import { LINE_GROUPS, POSITION_COLORS, POSITION_LABELS } from '../data/positions'
import { LOGO_SRC } from '../lib/brand'

const LINE = 'rgba(255,255,255,0.72)'
const SW = 0.3

function PitchMarkings() {
  return (
    <svg className="pitch-svg" viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x="0" y={i * 10.5} width="68" height="5.25" fill="rgba(255,255,255,0.05)" />
      ))}
      <rect x="0.4" y="0.4" width="67.2" height="104.2" fill="none" stroke={LINE} strokeWidth={SW} />
      <line x1="0.4" y1="52.5" x2="67.6" y2="52.5" stroke={LINE} strokeWidth={SW} />
      <circle cx="34" cy="52.5" r="9.15" fill="none" stroke={LINE} strokeWidth={SW} />
      <circle cx="34" cy="52.5" r="0.42" fill={LINE} />
      <rect x="13.84" y="0.4" width="40.32" height="16.1" fill="none" stroke={LINE} strokeWidth={SW} />
      <rect x="24.84" y="0.4" width="18.32" height="5.1" fill="none" stroke={LINE} strokeWidth={SW} />
      <circle cx="34" cy="11" r="0.38" fill={LINE} />
      <path d="M26.69 16.5 A 9.15 9.15 0 0 1 41.31 16.5" fill="none" stroke={LINE} strokeWidth={SW} />
      <rect x="13.84" y="88.5" width="40.32" height="16.1" fill="none" stroke={LINE} strokeWidth={SW} />
      <rect x="24.84" y="99.5" width="18.32" height="5.1" fill="none" stroke={LINE} strokeWidth={SW} />
      <circle cx="34" cy="94" r="0.38" fill={LINE} />
      <path d="M26.69 88.5 A 9.15 9.15 0 0 0 41.31 88.5" fill="none" stroke={LINE} strokeWidth={SW} />
    </svg>
  )
}

function playerTag(player) {
  return (player?.psn || player?.name || '').trim()
}

export default function Escalacao({ store }) {
  const [overSlot, setOverSlot] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const cardRef = useRef(null)

  const lineupRows = store.slots.map((slot) => {
    const groupIndex = LINE_GROUPS.findIndex((group) => group.codes.includes(slot.code))
    const group = LINE_GROUPS[groupIndex] || LINE_GROUPS[0]
    return {
      slot,
      player: playerById(store.lineup[slot.id]) || null,
      color: POSITION_COLORS[slot.code] || group.color,
      groupIndex: groupIndex < 0 ? LINE_GROUPS.length : groupIndex,
      codeIndex: group.codes.indexOf(slot.code),
      x: slot.x,
    }
  })
  lineupRows.sort((a, b) => a.groupIndex - b.groupIndex || a.codeIndex - b.codeIndex || a.x - b.x)
  const lineGroups = LINE_GROUPS.map((group, groupIndex) => ({
    ...group,
    players: lineupRows.filter((row) => row.groupIndex === groupIndex),
  })).filter((group) => group.players.length)
  const filled = lineupRows.filter((row) => row.player).length
  const clubName = store.club.name || 'XV de PiriPiri'
  const when = new Date().toLocaleDateString('pt-BR')

  function onDragStart(e, playerId) {
    e.dataTransfer.setData('text/plain', playerId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDrop(e, slotId) {
    e.preventDefault()
    const playerId = e.dataTransfer.getData('text/plain')
    if (playerId) store.assignPlayer(slotId, playerId)
    setOverSlot(null)
  }

  function playerById(id) {
    return store.players.find((p) => p.id === id)
  }

  async function baixarImagem() {
    if (!cardRef.current || exporting) return
    setExportMsg('')
    flushSync(() => setExporting(true))
    try {
      await document.fonts.ready
      await new Promise((r) => setTimeout(r, 80))
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#0b0c10',
        filter: (el) => !(el instanceof Element && el.classList.contains('remove-x')),
      })
      const form = store.formation.replace(/-/g, '')
      const day = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `xv-piripiri-escalacao-${form}-${day}.png`
      a.click()
      setExportMsg('Imagem baixada. Manda no grupo do time.')
    } catch (e) {
      setExportMsg(`Não deu para gerar a imagem. ${e.message || 'Tente de novo.'}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Escalação</h2>
          <p>Arraste o elenco para o campo. Baixe a imagem e envie no grupo.</p>
        </div>
        <div className="actions">
          <select
            className="formation-select"
            value={store.formation}
            onChange={(e) => store.setFormation(e.target.value)}
          >
            {FORMATION_KEYS.map((f) => (
              <option key={f} value={f}>
                {f.replace(/-/g, '')} · {f}
              </option>
            ))}
          </select>
          <button className="btn" onClick={baixarImagem} disabled={exporting}>
            {exporting ? 'Gerando imagem…' : 'Baixar imagem'}
          </button>
          <button className="btn danger" onClick={store.resetLineup}>
            Zerar escalação
          </button>
        </div>
      </div>
      {exportMsg && (
        <div className={`notice ${exportMsg.startsWith('Imagem') ? 'ok' : 'error'}`} style={{ marginBottom: 16 }}>
          {exportMsg}
        </div>
      )}

      <div className="pitch-wrap">
        <section className="card">
          <h3>Banco / elenco</h3>
          <div className="player-list">
            {store.players.map((p) => (
              <article
                key={p.id}
                className={`player-card ${store.assignedIds.has(p.id) ? 'used' : ''}`}
                draggable
                onDragStart={(e) => onDragStart(e, p.id)}
              >
                <div>
                  <b>{p.name}</b>
                  <small>PSN {p.psn}</small>
                  <div className="pos-pills">
                    <span className="pill">{p.primaryPos}</span>
                    {p.secondaryPos ? <span className="pill">{p.secondaryPos}</span> : null}
                    {(p.extraPositions || []).map((x) => (
                      <span className="pill" key={x}>
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
            {store.players.length === 0 && (
              <div className="notice">Cadastre jogadores na aba Elenco para escalar.</div>
            )}
          </div>
        </section>

        <section className="card pitch-panel">
          <div className={`pitch-card${exporting ? ' is-exporting' : ''}`} ref={cardRef}>
            <header className="pitch-card-head">
              <img src={LOGO_SRC} alt="" draggable="false" />
              <div>
                <small>Escalação · {when}</small>
                <b>{clubName}</b>
                <span>
                  {store.formation} · {filled}/11
                </span>
              </div>
            </header>
            <div className="pitch-board">
              <aside className="onfield-list">
                <h4>
                  Em campo <span>{filled}/11</span>
                </h4>
                {lineGroups.map((group) => (
                  <div key={group.id} className="onfield-group">
                    <div className="onfield-group-title" style={{ color: group.color }}>
                      {group.label}
                    </div>
                    {group.players.map(({ slot, player, color }) => (
                      <div key={slot.id} className={`onfield-row${player ? '' : ' vacant'}`}>
                        <span className="onfield-pos" style={{ backgroundColor: color }}>
                          {slot.code}
                        </span>
                        <div>
                          <b>{player ? playerTag(player) : 'vago'}</b>
                          <small>{POSITION_LABELS[slot.code] || slot.code}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </aside>
              <div className="pitch">
                <PitchMarkings />
                {store.slots.map((slot) => {
                  const player = playerById(store.lineup[slot.id])
                  const color = POSITION_COLORS[slot.code] || '#ffd200'
                  const tagAbove = slot.y <= 16
                  return (
                    <div
                      key={slot.id}
                      className={`slot${player ? ' has-player' : ''}${tagAbove ? ' tag-above' : ''}`}
                      style={{
                        left: `${slot.x}%`,
                        top: `${100 - slot.y}%`,
                        '--pos-color': color,
                      }}
                    >
                      <div
                        className={`slot-hole ${player ? 'filled' : ''} ${overSlot === slot.id ? 'over' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setOverSlot(slot.id)
                        }}
                        onDragLeave={() => setOverSlot(null)}
                        onDrop={(e) => onDrop(e, slot.id)}
                      >
                        {player ? (
                          <button
                            className="remove-x"
                            title="Remover"
                            onClick={() => store.clearSlot(slot.id)}
                          >
                            ×
                          </button>
                        ) : null}
                        <span className={player ? 'token-pos' : 'token-empty'}>{slot.code}</span>
                      </div>
                      {player ? <div className="slot-tag">{playerTag(player)}</div> : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
