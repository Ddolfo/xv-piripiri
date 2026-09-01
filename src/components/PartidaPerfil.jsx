import { useMemo, useState } from 'react'
import { MATCH_TYPE_LABEL, POS_LINE_LABEL } from '../lib/eaApi'
import PlayerMark from './PlayerMark'

function fmt(n, digits) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? (Number.isInteger(v) ? 0 : 2),
  })
}

function timeAgoLabel(ago) {
  if (!ago) return ''
  const n = ago.number
  const unit = {
    seconds: 'segundos',
    minutes: 'minutos',
    hours: 'horas',
    days: 'dias',
    weeks: 'semanas',
    months: 'meses',
    years: 'anos',
  }[ago.unit] || ago.unit
  return `há ${n} ${unit}`
}

function resultLabel(code) {
  if (code === 'V') return 'Vitória'
  if (code === 'E') return 'Empate'
  if (code === 'D') return 'Derrota'
  return 'Sem resultado'
}

function passLine(side) {
  if (!side?.passAttempts) return fmt(side?.passes)
  return `${fmt(side.passes)}/${fmt(side.passAttempts)}`
}

function Stat({ label, value, hint }) {
  return (
    <div className="stat-box">
      <span className="stat-box-label">{label}</span>
      <b className="stat-box-value">{value}</b>
      {hint ? <small className="stat-box-hint">{hint}</small> : null}
    </div>
  )
}

function Group({ title, children }) {
  return (
    <section className="stat-group">
      <h4>{title}</h4>
      <div className="stat-group-grid">{children}</div>
    </section>
  )
}

function VsBar({ label, us, them, digits }) {
  const a = Number(us) || 0
  const b = Number(them) || 0
  const tot = a + b
  const pct = tot ? Math.round((a / tot) * 100) : 50
  return (
    <div className="vs-bar">
      <div className="vs-bar-top">
        <b>{fmt(a, digits)}</b>
        <span>{label}</span>
        <b>{fmt(b, digits)}</b>
      </div>
      <div className="vs-bar-track">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const PLAYER_SORTS = [
  { key: 'rating', label: 'Nota' },
  { key: 'goals', label: 'Gols' },
  { key: 'assists', label: 'Assistências' },
  { key: 'shots', label: 'Chutes' },
  { key: 'passes', label: 'Passes' },
  { key: 'tackles', label: 'Desarmes' },
  { key: 'minutes', label: 'Minutos' },
  { key: 'name', label: 'Nome' },
]

function sortPlayers(list, key, dir) {
  return [...(list || [])].sort((a, b) => {
    if (key === 'name') {
      const cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      return dir === 'asc' ? cmp : -cmp
    }
    const av = Number(a[key]) || 0
    const bv = Number(b[key]) || 0
    if (av !== bv) return dir === 'asc' ? av - bv : bv - av
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

function PlayerTable({ side, sortKey, sortDir, onOpenPlayer, kitFallback }) {
  const rows = sortPlayers(side?.players, sortKey, sortDir)
  if (!rows.length) {
    return <div className="notice">A EA não devolveu jogadores deste lado nesta súmula.</div>
  }
  return (
    <div className="table-scroll">
      <table className="stats-table">
        <thead>
          <tr>
            <th>Jogador</th>
            <th>Linha</th>
            <th>Arquétipo</th>
            <th>Min</th>
            <th>Gols</th>
            <th>Assist.</th>
            <th>Chutes</th>
            <th>Nota</th>
            <th>MOTM</th>
            <th>Passes</th>
            <th>% passe</th>
            <th>Desarmes</th>
            <th>% desarme</th>
            <th>Faltas</th>
            <th>Faltas sofridas</th>
            <th>Vermelho</th>
            <th>Defesas</th>
            <th>Gols sofridos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.id || p.name}
              className={onOpenPlayer ? 'stats-row-click' : ''}
              onClick={() => onOpenPlayer?.(p.name)}
            >
              <td>
                <div className="player-rank">
                  <PlayerMark name={p.name} colors={side?.kit?.length ? side.kit : kitFallback} size={34} />
                  <div>
                    {p.name}
                    {p.idle ? (
                      <div>
                        <small>Inativo {fmt(p.idle)} s</small>
                      </div>
                    ) : null}
                  </div>
                </div>
              </td>
              <td>{POS_LINE_LABEL[p.position] || p.position || '—'}</td>
              <td>{p.archetype || '—'}</td>
              <td>{fmt(p.minutes)}</td>
              <td>{fmt(p.goals)}</td>
              <td>{fmt(p.assists)}</td>
              <td>{fmt(p.shots)}</td>
              <td>{p.rating ? fmt(p.rating, 2) : '—'}</td>
              <td>{p.motm ? 'Sim' : '—'}</td>
              <td>
                {p.passAttempts ? `${fmt(p.passes)}/${fmt(p.passAttempts)}` : fmt(p.passes)}
              </td>
              <td>{p.passPct != null ? `${p.passPct}%` : '—'}</td>
              <td>
                {p.tackleAttempts ? `${fmt(p.tackles)}/${fmt(p.tackleAttempts)}` : fmt(p.tackles)}
              </td>
              <td>{p.tacklePct != null ? `${p.tacklePct}%` : '—'}</td>
              <td>{fmt(p.fouls)}</td>
              <td>{fmt(p.foulsWon)}</td>
              <td>{fmt(p.redCards)}</td>
              <td>{p.saves ? fmt(p.saves) : '—'}</td>
              <td>{p.goalsConceded ? fmt(p.goalsConceded) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PartidaPerfil({
  match,
  matches,
  store,
  onClose,
  onSelectMatch,
  onOpenPlayer,
}) {
  const [tab, setTab] = useState('resumo')
  const [sortKey, setSortKey] = useState('rating')
  const [sortDir, setSortDir] = useState('desc')
  const us = match?.us
  const them = match?.them
  const homeName = us?.name || store.club.name || 'XV de PiriPiri'
  const list = matches?.length ? matches : [match].filter(Boolean)
  const kitFallback = store.ea?.info?.kit?.home || []

  const scorers = useMemo(() => {
    const pick = (side) =>
      (side?.players || [])
        .filter((p) => p.goals > 0)
        .sort((a, b) => b.goals - a.goals)
        .map((p) => ({ ...p, club: side.name }))
    return [...pick(us), ...pick(them)]
  }, [us, them])

  const assisters = useMemo(() => {
    const pick = (side) =>
      (side?.players || [])
        .filter((p) => p.assists > 0)
        .sort((a, b) => b.assists - a.assists)
        .map((p) => ({ ...p, club: side.name }))
    return [...pick(us), ...pick(them)]
  }, [us, them])

  const motm = useMemo(() => {
    const all = [...(us?.players || []), ...(them?.players || [])]
    return all.find((p) => p.motm) || all.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || null
  }, [us, them])

  function applySort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'name' ? 'asc' : 'desc')
  }

  if (!match) return null

  return (
    <div className="player-stage">
      <aside className="player-nav">
        <button type="button" className="player-back" onClick={onClose}>
          ← Voltar aos jogos
        </button>
        <p className="player-nav-kicker">Partida</p>
        <h3>
          {fmt(match.usGoals)} × {fmt(match.themGoals)}
        </h3>
        <small className="player-nav-psn">{them?.name || match.opponent || 'Adversário'}</small>
        <p className="player-id-line">
          {resultLabel(match.result)}
          {match.winnerByDnf ? ' · W.O.' : ''}
        </p>
        <p className="player-nav-kicker" style={{ marginTop: 18 }}>
          Jogos recentes
        </p>
        <nav>
          {list.map((m) => (
            <button
              key={m.id}
              type="button"
              className={m.id === match.id ? 'active' : ''}
              onClick={() => {
                onSelectMatch?.(m)
                setTab('resumo')
              }}
            >
              <b>
                {fmt(m.usGoals)} × {fmt(m.themGoals)} {m.opponent}
              </b>
              <small>
                {MATCH_TYPE_LABEL[m.type] || m.type}
                {m.timeAgo ? ` · ${timeAgoLabel(m.timeAgo)}` : ''}
              </small>
            </button>
          ))}
        </nav>
      </aside>

      <div className="player-main">
        <header className="player-hero">
          <div>
            <p className="player-nav-kicker">Você está vendo</p>
            <h2>
              {homeName} {fmt(match.usGoals)} × {fmt(match.themGoals)} {them?.name || match.opponent}
            </h2>
            <p>
              {MATCH_TYPE_LABEL[match.type] || match.type}
              {match.timeAgo ? ` · ${timeAgoLabel(match.timeAgo)}` : ''}
              {us?.stadium ? ` · ${us.stadium}` : ''}
              {match.winnerByDnf ? ' · ganhou por W.O.' : ''}
            </p>
          </div>
          <div className="player-tabs">
            {[
              ['resumo', 'Resumo'],
              ['xv', homeName],
              ['rival', them?.name || 'Adversário'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={tab === key ? 'active' : ''}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="player-frame">
          {!us ? (
            <div className="notice">
              Esta partida ainda não tem a súmula completa. Atualize da EA e abra de novo.
            </div>
          ) : (
            <>
              <div className="match-scoreboard">
                <div>
                  <span>{homeName}</span>
                  <b>{fmt(match.usGoals)}</b>
                  <small>{fmt(us.playerCount)} em campo</small>
                </div>
                <em className={`match-res ${(match.result || '').toLowerCase()}`}>
                  {match.result || '—'}
                </em>
                <div>
                  <span>{them?.name || match.opponent}</span>
                  <b>{fmt(match.themGoals)}</b>
                  <small>{fmt(them?.playerCount)} em campo</small>
                </div>
              </div>

              {tab === 'resumo' && (
                <>
                  <div className="stat-hero stat-hero-4">
                    <div className="stat-hero-item gold">
                      <span>Placar</span>
                      <b>
                        {fmt(match.usGoals)}–{fmt(match.themGoals)}
                      </b>
                      <small>{resultLabel(match.result)}</small>
                    </div>
                    <div className="stat-hero-item">
                      <span>Nota do XV</span>
                      <b>{us.avgRating ? fmt(us.avgRating, 2) : '—'}</b>
                      <small>Média 0 a 10</small>
                    </div>
                    <div className="stat-hero-item">
                      <span>Finalizações</span>
                      <b>{fmt(us.shots)}</b>
                      <small>Rival {fmt(them?.shots)}</small>
                    </div>
                    <div className="stat-hero-item">
                      <span>Melhor em campo</span>
                      <b>{motm?.name || '—'}</b>
                      <small>
                        {motm?.rating ? `Nota ${fmt(motm.rating, 2)}` : 'Sem MOTM na súmula'}
                        {motm?.motm ? '' : motm ? ' · maior nota' : ''}
                      </small>
                    </div>
                  </div>

                  <section className="stat-group">
                    <h4>XV × {them?.name || 'adversário'}</h4>
                    <div className="vs-list">
                      <VsBar label="Gols" us={us.goals} them={them?.goals} />
                      <VsBar label="Finalizações" us={us.shots} them={them?.shots} />
                      <VsBar label="Assistências" us={us.assists} them={them?.assists} />
                      <VsBar label="Passes certos" us={us.passes} them={them?.passes} />
                      <VsBar label="Passes tentados" us={us.passAttempts} them={them?.passAttempts} />
                      <VsBar label="Desarmes certos" us={us.tackles} them={them?.tackles} />
                      <VsBar label="Desarmes tentados" us={us.tackleAttempts} them={them?.tackleAttempts} />
                      <VsBar label="Defesas" us={us.saves} them={them?.saves} />
                      <VsBar label="Faltas" us={us.fouls} them={them?.fouls} />
                      <VsBar label="Nota média" us={us.avgRating} them={them?.avgRating} digits={2} />
                    </div>
                    <p className="stats-sort-hint" style={{ marginTop: 10 }}>
                      A barra mostra o volume de cada lado. A EA não publica posse de bola — o
                      volume de passe é o recorte mais próximo.
                    </p>
                  </section>

                  <Group title="Números do XV nesta partida">
                    <Stat label="Gols" value={fmt(us.goals)} hint="Marcados pelo XV" />
                    <Stat label="Gols sofridos" value={fmt(us.goalsAgainst || them?.goals)} hint="Levados nesta súmula" />
                    <Stat label="Assistências" value={fmt(us.assists)} />
                    <Stat label="Finalizações" value={fmt(us.shots)} />
                    <Stat
                      label="Passes certos / tentados"
                      value={passLine(us)}
                      hint={us.passPct ? `${us.passPct}% de acerto` : ''}
                    />
                    <Stat
                      label="Desarmes certos / tentados"
                      value={
                        us.tackleAttempts
                          ? `${fmt(us.tackles)}/${fmt(us.tackleAttempts)}`
                          : fmt(us.tackles)
                      }
                      hint={us.tacklePct ? `${us.tacklePct}% de acerto` : ''}
                    />
                    <Stat label="Defesas" value={fmt(us.saves)} />
                    <Stat label="Cartões vermelhos" value={fmt(us.redCards)} />
                    <Stat label="Faltas cometidas" value={fmt(us.fouls)} hint="Evento 30 da súmula da EA" />
                    <Stat label="Faltas sofridas" value={fmt(us.foulsWon)} hint="Evento 31 da súmula da EA" />
                    <Stat label="Jogadores em campo" value={fmt(us.playerCount)} />
                    <Stat
                      label="Minutos somados"
                      value={fmt(Math.round((us.secondsPlayed || 0) / 60))}
                      hint="Soma do tempo de todos os Pros"
                    />
                  </Group>

                  <Group title={`Números de ${them?.name || 'adversário'}`}>
                    <Stat label="Gols" value={fmt(them?.goals)} />
                    <Stat label="Assistências" value={fmt(them?.assists)} />
                    <Stat label="Finalizações" value={fmt(them?.shots)} />
                    <Stat
                      label="Passes certos / tentados"
                      value={passLine(them)}
                      hint={them?.passPct ? `${them.passPct}% de acerto` : ''}
                    />
                    <Stat
                      label="Desarmes certos / tentados"
                      value={
                        them?.tackleAttempts
                          ? `${fmt(them.tackles)}/${fmt(them.tackleAttempts)}`
                          : fmt(them?.tackles)
                      }
                    />
                    <Stat label="Defesas" value={fmt(them?.saves)} />
                    <Stat label="Nota média" value={them?.avgRating ? fmt(them.avgRating, 2) : '—'} />
                    <Stat label="Jogadores em campo" value={fmt(them?.playerCount)} />
                    <Stat label="Estádio" value={them?.stadium || us.stadium || '—'} />
                    <Stat label="W.O. do rival" value={them?.winnerByDnf ? 'Sim' : 'Não'} />
                  </Group>

                  {scorers.length ? (
                    <section className="stat-group">
                      <h4>Autores dos gols</h4>
                      <ul className="match-scorers">
                        {scorers.map((p) => (
                          <li key={`g-${p.id}-${p.club}`}>
                            <b>{p.name}</b>
                            <span>
                              {p.club} · {fmt(p.goals)} gol{p.goals === 1 ? '' : 's'}
                              {p.archetype ? ` · ${p.archetype}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {assisters.length ? (
                    <section className="stat-group">
                      <h4>Assistências</h4>
                      <ul className="match-scorers">
                        {assisters.map((p) => (
                          <li key={`a-${p.id}-${p.club}`}>
                            <b>{p.name}</b>
                            <span>
                              {p.club} · {fmt(p.assists)} assist.{p.archetype ? ` · ${p.archetype}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {match.winnerByDnf ? (
                    <p className="stats-sort-hint">
                      A EA marcou W.O. nesta partida. Os números do rival às vezes vêm incompletos
                      quando alguém caiu da sala.
                    </p>
                  ) : null}
                </>
              )}

              {(tab === 'xv' || tab === 'rival') && (
                <>
                  <p className="card-lead" style={{ marginTop: 0 }}>
                    Tudo o que a súmula publica para cada Pro. Clique no jogador do XV para abrir a
                    ficha.
                  </p>
                  <div className="stats-filters">
                    <span className="stats-filters-label">Ordenar</span>
                    {PLAYER_SORTS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={`filter-chip${sortKey === opt.key ? ' active' : ''}`}
                        onClick={() => applySort(opt.key)}
                      >
                        {opt.label}
                        {sortKey === opt.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                      </button>
                    ))}
                  </div>
                  <PlayerTable
                    side={tab === 'xv' ? us : them}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    kitFallback={kitFallback}
                    onOpenPlayer={tab === 'xv' ? onOpenPlayer : undefined}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
