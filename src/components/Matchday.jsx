import { divisionLabel, MATCH_TYPE_LABEL } from '../lib/eaApi'

const RESULT_WORD = { V: 'vitória', E: 'empate', D: 'derrota' }

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
  return 'Sequência zerada'
}

// Topo da página: o último placar e a forma recente pintada como as listras do manto.
// Cada vitória é uma listra amarela — uma boa fase literalmente veste a camisa do XV.
export default function Matchday({ club, overall, latest, divisionCode, peakCode, loading, onSync, onOpenMatch }) {
  const form = overall?.form || []
  const oldestFirst = [...form].reverse()
  const kicker = latest
    ? ['Último jogo', MATCH_TYPE_LABEL[latest.type] || latest.type, agoLong(latest.timeAgo)]
        .filter(Boolean)
        .join(' · ')
    : 'Painel do clube'

  return (
    <section className="matchday" aria-labelledby="matchday-title">
      <h2 id="matchday-title" className="sr-only">
        Estatísticas do {club.name}
      </h2>
      <div className="matchday-top">
        <span className="eyebrow">{kicker}</span>
        <button className="btn ghost" onClick={onSync} disabled={loading || !club.clubId}>
          {loading ? 'Atualizando…' : 'Atualizar da EA'}
        </button>
      </div>

      <div className="matchday-body">
        {latest ? (
          <button
            type="button"
            className={`placar ${String(latest.result || '').toLowerCase()}`}
            onClick={() => onOpenMatch(latest)}
          >
            <span className="placar-team us">{club.name}</span>
            <span className="placar-score" aria-label={`${latest.usGoals} a ${latest.themGoals}`}>
              <b>{latest.usGoals}</b>
              <i aria-hidden="true">×</i>
              <b>{latest.themGoals}</b>
            </span>
            <span className="placar-team them">{latest.opponent}</span>
            <small className="placar-foot">
              {RESULT_WORD[latest.result] ? `${RESULT_WORD[latest.result]}${latest.winnerByDnf ? ' por W.O.' : ''} · ` : ''}
              Abrir a súmula
            </small>
          </button>
        ) : (
          <div className="placar empty">
            <span className="placar-team us">{club.name}</span>
            <small className="placar-foot">A EA ainda não mandou jogos. Toque em Atualizar da EA.</small>
          </div>
        )}

        {form.length ? (
          <figure className="manto">
            <div
              className="manto-stripes"
              role="img"
              aria-label={`Forma nos últimos ${form.length} jogos, do mais antigo ao mais recente: ${oldestFirst.join(', ')}`}
            >
              {oldestFirst.map((r, i) => (
                <i key={i} className={`stripe ${r.toLowerCase()}`} style={{ '--i': i }}>
                  <span>{r}</span>
                </i>
              ))}
            </div>
            <figcaption>
              <b>{streakLine(overall)}</b>
              <span>Últimos {form.length} jogos · o mais recente à direita</span>
            </figcaption>
          </figure>
        ) : null}
      </div>

      <dl className="ledger">
        <div>
          <dt>Divisão</dt>
          <dd>{divisionLabel(divisionCode)}</dd>
        </div>
        <div>
          <dt>Habilidade</dt>
          <dd>{overall ? fmt(overall.skillRating) : '—'}</dd>
        </div>
        <div>
          <dt>Carreira V-E-D</dt>
          <dd>{overall ? `${fmt(overall.wins)}-${fmt(overall.ties)}-${fmt(overall.losses)}` : '—'}</dd>
          {overall ? <small>{plural(overall.games, 'jogo', 'jogos')}</small> : null}
        </div>
        <div>
          <dt>Saldo de gols</dt>
          <dd>{overall ? signed(overall.goalDiff) : '—'}</dd>
          {overall ? (
            <small>
              {fmt(overall.goals)} pró · {fmt(overall.goalsAgainst)} contra
            </small>
          ) : null}
        </div>
        <div>
          <dt>Aproveitamento</dt>
          <dd>{overall ? `${overall.winPct}%` : '—'}</dd>
        </div>
        <div>
          <dt>Melhor divisão</dt>
          <dd>{divisionLabel(peakCode)}</dd>
        </div>
      </dl>
    </section>
  )
}
