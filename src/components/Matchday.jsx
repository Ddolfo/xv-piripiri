import { divisionLabel, MATCH_TYPE_LABEL } from '../lib/eaApi'

const RESULT_WORD = { V: 'Vitória', E: 'Empate', D: 'Derrota' }

function fmt(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR')
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
  const n = Number(ago.number)
  const words = {
    seconds: ['segundo', 'segundos'],
    minutes: ['minuto', 'minutos'],
    hours: ['hora', 'horas'],
    days: ['dia', 'dias'],
    weeks: ['semana', 'semanas'],
    months: ['mês', 'meses'],
    years: ['ano', 'anos'],
  }[ago.unit]
  return words ? `há ${plural(n, words[0], words[1])}` : ''
}

function streakLine(overall) {
  if (overall?.winStreak) return plural(overall.winStreak, 'vitória seguida', 'vitórias seguidas')
  if (overall?.unbeatenStreak) return plural(overall.unbeatenStreak, 'jogo sem perder', 'jogos sem perder')
  return 'Sem sequência no momento'
}

function Tile({ label, value, note }) {
  return (
    <div className="tile">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note ? <small>{note}</small> : null}
    </div>
  )
}

// Topo da página no estilo vitrine: o último placar como manchete e os números em mosaico.
export default function Matchday({ club, overall, latest, divisionCode, peakCode, loading, onSync, onOpenMatch }) {
  const form = overall?.form || []
  const oldestFirst = [...form].reverse()
  const kicker = latest
    ? ['Último jogo', MATCH_TYPE_LABEL[latest.type] || latest.type, agoLong(latest.timeAgo)]
        .filter(Boolean)
        .join(' · ')
    : 'Painel do clube'
  const result = String(latest?.result || '').toLowerCase()

  return (
    <section className="showcase" aria-labelledby="showcase-title">
      <div className="showcase-hero">
        <p className="showcase-eyebrow">{kicker}</p>
        {latest ? (
          <>
            <h2 id="showcase-title" className="showcase-teams">
              {club.name} <span>×</span> {latest.opponent}
            </h2>
            <p className={`showcase-score ${result}`} aria-label={`${latest.usGoals} a ${latest.themGoals}`}>
              {latest.usGoals}
              <span aria-hidden="true">–</span>
              {latest.themGoals}
            </p>
            <p className="showcase-sub">
              {RESULT_WORD[latest.result] || 'Resultado'}
              {latest.winnerByDnf ? ' por W.O.' : ''}
            </p>
          </>
        ) : (
          <>
            <h2 id="showcase-title" className="showcase-teams">
              {club.name}
            </h2>
            <p className="showcase-sub">A EA ainda não mandou jogos. Toque em Atualizar da EA.</p>
          </>
        )}
        <div className="showcase-actions">
          {latest ? (
            <button type="button" className="pill" onClick={() => onOpenMatch(latest)}>
              Ver súmula
            </button>
          ) : null}
          <button type="button" className="link-btn" onClick={onSync} disabled={loading || !club.clubId}>
            {loading ? 'Atualizando…' : 'Atualizar da EA'}
          </button>
        </div>

        {form.length ? (
          <figure className="form-line">
            <div
              className="form-line-dots"
              role="img"
              aria-label={`Forma nos últimos ${form.length} jogos, do mais antigo ao mais recente: ${oldestFirst.join(', ')}`}
            >
              {oldestFirst.map((r, i) => (
                <i key={i} className={r.toLowerCase()} title={RESULT_WORD[r]} style={{ '--n': i }} />
              ))}
            </div>
            <figcaption>
              {streakLine(overall)} · últimos {form.length} jogos
            </figcaption>
          </figure>
        ) : null}
      </div>

      <dl className="bento">
        <Tile label="Divisão" value={divisionLabel(divisionCode)} note={`Melhor: ${divisionLabel(peakCode)}`} />
        <Tile label="Habilidade" value={overall ? fmt(overall.skillRating) : '—'} note="Nota da EA para o clube" />
        <Tile
          label="Campanha"
          value={overall ? `${fmt(overall.wins)}-${fmt(overall.ties)}-${fmt(overall.losses)}` : '—'}
          note={overall ? `${plural(overall.games, 'jogo', 'jogos')} · V-E-D` : ''}
        />
        <Tile
          label="Saldo de gols"
          value={overall ? signed(overall.goalDiff) : '—'}
          note={overall ? `${fmt(overall.goals)} pró · ${fmt(overall.goalsAgainst)} contra` : ''}
        />
        <Tile label="Aproveitamento" value={overall ? `${overall.winPct}%` : '—'} note="Vitórias na carreira" />
      </dl>
    </section>
  )
}
