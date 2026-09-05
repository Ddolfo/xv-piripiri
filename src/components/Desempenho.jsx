import { useMemo } from 'react'
import { analyzeDesempenho } from '../lib/desempenho'

function fmt(n, digits) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? (Number.isInteger(v) ? 0 : 1),
  })
}

function Bar({ value, warn }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="study-bar">
      <i className={warn ? 'warn' : ''} style={{ width: `${v}%` }} />
    </div>
  )
}

function Fact({ label, value, hint, warn }) {
  return (
    <div className={`study-fact${warn ? ' warn' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
      {hint ? <small>{hint}</small> : null}
    </div>
  )
}

function Person({ title, player, stat, unit }) {
  return (
    <article className="study-person">
      <span>{title}</span>
      <b>{player?.name || '—'}</b>
      <small>
        {player && stat != null ? `${fmt(stat)}${unit || ''}` : 'Sem recorte de regulares'}
      </small>
    </article>
  )
}

export default function Desempenho({ store }) {
  const study = useMemo(
    () => analyzeDesempenho(store.players, store.ea?.matches, store.history),
    [store.players, store.ea?.matches, store.history],
  )
  const t = study.teamRecent
  const w = study.worst

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Estudo de desempenho</h2>
          <p>
            Onde o XV erra, quando o time entra curto e quem mais suja o passe, o desarme e o chute.
            Carreira no clube para o elenco; súmulas recentes da EA para o coletivo.
          </p>
        </div>
      </div>

      {study.insights.length ? (
        <section className="study-insights">
          {study.insights.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
      ) : (
        <div className="notice">Sincronize o clube para montar o diagnóstico.</div>
      )}

      <div className="study-facts">
        <Fact
          label="Passes errados"
          value={t.passMissPct != null ? `${t.passMissPct}%` : '—'}
          hint={t.passTry ? `${fmt(t.passTry - t.passOk)} em ${fmt(t.passTry)} nas súmulas` : ''}
          warn={t.passMissPct >= 25}
        />
        <Fact
          label="Desarmes falhos"
          value={t.tklMissPct != null ? `${t.tklMissPct}%` : '—'}
          hint={t.tklTry ? `${fmt(t.tklTry - t.tklOk)} em ${fmt(t.tklTry)} tentativas` : ''}
          warn={t.tklMissPct >= 55}
        />
        <Fact
          label="Chutes sem gol"
          value={t.shotMissPct != null ? `${t.shotMissPct}%` : '—'}
          hint={t.shots ? `${fmt(t.gf)} gols em ${fmt(t.shots)} finalizações` : ''}
        />
        <Fact
          label="Jogos curtos"
          value={t.shortPct != null ? `${t.shortPct}%` : '—'}
          hint={`${fmt(t.short)} com menos de 7 em campo`}
          warn={t.shortPct >= 40}
        />
        <Fact
          label="Gols pró · contra"
          value={`${fmt(t.gf)}–${fmt(t.ga)}`}
          hint={`Nas ${fmt(study.recentCount)} súmulas recentes`}
          warn={t.ga > t.gf}
        />
        <Fact
          label="Arquivo de rivais"
          value={`${fmt(study.histRecord.wins)}-${fmt(study.histRecord.draws)}-${fmt(study.histRecord.losses)}`}
          hint={`${fmt(study.histCount)} jogos guardados`}
        />
      </div>

      <section className="card">
        <h3>Quando o XV entra curto</h3>
        <p className="card-lead">
          Aproveitamento nas súmulas recentes, separado pelo número de Pros em campo. Menos gente
          costuma ser o erro tático número um.
        </p>
        {study.buckets.length ? (
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
                      <Bar value={b.winPct} warn={b.winPct != null && b.winPct < 45} />
                    </td>
                    <td>
                      {fmt(b.gf)}–{fmt(b.ga)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="notice">Sem súmulas recentes para fatiar por número em campo.</div>
        )}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Quem mais erra no elenco</h3>
        <p className="card-lead">
          Só entram jogadores com {fmt(40)} jogos ou mais no clube, para não distorcer com quem
          mal estreou.
        </p>
        <div className="study-people">
          <Person title="Passe mais sujo" player={w.pass} stat={w.pass?.passSuccess} unit="% de acerto" />
          <Person title="Desarme mais falho" player={w.tackle} stat={w.tackle?.tackleSuccess} unit="% de acerto" />
          <Person title="Chute menos certeiro" player={w.shot} stat={w.shot?.shotSuccess} unit="% no gol" />
          <Person title="Menor nota" player={w.rating} stat={w.rating?.rating} unit="" />
          <Person title="Pior aproveitamento" player={w.winRate} stat={w.winRate?.winRate} unit="%" />
          <Person title="Mais expulsões" player={w.red} stat={w.red?.redCards} unit=" vermelhos" />
        </div>
        {study.regulars.length ? (
          <div className="table-scroll" style={{ marginTop: 14 }}>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Jogador</th>
                  <th>Linha</th>
                  <th>Jogos</th>
                  <th>Erro no passe</th>
                  <th>Erro no desarme</th>
                  <th>Erro no chute</th>
                  <th>Nota</th>
                  <th>Vermelhos</th>
                </tr>
              </thead>
              <tbody>
                {[...study.regulars]
                  .sort((a, b) => (b.tklMissPct || 0) - (a.tklMissPct || 0))
                  .map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.line}</td>
                      <td>{fmt(p.games)}</td>
                      <td>{p.passMissPct != null ? `${p.passMissPct}%` : '—'}</td>
                      <td>{p.tklMissPct != null ? `${p.tklMissPct}%` : '—'}</td>
                      <td>{p.shotMissPct != null ? `${p.shotMissPct}%` : '—'}</td>
                      <td>{p.rating ? fmt(p.rating, 2) : '—'}</td>
                      <td>{fmt(p.redCards)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {study.lineRows.length ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h3>Erro por linha</h3>
          <p className="card-lead">Média dos regulares de cada setor, na carreira deste clube.</p>
          <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Jogadores</th>
                  <th>Erro no passe</th>
                  <th>Erro no desarme</th>
                  <th>Erro no chute</th>
                  <th>Nota média</th>
                </tr>
              </thead>
              <tbody>
                {study.lineRows.map((L) => (
                  <tr key={L.line}>
                    <td>{L.line}</td>
                    <td>{fmt(L.players)}</td>
                    <td>{fmt(L.passMiss)}%</td>
                    <td>{fmt(L.tklMiss)}%</td>
                    <td>{fmt(L.shotMiss)}%</td>
                    <td>{fmt(L.rating, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {study.matchRows.length ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h3>Erros jogo a jogo</h3>
          <p className="card-lead">Passes e desarmes que não saíram, nas súmulas que a EA ainda publica.</p>
          <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Jogo</th>
                  <th>Em campo</th>
                  <th>Passes errados</th>
                  <th>Desarmes falhos</th>
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
