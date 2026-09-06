import { useMemo, useState } from 'react'
import { analyzeDesempenho } from '../lib/desempenho'
import JogadorPerfil from './JogadorPerfil'
import PlayerMark from './PlayerMark'

function fmt(n, digits) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? (Number.isInteger(v) ? 0 : 1),
  })
}

function fmt2(n) {
  return fmt(n, 2)
}

function Sign({ value, digits = 1, suffix = '' }) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const v = Number(value)
  const abs = Math.abs(v).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  if (v > 0) return `+${abs}${suffix}`
  if (v < 0) return `−${abs}${suffix}`
  return `${abs}${suffix}`
}

function Bar({ value, warn, gold }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="study-bar">
      <i className={warn ? 'warn' : gold ? 'gold' : ''} style={{ width: `${v}%` }} />
    </div>
  )
}

export default function Desempenho({ store }) {
  const [openPlayer, setOpenPlayer] = useState(null)
  const study = useMemo(() => {
    try {
      return analyzeDesempenho(store.players, store.ea?.matches)
    } catch (err) {
      return { insights: [], crowns: {}, teamRecent: {}, form: [], error: String(err?.message || err) }
    }
  }, [store.players, store.ea?.matches])
  const kit = store.ea?.info?.kit?.home || []
  const t = study.teamRecent || {}
  const c = study.crowns || {}

  if (openPlayer) {
    return <JogadorPerfil player={openPlayer} store={store} onClose={() => setOpenPlayer(null)} />
  }

  function open(row) {
    if (row?.player) setOpenPlayer(row.player)
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Desempenho</h2>
          <p>
            Quantidade e qualidade juntas — não só a porcentagem. Carreira no clube para o
            retrato longo; últimos {fmt(study.recentCount)} jogos da EA para ver quem subiu e
            quem esfriou.
          </p>
        </div>
      </div>

      {study.error ? <div className="notice">Não deu para montar o estudo: {study.error}</div> : null}
      {study.insights?.length ? (
        <section className="study-insights">
          {study.insights.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
      ) : !study.error ? (
        <div className="notice">Sincronize o clube para montar o estudo.</div>
      ) : null}

      <div className="study-hero">
        <Crown
          kicker="Participações em gol"
          row={c.involvement}
          kit={kit}
          onOpen={open}
          gold
          line={
            c.involvement?.recent
              ? `${fmt(c.involvement.recent.involvement)} nas súmulas (${fmt(c.involvement.recent.goals)} gols + ${fmt(c.involvement.recent.assists)} assist.) · ${fmt2(c.involvement.recent.gaPg)} por jogo`
              : 'Sem janela recente'
          }
        />
        <Crown
          kicker="Homem do momento"
          row={c.moment}
          kit={kit}
          onOpen={open}
          line={
            c.moment?.recent
              ? `Nota ${fmt2(c.moment.recent.rating)} · ${fmt(c.moment.recent.involvement)} participações · ${fmt(c.moment.recent.games)} súmulas`
              : 'Sem janela recente'
          }
        />
        <Crown
          kicker="Pilar da carreira"
          row={c.career}
          kit={kit}
          onOpen={open}
          line={
            c.career
              ? `Nota ${fmt(c.career.rating, 1)} · ${fmt2(c.career.gaPg)} participações/jogo · ${fmt(c.career.involvement)} no clube`
              : 'Sem regulares'
          }
        />
        <Crown
          kicker="Quem mais cresceu"
          row={c.rise}
          kit={kit}
          onOpen={open}
          line={
            c.rise
              ? `${fmt(c.rise.rating, 1)} → ${fmt2(c.rise.recent.rating)}  (${Sign(c.rise.ratingDelta)})`
              : 'Ninguém disparou na janela'
          }
        />
      </div>

      <section className="card">
        <h3>Quem mais entra nas jogadas de gol</h3>
        <p className="card-lead">
          O mesmo número da súmula: <b>participações em gol = gols + assistências</b>. Janela das
          últimas {fmt(study.recentCount)} partidas da EA, e o ritmo na carreira do clube.
          {t.gf ? ` O XV marcou ${fmt(t.gf)} gols nessa janela.` : ''}
        </p>
        {study.rankedInvolvement?.length ? (
          <div className="study-goal-grid">
            <div>
              <h4 className="study-sub">Nas súmulas recentes</h4>
              <div className="study-rank">
                {study.rankedInvolvement.slice(0, 8).map((p, i) => (
                  <button key={p.id} type="button" className="study-rank-row" onClick={() => open(p)}>
                    <b>{i + 1}</b>
                    <PlayerMark name={p.name} nationId={p.player?.stats?.proNationality} colors={kit} size={40} />
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {fmt(p.recent.goals)} gols · {fmt(p.recent.assists)} assist. · {fmt2(p.recent.gaPg)} por jogo
                        {p.recent.share != null ? ` · ${fmt(p.recent.share)}% dos gols do XV` : ''}
                      </small>
                    </div>
                    <em>{fmt(p.recent.involvement)}</em>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="study-sub">Ritmo na carreira do clube</h4>
              <div className="study-rank">
                {(study.rankedInvolvementCareer || []).slice(0, 8).map((p, i) => (
                  <button key={p.id} type="button" className="study-rank-row" onClick={() => open(p)}>
                    <b>{i + 1}</b>
                    <PlayerMark name={p.name} nationId={p.player?.stats?.proNationality} colors={kit} size={40} />
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {fmt(p.goals)} gols · {fmt(p.assists)} assist. · {fmt(p.games)} jogos
                      </small>
                    </div>
                    <em>{fmt2(p.gaPg)}</em>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="notice">Sem súmulas recentes para somar participações.</div>
        )}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Forma viva</h3>
        <p className="card-lead">
          Nota da carreira no clube contra a nota dos últimos jogos. Subiu, caiu ou ficou de
          fora da janela — a melhora aparece aqui, jogo a jogo, quando a EA ainda publica a
          súmula.
        </p>
        {study.form?.length ? (
          <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Jogador</th>
                  <th>Janela</th>
                  <th>Nota agora</th>
                  <th>Nota carreira</th>
                  <th>Δ</th>
                  <th>Participações</th>
                  <th>Passe agora</th>
                  <th>Bote agora</th>
                  <th>Forma</th>
                </tr>
              </thead>
              <tbody>
                {study.form.map((p) => (
                  <tr key={p.id} className={p.form === 'sobe' ? 'study-row-up' : p.form === 'cai' ? 'study-row-warn' : ''}>
                    <td>
                      <button type="button" className="study-name" onClick={() => open(p)}>
                        {p.name}
                      </button>
                      <small> {p.line}</small>
                    </td>
                    <td>{p.recent?.games ? `${fmt(p.recent.games)} j` : 'fora'}</td>
                    <td>{p.recent?.rating != null ? fmt2(p.recent.rating) : '—'}</td>
                    <td>{fmt(p.rating, 1)}</td>
                    <td className={`study-delta ${p.form}`}>{Sign(p.ratingDelta)}</td>
                    <td>
                      {p.recent
                        ? `${fmt(p.recent.involvement)} · ${fmt2(p.recent.gaPg)}/j`
                        : '—'}
                    </td>
                    <td>
                      {p.recent?.passPct != null ? `${fmt(p.recent.passPct)}%` : '—'}
                      {p.passDelta != null ? <small> ({Sign(p.passDelta, 0, ' pp')})</small> : null}
                    </td>
                    <td>
                      {p.recent?.tklPct != null ? `${fmt(p.recent.tklPct)}%` : '—'}
                      {p.tklDelta != null ? <small> ({Sign(p.tklDelta, 0, ' pp')})</small> : null}
                    </td>
                    <td>
                      <FormPill form={p.form} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="notice">Sem elenco sincronizado.</div>
        )}
      </section>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <section className="card">
          <h3>Passe · quantidade × qualidade</h3>
          <p className="card-lead">
            Índice = passes certos por jogo × (% de acerto). Quem só tem % alto e pouco volume
            cai. Média dos regulares: {study.avg.passIndex != null ? fmt2(study.avg.passIndex) : '—'}.
          </p>
          <CompareTable
            rows={study.passers || []}
            avg={study.avg?.passIndex}
            onOpen={open}
            kind="pass"
          />
        </section>

        <section className="card">
          <h3>Bote · quantidade × qualidade</h3>
          <p className="card-lead">
            Desarme certo por jogo e quantos botes falham por jogo. % sozinho não conta: errar
            4, 5 vezes por partida pesa. Ordenado por quem mais erra o bote.
          </p>
          <CompareTable
            rows={study.tacklers || []}
            avg={study.avg?.tklMiss}
            onOpen={open}
            kind="tkl"
          />
        </section>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Melhores no geral</h3>
        <p className="card-lead">
          Índice da carreira (0–100) mistura participações em gol por jogo, nota, MOTM, passe com
          volume e aproveitamento. Só entram {fmt(study.minGames)} jogos ou mais no clube.
        </p>
        {study.rankedCareer?.length ? (
          <div className="study-rank">
            {study.rankedCareer.slice(0, 8).map((p, i) => (
              <button key={p.id} type="button" className="study-rank-row" onClick={() => open(p)}>
                <b>{i + 1}</b>
                <PlayerMark name={p.name} nationId={p.player?.stats?.proNationality} colors={kit} size={40} />
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {p.line} · {fmt2(p.gaPg)} participações/jogo · nota {fmt(p.rating, 1)} · {fmt(p.motm)} MOTM
                  </small>
                </div>
                <em>{fmt(p.overall)}</em>
              </button>
            ))}
          </div>
        ) : (
          <div className="notice">Poucos regulares para ranquear.</div>
        )}
      </section>

      {study.buckets?.length ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h3>Quando o XV entra curto</h3>
          <p className="card-lead">Aproveitamento nas súmulas recentes, pelo número de Pros em campo.</p>
          <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Em campo</th>
                  <th>Jogos</th>
                  <th>V-E-D</th>
                  <th>Aproveitamento</th>
                  <th>Gols</th>
                </tr>
              </thead>
              <tbody>
                {study.buckets.map((b) => (
                  <tr key={b.key} className={b.key !== '7+' && b.key !== 's/n' ? 'study-row-warn' : ''}>
                    <td>{b.key === '7+' ? '7 ou mais' : b.key}</td>
                    <td>{fmt(b.games)}</td>
                    <td>
                      {fmt(b.wins)}-{fmt(b.draws)}-{fmt(b.losses)}
                    </td>
                    <td>
                      {b.winPct != null ? `${b.winPct}%` : '—'}
                      <Bar value={b.winPct} warn={b.winPct != null && b.winPct < 45} gold={b.winPct >= 55} />
                    </td>
                    <td>
                      {fmt(b.gf)}–{fmt(b.ga)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {study.matchRows?.length ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h3>Janela recente do time</h3>
          <p className="card-lead">
            Passes errados {t.passMissPct != null ? `${t.passMissPct}%` : '—'} · botes falhos{' '}
            {t.tklMissPct != null ? `${t.tklMissPct}%` : '—'} · {fmt(t.gf)}–{fmt(t.ga)} em{' '}
            {fmt(study.recentCount)} súmulas.
          </p>
          <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Jogo</th>
                  <th>Em campo</th>
                  <th>Passes errados</th>
                  <th>Botes falhos</th>
                  <th>Finalizações</th>
                </tr>
              </thead>
              <tbody>
                {study.matchRows.map((m) => (
                  <tr key={m.id} className={m.count && m.count < 7 ? 'study-row-warn' : ''}>
                    <td>
                      <b>
                        {m.result} {fmt(m.usGoals)}–{fmt(m.themGoals)}
                      </b>
                      <div>
                        <small>{m.opponent}</small>
                      </div>
                    </td>
                    <td>{m.count ? fmt(m.count) : '—'}</td>
                    <td>
                      {fmt(m.passMiss)}
                      {m.passAttempts ? <small> / {fmt(m.passAttempts)}</small> : null}
                    </td>
                    <td>
                      {fmt(m.tklMiss)}
                      {m.tackleAttempts ? <small> / {fmt(m.tackleAttempts)}</small> : null}
                    </td>
                    <td>{fmt(m.shots)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  )
}

function Crown({ kicker, row, line, kit, onOpen, gold }) {
  return (
    <button
      type="button"
      className={`study-crown${gold ? ' gold' : ''}`}
      onClick={() => row && onOpen(row)}
      disabled={!row}
    >
      <span>{kicker}</span>
      {row ? (
        <PlayerMark name={row.name} nationId={row.player?.stats?.proNationality} colors={kit} size={48} />
      ) : null}
      <b>{row?.name || '—'}</b>
      <small>{line}</small>
    </button>
  )
}

function FormPill({ form }) {
  const label = { sobe: 'Subindo', cai: 'Caindo', estavel: 'Estável', ausente: 'Fora da janela' }[form] || form
  return <em className={`study-pill ${form}`}>{label}</em>
}

function CompareTable({ rows, avg, onOpen, kind }) {
  if (!rows?.length) return <div className="notice">Sem amostra de regulares.</div>
  const pass = kind === 'pass'
  return (
    <div className="table-scroll">
      <table className="stats-table">
        <thead>
          <tr>
            <th>Jogador</th>
            <th>{pass ? 'Certos/jogo' : 'Certos/jogo'}</th>
            <th>{pass ? 'Erra/jogo' : 'Erra o bote/jogo'}</th>
            <th>%</th>
            <th>{pass ? 'Índice' : 'Índice certo'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const index = pass ? p.passIndex : p.tklIndex
            const miss = pass ? p.passMissPg : p.tklMissPg
            const ok = pass ? p.passPg : p.tklPg
            const rate = pass ? p.passPct : p.tklPct
            const warn = pass ? avg != null && index < avg * 0.75 : miss >= 4
            return (
              <tr key={p.id} className={warn ? 'study-row-warn' : ''}>
                <td>
                  <button type="button" className="study-name" onClick={() => onOpen(p)}>
                    {p.name}
                  </button>
                </td>
                <td>{fmt(ok, 1)}</td>
                <td>{fmt(miss, 1)}</td>
                <td>{rate != null ? fmt(rate) + '%' : '-'}</td>
                <td>{fmt(index, 1)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
