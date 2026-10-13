import { useEffect, useRef, useState } from 'react'
import { validateCrest } from '../lib/crest.js'
import { coins, draftApi, getDraftToken, ledgerLabel, overallTone, setDraftToken, statusLabel } from './api.js'
import CrestEditor, { startingCrest } from './CrestEditor.jsx'
import CrestMark from './CrestMark.jsx'
import AdminPanel from './AdminPanel.jsx'
import { PlayerCard } from './parts.jsx'
import FormModal from './FormModal.jsx'
import FormationPicker from './FormationPicker.jsx'
import NotificationBell from './NotificationBell.jsx'
import ProposalComposer from './ProposalComposer.jsx'
import { payloadFor, termsFor } from './deal.js'
import LineupView from './LineupView.jsx'
import { CupsView, TableView } from './MatchViews.jsx'
import PlayerFace from './PlayerFace.jsx'
import './draft.css'

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
  const [now, setNow] = useState(() => Date.now())
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

const BLANK_LOGIN = { username: '', password: '' }
const blankOnboard = () => ({ step: 1, name: '', formation: '', crest: null })

export default function DraftApp() {
  const [snap, setSnap] = useState(null)
  const [tab, setTabState] = useState('clube')
  const [marketArea, setMarketArea] = useState('livres')
  const [focusMatchId, setFocusMatchId] = useState(null)
  const setTab = (id) => {
    setFocusMatchId(null)
    setTabState(id)
  }
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [login, setLogin] = useState(BLANK_LOGIN)
  const [onboard, setOnboard] = useState(blankOnboard)
  const [modal, setModal] = useState(null)
  const shownUser = useRef(null)

  // Tudo o que pertence a uma conta some quando a conta muda: formulário de login,
  // cadastro do clube em andamento, aba aberta e janelas.
  function resetAccountState() {
    setLogin(BLANK_LOGIN)
    setOnboard(blankOnboard())
    setTab('clube')
    setModal(null)
  }

  async function refresh() {
    const token = getDraftToken()
    try {
      const data = await draftApi.snapshot()
      // Resposta de um pedido feito com outra conta (antes de sair ou trocar): descarta.
      if (getDraftToken() !== token) return
      const userId = data?.me?.id || null
      if (shownUser.current !== userId) {
        if (shownUser.current !== null) resetAccountState()
        shownUser.current = userId
      }
      setSnap(data)
      setErr('')
    } catch (e) {
      if (getDraftToken() !== token) return
      if (String(e.message).includes('Sessão')) {
        setDraftToken('')
        shownUser.current = null
        resetAccountState()
        setSnap({ me: null })
      } else setErr(e.message)
    }
  }

  async function logout() {
    await run(async () => {
      // Sai mesmo que a sessão já tenha expirado no servidor.
      await draftApi.logout().catch(() => {})
      setDraftToken('')
      resetAccountState()
    })
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
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                const res = await draftApi.login(login.username.trim(), login.password)
                resetAccountState()
                setDraftToken(res.token)
              }, 'Sessão iniciada.')
            }}
          >
            <div className="field">
              <label htmlFor="draft-user">Identificador</label>
              <input
                id="draft-user"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={login.username}
                onChange={(e) => setLogin({ ...login, username: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="draft-pass">Senha</label>
              <input
                id="draft-pass"
                type="password"
                autoComplete="current-password"
                value={login.password}
                onChange={(e) => setLogin({ ...login, password: e.target.value })}
              />
            </div>
            <div className="actions">
              <button type="submit" className="btn" disabled={busy || !login.username.trim() || !login.password}>
                Entrar
              </button>
            </div>
          </form>
        </div>
      </section>
    )
  }

  if (snap.me?.role === 'admin') {
    return <AdminPanel key={snap.me.id} snap={snap} err={err} ok={ok} busy={busy} run={run} onLogout={logout} />
  }

  if (snap.me && !snap.club?.setupComplete) {
    return (
      <Onboarding
        onboard={onboard}
        setOnboard={setOnboard}
        err={err}
        busy={busy}
        run={run}
        onLogout={logout}
      />
    )
  }

  const club = snap.club
  const drawDone = !!snap.drawDone
  const marketOpen = drawDone && snap.marketStatus === 'aberto'
  const tabs = [
    ['clube', 'Clube'],
    ['formacao', 'Formação e Escalação'],
    ...(drawDone ? [['mercado', 'Mercado da Bola']] : []),
    ['campeonatos', 'Campeonatos'],
    ['tabela', 'Tabela do Campeonato'],
  ]
  const currentTab = tab === 'mercado' && !drawDone ? 'clube' : tab

  // Clique numa notificação: marca como lida e leva ao lugar certo.
  function openNotification(n, route) {
    if (!n.read) draftApi.readNotes([n.id]).then(refresh).catch(() => {})
    const target = route.tab === 'mercado' && !drawDone ? 'clube' : route.tab
    setTabState(target)
    if (route.area) setMarketArea(route.area)
    setFocusMatchId(target === 'campeonatos' ? route.matchId : null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function readAll() {
    draftApi.readNotes().then(refresh).catch(() => {})
  }

  return (
    <section className="draft-xv" key={snap.me.id}>
      <div className="draft-hero">
        <div className="club-cell">
          <CrestMark crest={club.crest} size={72} />
          <div>
            <h2>{club.name}</h2>
            <p>
              {club.participantName} · {club.preferredFormation} · {club.rosterCount}/{club.maxRoster} jogadores ·{' '}
              {drawDone ? `mercado ${snap.marketStatus}` : 'aguardando o sorteio oficial · mercado fechado'}
            </p>
          </div>
        </div>
        <div className="hero-side">
          <NotificationBell notifications={snap.notifications} onOpen={openNotification} onReadAll={readAll} />
        <div className="wallet-box">
          <span>Carteira</span>
          <b>{coins(club.spendable)}</b>
          {club.reserved ? <small className="muted">Reservado em lances: {coins(club.reserved)}</small> : null}
          <button
            className="link-btn draft-logout"
            onClick={logout}
          >
            Sair
          </button>
        </div>
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
      </div>
      {currentTab === 'clube' && <ClubView club={club} marketOpen={marketOpen} run={run} setModal={setModal} />}
      {currentTab === 'formacao' && <LineupView snap={snap} run={run} />}
      {currentTab === 'mercado' && drawDone && <MarketView snap={snap} run={run} setModal={setModal} area={marketArea} setArea={setMarketArea} />}
      {currentTab === 'campeonatos' && <CupsView key={focusMatchId || 'cups'} snap={snap} run={run} focusMatchId={focusMatchId} />}
      {currentTab === 'tabela' && <TableView snap={snap} run={run} />}
      {modal}
    </section>
  )
}

function Onboarding({ onboard, setOnboard, err, busy, run, onLogout }) {
  const crest = onboard.crest || startingCrest(onboard.name)
  const crestError = validateCrest(crest)
  const canFinish = onboard.name.trim().length >= 3 && !!onboard.formation && !crestError
  const LAST = 4
  const canNext =
    (onboard.step === 1 && onboard.name.trim().length >= 3) || (onboard.step === 2 && !!onboard.formation) || (onboard.step === 3 && !crestError)
  return (
    <section className="draft-xv card onboarding">
      <div className="steps">
        {['Nome', 'Formação', 'Escudo', 'Concluir'].map((label, i) => (
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
          <small className="muted">De 3 a 32 caracteres.</small>
        </div>
      )}
      {onboard.step === 2 && (
        <div>
          <h3>Formação preferida</h3>
          <p className="muted">
            O sorteio garante pelo menos um jogador para cada posição desta formação. O restante do elenco sai aleatório,
            dentro das mesmas faixas de over.
          </p>
          <FormationPicker value={onboard.formation} onChange={(formation) => setOnboard({ ...onboard, formation })} />
        </div>
      )}
      {onboard.step === 3 && (
        <div>
          <h3>Escudo do clube</h3>
          <p className="muted">Escolha forma, padrão, cores, símbolo e texto. Tudo pode ser trocado até concluir.</p>
          <CrestEditor clubName={onboard.name.trim()} value={crest} onChange={(c) => setOnboard({ ...onboard, crest: c })} />
          {crestError ? <p className="err-text">{crestError}</p> : null}
        </div>
      )}
      {onboard.step === LAST && (
        <div className="club-cell">
          <CrestMark crest={crest} size={120} />
          <div>
            <h3>{onboard.name}</h3>
            <p className="muted">
              Formação preferida {onboard.formation || '—'}. O elenco inicial será sorteado depois pelo administrador.
            </p>
          </div>
        </div>
      )}
      <div className="actions">
        {onboard.step > 1 && (
          <button className="btn ghost" onClick={() => setOnboard({ ...onboard, step: onboard.step - 1 })}>
            Voltar
          </button>
        )}
        {onboard.step < LAST && (
          <button className="btn" disabled={!canNext} onClick={() => setOnboard({ ...onboard, step: onboard.step + 1 })}>
            Continuar
          </button>
        )}
        {onboard.step === LAST && (
          <button
            className="btn"
            disabled={!canFinish || busy}
            onClick={() =>
              run(
                () =>
                  draftApi.setupClub({
                    name: onboard.name,
                    formation: onboard.formation,
                    primary: crest.primary,
                    secondary: crest.secondary,
                    crest,
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
                    <td>{ledgerLabel(l.reason)}</td>
                    <td className={l.amount < 0 ? 'money-out' : 'money-in'}>
                      {l.amount > 0 ? '+' : ''}
                      {coins(l.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MarketView({ snap, run, setModal, area: areaProp, setArea: setAreaProp }) {
  const [q, setQ] = useState('')
  const [ovr, setOvr] = useState('')
  const [areaLocal, setAreaLocal] = useState('livres')
  const area = areaProp || areaLocal
  const setArea = setAreaProp || setAreaLocal
  const list = (snap.market || []).filter((p) => {
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false
    if (ovr && String(p.overall) !== ovr) return false
    return true
  })
  const allPlayers = [
    ...(snap.market || []),
    ...(snap.club?.roster || []),
    ...(snap.clubs || []).flatMap((c) => c.roster || []),
  ]
  const playerName = (id) => allPlayers.find((x) => x.id === id)?.name || 'Jogador'
  const clubName = (id) => (id === snap.club?.id ? 'Seu clube' : snap.clubs?.find((c) => c.id === id)?.name || 'Clube')
  const closeModal = () => setModal(null)

  function askBid(a, p, last) {
    const min = (last?.amount || 0) + (snap.settings?.minBidIncrement || 100)
    setModal(
      <FormModal
        title={`Lance por ${p.name}`}
        intro={`Lance atual: ${coins(last?.amount || 0)}. O próximo precisa ser de pelo menos ${coins(min)}.`}
        fields={[{ name: 'amount', label: 'Seu lance em XV-Coins', type: 'number', min, defaultValue: String(min) }]}
        submitLabel="Dar lance"
        onClose={closeModal}
        onSubmit={({ amount }) => run(() => draftApi.bid(a.id, amount), 'Lance registrado.')}
      />,
    )
  }

  const myClub = snap.club
  const clubById = (id) => (snap.clubs || []).find((c) => c.id === id)
  // Jogadores presos em outra negociação ou leilão não podem entrar numa nova.
  const lockedFor = (proposalId) => {
    const ids = new Set()
    for (const x of snap.proposals || []) {
      if (x.id === proposalId || !['pendente', 'contraproposta'].includes(x.status)) continue
      for (const id of [...(x.requestPlayerIds || []), ...(x.offerPlayerIds || [])]) ids.add(id)
    }
    for (const a of snap.auctions || []) if (a.status === 'aberto') ids.add(a.playerId)
    return ids
  }

  function openDeal(c, p) {
    setModal(
      <ProposalComposer
        title={`Negociar com ${c.name}`}
        myClub={myClub}
        otherClub={c}
        initial={{ take: p ? [p.id] : [], give: [], pay: Math.min(p?.buy || 0, myClub.spendable ?? myClub.balance ?? 0), receive: 0 }}
        lockedIds={lockedFor(null)}
        submitLabel="Enviar proposta"
        onClose={closeModal}
        onSubmit={(terms) => run(() => draftApi.propose({ toClubId: c.id, ...payloadFor(terms, true) }), 'Proposta enviada.')}
      />,
    )
  }

  function openCounter(p) {
    const otherId = p.fromClubId === myClub.id ? p.toClubId : p.fromClubId
    const other = clubById(otherId)
    if (!other) return
    setModal(
      <ProposalComposer
        title={`Contraproposta para ${other.name}`}
        myClub={myClub}
        otherClub={other}
        initial={termsFor(p, myClub.id)}
        lockedIds={lockedFor(p.id)}
        submitLabel="Enviar contraproposta"
        onClose={closeModal}
        onSubmit={(terms) =>
          run(
            () => draftApi.respondProposal(p.id, { action: 'contraproposta', ...payloadFor(terms, p.fromClubId === myClub.id) }),
            'Contraproposta enviada.',
          )
        }
      />,
    )
  }

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
            <input placeholder="Nota" inputMode="numeric" value={ovr} onChange={(e) => setOvr(e.target.value)} />
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
          {!(snap.auctions || []).some((a) => a.status === 'aberto') ? (
            <p className="draft-empty">Nenhum leilão aberto agora. Inicie um pela aba Jogadores livres.</p>
          ) : null}
          {(snap.auctions || [])
            .filter((a) => a.status === 'aberto')
            .map((a) => {
              const p = allPlayers.find((x) => x.id === a.playerId) || { name: 'Jogador', overall: '—' }
              const last = a.bids[a.bids.length - 1]
              return (
                <div key={a.id} className="auction-row">
                  <PlayerFace src={p.image} name={p.name} />
                  <div>
                    <h4>
                      {p.name} <span className={`ovr ${overallTone(p.overall)}`}>{p.overall}</span>
                    </h4>
                    <small className="muted">
                      Lance atual {coins(last?.amount || 0)}
                      {last?.clubId ? ` · ${clubName(last.clubId)}` : ''}
                    </small>
                  </div>
                  <Timer endsAt={a.endsAt} />
                  <button className="btn" onClick={() => askBid(a, p, last)}>
                    Dar lance
                  </button>
                </div>
              )
            })}
        </div>
      )}
      {area === 'clubes' && (
        <div className="card">
          {!(snap.clubs || []).some((c) => c.id !== snap.club.id) ? <p className="draft-empty">Ainda não há outros clubes no Draft.</p> : null}
          {(snap.clubs || [])
            .filter((c) => c.id !== snap.club.id)
            .map((c) => (
              <details key={c.id} className="market-club">
                <summary className="club-cell">
                  <CrestMark crest={c.crest} size={36} />
                  <b>{c.name}</b>
                  <span className="muted">
                    {c.participantName} · {c.rosterCount} jogadores
                  </span>
                  <button
                    type="button"
                    className="link-btn market-club-deal"
                    onClick={(e) => {
                      e.preventDefault()
                      openDeal(c, null)
                    }}
                  >
                    Negociar
                  </button>
                </summary>
                <div className="player-grid" style={{ marginTop: 10 }}>
                  {(c.roster || []).map((p) => (
                    <PlayerCard
                      key={p.id}
                      player={p}
                      actions={
                        <button className="btn" onClick={() => openDeal(c, p)}>
                          Fazer proposta
                        </button>
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
          {!(snap.proposals || []).length ? <p className="draft-empty">Nenhuma proposta por enquanto.</p> : null}
          {[...(snap.proposals || [])]
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .map((p) => {
              const mine = snap.club?.id
              const open = ['pendente', 'contraproposta'].includes(p.status)
              const awaiting = p.awaitingClubId || (p.status === 'pendente' ? p.toClubId : p.fromClubId)
              const myTurn = open && awaiting === mine
              const otherId = p.fromClubId === mine ? p.toClubId : p.fromClubId
              const t = termsFor(p, mine)
              const list = (ids) => ids.map(playerName).join(', ')
              return (
                <div key={p.id} className={`note proposal${myTurn ? ' my-turn' : ''}`}>
                  <div className="proposal-head">
                    <span className="club-cell">
                      <CrestMark crest={clubById(otherId)?.crest} size={28} />
                      <b>{clubName(otherId)}</b>
                      <small className="muted">{p.fromClubId === mine ? 'você propôs' : 'propôs a você'}</small>
                    </span>
                    <span className={`badge${myTurn ? ' turn' : ''}`}>
                      {open ? (myTurn ? 'Sua vez de responder' : 'Aguardando o outro clube') : statusLabel(p.status)}
                    </span>
                  </div>
                  <div className="proposal-terms">
                    <span>
                      Você leva <b>{list(t.take) || 'ninguém'}</b>
                    </span>
                    <span>
                      Você dá <b>{list(t.give) || 'ninguém'}</b>
                    </span>
                    {t.pay ? (
                      <span>
                        Você paga <b>{coins(t.pay)}</b>
                      </span>
                    ) : null}
                    {t.receive ? (
                      <span>
                        Você recebe <b>{coins(t.receive)}</b>
                      </span>
                    ) : null}
                    {!t.pay && !t.receive ? <span className="muted">Troca direta, sem dinheiro</span> : null}
                  </div>
                  {open ? (
                    <div className="actions">
                      {myTurn ? (
                        <>
                          <button className="btn" onClick={() => run(() => draftApi.respondProposal(p.id, { action: 'aceitar' }), 'Negócio fechado.')}>
                            Aceitar
                          </button>
                          <button className="btn ghost" onClick={() => openCounter(p)}>
                            Contraproposta
                          </button>
                          <button className="btn ghost" onClick={() => run(() => draftApi.respondProposal(p.id, { action: 'recusar' }), 'Proposta recusada.')}>
                            Recusar
                          </button>
                        </>
                      ) : (
                        <button className="btn danger" onClick={() => run(() => draftApi.respondProposal(p.id, { action: 'cancelar' }), 'Proposta retirada.')}>
                          Retirar proposta
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

