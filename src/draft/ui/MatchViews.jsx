import { useState } from 'react'
import { YELLOW_CARD_LIMIT } from '../lib/constants.js'
import { draftApi, formatLabel, statusLabel } from './api.js'
import CrestMark from './CrestMark.jsx'

function useNames(snap) {
  const clubs = snap.clubs || []
  const players = [...(snap.club?.roster || []), ...clubs.flatMap((c) => c.roster || []), ...(snap.players || [])]
  return {
    club: (id) => clubs.find((c) => c.id === id) || (snap.club?.id === id ? snap.club : null),
    clubName: (id) => clubs.find((c) => c.id === id)?.name || (snap.club?.id === id ? snap.club.name : 'Clube'),
    playerName: (id) => players.find((p) => p.id === id)?.name || null,
  }
}

export function CardRules({ settings }) {
  const limit = Number(settings?.yellowCardLimit) || YELLOW_CARD_LIMIT
  return (
    <details className="card-rules">
      <summary>Regras de cartões</summary>
      <ul>
        <li>
          <span className="card-chip red" aria-hidden="true" /> Vermelho direto: suspensão na próxima partida oficial.
        </li>
        <li>
          <span className="card-chip yellow" aria-hidden="true" />
          <span className="card-chip yellow" aria-hidden="true" /> Dois amarelos no mesmo jogo: expulsão e suspensão na próxima partida.
          Esses dois amarelos não contam para o acúmulo.
        </li>
        <li>
          <span className="card-chip yellow" aria-hidden="true" /> A cada {limit} amarelos no mesmo campeonato: suspensão na próxima
          partida oficial.
        </li>
        <li>Jogador suspenso não pode estar entre os titulares. Troque na Formação e Escalação antes do convite.</li>
      </ul>
    </details>
  )
}

function MatchReport({ match, names }) {
  const events = (match.result?.events || []).filter((e) => ['gol', 'amarelo', 'vermelho'].includes(e.type))
  const st = match.result?.stats
  return (
    <article className="match-report">
      <div className="match-report-score">
        <span className="club-cell">
          <CrestMark crest={names.club(match.homeClubId)?.crest} size={32} />
          {names.clubName(match.homeClubId)}
        </span>
        <b>
          {match.homeGoals} <i>×</i> {match.awayGoals}
        </b>
        <span className="club-cell away">
          {names.clubName(match.awayClubId)}
          <CrestMark crest={names.club(match.awayClubId)?.crest} size={32} />
        </span>
      </div>
      {events.length ? (
        <ul className="match-report-events">
          {events.map((e, i) => {
            const assist = e.type === 'gol' && e.assistId ? names.playerName(e.assistId) : null
            const side = e.clubId === match.homeClubId ? 'home' : 'away'
            return (
              <li key={i} className={side}>
                <span className="minute">{e.minute}'</span>
                <span className={`ev ev-${e.type}`} aria-hidden="true">
                  {e.type === 'gol' ? '⚽' : ''}
                </span>
                <span>
                  {e.playerName || names.clubName(e.clubId)}
                  {assist ? <small> · assistência de {assist}</small> : null}
                  {e.type === 'vermelho' && e.reason === 'segundo_amarelo' ? <small> · dois amarelos</small> : null}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="muted">Sem gols nem cartões.</p>
      )}
      {st ? (
        <div className="match-report-stats">
          <span>
            Faltas <b>{st.home.fouls}</b> · <b>{st.away.fouls}</b>
          </span>
          <span>
            Amarelos <b>{st.home.yellows}</b> · <b>{st.away.yellows}</b>
          </span>
          <span>
            Vermelhos <b>{st.home.reds}</b> · <b>{st.away.reds}</b>
          </span>
          <span>
            Finalizações <b>{st.home.shots}</b> · <b>{st.away.shots}</b>
          </span>
        </div>
      ) : null}
    </article>
  )
}

export function CupsView({ snap, run }) {
  const names = useNames(snap)
  const mine = snap.club?.id
  const challenges = snap.challenges || []
  const openFor = (fixtureId) => challenges.find((c) => c.fixtureId === fixtureId && ['pendente', 'aceito'].includes(c.status))
  const incoming = challenges.filter((c) => c.status === 'pendente' && c.toClubId === mine)
  const legacyReady = challenges.filter((c) => c.status === 'aceito' && c.fromClubId === mine)
  const legacyToConfirm = (snap.matches || []).filter((m) => m.status === 'aguardando_confirmacao')
  const played = (snap.matches || [])
    .filter((m) => m.status === 'validado')
    .sort((a, b) => (b.validatedAt || b.createdAt || 0) - (a.validatedAt || a.createdAt || 0))
  const suspended = snap.suspensions || snap.club?.suspensions || []

  return (
    <div className="cups">
      {incoming.length ? (
        <div className="card invite-box">
          <h3>Convites para jogar</h3>
          {incoming.map((ch) => (
            <div key={ch.id} className="invite">
              <span className="club-cell">
                <CrestMark crest={names.club(ch.fromClubId)?.crest} size={36} />
                <span>
                  <b>{names.clubName(ch.fromClubId)}</b> convidou seu clube
                  <small className="muted"> · ao aceitar, a partida acontece na hora</small>
                </span>
              </span>
              <div className="actions">
                <button className="btn" onClick={() => run(() => draftApi.respondChallenge(ch.id, true), 'Partida jogada. O resultado já está na tabela.')}>
                  Aceitar e jogar
                </button>
                <button className="btn ghost" onClick={() => run(() => draftApi.respondChallenge(ch.id, false), 'Convite recusado.')}>
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {legacyReady.map((ch) => (
        <div key={ch.id} className="card invite-box">
          <div className="invite">
            <span>
              <b>{names.clubName(ch.toClubId)}</b> já tinha aceitado seu convite.
            </span>
            <button className="btn" onClick={() => run(() => draftApi.startChallenge(ch.id), 'Partida jogada. O resultado já está na tabela.')}>
              Jogar agora
            </button>
          </div>
        </div>
      ))}

      {suspended.length ? (
        <div className="card suspended-box">
          <h3>Suspensos para a próxima partida</h3>
          <p className="muted">{suspended.map((s) => names.playerName(s.playerId) || 'Jogador').join(', ')}</p>
        </div>
      ) : null}

      <div className="card">
        {(snap.championships || []).map((cup) => (
          <section key={cup.id} className="cup-block">
            <h3>{cup.name}</h3>
            <p className="muted">
              {formatLabel(cup.format)} · {statusLabel(cup.status)}
            </p>
            {!(cup.fixtures || []).length ? (
              <p className="draft-empty">O calendário deste campeonato ainda não foi gerado pelo administrador.</p>
            ) : (
              <div className="table-wrap">
                <table className="draft-table">
                  <thead>
                    <tr>
                      <th>Rodada</th>
                      <th>Mandante</th>
                      <th>Visitante</th>
                      <th>Situação</th>
                      <th aria-label="Ação" />
                    </tr>
                  </thead>
                  <tbody>
                    {(cup.fixtures || []).map((f) => {
                      const open = openFor(f.id)
                      const iAmHome = f.homeClubId === mine
                      const done = f.status === 'concluido'
                      const match = done ? (snap.matches || []).find((m) => m.fixtureId === f.id) : null
                      return (
                        <tr key={f.id}>
                          <td>{f.round}</td>
                          <td>{names.clubName(f.homeClubId)}</td>
                          <td>{f.bye ? 'Folga' : names.clubName(f.awayClubId)}</td>
                          <td>
                            {match ? (
                              <b>
                                {match.homeGoals} × {match.awayGoals}
                              </b>
                            ) : open?.status === 'pendente' ? (
                              open.fromClubId === mine ? (
                                'Aguardando o adversário aceitar'
                              ) : (
                                'Convite recebido'
                              )
                            ) : (
                              statusLabel(f.status)
                            )}
                          </td>
                          <td className="row-actions">
                            {f.status === 'pendente' && iAmHome && !open && !f.bye ? (
                              <button className="btn" onClick={() => run(() => draftApi.challenge(f.id), 'Convite enviado.')}>
                                Convidar para jogar
                              </button>
                            ) : null}
                            {f.status === 'pendente' && !iAmHome && !open && (f.homeClubId === mine || f.awayClubId === mine) ? (
                              <small className="muted">O mandante convida</small>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
        {!(snap.championships || []).length ? <p className="draft-empty">Nenhum campeonato criado ainda.</p> : null}
      </div>

      {legacyToConfirm.map((m) => (
        <div key={m.id} className="card">
          <h3>Resultado pendente de confirmação</h3>
          <MatchReport match={m} names={names} />
          <div className="actions">
            <button className="btn" onClick={() => run(() => draftApi.confirmMatch(m.id), 'Resultado confirmado.')}>
              Confirmar resultado
            </button>
          </div>
        </div>
      ))}

      {played.length ? (
        <div className="card">
          <h3>Partidas jogadas</h3>
          <div className="match-reports">
            {played.map((m) => (
              <MatchReport key={m.id} match={m} names={names} />
            ))}
          </div>
        </div>
      ) : null}

      <CardRules settings={snap.settings} />
    </div>
  )
}

const LEADER_TABS = [
  ['goals', 'Artilharia', 'Gols'],
  ['assists', 'Assistências', 'Assist.'],
  ['fouls', 'Faltas', 'Faltas'],
  ['yellows', 'Amarelos', 'Amarelos'],
  ['reds', 'Vermelhos', 'Vermelhos'],
]

export function TableView({ snap }) {
  const [cupId, setCupId] = useState(snap.championships?.[0]?.id || '')
  const [board, setBoard] = useState('goals')
  const names = useNames(snap)
  const cup = (snap.championships || []).find((c) => c.id === cupId) || snap.championships?.[0]
  if (!cup) return <div className="card draft-empty">Nenhum campeonato ativo.</div>
  const [, boardLabel, boardColumn] = LEADER_TABS.find(([id]) => id === board)
  const leaders = [...(cup.leaders || [])]
    .filter((r) => r[board] > 0)
    .sort((a, b) => b[board] - a[board] || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, 15)

  return (
    <div className="tables">
      <div className="card">
        {(snap.championships || []).length > 1 ? (
          <select className="draft-select" value={cup.id} onChange={(e) => setCupId(e.target.value)}>
            {snap.championships.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {formatLabel(c.format)}
              </option>
            ))}
          </select>
        ) : (
          <h3>{cup.name}</h3>
        )}
        {cup.format === 'pontos-corridos' ? (
          <div className="table-wrap">
            <table className="draft-table standings">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Clube</th>
                  <th title="Pontos">P</th>
                  <th title="Jogos">J</th>
                  <th title="Vitórias">V</th>
                  <th title="Empates">E</th>
                  <th title="Derrotas">D</th>
                  <th title="Gols pró">GP</th>
                  <th title="Gols contra">GC</th>
                  <th title="Saldo de gols">SG</th>
                  <th title="Faltas">F</th>
                  <th title="Cartões amarelos">
                    <span className="card-chip yellow" />
                  </th>
                  <th title="Cartões vermelhos">
                    <span className="card-chip red" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {(cup.standings || []).map((r) => (
                  <tr key={r.clubId} className={r.clubId === snap.club?.id ? 'mine' : ''}>
                    <td>{r.position}º</td>
                    <td className="club-cell">
                      <CrestMark crest={r.crest} size={26} /> {r.name}
                    </td>
                    <td>
                      <b>{r.points}</b>
                    </td>
                    <td>{r.played}</td>
                    <td>{r.wins}</td>
                    <td>{r.draws}</td>
                    <td>{r.losses}</td>
                    <td>{r.gf}</td>
                    <td>{r.ga}</td>
                    <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                    <td>{r.fouls ?? 0}</td>
                    <td>{r.yellows ?? 0}</td>
                    <td>{r.reds ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="note-list">
            {(cup.fixtures || []).map((f) => (
              <div key={f.id} className="note">
                Rodada {f.round}: {names.clubName(f.homeClubId)} {f.bye ? '(folga)' : `x ${names.clubName(f.awayClubId)}`} ·{' '}
                {statusLabel(f.status)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="leaders-head">
          <h3>Jogadores</h3>
          <div className="segmented" role="group" aria-label="Ranking">
            {LEADER_TABS.map(([id, label]) => (
              <button key={id} type="button" className={board === id ? 'active' : ''} aria-pressed={board === id} onClick={() => setBoard(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {leaders.length ? (
          <table className="draft-table leaders">
            <thead>
              <tr>
                <th>#</th>
                <th>Jogador</th>
                <th>Clube</th>
                <th>{boardColumn}</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((r, i) => (
                <tr key={r.playerId} className={r.clubId === snap.club?.id ? 'mine' : ''}>
                  <td>{i + 1}º</td>
                  <td>
                    {r.name} <small className="muted">{r.position}</small>
                  </td>
                  <td>{r.clubName}</td>
                  <td>
                    <b>{r[board]}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="draft-empty">Ninguém em {boardLabel.toLowerCase()} ainda. Os números aparecem depois das partidas.</p>
        )}
      </div>

      <CardRules settings={snap.settings} />
    </div>
  )
}
