import { useState } from 'react'
import { coins, overallTone } from './api.js'
import CrestMark from './CrestMark.jsx'
import PlayerFace from './PlayerFace.jsx'

export function PlayerCard({ player, actions }) {
  return (
    <article className="fut-card">
      <PlayerFace src={player.image} name={player.name} />
      <div className="fut-body">
        <div className="fut-title">
          <h4>{player.name}</h4>
          <span className={`ovr ${overallTone(player.overall)}`}>{player.overall}</span>
        </div>
        <small>
          {[player.position, player.club, player.nation, player.status].filter(Boolean).join(' · ')}
        </small>
        {player.buy != null && (
          <div className="fut-price">
            <span>
              Compra <b>{Number(player.buy).toLocaleString('pt-BR')}</b>
            </span>
            <span>
              Venda <b>{Number(player.sell).toLocaleString('pt-BR')}</b>
            </span>
          </div>
        )}
      </div>
      {actions ? <div className="card-actions">{actions}</div> : null}
    </article>
  )
}

export function ClubPicker({ clubs, users, selected, onChange }) {
  const list = clubs || []
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }
  const pending = (users || []).filter((u) => u.role === 'participante' && u.status === 'ativo' && !list.some((c) => c.userId === u.id || c.id === u.clubId))
  if (!list.length) {
    return <p className="muted">Nenhum clube concluído. Os participantes precisam criar o clube antes da inscrição.</p>
  }
  return (
    <div className="club-picker">
      <div className="actions">
        <button type="button" className="btn ghost" onClick={() => onChange(list.map((c) => c.id))}>
          Marcar todos
        </button>
        <button type="button" className="btn ghost" onClick={() => onChange([])}>
          Limpar
        </button>
      </div>
      {list.map((c) => {
        const owner = (users || []).find((u) => u.clubId === c.id)
        return (
          <label key={c.id} className="club-pick">
            <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
            <CrestMark crest={c.crest} size={28} />
            <span>
              <b>{c.name}</b>
              <small className="muted"> {owner?.displayName || owner?.username || c.participantName || '—'}</small>
            </span>
          </label>
        )
      })}
      {pending.map((u) => (
        <div key={u.id} className="club-pick" style={{ opacity: 0.55 }}>
          <input type="checkbox" disabled />
          <span>
            <b>{u.displayName || u.username}</b>
            <small className="muted"> ainda sem clube</small>
          </span>
        </div>
      ))}
    </div>
  )
}

function bandLabel(ovr) {
  if (ovr >= 92) return '92+'
  if (ovr >= 89) return '89–91'
  if (ovr >= 85) return '85–87'
  if (ovr === 83) return '83'
  if (ovr >= 74) return '74–79'
  return '65–73'
}

export function AdminTeams({ snap }) {
  const [q, setQ] = useState('')
  const drawDone = !!snap.drawDone
  const lastDraw = (snap.draws || [])[snap.draws.length - 1]
  const clubs = (snap.clubs || [])
    .filter((c) => c.setupComplete)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const drawn = clubs.filter((c) => (c.roster || []).length > 0)
  const term = q.trim().toLowerCase()
  const shown = drawn.filter((c) => {
    if (!term) return true
    const owner = (c.participantName || '').toLowerCase()
    const names = (c.roster || []).some((p) => p.name.toLowerCase().includes(term))
    return c.name.toLowerCase().includes(term) || owner.includes(term) || names
  })

  if (!drawDone) {
    return (
      <div className="card drawn-empty">
        <h3>Times sorteados</h3>
        <p className="muted">Essa visão abre depois do sorteio oficial. Até lá os elencos ainda não existem.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <h3>Times sorteados</h3>
        <p className="muted">
          {drawn.length} clube(s) com elenco
          {lastDraw ? ` · último sorteio ${new Date(lastDraw.at).toLocaleString('pt-BR')}` : ''}
        </p>
        <input className="lineup-search" placeholder="Buscar clube, participante ou jogador" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {shown.map((c) => {
        const roster = [...(c.roster || [])].sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name, 'pt-BR'))
        return (
          <details key={c.id} className="card admin-team" open={shown.length <= 3}>
            <summary>
              <CrestMark crest={c.crest} size={40} />
              <span>
                <b>{c.name}</b>
                <small className="muted">
                  {' '}
                  {c.participantName} · {c.preferredFormation} · {c.rosterCount}/{c.maxRoster} jogadores ·{' '}
                  {coins(c.spendable ?? c.balance)}
                </small>
              </span>
            </summary>
            <div className="player-grid" style={{ marginTop: 12 }}>
              {roster.map((p) => (
                <PlayerCard key={p.id} player={{ ...p, status: `${p.position} · faixa ${bandLabel(p.overall)}` }} />
              ))}
            </div>
          </details>
        )
      })}
      {shown.length === 0 ? <p className="muted">Nenhum time encontrado nessa busca.</p> : null}
    </div>
  )
}
