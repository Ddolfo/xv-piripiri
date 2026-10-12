import { useEffect, useState } from 'react'
import { uniqueColors } from '../lib/util.js'
import { coins, draftApi, overallTone, setDraftToken } from './api.js'
import { emptyCrest } from './crest-lib.js'
import CrestEditor from './CrestEditor.jsx'
import CrestMark from './CrestMark.jsx'
import LineupView from './LineupView.jsx'
import './draft.css'

function PlayerCard({ player, actions }) {
  return (
    <article className="fut-card">
      <div className="fut-face-wrap">
        {player.image ? <img className="fut-face" src={player.image} alt="" /> : null}
        <div className={`ovr ${overallTone(player.overall)}`}>{player.overall}</div>
      </div>
      <div>
        <h4>{player.name}</h4>
        <small>
          {player.position}
          {player.club ? ` · ${player.club}` : ''}
          {player.nation ? ` · ${player.nation}` : ''}
          {player.status ? ` · ${player.status}` : ''}
        </small>
        {player.buy != null && (
          <div>
            <small>Compra {coins(player.buy)} · Venda {coins(player.sell)}</small>
          </div>
        )}
      </div>
      {actions ? <div className="card-actions">{actions}</div> : null}
    </article>
  )
}

function ClubPicker({ clubs, users, selected, onChange }) {
  const list = clubs || []
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }
  const pending = (users || []).filter((u) => u.role === 'participante' && u.status === 'ativo' && !list.some((c) => c.userId === u.id || c.id === u.clubId))
  if (!list.length) {
    return <p className="muted">Nenhum clube concluído. Os participantes precisam criar o clube antes da inscrição.</p>
  }
  return (
    <div className="club-picker">
      <div className="actions">
        <button type="button" className="btn ghost" onClick={() => onChange(list.map((c) => c.id))}>
          Marcar todos
        </button>
        <button type="button" className="btn ghost" onClick={() => onChange([])}>
          Limpar
        </button>
      </div>
      {list.map((c) => {
        const owner = (users || []).find((u) => u.clubId === c.id)
        return (
          <label key={c.id} className="club-pick">
            <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
            <CrestMark crest={c.crest} size={28} />
            <span>
              <b>{c.name}</b>
              <small className="muted"> {owner?.displayName || owner?.username || c.participantName || '—'}</small>
            </span>
          </label>
        )
      })}
      {pending.map((u) => (
        <div key={u.id} className="club-pick" style={{ opacity: 0.55 }}>
          <input type="checkbox" disabled />
          <span>
            <b>{u.displayName || u.username}</b>
            <small className="muted"> ainda sem clube</small>
          </span>
        </div>
      ))}
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

function Timer({ endsAt }) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, endsAt - now)
  const h = Math.floor(left / 3600000)
  const m = Math.floor((left % 3600000) / 60000)
  const s = Math.floor((left % 60000) / 1000)
  return (
    <div className="auction-timer">
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  )
}

export default function DraftApp() {
  const [snap, setSnap] = useState(null)
  const [tab, setTab] = useState('clube')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [login, setLogin] = useState({ username: '', password: '' })
  const [onboard, setOnboard] = useState({ step: 1, name: '', primary: '#ffd200', secondary: '#145c32', crest: null })
  const [modal, setModal] = useState(null)

  async function refresh() {
    try {
      const data = await draftApi.snapshot()
      setSnap(data)
      setErr('')
    } catch (e) {
      if (String(e.message).includes('Sessão')) {
        setDraftToken('')
        setSnap({ me: null })
      } else setErr(e.message)
    }
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 8000)
    return () => clearInterval(t)
  }, [])

  async function run(fn, success) {
    setBusy(true)
    setErr('')
    setOk('')
    try {
      await fn()
      if (success) setOk(success)
      await refresh()
      setModal(null)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!snap) return <div className="card">Carregando o Draft XV…</div>

  if (!snap.me) {
    return (
      <section className="draft-xv">
        <div className="card draft-login">
          <h2>Draft XV</h2>
          <p className="muted">Campeonato interno do XV de PiriPiri. Entre com a conta criada pelo administrador.</p>
          {err ? <div className="alert">{err}</div> : null}
          <div className="field">
            <label>Identificador</label>
            <input value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
          </div>
          <div className="field">
            <label>Senha</label>
            <input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
          </div>
          <div className="actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res = await draftApi.login(login.username, login.password)
                  setDraftToken(res.token)
                }, 'Sessão iniciada.')
              }
            >
              Entrar
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (snap.me?.role === 'admin') {
    return <AdminView snap={snap} err={err} ok={ok} busy={busy} run={run} refresh={refresh} setErr={setErr} />
  }

  if (snap.me && !snap.club?.setupComplete) {
    return (
      <Onboarding
        onboard={onboard}
        setOnboard={setOnboard}
        err={err}
        busy={busy}
        run={run}
        onLogout={() =>
          run(async () => {
            await draftApi.logout()
            setDraftToken('')
          })
        }
      />
    )
  }

  const unread = (snap.notifications || []).filter((n) => !n.read).length
  const club = snap.club
  const drawDone = !!snap.drawDone
  const marketOpen = drawDone && snap.marketStatus === 'aberto'
  const tabs = [
    ['clube', 'Clube'],
    ['formacao', 'Formação e Escalação'],
    ...(drawDone ? [['mercado', 'Mercado da Bola']] : []),
    ['campeonatos', 'Campeonatos'],
    ['tabela', 'Tabela do Campeonato'],
    ['notas', `Notificações${unread ? ` (${unread})` : ''}`],
  ]
  const currentTab = tab === 'mercado' && !drawDone ? 'clube' : tab

  return (
    <section className="draft-xv">
      <div className="draft-hero">
        <div className="club-cell" style={{ gap: 14 }}>
          <CrestMark crest={club.crest} size={72} />
          <div>
            <h2>{club.name}</h2>
            <p>
              {club.participantName} · {club.rosterCount}/{club.maxRoster} jogadores ·{' '}
              {drawDone ? `mercado ${snap.marketStatus}` : 'aguardando o sorteio oficial · mercado fechado'}
            </p>
          </div>
        </div>
        <div className="wallet-box">
          <span>Carteira</span>
          <b>{coins(club.spendable)}</b>
          {club.reserved ? <small className="muted">Reservado em lances: {coins(club.reserved)}</small> : null}
        </div>
      </div>
      {err ? <div className="alert">{err}</div> : null}
      {ok ? <div className="okbox">{ok}</div> : null}
      <div className="draft-subnav">
        {tabs.map(([id, label]) => (
          <button key={id} className={currentTab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <button
          className="btn ghost"
          onClick={() =>
            run(async () => {
              await draftApi.logout()
              setDraftToken('')
            })
          }
        >
          Sair
        </button>
      </div>
      {currentTab === 'clube' && <ClubView club={club} marketOpen={marketOpen} run={run} setModal={setModal} />}
      {currentTab === 'formacao' && <LineupView snap={snap} run={run} />}
      {currentTab === 'mercado' && drawDone && <MarketView snap={snap} run={run} setModal={setModal} modal={modal} />}
      {currentTab === 'campeonatos' && <CupsView snap={snap} run={run} />}
      {currentTab === 'tabela' && <TableView snap={snap} run={run} />}
      {currentTab === 'notas' && <NotesView snap={snap} run={run} />}
      {modal}
    </section>
  )
}

function Onboarding({ onboard, setOnboard, err, busy, run, onLogout }) {
  const crest = onboard.crest || emptyCrest(onboard.primary, onboard.secondary)
  const colors = uniqueColors({ ...crest, primary: onboard.primary, secondary: onboard.secondary })
  const canFinish = onboard.name.trim().length >= 3 && colors.length >= 2 && colors.length <= 5
  return (
    <section className="draft-xv card">
      <div className="steps">
        {['Nome', 'Cores', 'Emblema', 'Concluir'].map((label, i) => (
          <span key={label} className={onboard.step === i + 1 ? 'on' : ''}>
            {i + 1}. {label}
          </span>
        ))}
      </div>
      {err ? <div className="alert">{err}</div> : null}
      {onboard.step === 1 && (
        <div className="field">
          <label>Nome do clube</label>
          <input value={onboard.name} maxLength={32} onChange={(e) => setOnboard({ ...onboard, name: e.target.value })} />
        </div>
      )}
      {onboard.step === 2 && (
        <div className="color-row">
          <label className="field">
            Cor principal
            <input type="color" value={onboard.primary} onChange={(e) => setOnboard({ ...onboard, primary: e.target.value })} />
          </label>
          <label className="field">
            Cor secundária
            <input type="color" value={onboard.secondary} onChange={(e) => setOnboard({ ...onboard, secondary: e.target.value })} />
          </label>
        </div>
      )}
      {onboard.step === 3 && (
        <CrestEditor
          primary={onboard.primary}
          secondary={onboard.secondary}
          value={crest}
          onChange={(c) => setOnboard({ ...onboard, crest: c })}
        />
      )}
      {onboard.step === 4 && (
        <div className="club-cell">
          <CrestMark crest={{ ...crest, primary: onboard.primary, secondary: onboard.secondary }} size={96} />
          <div>
            <h3>{onboard.name}</h3>
            <p className="muted">O elenco inicial será sorteado depois pelo administrador.</p>
          </div>
        </div>
      )}
      <div className="actions">
        {onboard.step > 1 && (
          <button className="btn ghost" onClick={() => setOnboard({ ...onboard, step: onboard.step - 1 })}>
            Voltar
          </button>
        )}
        {onboard.step < 4 && (
          <button className="btn" onClick={() => setOnboard({ ...onboard, step: onboard.step + 1 })}>
            Continuar
          </button>
        )}
        {onboard.step === 4 && (
          <button
            className="btn"
            disabled={!canFinish || busy}
            onClick={() =>
              run(
                () =>
                  draftApi.setupClub({
                    name: onboard.name,
                    primary: onboard.primary,
                    secondary: onboard.secondary,
                    crest: { ...crest, primary: onboard.primary, secondary: onboard.secondary },
                  }),
                'Clube criado.',
              )
            }
          >
            Concluir
          </button>
        )}
        <button className="btn ghost" onClick={onLogout}>
          Sair
        </button>
      </div>
    </section>
  )
}

function ClubView({ club, marketOpen, run, setModal }) {
  return (
    <div className="grid-2">
      <div className="card">
        <h3>Elenco {club.rosterCount}/{club.maxRoster}</h3>
        {!club.rosterCount ? (
          <p className="muted">O elenco entra depois do sorteio oficial feito pelo administrador.</p>
        ) : null}
        <div className="player-grid">
          {club.roster.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              actions={
                marketOpen ? (
                  <button
                    className="btn ghost"
                    onClick={() =>
                      setModal(
                        <Modal title="Vender ao mercado" onClose={() => setModal(null)}>
                          <p>
                            {p.name} ({p.overall}) rende {coins(p.sell)}.
                          </p>
                          <div className="actions">
                            <button className="btn" onClick={() => run(() => draftApi.sell(p.id), 'Venda concluída.')}>
                              Confirmar venda
                            </button>
                          </div>
                        </Modal>,
                      )
                    }
                  >
                    Vender ao mercado
                  </button>
                ) : null
              }
            />
          ))}
        </div>
      </div>
      <div className="card">
        <h3>Histórico financeiro</h3>
        <div className="table-wrap">
          <table className="draft-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Motivo</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {(club.ledger || [])
                .slice()
                .reverse()
                .map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.at).toLocaleString('pt-BR')}</td>
                    <td>{l.reason}</td>
                    <td>{coins(l.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MarketView({ snap, run, setModal }) {
  const [q, setQ] = useState('')
  const [ovr, setOvr] = useState('')
  const [area, setArea] = useState('livres')
  const list = (snap.market || []).filter((p) => {
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false
    if (ovr && String(p.overall) !== ovr) return false
    return true
  })
  if (snap.marketStatus !== 'aberto') {
    return (
      <div className="card">
        <h3>Mercado da Bola fechado</h3>
        <p>O sorteio já aconteceu, mas o administrador ainda não abriu o mercado. Compras, vendas, leilões e propostas ficam bloqueados.</p>
      </div>
    )
  }
  return (
    <div>
      <div className="draft-subnav">
        {[
          ['livres', 'Jogadores livres'],
          ['leiloes', 'Leilões'],
          ['clubes', 'Clubes participantes'],
          ['propostas', 'Propostas'],
        ].map(([id, label]) => (
          <button key={id} className={area === id ? 'active' : ''} onClick={() => setArea(id)}>
            {label}
          </button>
        ))}
      </div>
      {area === 'livres' && (
        <div className="card">
          <div className="filters">
            <input placeholder="Buscar nome" value={q} onChange={(e) => setQ(e.target.value)} />
            <input placeholder="Over" value={ovr} onChange={(e) => setOvr(e.target.value)} />
          </div>
          <div className="player-grid">
            {list
              .filter((p) => p.status === 'livre')
              .map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  actions={
                    <>
                      <button
                        className="btn"
                        onClick={() =>
                          setModal(
                            <Modal title="Compra direta" onClose={() => setModal(null)}>
                              <p>
                                Contratar {p.name} por {coins(p.buy)}? Saldo atual: {coins(snap.club.spendable)}.
                              </p>
                              <div className="actions">
                                <button className="btn" onClick={() => run(() => draftApi.buy(p.id), 'Jogador contratado.')}>
                                  Confirmar compra
                                </button>
                              </div>
                            </Modal>,
                          )
                        }
                      >
                        Comprar diretamente
                      </button>
                      <button className="btn ghost" onClick={() => run(() => draftApi.startAuction(p.id), 'Leilão iniciado.')}>
                        Iniciar leilão
                      </button>
                    </>
                  }
                />
              ))}
          </div>
        </div>
      )}
      {area === 'leiloes' && (
        <div className="card">
          {(snap.auctions || [])
            .filter((a) => a.status === 'aberto')
            .map((a) => {
              const p = (snap.market || []).find((x) => x.id === a.playerId) || { name: a.playerId, overall: '—' }
              const last = a.bids[a.bids.length - 1]
              return (
                <div key={a.id} className="fut-card" style={{ marginBottom: 10, gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <h4>
                      {p.name} · {p.overall}
                    </h4>
                    <Timer endsAt={a.endsAt} />
                    <small>Lance atual: {coins(last?.amount || 0)}</small>
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      const amount = Number(prompt('Novo lance em XV-Coins', String((last?.amount || 0) + (snap.settings?.minBidIncrement || 100))))
                      if (amount) run(() => draftApi.bid(a.id, amount), 'Lance registrado.')
                    }}
                  >
                    Dar lance
                  </button>
                </div>
              )
            })}
        </div>
      )}
      {area === 'clubes' && (
        <div className="card">
          {(snap.clubs || [])
            .filter((c) => c.id !== snap.club.id)
            .map((c) => (
              <details key={c.id} className="card" style={{ marginBottom: 8 }}>
                <summary className="club-cell">
                  <CrestMark crest={c.crest} size={36} />
                  <b>{c.name}</b>
                  <span className="muted">
                    {c.participantName} · {c.rosterCount} jogadores
                  </span>
                </summary>
                <div className="player-grid" style={{ marginTop: 10 }}>
                  {(c.roster || []).map((p) => (
                    <PlayerCard
                      key={p.id}
                      player={p}
                      actions={
                        <>
                          <button
                            className="btn"
                            onClick={() => {
                              const amount = Number(prompt(`Oferecer XV-Coins por ${p.name}`))
                              if (amount)
                                run(
                                  () => draftApi.propose({ toClubId: c.id, requestPlayerIds: [p.id], coinsFrom: amount }),
                                  'Proposta enviada.',
                                )
                            }}
                          >
                            Proposta em XV-Coins
                          </button>
                          <button
                            className="btn ghost"
                            onClick={() => {
                              const mine = snap.club.roster.map((x) => x.name).join(', ')
                              const named = prompt(`Seu elenco: ${mine}\nNome do jogador para oferecer em troca:`)
                              const offer = snap.club.roster.find((x) => x.name.toLowerCase() === String(named || '').toLowerCase())
                              if (!offer) return
                              const extra = Number(prompt('Complemento em XV-Coins (0 se for só troca)') || 0)
                              run(
                                () =>
                                  draftApi.propose({
                                    toClubId: c.id,
                                    requestPlayerIds: [p.id],
                                    offerPlayerIds: [offer.id],
                                    coinsFrom: extra || 0,
                                  }),
                                'Troca proposta.',
                              )
                            }}
                          >
                            Propor troca
                          </button>
                        </>
                      }
                    />
                  ))}
                </div>
              </details>
            ))}
        </div>
      )}
      {area === 'propostas' && (
        <div className="card">
          {(snap.proposals || []).map((p) => (
            <div key={p.id} className="note">
              <b>{p.status}</b>
              <div>
                Pedidos: {(p.requestPlayerIds || []).join(', ')} · Oferecidos: {(p.offerPlayerIds || []).join(', ') || '—'} ·{' '}
                {coins(p.coinsFrom)}
              </div>
              {['pendente', 'contraproposta'].includes(p.status) && (
                <div className="actions">
                  <button className="btn" onClick={() => run(() => draftApi.respondProposal(p.id, { action: 'aceitar' }), 'Proposta aceita.')}>
                    Aceitar
                  </button>
                  <button className="btn ghost" onClick={() => run(() => draftApi.respondProposal(p.id, { action: 'recusar' }))}>
                    Recusar
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      const coinsFrom = Number(prompt('Novo valor em XV-Coins oferecido pelo clube de origem', String(p.coinsFrom || 0)))
                      if (Number.isFinite(coinsFrom))
                        run(() => draftApi.respondProposal(p.id, { action: 'contraproposta', coinsFrom }), 'Contraproposta enviada.')
                    }}
                  >
                    Contraproposta
                  </button>
                  {p.fromClubId === snap.club.id && (
                    <button className="btn danger" onClick={() => run(() => draftApi.respondProposal(p.id, { action: 'cancelar' }))}>
                      Cancelar
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CupsView({ snap, run }) {
  return (
    <div className="card">
      {(snap.championships || []).map((cup) => (
        <div key={cup.id} style={{ marginBottom: 18 }}>
          <h3>
            {cup.name} · {cup.format} · {cup.status}
          </h3>
          <div className="table-wrap">
            <table className="draft-table">
              <thead>
                <tr>
                  <th>Rodada</th>
                  <th>Mandante</th>
                  <th>Visitante</th>
                  <th>Situação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(cup.fixtures || []).map((f) => (
                  <tr key={f.id}>
                    <td>{f.round}</td>
                    <td>{snap.clubs?.find((c) => c.id === f.homeClubId)?.name || f.homeClubId}</td>
                    <td>{f.bye ? 'bye' : snap.clubs?.find((c) => c.id === f.awayClubId)?.name || f.awayClubId}</td>
                    <td>{f.status}</td>
                    <td>
                      {f.status === 'pendente' && (
                        <button className="btn" onClick={() => run(() => draftApi.challenge(f.id), 'Desafio enviado.')}>
                          Desafiar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {(snap.challenges || []).map((ch) => (
        <div key={ch.id} className="note">
          Desafio {ch.status}
          {ch.status === 'pendente' && ch.toClubId === snap.club.id && (
            <div className="actions">
              <button className="btn" onClick={() => run(() => draftApi.respondChallenge(ch.id, true), 'Desafio aceito.')}>
                Aceitar
              </button>
              <button className="btn ghost" onClick={() => run(() => draftApi.respondChallenge(ch.id, false))}>
                Recusar
              </button>
            </div>
          )}
          {ch.status === 'aceito' && ch.fromClubId === snap.club.id && (
            <button className="btn" onClick={() => run(() => draftApi.startChallenge(ch.id), 'Partida simulada.')}>
              Confirmar início
            </button>
          )}
        </div>
      ))}
      {(snap.matches || []).map((m) => (
        <div key={m.id} className="card" style={{ marginTop: 10 }}>
          <h3>
            {m.homeGoals} x {m.awayGoals} · {m.status}
          </h3>
          <ul className="match-timeline">
            {(m.result?.events || []).map((e, i) => (
              <li key={i}>
                <b>{e.minute}'</b>
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
          {m.status === 'aguardando_confirmacao' && (
            <div className="actions">
              <button className="btn" onClick={() => run(() => draftApi.confirmMatch(m.id), 'Resultado confirmado.')}>
                Confirmar resultado
              </button>
              <button className="btn danger" onClick={() => run(() => draftApi.contestMatch(m.id, 'Divergência'), 'Contestação enviada.')}>
                Contestar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TableView({ snap }) {
  const [cupId, setCupId] = useState(snap.championships?.[0]?.id || '')
  const cup = (snap.championships || []).find((c) => c.id === cupId) || snap.championships?.[0]
  if (!cup) return <div className="card">Nenhum campeonato ativo.</div>
  return (
    <div className="card">
      <select value={cup.id} onChange={(e) => setCupId(e.target.value)}>
        {snap.championships.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {cup.format === 'pontos-corridos' ? (
        <div className="table-wrap">
          <table className="draft-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Clube</th>
                <th>J</th>
                <th>V</th>
                <th>E</th>
                <th>D</th>
                <th>GP</th>
                <th>GC</th>
                <th>SG</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {(cup.standings || []).map((r) => (
                <tr key={r.clubId}>
                  <td>{r.position}</td>
                  <td className="club-cell">
                    <CrestMark crest={r.crest} size={28} /> {r.name}
                  </td>
                  <td>{r.played}</td>
                  <td>{r.wins}</td>
                  <td>{r.draws}</td>
                  <td>{r.losses}</td>
                  <td>{r.gf}</td>
                  <td>{r.ga}</td>
                  <td>{r.gd}</td>
                  <td>
                    <b>{r.points}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {(cup.fixtures || []).map((f) => (
            <div key={f.id} className="note">
              Rodada {f.round}: {f.homeClubId} {f.bye ? ' (bye)' : `x ${f.awayClubId}`} · {f.status}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NotesView({ snap, run }) {
  return (
    <div className="card">
      <div className="actions">
        <button className="btn ghost" onClick={() => run(() => draftApi.readNotes(), 'Notificações lidas.')}>
          Marcar todas como lidas
        </button>
      </div>
      <div className="note-list">
        {(snap.notifications || [])
          .slice()
          .reverse()
          .map((n) => (
            <div key={n.id} className={n.read ? 'note' : 'note unread'}>
              <b>{n.title}</b>
              <div>{n.body}</div>
              <time>{new Date(n.at).toLocaleString('pt-BR')}</time>
            </div>
          ))}
      </div>
    </div>
  )
}

function bandLabel(ovr) {
  if (ovr >= 92) return '92+'
  if (ovr >= 89) return '89–91'
  if (ovr >= 85) return '85–87'
  if (ovr === 83) return '83'
  if (ovr >= 74) return '74–79'
  return '65–73'
}

function AdminTeams({ snap }) {
  const [q, setQ] = useState('')
  const drawDone = !!snap.drawDone
  const lastDraw = (snap.draws || [])[snap.draws.length - 1]
  const clubs = (snap.clubs || [])
    .filter((c) => c.setupComplete)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const drawn = clubs.filter((c) => (c.roster || []).length > 0)
  const term = q.trim().toLowerCase()
  const shown = drawn.filter((c) => {
    if (!term) return true
    const owner = (c.participantName || '').toLowerCase()
    const names = (c.roster || []).some((p) => p.name.toLowerCase().includes(term))
    return c.name.toLowerCase().includes(term) || owner.includes(term) || names
  })

  if (!drawDone) {
    return (
      <div className="card drawn-empty">
        <h3>Times sorteados</h3>
        <p className="muted">Essa visão abre depois do sorteio oficial. Até lá os elencos ainda não existem.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <h3>Times sorteados</h3>
        <p className="muted">
          {drawn.length} clube(s) com elenco
          {lastDraw ? ` · último sorteio ${new Date(lastDraw.at).toLocaleString('pt-BR')}` : ''}
        </p>
        <input className="lineup-search" placeholder="Buscar clube, participante ou jogador" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {shown.map((c) => {
        const roster = [...(c.roster || [])].sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name, 'pt-BR'))
        return (
          <details key={c.id} className="card admin-team" open={shown.length <= 3}>
            <summary>
              <CrestMark crest={c.crest} size={40} />
              <span>
                <b>{c.name}</b>
                <small className="muted">
                  {' '}
                  {c.participantName} · {c.rosterCount}/{c.maxRoster} jogadores · {coins(c.spendable ?? c.balance)}
                </small>
              </span>
            </summary>
            <div className="player-grid" style={{ marginTop: 12 }}>
              {roster.map((p) => (
                <PlayerCard key={p.id} player={{ ...p, status: `${p.position} · faixa ${bandLabel(p.overall)}` }} />
              ))}
            </div>
          </details>
        )
      })}
      {shown.length === 0 ? <p className="muted">Nenhum time encontrado nessa busca.</p> : null}
    </div>
  )
}

function AdminView({ snap, err, ok, busy, run }) {
  const [adminTab, setAdminTab] = useState('painel')
  const [user, setUser] = useState({ username: '', password: '', displayName: '' })
  const [cup, setCup] = useState({ name: 'Liga Draft XV', format: 'pontos-corridos' })
  const [just, setJust] = useState('')
  const [userJust, setUserJust] = useState('')
  const [cupJust, setCupJust] = useState({})
  const readyClubs = (snap.clubs || []).filter((c) => c.setupComplete)
  const [selectedClubIds, setSelectedClubIds] = useState(readyClubs.map((c) => c.id))
  const [editIds, setEditIds] = useState({})
  const drawDone = !!snap.drawDone
  const marketStatus = snap.marketStatus || 'fechado'
  return (
    <section className="draft-xv">
      <div className="draft-hero">
        <div>
          <h2>Painel administrativo · Draft XV</h2>
          <p>
            Mercado {marketStatus} · {snap.clubs?.length || 0} clubes · {snap.users?.length || 0} contas
            {drawDone ? '' : ' · sorteio pendente'}
          </p>
        </div>
        <button
          className="btn ghost"
          onClick={() =>
            run(async () => {
              await draftApi.logout()
              setDraftToken('')
            })
          }
        >
          Sair
        </button>
      </div>
      {err ? <div className="alert">{err}</div> : null}
      {ok ? <div className="okbox">{ok}</div> : null}
      <div className="draft-subnav">
        <button className={adminTab === 'painel' ? 'active' : ''} onClick={() => setAdminTab('painel')}>
          Painel
        </button>
        <button className={adminTab === 'times' ? 'active' : ''} onClick={() => setAdminTab('times')}>
          Times sorteados
        </button>
      </div>
      {adminTab === 'times' ? <AdminTeams snap={snap} /> : null}
      {adminTab === 'painel' ? (
      <>
      <div className="card market-desk">
        <div>
          <h3>Mercado da Bola</h3>
          <p>
            Situação atual: <span className={`badge ${marketStatus}`}>{marketStatus}</span>
          </p>
          {drawDone ? (
            <p className="muted">Abra para liberar compras, vendas e leilões aos participantes. Feche para travar o mercado.</p>
          ) : (
            <p className="muted">O mercado permanece fechado até o sorteio oficial dos elencos. Depois disso você abre e fecha por aqui.</p>
          )}
        </div>
        <div className="actions">
          <button
            className="btn"
            disabled={busy || !drawDone || marketStatus === 'aberto'}
            onClick={() => run(() => draftApi.marketStatus('aberto'), 'Mercado aberto.')}
          >
            Abrir mercado
          </button>
          <button
            className="btn ghost"
            disabled={busy || !drawDone || marketStatus === 'pausado'}
            onClick={() => run(() => draftApi.marketStatus('pausado'), 'Mercado pausado.')}
          >
            Pausar
          </button>
          <button
            className="btn danger"
            disabled={busy || marketStatus === 'fechado'}
            onClick={() => run(() => draftApi.marketStatus('fechado'), 'Mercado fechado.')}
          >
            Fechar mercado
          </button>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Participantes</h3>
          <div className="form-grid">
            <label className="field">
              Identificador
              <input value={user.username} onChange={(e) => setUser({ ...user, username: e.target.value })} />
            </label>
            <label className="field">
              Nome
              <input value={user.displayName} onChange={(e) => setUser({ ...user, displayName: e.target.value })} />
            </label>
            <label className="field full">
              Senha inicial
              <input type="password" value={user.password} onChange={(e) => setUser({ ...user, password: e.target.value })} />
            </label>
          </div>
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => run(() => draftApi.adminUsers(user), 'Participante criado.')}>
              Criar conta
            </button>
          </div>
          <label className="field">
            Justificativa para excluir participante
            <input value={userJust} onChange={(e) => setUserJust(e.target.value)} placeholder="Obrigatória para excluir a conta" />
          </label>
          <table className="draft-table">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Perfil</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(snap.users || [])
                .filter((u) => u.role === 'participante')
                .map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.displayName}</td>
                    <td>{u.status}</td>
                    <td>
                      <button
                        className="btn ghost"
                        onClick={() => run(() => draftApi.adminStatus(u.id, u.status === 'ativo' ? 'bloqueado' : 'ativo'))}
                      >
                        {u.status === 'ativo' ? 'Bloquear' : 'Reativar'}
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() => {
                          const password = prompt(`Nova senha para ${u.username}`)
                          if (password) run(() => draftApi.adminPassword(u.id, password), 'Senha redefinida.')
                        }}
                      >
                        Senha
                      </button>
                      <button
                        className="btn danger"
                        disabled={busy || !userJust.trim()}
                        onClick={() =>
                          run(
                            () => draftApi.deleteUser(u.id, userJust),
                            `${u.username} excluído, com clube e elenco liberados.`,
                          )
                        }
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Sorteio dos elencos</h3>
          <p className="muted">
            {drawDone
              ? 'Já existe sorteio oficial. Um novo sorteio redistribui os 22 jogadores e pede justificativa.'
              : 'Todos os clubes concluídos recebem 22 jogadores nas faixas oficiais. O mercado só pode abrir depois deste passo.'}
          </p>
          <label className="field">
            Justificativa (novo sorteio)
            <input value={just} onChange={(e) => setJust(e.target.value)} />
          </label>
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => run(() => draftApi.draw(just || undefined), 'Sorteio realizado.')}>
              Sortear elencos
            </button>
          </div>
          <h3>Campeonatos</h3>
          <label className="field">
            Nome
            <input value={cup.name} onChange={(e) => setCup({ ...cup, name: e.target.value })} />
          </label>
          <label className="field">
            Formato
            <select value={cup.format} onChange={(e) => setCup({ ...cup, format: e.target.value })}>
              <option value="pontos-corridos">Pontos corridos (ida e volta)</option>
              <option value="mata-mata">Mata-mata tiro rápido</option>
            </select>
          </label>
          <h4>Participantes</h4>
          <ClubPicker
            clubs={readyClubs}
            users={snap.users}
            selected={selectedClubIds}
            onChange={setSelectedClubIds}
          />
          <p className="muted">{selectedClubIds.length} clube(s) selecionado(s)</p>
          <div className="actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                run(
                  () => draftApi.createCup({ ...cup, clubIds: selectedClubIds }),
                  'Campeonato criado com os participantes selecionados.',
                )
              }
            >
              Criar campeonato
            </button>
            <button
              className="btn ghost"
              disabled={busy || selectedClubIds.length < 2}
              onClick={() =>
                run(
                  () => draftApi.createCup({ ...cup, clubIds: selectedClubIds, generateCalendar: true }),
                  'Campeonato criado e calendário gerado.',
                )
              }
            >
              Criar e gerar calendário
            </button>
          </div>
          {(snap.championships || []).map((c) => {
            const current = editIds[c.id] || c.clubIds || []
            return (
              <div key={c.id} className="note">
                <b>{c.name}</b> · {c.format} · {c.status}
                <ClubPicker
                  clubs={readyClubs}
                  users={snap.users}
                  selected={current}
                  onChange={(ids) => setEditIds({ ...editIds, [c.id]: ids })}
                />
                <div className="actions">
                  <button
                    className="btn ghost"
                    onClick={() => run(() => draftApi.assignCup(c.id, current), 'Participantes atualizados.')}
                  >
                    Salvar inscritos
                  </button>
                  <button className="btn" onClick={() => run(() => draftApi.calendar(c.id), 'Calendário gerado.')}>
                    Gerar calendário
                  </button>
                </div>
                <label className="field">
                  Justificativa para excluir
                  <input
                    value={cupJust[c.id] || ''}
                    onChange={(e) => setCupJust({ ...cupJust, [c.id]: e.target.value })}
                    placeholder="Obrigatória"
                  />
                </label>
                <div className="actions">
                  <button
                    className="btn danger"
                    disabled={busy || !(cupJust[c.id] || '').trim()}
                    onClick={() =>
                      run(
                        () => draftApi.deleteCup(c.id, cupJust[c.id]),
                        'Campeonato excluído, com confrontos e partidas removidos.',
                      )
                    }
                  >
                    Excluir campeonato
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="card">
        <h3>Tabela oficial de preços</h3>
        <div className="table-wrap">
          <table className="draft-table">
            <thead>
              <tr>
                <th>Over</th>
                <th>Compra direta</th>
                <th>Início do leilão</th>
                <th>Venda ao mercado</th>
              </tr>
            </thead>
            <tbody>
              {(snap.prices || []).map((r) => (
                <tr key={r.overall}>
                  <td>{r.overall}</td>
                  <td>{coins(r.buy)}</td>
                  <td>{coins(r.auction)}</td>
                  <td>{coins(r.sell)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3>Partidas em contestação</h3>
        {(snap.matches || [])
          .filter((m) => m.status === 'contestada' || m.status === 'analise')
          .map((m) => (
            <div key={m.id} className="note">
              {m.homeGoals} x {m.awayGoals} · {m.contest?.reason}
              <button
                className="btn"
                onClick={() =>
                  run(() => draftApi.resolveMatch(m.id, { keepOriginal: true, justification: 'Registro original mantido.' }))
                }
              >
                Manter original
              </button>
            </div>
          ))}
      </div>
      <div className="card">
        <h3>Auditoria</h3>
        <table className="draft-table">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Quem</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {(snap.audit || [])
              .slice()
              .reverse()
              .slice(0, 30)
              .map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.at).toLocaleString('pt-BR')}</td>
                  <td>{a.username}</td>
                  <td>{a.action}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      </>
      ) : null}
    </section>
  )
}
