import { useMemo, useState } from 'react'
import { MATCH_TYPE_LABEL, POS_LINE_LABEL } from '../lib/eaApi'
import { LOGO_SRC } from '../lib/brand'
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

function clubInitials(name) {
  const parts = String(name || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return String(name || 'ADV').slice(0, 3).toUpperCase()
}

function possessionPct(side) {
  const raw = side?.possession ?? side?.possessionPct ?? side?.ballPossession
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function PossessionDisk({ usPct, themPct }) {
  if (usPct == null || themPct == null) return null
  const us = Math.max(0, Math.min(100, Number(usPct)))
  const them = Math.max(0, Math.min(100, Number(themPct)))
  const deg = (us / 100) * 360
  return (
    <div className="posse-disk">
      <div
        className="posse-ring"
        style={{
          background: `conic-gradient(#ffd200 0deg ${deg}deg, #f4f4f6 ${deg}deg 360deg)`,
        }}
        aria-label={`Posse de bola: XV ${Math.round(us)} por cento, rival ${Math.round(them)} por cento`}
      >
        <div className="posse-hole">
          <b>{Math.round(us)}%</b>
          <span>XV</span>
        </div>
      </div>
      <div className="posse-legend">
        <span>
          <i className="gold" /> XV {Math.round(us)}%
        </span>
        <span>
          <i className="white" /> Rival {Math.round(them)}%
        </span>
      </div>
    </div>
  )
}

function HexBadge({ crest, initials, label, kit }) {
  return (
    <div className="fim-club">
      <div
        className={`fim-crest${crest ? '' : ' rival'}`}
        style={!crest && kit?.[0] ? { background: kit[0] } : undefined}
      >
        {crest ? <img src={crest} alt={label} /> : <em>{initials}</em>}
      </div>
      <small>{label}</small>
    </div>
  )
}

function MotmFeature({ player, official, kit, onOpen }) {
  if (!player) return null
  const clickable = Boolean(onOpen)
  const Tag = clickable ? 'button' : 'div'
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      className={`motm-feature${clickable ? ' clickable' : ''}`}
      onClick={clickable ? () => onOpen(player.name) : undefined}
    >
      <div className="motm-stack" aria-hidden="true">
        <span className="motm-card" />
        <span className="motm-card" />
        <span className="motm-card">
          <PlayerMark name={player.name} colors={kit} size={52} />
        </span>
      </div>
      <div className="motm-copy">
        <p className="motm-kicker">
          {official ? 'Melhor em campo' : 'Maior nota'}
          <span aria-hidden="true"> →</span>
        </p>
        <h4>{player.name}</h4>
        <div className="motm-slashes">
          <span>/ nota {player.rating ? fmt(player.rating, 2) : '—'}</span>
          <span>/ {POS_LINE_LABEL[player.position] || player.position || 'linha n/d'}</span>
          {player.archetype ? <span>/ {player.archetype}</span> : null}
          {player.goals ? <span>/ {fmt(player.goals)} gol{player.goals === 1 ? '' : 's'}</span> : null}
        </div>
      </div>
    </Tag>
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
    const official = all.find((p) => p.motm) || null
    const fallback =
      all.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || null
    return { player: official || fallback, official: Boolean(official) }
  }, [us, them])

  const usPosse = possessionPct(us)
  const themPosse = possessionPct(them)
  const boardRows = [
    { label: 'Finalizações', us: us?.shots, them: them?.shots },
    { label: 'Assistências', us: us?.assists, them: them?.assists },
    { label: 'Passes', us: us?.passAttempts, them: them?.passAttempts },
    { label: 'Passes completos', us: us?.passes, them: them?.passes },
    { label: 'Desarmes', us: us?.tackleAttempts, them: them?.tackleAttempts },
    { label: 'Desarmes certos', us: us?.tackles, them: them?.tackles },
    { label: 'Defesas', us: us?.saves, them: them?.saves },
    { label: 'Cartões vermelhos', us: us?.redCards, them: them?.redCards },
    { label: 'Nota média', us: us?.avgRating, them: them?.avgRating, digits: 2 },
    { label: 'Jogadores em campo', us: us?.playerCount, them: them?.playerCount },
  ]

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
              {tab === 'resumo' && (
                <>
                  <section className="fim-board">
                    <div className="fim-board-grid" aria-hidden="true" />
                    <p className="fim-kicker">Fim de jogo</p>
                    <div className="fim-scoreline">
                      <HexBadge
                        crest={LOGO_SRC}
                        label="XV de PiriPiri"
                      />
                      <div className="fim-scoreline-mid">
                        <b className="fim-goals">{fmt(match.usGoals)}</b>
                        <h3 className="fim-title">Estatísticas da partida</h3>
                        <b className="fim-goals">{fmt(match.themGoals)}</b>
                      </div>
                      <HexBadge
                        initials={clubInitials(them?.name || match.opponent)}
                        label={them?.name || match.opponent || 'Adversário'}
                        kit={them?.kit}
                      />
                    </div>
                    <p className="fim-meta">
                      {resultLabel(match.result)}
                      {MATCH_TYPE_LABEL[match.type] ? ` · ${MATCH_TYPE_LABEL[match.type]}` : ''}
                      {match.timeAgo ? ` · ${timeAgoLabel(match.timeAgo)}` : ''}
                      {match.winnerByDnf ? ' · W.O.' : ''}
                    </p>
                    <MotmFeature
                      player={motm.player}
                      official={motm.official}
                      kit={us?.kit?.length ? us.kit : kitFallback}
                      onOpen={onOpenPlayer}
                    />
                    <PossessionDisk usPct={usPosse} themPct={themPosse} />
                    <div className="fim-rows">
                      {boardRows.map((row) => (
                        <div key={row.label} className="fim-row">
                          <b className="us">{fmt(row.us, row.digits)}</b>
                          <span>{row.label}</span>
                          <b className="them">{fmt(row.them, row.digits)}</b>
                        </div>
                      ))}
                    </div>
                  </section>

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
