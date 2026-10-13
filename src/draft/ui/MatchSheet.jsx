import { useEffect, useState } from 'react'
import CrestMark from './CrestMark.jsx'

const STAT_ROWS = [
  ['possession', 'Posse de bola', (v) => `${v}%`],
  ['xg', 'Gols esperados (xG)', (v) => Number(v).toFixed(2).replace('.', ',')],
  ['shots', 'Finalizações'],
  ['shotsOnTarget', 'Chutes no gol'],
  ['corners', 'Escanteios'],
  ['offsides', 'Impedimentos'],
  ['fouls', 'Faltas'],
  ['yellows', 'Cartões amarelos'],
  ['reds', 'Cartões vermelhos'],
  ['passes', 'Passes'],
  ['passAccuracy', 'Precisão de passe', (v) => `${v}%`],
  ['tackles', 'Desarmes'],
  ['saves', 'Defesas do goleiro'],
]

// Menos é melhor nestas: a barra destaca quem teve menos.
const LOWER_IS_BETTER = new Set(['fouls', 'yellows', 'reds', 'offsides'])

function ratingTone(r) {
  if (r >= 8) return 'top'
  if (r >= 7) return 'good'
  if (r >= 6) return 'ok'
  return 'low'
}

function StatRow({ id, label, home, away, format = (v) => v }) {
  const a = Number(home) || 0
  const b = Number(away) || 0
  const total = a + b
  const hShare = total ? (a / total) * 100 : 50
  const better = a === b ? 'tie' : (a > b) !== LOWER_IS_BETTER.has(id) ? 'home' : 'away'
  return (
    <div className={`sheet-stat ${better}`}>
      <b className="h">{format(home)}</b>
      <span>{label}</span>
      <b className="a">{format(away)}</b>
      <div className="sheet-bar" aria-hidden="true">
        <i className="h" style={{ width: `${hShare}%` }} />
        <i className="a" style={{ width: `${100 - hShare}%` }} />
      </div>
    </div>
  )
}

function Timeline({ match, names }) {
  const events = (match.result?.events || []).filter((e) => ['gol', 'amarelo', 'vermelho', 'substituicao'].includes(e.type))
  if (!events.length) return <p className="muted sheet-empty">Partida sem gols, cartões ou substituições.</p>
  const half = match.result?.halfTime
  // O marcador de intervalo entra antes do primeiro lance do segundo tempo.
  const htIndex = events.findIndex((e) => e.minute > 45)
  return (
    <ol className="sheet-timeline">
      {events.map((e, i) => {
        const side = e.clubId === match.homeClubId ? 'home' : 'away'
        const marker =
          i === htIndex && half ? (
            <li key="ht" className="sheet-ht">
              Intervalo · {half.home} × {half.away}
            </li>
          ) : null
        const assist = e.type === 'gol' && e.assistId ? names.playerName(e.assistId) : null
        return [
          marker,
          <li key={i} className={`sheet-ev ${side}`}>
            <span className="sheet-min">{e.minute}'</span>
            <span className={`sheet-icon ev-${e.type}`} aria-hidden="true" />
            <span className="sheet-what">
              {e.type === 'substituicao' ? (
                <>
                  <b>{e.inName || names.playerName(e.inId) || 'Entra'}</b>
                  <small>sai {e.outName || names.playerName(e.outId) || '—'}</small>
                </>
              ) : (
                <>
                  <b>{e.playerName || names.clubName(e.clubId)}</b>
                  {e.type === 'gol' ? <small>{assist ? `assistência de ${assist}` : 'gol'}</small> : null}
                  {e.type === 'amarelo' ? <small>{e.second ? 'segundo amarelo' : 'cartão amarelo'}</small> : null}
                  {e.type === 'vermelho' ? <small>{e.reason === 'segundo_amarelo' ? 'expulso por dois amarelos' : 'vermelho direto'}</small> : null}
                </>
              )}
            </span>
          </li>,
        ]
      })}
      {htIndex < 0 && half ? (
        <li className="sheet-ht">
          Intervalo · {half.home} × {half.away}
        </li>
      ) : null}
    </ol>
  )
}

// Ordem de súmula: goleiro, defesa, meio e ataque.
const POSITION_ORDER = ['GK', 'RB', 'RWB', 'CB', 'LB', 'LWB', 'CDM', 'CM', 'RM', 'LM', 'CAM', 'RW', 'LW', 'CF', 'ST']
const byPosition = (a, b) => {
  const ia = POSITION_ORDER.indexOf(a.position)
  const ib = POSITION_ORDER.indexOf(b.position)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
}

function LineupColumn({ title, crest, formation, lines }) {
  const starters = lines.filter((p) => p.starter).sort(byPosition)
  const subs = lines.filter((p) => !p.starter)
  const row = (p) => (
    <li key={p.playerId}>
      <span className="sheet-pos">{p.position}</span>
      <span className="sheet-name">
        {p.name}
        <span className="sheet-tags">
          {p.goals ? <i className="tag-goal" title={`${p.goals} gol(s)`}>{p.goals > 1 ? p.goals : ''}</i> : null}
          {p.assists ? <i className="tag-assist" title={`${p.assists} assistência(s)`}>A</i> : null}
          {p.yellows && !p.red ? <i className="tag-yellow" title="Amarelo" /> : null}
          {p.red ? <i className="tag-red" title="Expulso" /> : null}
        </span>
      </span>
      {p.rating != null ? <span className={`sheet-rating ${ratingTone(p.rating)}`}>{p.rating.toFixed(1).replace('.', ',')}</span> : null}
    </li>
  )
  return (
    <div className="sheet-lineup">
      <div className="sheet-lineup-head">
        <CrestMark crest={crest} size={28} />
        <b>{title}</b>
        {formation ? <small>{formation}</small> : null}
      </div>
      <ul>{starters.map(row)}</ul>
      {subs.length ? (
        <>
          <p className="sheet-subtitle">Entraram</p>
          <ul>{subs.map(row)}</ul>
        </>
      ) : null}
    </div>
  )
}

export default function MatchSheet({ match, names, cup, onClose }) {
  const [tab, setTab] = useState('resumo')
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const r = match.result || {}
  const st = r.stats
  const fixture = (cup?.fixtures || []).find((f) => f.id === match.fixtureId)
  const lines = r.players || []
  // Partidas antigas não têm nota por jogador: monta a escalação pelos titulares congelados.
  const fallback = (side) =>
    (match.frozenLineups?.[side]?.starters || []).filter(Boolean).map((id) => ({
      playerId: id,
      name: names.playerName(id) || 'Jogador',
      position: names.playerPosition(id) || '',
      starter: true,
      rating: null,
    }))
  const homeLines = lines.length ? lines.filter((p) => p.clubId === match.homeClubId) : fallback('home')
  const awayLines = lines.length ? lines.filter((p) => p.clubId === match.awayClubId) : fallback('away')
  const motm = r.motm
  const when = match.validatedAt || match.createdAt

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div className="modal sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Súmula da partida">
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Fechar súmula">
          ×
        </button>
        <p className="sheet-kicker">
          {cup?.name || 'Partida oficial'}
          {fixture ? ` · Rodada ${fixture.round}` : ''}
          {when ? ` · ${new Date(when).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : ''}
        </p>

        <div className="sheet-board">
          <div className="sheet-team">
            <CrestMark crest={names.club(match.homeClubId)?.crest} size={64} />
            <b>{names.clubName(match.homeClubId)}</b>
          </div>
          <div className="sheet-score">
            <div>
              <b className={match.homeGoals >= match.awayGoals ? 'lead' : ''}>{match.homeGoals}</b>
              <i>–</i>
              <b className={match.awayGoals >= match.homeGoals ? 'lead' : ''}>{match.awayGoals}</b>
            </div>
            <small>Encerrado{r.halfTime ? ` · intervalo ${r.halfTime.home} × ${r.halfTime.away}` : ''}</small>
            {r.penalties ? (
              <small>
                Pênaltis {r.penalties.home} × {r.penalties.away}
              </small>
            ) : null}
          </div>
          <div className="sheet-team">
            <CrestMark crest={names.club(match.awayClubId)?.crest} size={64} />
            <b>{names.clubName(match.awayClubId)}</b>
          </div>
        </div>

        {motm ? (
          <div className="sheet-motm">
            <span className="sheet-motm-star" aria-hidden="true">★</span>
            <span>
              <small>Melhor em campo</small>
              <b>{motm.playerName}</b> · {names.clubName(motm.clubId)}
            </span>
            {motm.rating ? <span className={`sheet-rating ${ratingTone(motm.rating)}`}>{Number(motm.rating).toFixed(1).replace('.', ',')}</span> : null}
          </div>
        ) : null}

        <div className="draft-subnav sheet-tabs" role="tablist">
          {[
            ['resumo', 'Resumo'],
            ['estatisticas', 'Estatísticas'],
            ['escalacoes', 'Escalações'],
          ].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'resumo' && <Timeline match={match} names={names} />}

        {tab === 'estatisticas' &&
          (st ? (
            <div className="sheet-stats">
              {STAT_ROWS.filter(([id]) => st.home?.[id] != null && st.away?.[id] != null).map(([id, label, format]) => (
                <StatRow key={id} id={id} label={label} home={st.home[id]} away={st.away[id]} format={format} />
              ))}
            </div>
          ) : (
            <p className="muted sheet-empty">Estatísticas indisponíveis para esta partida.</p>
          ))}

        {tab === 'escalacoes' && (
          <div className="sheet-lineups">
            <LineupColumn
              title={names.clubName(match.homeClubId)}
              crest={names.club(match.homeClubId)?.crest}
              formation={match.frozenLineups?.home?.formation}
              lines={homeLines}
            />
            <LineupColumn
              title={names.clubName(match.awayClubId)}
              crest={names.club(match.awayClubId)?.crest}
              formation={match.frozenLineups?.away?.formation}
              lines={awayLines}
            />
          </div>
        )}
      </div>
    </div>
  )
}
