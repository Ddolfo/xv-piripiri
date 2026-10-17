import { useState } from 'react'
import { clubLogoSrc } from '../lib/brand'
import { divisionLabel, MATCH_TYPE_LABEL, PLAYOFF_FINISH } from '../lib/eaApi'
import DivisionBadge from './DivisionBadge'

const RESULT_WORD = { V: 'Vitória', E: 'Empate', D: 'Derrota' }
const FILTERS = [
  ['all', 'Todos'],
  ['leagueMatch', 'Liga'],
  ['playoffMatch', 'Playoff'],
  ['friendlyMatch', 'Amistoso'],
]

function fmt(n, digits) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR', {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? 0,
  })
}

function signed(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return v > 0 ? `+${fmt(v)}` : fmt(v)
}

function plural(n, one, many) {
  return `${fmt(n)} ${Number(n) === 1 ? one : many}`
}

function agoLong(ago) {
  if (!ago?.number) return ''
  const words = {
    seconds: ['segundo', 'segundos'],
    minutes: ['minuto', 'minutos'],
    hours: ['hora', 'horas'],
    days: ['dia', 'dias'],
    weeks: ['semana', 'semanas'],
    months: ['mês', 'meses'],
    years: ['ano', 'anos'],
  }[ago.unit]
  return words ? `há ${plural(ago.number, words[0], words[1])}` : ''
}

function streakLine(overall) {
  if (overall?.winStreak) return plural(overall.winStreak, 'vitória seguida', 'vitórias seguidas')
  if (overall?.unbeatenStreak) return plural(overall.unbeatenStreak, 'jogo sem perder', 'jogos sem perder')
  return 'Sem sequência no momento'
}

function initials(name) {
  const parts = String(name || '').replace(/[_-]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return String(name || '?').slice(0, 2).toUpperCase()
}

function Crest({ src, name, color }) {
  if (src) return <img className="mc-crest" src={src} alt="" />
  return (
    <span className="mc-crest rival" style={color ? { '--kit': color } : undefined} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

// Linha de comparação: nosso valor à esquerda, o do rival à direita, barra proporcional.
function Duel({ label, us, them, display = (v) => fmt(v) }) {
  const a = Number(us) || 0
  const b = Number(them) || 0
  const share = a + b ? Math.round((a / (a + b)) * 100) : 50
  return (
    <div className="mc-duel">
      <b>{display(us)}</b>
      <div className="mc-duel-mid">
        <span>{label}</span>
        <div className="mc-duel-bar" style={{ '--share': `${share}%` }} aria-hidden="true" />
      </div>
      <b>{display(them)}</b>
    </div>
  )
}

function Tile({ label, value, note, icon, wide }) {
  return (
    <div className={`tile${wide ? ' wide' : ''}`}>
      <dt>{label}</dt>
      <dd>
        {icon}
        <span>{value}</span>
      </dd>
      {note ? <small>{note}</small> : null}
    </div>
  )
}

function MatchCard({ club, match, onOpenMatch }) {
  const us = match.us
  const them = match.them
  const motm =
    [...(us?.players || []), ...(them?.players || [])].find((p) => p.motm) ||
    [...(us?.players || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] ||
    null
  const result = String(match.result || '').toLowerCase()

  return (
    <article className="mc-card" aria-live="polite">
      <div className="mc-meta">
        <span>{MATCH_TYPE_LABEL[match.type] || match.type}</span>
        <span>{agoLong(match.timeAgo)}</span>
      </div>

      <div className="mc-board">
        <div className="mc-team">
          <Crest src={clubLogoSrc(club)} name={club.name} />
          <span>{club.name}</span>
        </div>
        <div className="mc-score">
          <div>
            <b className={match.usGoals >= match.themGoals ? 'lead' : ''}>{match.usGoals}</b>
            <i aria-hidden="true">–</i>
            <b className={match.themGoals >= match.usGoals ? 'lead' : ''}>{match.themGoals}</b>
          </div>
          <em className={`mc-result ${result}`}>
            {RESULT_WORD[match.result] || 'Encerrado'}
            {match.winnerByDnf ? ' · W.O.' : ''}
          </em>
        </div>
        <div className="mc-team">
          <Crest name={match.opponent} color={them?.kit?.[0]} />
          <span>{match.opponent}</span>
          {match.opponentDivision ? (
            <small className="mc-team-div">
              <DivisionBadge code={match.opponentDivision} size={16} />
              {divisionLabel(match.opponentDivision)}
            </small>
          ) : null}
        </div>
      </div>

      {us && them && (us.shots || us.passAttempts || us.avgRating) ? (
        <div className="mc-duels">
          <Duel label="Finalizações" us={us.shots} them={them.shots} />
          <Duel label="Passes certos" us={us.passPct} them={them.passPct} display={(v) => (v ? `${fmt(v)}%` : '—')} />
          <Duel label="Nota média" us={us.avgRating} them={them.avgRating} display={(v) => (v ? fmt(v, 1) : '—')} />
        </div>
      ) : null}

      <div className="mc-foot">
        {motm ? (
          <span className="mc-motm">
            <i aria-hidden="true">{initials(motm.name)}</i>
            <span>
              <small>Melhor em campo</small>
              {motm.name}
              {motm.rating ? ` · ${fmt(motm.rating, 1)}` : ''}
            </span>
          </span>
        ) : (
          <span />
        )}
        <button type="button" className="pill" onClick={() => onOpenMatch(match)}>
          Ver súmula
        </button>
      </div>
    </article>
  )
}

// Jogos de playoff: junta os da EA com o histórico compartilhado, sem repetir partida.
function playoffMatches(matches, history) {
  const byId = new Map()
  for (const m of [...(history || []), ...(matches || [])]) {
    if (m?.type !== 'playoffMatch') continue
    const id = String(m.id || m.timestamp)
    byId.set(id, { ...byId.get(id), ...m })
  }
  return [...byId.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
}

function latestSeason(playoffs) {
  return [...(playoffs || [])].sort((a, b) => Number(b.seasonId) - Number(a.seasonId))[0] || null
}

// Resumo do playoff no topo da lista quando o filtro Playoff está ativo.
function PlayoffSummary({ games, eaGames, season }) {
  const wins = games.filter((m) => m.result === 'V').length
  const draws = games.filter((m) => m.result === 'E').length
  const losses = games.filter((m) => m.result === 'D').length
  const played = wins + draws + losses
  const gf = games.reduce((t, m) => t + (Number(m.usGoals) || 0), 0)
  const ga = games.reduce((t, m) => t + (Number(m.themGoals) || 0), 0)
  const points = wins * 3 + draws
  const pct = played ? Math.round((points / (played * 3)) * 100) : 0
  const wo = games.filter((m) => m.winnerByDnf).length
  const finish = PLAYOFF_FINISH[season?.bestFinishGroup]
  const total = Math.max(Number(eaGames) || 0, played)
  const oldestFirst = [...games].reverse()

  return (
    <div className="po">
      <div className="po-head">
        {season?.bestDivision ? <DivisionBadge code={season.bestDivision} size={34} /> : null}
        <div>
          <h4>Playoff{season?.bestDivision ? ` da ${divisionLabel(season.bestDivision)}` : ''}</h4>
          <p>
            {String(season?.seasonName || 'Temporada atual').replace(/CLUBS_LEAGUE_(?:CLOSED_)?SEASON_0*(\d+)/, 'Temporada $1')} · {plural(total, 'jogo', 'jogos')} pela EA
          </p>
        </div>
      </div>

      <dl className="po-grid">
        <div>
          <dt>Pontos</dt>
          <dd>{fmt(points)}</dd>
          <small>{pct}% aproveitamento</small>
        </div>
        <div>
          <dt>V · E · D</dt>
          <dd>
            <span className="v">{wins}</span>
            <i>·</i>
            <span>{draws}</span>
            <i>·</i>
            <span className="d">{losses}</span>
          </dd>
          <small>{plural(played, 'jogo', 'jogos')}</small>
        </div>
        <div>
          <dt>Gols</dt>
          <dd>
            {gf}
            <i>–</i>
            {ga}
          </dd>
          <small>
            saldo {signed(gf - ga)} · {fmt(played ? gf / played : 0, 1)} por jogo
          </small>
        </div>
        <div>
          <dt>Posição</dt>
          <dd className="po-finish">{finish ? finish.label : '—'}</dd>
          <small>{finish ? `Faixa da EA: ${finish.hint}` : 'EA ainda sem faixa'}</small>
        </div>
      </dl>

      {oldestFirst.length ? (
        <ol className="po-form" aria-label="Resultados no playoff, do mais antigo ao mais recente">
          {oldestFirst.map((m) => (
            <li key={m.id || m.timestamp} className={String(m.result || '').toLowerCase()} title={`${m.opponent} ${m.usGoals}–${m.themGoals}`}>
              {m.result}
            </li>
          ))}
        </ol>
      ) : null}

      <p className="po-note">
        A EA não publica tabela de playoff: pontos contam 3 por vitória e 1 por empate, e a posição é a faixa que a EA
        mostra (parcial enquanto o playoff não termina).
        {wo ? ` ${plural(wo, 'vitória', 'vitórias')} por W.O.` : ''}
        {total > played ? ` Detalhes de ${played} dos ${total} jogos.` : ''}
      </p>
    </div>
  )
}

// Topo da aba Estatísticas: números do clube, sequência de resultados,
// lista das últimas partidas e o cartão da partida escolhida.
export default function Matchday({
  club,
  overall,
  matches,
  history,
  playoffs,
  playoffGames,
  divisionCode,
  loading,
  onSync,
  onOpenMatch,
}) {
  const [filter, setFilter] = useState('all')
  const [pickedId, setPickedId] = useState(null)

  const sorted = [...(matches || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  const poGames = playoffMatches(matches, history)
  const poSeason = latestSeason(playoffs)
  const list = (filter === 'all' ? sorted : filter === 'playoffMatch' ? poGames : sorted.filter((m) => m.type === filter)).slice(0, 10)
  // Em playoff: o último jogo de playoff é mais novo que o último de liga.
  const lastLeague = Math.max(0, ...[...(history || []), ...(matches || [])].filter((m) => m.type === 'leagueMatch').map((m) => m.timestamp || 0))
  const inPlayoff = Boolean(poGames.length && poSeason?.bestDivision && (poGames[0].timestamp || 0) > lastLeague)
  const picked = list.find((m) => m.id === pickedId) || list[0] || null
  const form = overall?.form || []
  const oldestFirst = [...form].reverse()

  return (
    <section className="mc" aria-labelledby="mc-title">
      <header className="mc-head">
        <div>
          <h2 id="mc-title">{club.name}</h2>
          <p>Números do clube no FC 27, direto da EA.</p>
        </div>
        <button type="button" className="link-btn" onClick={onSync} disabled={loading || !club.clubId}>
          {loading ? 'Atualizando…' : 'Atualizar da EA'}
        </button>
      </header>

      <dl className="bento">
        {inPlayoff ? (
          <Tile
            wide
            label="Disputando o playoff"
            icon={<DivisionBadge code={poSeason.bestDivision} size={52} />}
            value={divisionLabel(poSeason.bestDivision)}
            note={
              Number(divisionCode) !== Number(poSeason.bestDivision)
                ? `A EA já mostra ${divisionLabel(divisionCode)} para a próxima temporada`
                : 'Divisão confirmada pela EA'
            }
          />
        ) : (
          <Tile
            wide
            label="Divisão atual"
            icon={<DivisionBadge code={divisionCode} size={52} />}
            value={divisionLabel(divisionCode)}
            note={overall?.bestDivision ? `Melhor da história: ${divisionLabel(overall.bestDivision)}` : ''}
          />
        )}
        <Tile
          label="Campanha"
          value={overall ? `${fmt(overall.wins)}-${fmt(overall.ties)}-${fmt(overall.losses)}` : '—'}
          note={overall ? `${plural(overall.games, 'jogo', 'jogos')} · V-E-D` : ''}
        />
        <Tile label="Aproveitamento" value={overall ? `${overall.winPct}%` : '—'} note="Vitórias na carreira" />
        <Tile
          label="Saldo de gols"
          value={overall ? signed(overall.goalDiff) : '—'}
          note={overall ? `${fmt(overall.goals)} pró · ${fmt(overall.goalsAgainst)} contra` : ''}
        />
        <Tile label="Habilidade" value={overall ? fmt(overall.skillRating) : '—'} note="Nota da EA para o clube" />
      </dl>

      {form.length ? (
        <div className="mc-form">
          <div>
            <h3>Sequência</h3>
            <p>
              {streakLine(overall)} · o mais recente à direita
            </p>
          </div>
          <ol aria-label={`Resultados dos últimos ${form.length} jogos, do mais antigo ao mais recente`}>
            {oldestFirst.map((r, i) => (
              <li key={i} className={r.toLowerCase()} style={{ '--n': i }}>
                <span className="sr-only">{RESULT_WORD[r]}</span>
                <span aria-hidden="true">{r}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="mc-split">
        <div className="mc-list">
          <div className="mc-list-head">
            <h3>Últimas partidas</h3>
            <div className="segmented" role="group" aria-label="Filtrar partidas">
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={filter === key ? 'active' : ''}
                  aria-pressed={filter === key}
                  onClick={() => {
                    setFilter(key)
                    setPickedId(null)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {filter === 'playoffMatch' && (poGames.length || playoffGames) ? (
            <PlayoffSummary games={poGames} eaGames={playoffGames} season={poSeason} />
          ) : null}
          {list.length ? (
            <ul>
              {list.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={picked?.id === m.id ? 'active' : ''}
                    aria-pressed={picked?.id === m.id}
                    onClick={() => setPickedId(m.id)}
                  >
                    <span className={`mc-pill ${String(m.result || '').toLowerCase()}`}>{m.result || '—'}</span>
                    <span className="mc-row-main">
                      <b>{m.opponent}</b>
                      <small>
                        {MATCH_TYPE_LABEL[m.type] || m.type}
                        {m.timeAgo ? ` · ${agoLong(m.timeAgo)}` : ''}
                        {m.winnerByDnf ? ' · W.O.' : ''}
                      </small>
                    </span>
                    {m.opponentDivision ? <DivisionBadge code={m.opponentDivision} size={22} /> : <span />}
                    <span className="mc-row-score">
                      {m.usGoals}–{m.themGoals}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mc-empty">Nenhuma partida deste tipo entre as últimas da EA.</p>
          )}
        </div>

        {picked ? (
          <MatchCard club={club} match={picked} onOpenMatch={onOpenMatch} />
        ) : (
          <article className="mc-card empty">
            <p>A EA ainda não mandou jogos deste clube. Toque em Atualizar da EA.</p>
          </article>
        )}
      </div>
    </section>
  )
}
