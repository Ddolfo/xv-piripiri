import { clubLogoSrc } from '../lib/brand'
import { divisionLabel, MATCH_TYPE_LABEL } from '../lib/eaApi'

const RESULT_WORD = { V: 'Vitória', E: 'Empate', D: 'Derrota' }

function fmt(n, digits) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  return v.toLocaleString('pt-BR', {
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

function agoShort(ago) {
  if (!ago?.number) return ''
  const unit = { seconds: 's', minutes: 'min', hours: 'h', days: 'd', weeks: 'sem', months: 'm', years: 'a' }[ago.unit]
  return unit ? `${ago.number}${unit}` : ''
}

function streakLine(overall) {
  if (overall?.winStreak) return plural(overall.winStreak, 'vitória seguida', 'vitórias seguidas')
  if (overall?.unbeatenStreak) return plural(overall.unbeatenStreak, 'jogo sem perder', 'jogos sem perder')
  return ''
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
  const total = a + b
  const share = total ? Math.round((a / total) * 100) : 50
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

function Tile({ label, value, note }) {
  return (
    <div className="tile">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note ? <small>{note}</small> : null}
    </div>
  )
}

export default function Matchday({ club, overall, matches, divisionCode, loading, onSync, onOpenMatch }) {
  const list = [...(matches || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 10)
  const latest = list[0] || null
  const us = latest?.us
  const them = latest?.them
  const motm = latest
    ? [...(us?.players || []), ...(them?.players || [])].find((p) => p.motm) ||
      [...(us?.players || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] ||
      null
    : null
  const subtitle = [divisionLabel(divisionCode), streakLine(overall)].filter((s) => s && s !== '—')

  return (
    <section className="mc" aria-labelledby="mc-title">
      <header className="mc-head">
        <div>
          <h2 id="mc-title">{club.name}</h2>
          {subtitle.length ? <p>{subtitle.join(' · ')}</p> : null}
        </div>
        <button type="button" className="link-btn" onClick={onSync} disabled={loading || !club.clubId}>
          {loading ? 'Atualizando…' : 'Atualizar da EA'}
        </button>
      </header>

      <div className="mc-grid">
        {latest ? (
          <article className={`mc-card ${String(latest.result || '').toLowerCase()}`}>
            <div className="mc-meta">
              <span>
                Último jogo · {MATCH_TYPE_LABEL[latest.type] || latest.type}
                {latest.opponentDivision ? ` · rival na ${divisionLabel(latest.opponentDivision)}` : ''}
              </span>
              <span>{agoLong(latest.timeAgo)}</span>
            </div>

            <div className="mc-board">
              <div className="mc-team">
                <Crest src={clubLogoSrc(club)} name={club.name} />
                <span>{club.name}</span>
              </div>
              <div className="mc-score">
                <div>
                  <b className={latest.usGoals >= latest.themGoals ? 'lead' : ''}>{latest.usGoals}</b>
                  <i aria-hidden="true">–</i>
                  <b className={latest.themGoals >= latest.usGoals ? 'lead' : ''}>{latest.themGoals}</b>
                </div>
                <em className={`mc-result ${String(latest.result || '').toLowerCase()}`}>
                  {RESULT_WORD[latest.result] || 'Encerrado'}
                  {latest.winnerByDnf ? ' · W.O.' : ''}
                </em>
              </div>
              <div className="mc-team">
                <Crest name={latest.opponent} color={them?.kit?.[0]} />
                <span>{latest.opponent}</span>
              </div>
            </div>

            {us && them ? (
              <div className="mc-duels">
                <Duel label="Finalizações" us={us.shots} them={them.shots} />
                <Duel
                  label="Passes certos"
                  us={us.passPct}
                  them={them.passPct}
                  display={(v) => (v ? `${fmt(v)}%` : '—')}
                />
                <Duel
                  label="Nota média"
                  us={us.avgRating}
                  them={them.avgRating}
                  display={(v) => (v ? fmt(v, 1) : '—')}
                />
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
              <button type="button" className="link-btn" onClick={() => onOpenMatch(latest)}>
                Ver súmula
              </button>
            </div>
          </article>
        ) : (
          <article className="mc-card empty">
            <p>A EA ainda não mandou jogos deste clube. Toque em Atualizar da EA.</p>
          </article>
        )}

        <dl className="bento">
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
      </div>

      {list.length > 1 ? (
        <div className="mc-rail-wrap">
          <h3 className="mc-rail-title">Últimos {list.length} jogos</h3>
          <ol className="mc-rail">
            {list.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onOpenMatch(m)}>
                  <span className={`mc-pill ${String(m.result || '').toLowerCase()}`}>{m.result || '—'}</span>
                  <b>
                    {m.usGoals}–{m.themGoals}
                  </b>
                  <span className="mc-rail-opp">{m.opponent}</span>
                  <small>
                    {MATCH_TYPE_LABEL[m.type] || m.type}
                    {agoShort(m.timeAgo) ? ` · ${agoShort(m.timeAgo)}` : ''}
                  </small>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}
