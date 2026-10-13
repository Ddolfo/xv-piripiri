import { useState } from 'react'
import { coins, draftApi, formatLabel, statusLabel } from './api.js'
import CrestMark from './CrestMark.jsx'
import FormModal from './FormModal.jsx'
import MatchSheet from './MatchSheet.jsx'
import { LeadersBoard, StandingsTable } from './MatchViews.jsx'
import { useNames } from './names.js'
import { AdminTeams, ClubPicker } from './parts.jsx'

const TABS = [
  ['inicio', 'Início'],
  ['campeonatos', 'Campeonatos'],
  ['participantes', 'Participantes'],
  ['elencos', 'Elencos'],
  ['mercado', 'Mercado'],
  ['auditoria', 'Auditoria'],
]

const ACTION_LABEL = {
  criar_participante: 'Criou conta de participante',
  excluir_participante: 'Excluiu participante',
  redefinir_senha: 'Redefiniu senha',
  status_usuario: 'Bloqueou ou reativou conta',
  criar_clube: 'Clube criado',
  sorteio_elencos: 'Sorteou os elencos',
  mercado_status: 'Alterou o mercado',
  criar_campeonato: 'Criou campeonato',
  excluir_campeonato: 'Excluiu campeonato',
  inscrever_clubes: 'Atualizou inscritos',
  gerar_calendario: 'Gerou calendário',
  resolver_partida: 'Resolveu partida',
  configuracao: 'Alterou configurações',
  campeonato_status: 'Alterou situação do campeonato',
  ajuste_admin: 'Ajuste manual de saldo',
  excluir_jogador: 'Excluiu jogador do banco',
  importar_jogadores: 'Importou jogadores',
  jogador_banco: 'Editou jogador do banco',
}

function Kpi({ label, value, note, tone }) {
  return (
    <div className={`tile admin-kpi${tone ? ` ${tone}` : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note ? <small>{note}</small> : null}
    </div>
  )
}

// ---------- Início ----------

function Overview({ snap, go }) {
  const participants = (snap.users || []).filter((u) => u.role === 'participante')
  const clubs = (snap.clubs || []).filter((c) => c.setupComplete)
  const withoutClub = participants.filter((u) => !clubs.some((c) => c.userId === u.id || c.id === u.clubId))
  const cups = (snap.championships || []).filter((c) => c.status === 'ativo')
  const fixtures = cups.flatMap((c) => (c.fixtures || []).filter((f) => !f.bye))
  const played = fixtures.filter((f) => f.status === 'concluido').length
  const invites = (snap.challenges || []).filter((c) => c.status === 'pendente').length
  const market = snap.marketStatus || 'fechado'
  const steps = [
    ['Criar as contas dos participantes', participants.length > 0, 'participantes'],
    ['Cada participante cria o clube', participants.length > 0 && withoutClub.length === 0, 'participantes'],
    ['Sortear os elencos', !!snap.drawDone, 'elencos'],
    ['Criar o campeonato', cups.length > 0, 'campeonatos'],
    ['Gerar o calendário', cups.some((c) => (c.fixtures || []).length), 'campeonatos'],
    ['Abrir o mercado (opcional)', market === 'aberto', 'mercado'],
  ]
  const next = steps.find(([, done]) => !done)

  return (
    <div className="admin-stack">
      <dl className="admin-kpis">
        <Kpi label="Participantes" value={participants.length} note={withoutClub.length ? `${withoutClub.length} sem clube` : 'Todos com clube'} />
        <Kpi label="Campeonatos ativos" value={cups.length} note={cups.map((c) => c.name).join(' · ') || 'Nenhum'} />
        <Kpi label="Partidas jogadas" value={`${played}/${fixtures.length}`} note={fixtures.length ? `${fixtures.length - played} por jogar` : 'Sem calendário'} />
        <Kpi label="Convites pendentes" value={invites} note={invites ? 'Aguardando aceite do visitante' : 'Nenhum'} />
        <Kpi label="Mercado" value={statusLabel(market)} tone={market} note={snap.drawDone ? 'Sorteio feito' : 'Sorteio pendente'} />
      </dl>

      <div className="grid-2">
        <div className="card">
          <h3>Passo a passo</h3>
          <ol className="admin-steps">
            {steps.map(([label, done, tab]) => (
              <li key={label} className={done ? 'done' : next?.[0] === label ? 'next' : ''}>
                <span className="admin-step-dot" aria-hidden="true">
                  {done ? '✓' : ''}
                </span>
                <span>{label}</span>
                {!done ? (
                  <button type="button" className="link-btn" onClick={() => go(tab)}>
                    Ir
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
        <div className="card">
          <h3>Atividade recente</h3>
          <ul className="admin-activity">
            {(snap.audit || [])
              .slice(-8)
              .reverse()
              .map((a) => (
                <li key={a.id}>
                  <span>{ACTION_LABEL[a.action] || statusLabel(a.action)}</span>
                  <small>
                    {a.username} · {new Date(a.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </small>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ---------- Campeonatos ----------

function fixtureState(f, snap) {
  if (f.bye) return { label: 'Folga', tone: 'muted' }
  if (f.status === 'concluido') return { label: 'Jogado', tone: 'ok' }
  const invite = (snap.challenges || []).find((c) => c.fixtureId === f.id && ['pendente', 'aceito'].includes(c.status))
  if (invite?.status === 'pendente') return { label: 'Convite enviado', tone: 'gold' }
  if (invite?.status === 'aceito') return { label: 'Aceito, falta jogar', tone: 'gold' }
  return { label: 'Aguardando convite do mandante', tone: 'muted' }
}

function CupDetail({ cup, snap, names, run, setModal, readyClubs }) {
  const [view, setView] = useState('tabela')
  const [sheet, setSheet] = useState(null)
  const [editing, setEditing] = useState(false)
  const [clubIds, setClubIds] = useState(cup.clubIds || [])
  const fixtures = cup.fixtures || []
  const real = fixtures.filter((f) => !f.bye)
  const played = real.filter((f) => f.status === 'concluido').length
  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b)
  const matchOf = (f) => (snap.matches || []).find((m) => m.fixtureId === f.id)
  const clubSet = new Set(cup.clubIds || [])
  const suspended = (snap.suspensions || []).filter((s) => s.status === 'ativa' && clubSet.has(s.clubId))

  function confirmDelete() {
    setModal(
      <FormModal
        title={`Excluir ${cup.name}?`}
        intro="Os confrontos, convites e partidas deste campeonato serão apagados. Isso não pode ser desfeito."
        fields={[]}
        submitLabel="Excluir campeonato"
        danger
        onClose={() => setModal(null)}
        onSubmit={() => run(() => draftApi.deleteCup(cup.id), 'Campeonato excluído.').then(() => setModal(null))}
      />,
    )
  }

  return (
    <div className="admin-stack">
      <div className="card admin-cup-head">
        <div>
          <h3>{cup.name}</h3>
          <p className="muted">
            {formatLabel(cup.format)} · {statusLabel(cup.status)} · {cup.clubIds?.length || 0} clubes
            {cup.championClubId ? ` · campeão: ${names.clubName(cup.championClubId)}` : ''}
          </p>
        </div>
        <div className="admin-progress" aria-label={`${played} de ${real.length} jogos`}>
          <b>
            {played}/{real.length}
          </b>
          <small>jogos</small>
          <i style={{ '--p': `${real.length ? (played / real.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="draft-subnav">
        {[
          ['tabela', 'Classificação'],
          ['jogos', 'Jogos'],
          ['jogadores', 'Jogadores'],
          ['gerenciar', 'Gerenciar'],
        ].map(([id, label]) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>

      {view === 'tabela' && (
        <div className="card">
          {cup.format === 'pontos-corridos' ? (
            <StandingsTable cup={cup} />
          ) : (
            <p className="muted">Mata-mata: acompanhe os confrontos na aba Jogos.</p>
          )}
          {suspended.length ? (
            <div className="admin-suspended">
              <b>Suspensos para a próxima partida</b>
              <ul>
                {suspended.map((s) => (
                  <li key={s.id}>
                    {names.playerName(s.playerId) || 'Jogador'} <small className="muted">· {names.clubName(s.clubId)}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {view === 'jogos' && (
        <div className="card">
          {!fixtures.length ? <p className="draft-empty">Calendário ainda não gerado. Use a aba Gerenciar.</p> : null}
          {rounds.map((round) => (
            <section key={round} className="admin-round">
              <h4>Rodada {round}</h4>
              <ul>
                {fixtures
                  .filter((f) => f.round === round)
                  .map((f) => {
                    const st = fixtureState(f, snap)
                    const match = matchOf(f)
                    return (
                      <li key={f.id} className="admin-fixture">
                        <span className="club-cell home">
                          {names.clubName(f.homeClubId)}
                          <CrestMark crest={names.club(f.homeClubId)?.crest} size={24} />
                        </span>
                        {match ? (
                          <button type="button" className="score-link admin-score" onClick={() => setSheet(match)}>
                            {match.homeGoals} × {match.awayGoals}
                          </button>
                        ) : (
                          <span className="admin-score muted">×</span>
                        )}
                        <span className="club-cell">
                          {f.bye ? null : <CrestMark crest={names.club(f.awayClubId)?.crest} size={24} />}
                          {f.bye ? 'Folga' : names.clubName(f.awayClubId)}
                        </span>
                        <span className={`admin-pill ${st.tone}`}>{st.label}</span>
                      </li>
                    )
                  })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {view === 'jogadores' && (
        <div className="card">
          <LeadersBoard cup={cup} limit={20} />
        </div>
      )}

      {view === 'gerenciar' && (
        <div className="card">
          <h3>Clubes inscritos</h3>
          {editing ? (
            <>
              <ClubPicker clubs={readyClubs} users={snap.users} selected={clubIds} onChange={setClubIds} />
              <div className="actions">
                <button
                  className="btn"
                  onClick={() => run(() => draftApi.assignCup(cup.id, clubIds), 'Inscritos atualizados.').then(() => setEditing(false))}
                >
                  Salvar inscritos
                </button>
                <button className="btn ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <div className="admin-chips">
              {(cup.clubIds || []).map((id) => (
                <span key={id} className="admin-chip">
                  <CrestMark crest={names.club(id)?.crest} size={20} /> {names.clubName(id)}
                </span>
              ))}
              <button className="link-btn" onClick={() => setEditing(true)}>
                Alterar inscritos
              </button>
            </div>
          )}
          <h3 className="admin-sub">Calendário</h3>
          <p className="muted">
            {fixtures.length
              ? `${fixtures.length} confrontos em ${rounds.length} rodadas. Gerar de novo refaz os confrontos que ainda não foram jogados.`
              : 'Gere os confrontos com os clubes inscritos.'}
          </p>
          <div className="actions">
            <button className="btn" disabled={(cup.clubIds || []).length < 2} onClick={() => run(() => draftApi.calendar(cup.id), 'Calendário gerado.')}>
              {fixtures.length ? 'Gerar de novo' : 'Gerar calendário'}
            </button>
          </div>
          <h3 className="admin-sub">Zona de perigo</h3>
          <div className="actions">
            <button className="btn danger" onClick={confirmDelete}>
              Excluir campeonato
            </button>
          </div>
        </div>
      )}

      {sheet ? <MatchSheet match={sheet} names={names} cup={cup} onClose={() => setSheet(null)} /> : null}
    </div>
  )
}

function Championships({ snap, run, setModal, names }) {
  const cups = snap.championships || []
  const [selected, setSelected] = useState(cups[0]?.id || '')
  const cup = cups.find((c) => c.id === selected) || cups[0]
  const readyClubs = (snap.clubs || []).filter((c) => c.setupComplete)

  function create() {
    setModal(
      <FormModal
        title="Novo campeonato"
        intro={`Entram os ${readyClubs.length} clubes prontos. O calendário já sai gerado.`}
        fields={[
          { name: 'name', label: 'Nome', defaultValue: 'Liga Draft XV' },
          {
            name: 'format',
            label: 'Formato',
            type: 'select',
            options: [
              { value: 'pontos-corridos', label: 'Pontos corridos (ida e volta)' },
              { value: 'mata-mata', label: 'Mata-mata em jogo único' },
            ],
          },
        ]}
        submitLabel="Criar campeonato"
        onClose={() => setModal(null)}
        onSubmit={({ name, format }) =>
          run(
            () => draftApi.createCup({ name, format, clubIds: readyClubs.map((c) => c.id), generateCalendar: readyClubs.length >= 2 }),
            'Campeonato criado.',
          ).then(() => setModal(null))
        }
      />,
    )
  }

  return (
    <div className="admin-stack">
      <div className="admin-cup-bar">
        {cups.length ? (
          <div className="segmented">
            {cups.map((c) => (
              <button key={c.id} type="button" className={cup?.id === c.id ? 'active' : ''} onClick={() => setSelected(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        ) : (
          <span className="muted">Nenhum campeonato ainda.</span>
        )}
        <button className="btn" onClick={create}>
          Novo campeonato
        </button>
      </div>
      {cup ? <CupDetail key={cup.id} cup={cup} snap={snap} names={names} run={run} setModal={setModal} readyClubs={readyClubs} /> : null}
    </div>
  )
}

// ---------- Participantes ----------

function Participants({ snap, run, setModal, busy }) {
  const participants = (snap.users || []).filter((u) => u.role === 'participante')
  const clubOf = (u) => (snap.clubs || []).find((c) => c.userId === u.id || c.id === u.clubId)

  function create() {
    setModal(
      <FormModal
        title="Nova conta de participante"
        intro="Passe o identificador e a senha para a pessoa. Ela cria o clube no primeiro acesso."
        fields={[
          { name: 'username', label: 'Identificador' },
          { name: 'displayName', label: 'Nome', required: false },
          { name: 'password', label: 'Senha inicial (8 ou mais caracteres)', type: 'password' },
        ]}
        submitLabel="Criar conta"
        onClose={() => setModal(null)}
        onSubmit={(v) => run(() => draftApi.adminUsers(v), 'Conta criada.').then(() => setModal(null))}
      />,
    )
  }

  function password(u) {
    setModal(
      <FormModal
        title={`Nova senha para ${u.username}`}
        intro="A pessoa entra com essa senha no próximo acesso."
        fields={[{ name: 'password', label: 'Nova senha', type: 'password' }]}
        submitLabel="Redefinir senha"
        onClose={() => setModal(null)}
        onSubmit={({ password: pw }) => run(() => draftApi.adminPassword(u.id, pw), 'Senha redefinida.').then(() => setModal(null))}
      />,
    )
  }

  function remove(u) {
    const club = clubOf(u)
    setModal(
      <FormModal
        title={`Excluir ${u.username}?`}
        intro={
          club
            ? `A conta e o clube ${club.name} somem, e os ${club.rosterCount} jogadores voltam para o mercado. Isso não pode ser desfeito.`
            : 'A conta será apagada. Isso não pode ser desfeito.'
        }
        fields={[]}
        submitLabel="Excluir participante"
        danger
        onClose={() => setModal(null)}
        onSubmit={() => run(() => draftApi.deleteUser(u.id), `${u.username} excluído.`).then(() => setModal(null))}
      />,
    )
  }

  return (
    <div className="card">
      <div className="admin-card-head">
        <h3>Participantes</h3>
        <button className="btn" onClick={create}>
          Nova conta
        </button>
      </div>
      {!participants.length ? <p className="draft-empty">Nenhum participante ainda. Crie a primeira conta.</p> : null}
      {participants.length ? (
        <div className="table-wrap">
          <table className="draft-table admin-people">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Clube</th>
                <th>Formação</th>
                <th>Elenco</th>
                <th>Carteira</th>
                <th>Situação</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {participants.map((u) => {
                const club = clubOf(u)
                return (
                  <tr key={u.id}>
                    <td>
                      <b>{u.username}</b>
                      {u.displayName && u.displayName !== u.username ? <small className="muted"> · {u.displayName}</small> : null}
                    </td>
                    <td>
                      {club ? (
                        <span className="club-cell">
                          <CrestMark crest={club.crest} size={24} /> {club.name}
                        </span>
                      ) : (
                        <span className="muted">Ainda não criou</span>
                      )}
                    </td>
                    <td>{club?.preferredFormation || '—'}</td>
                    <td>{club ? `${club.rosterCount}/${club.maxRoster}` : '—'}</td>
                    <td>{club ? coins(club.spendable ?? club.balance) : '—'}</td>
                    <td>
                      <span className={`admin-pill ${u.status === 'ativo' ? 'ok' : 'danger'}`}>{statusLabel(u.status)}</span>
                    </td>
                    <td className="row-actions">
                      <button className="btn ghost" onClick={() => password(u)}>
                        Senha
                      </button>
                      <button
                        className="btn ghost"
                        disabled={busy}
                        onClick={() => run(() => draftApi.adminStatus(u.id, u.status === 'ativo' ? 'bloqueado' : 'ativo'), u.status === 'ativo' ? 'Conta bloqueada.' : 'Conta reativada.')}
                      >
                        {u.status === 'ativo' ? 'Bloquear' : 'Reativar'}
                      </button>
                      <button className="btn danger" onClick={() => remove(u)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

// ---------- Elencos ----------

function Rosters({ snap, run, setModal }) {
  const drawDone = !!snap.drawDone
  const ready = (snap.clubs || []).filter((c) => c.setupComplete).length
  // O sorteio só roda quando todo participante ativo já criou o clube.
  const pending = (snap.users || []).filter(
    (u) => u.role === 'participante' && u.status === 'ativo' && !(snap.clubs || []).some((c) => c.setupComplete && (c.userId === u.id || c.id === u.clubId)),
  )

  function draw() {
    setModal(
      <FormModal
        title={drawDone ? 'Sortear os elencos de novo?' : 'Sortear os elencos?'}
        intro={
          drawDone
            ? 'Todos os elencos atuais voltam para o banco e cada clube recebe 22 jogadores novos, cobrindo a formação preferida.'
            : `Os ${ready} clubes recebem 22 jogadores cada, nas faixas oficiais, cobrindo a formação preferida.`
        }
        fields={[]}
        submitLabel={drawDone ? 'Sortear de novo' : 'Sortear agora'}
        danger={drawDone}
        onClose={() => setModal(null)}
        onSubmit={() => run(() => draftApi.draw(), 'Sorteio realizado.').then(() => setModal(null))}
      />,
    )
  }

  return (
    <div className="admin-stack">
      <div className="card admin-card-head">
        <div>
          <h3>Sorteio dos elencos</h3>
          <p className="muted">
            {drawDone ? 'Sorteio oficial feito.' : 'Ainda não houve sorteio.'} {ready} clube(s) pronto(s) para sortear.
          </p>
        </div>
        <button className={drawDone ? 'btn ghost' : 'btn'} disabled={!ready || pending.length > 0} onClick={draw}>
          {drawDone ? 'Sortear de novo' : 'Sortear elencos'}
        </button>
        {pending.length ? (
          <p className="admin-blocker">
            Falta criar o clube: <b>{pending.map((u) => u.username).join(', ')}</b>. O sorteio libera quando todos tiverem clube, ou
            bloqueie essas contas em Participantes.
          </p>
        ) : null}
      </div>
      <AdminTeams snap={snap} />
    </div>
  )
}

// ---------- Mercado ----------

function Market({ snap, run, busy }) {
  const drawDone = !!snap.drawDone
  const market = snap.marketStatus || 'fechado'
  return (
    <div className="admin-stack">
      <div className="card market-desk">
        <div>
          <h3>Mercado da Bola</h3>
          <p>
            Situação atual: <span className={`badge ${market}`}>{statusLabel(market)}</span>
          </p>
          <p className="muted">
            {drawDone
              ? 'Aberto, os participantes compram, vendem, fazem leilões e propostas. Pausado ou fechado, tudo fica travado.'
              : 'O mercado só abre depois do sorteio dos elencos.'}
          </p>
        </div>
        <div className="actions">
          <button className="btn" disabled={busy || !drawDone || market === 'aberto'} onClick={() => run(() => draftApi.marketStatus('aberto'), 'Mercado aberto.')}>
            Abrir
          </button>
          <button className="btn ghost" disabled={busy || !drawDone || market === 'pausado'} onClick={() => run(() => draftApi.marketStatus('pausado'), 'Mercado pausado.')}>
            Pausar
          </button>
          <button className="btn danger" disabled={busy || market === 'fechado'} onClick={() => run(() => draftApi.marketStatus('fechado'), 'Mercado fechado.')}>
            Fechar
          </button>
        </div>
      </div>
      <details className="card admin-prices">
        <summary>Tabela oficial de preços</summary>
        <div className="table-wrap">
          <table className="draft-table">
            <thead>
              <tr>
                <th>Nota</th>
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
      </details>
    </div>
  )
}

// ---------- Auditoria ----------

function Audit({ snap }) {
  return (
    <div className="card">
      <h3>Auditoria</h3>
      <div className="table-wrap">
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
              .slice(0, 60)
              .map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.at).toLocaleString('pt-BR')}</td>
                  <td>{a.username}</td>
                  <td>{ACTION_LABEL[a.action] || statusLabel(a.action)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminPanel({ snap, err, ok, busy, run, onLogout }) {
  const [tab, setTab] = useState('inicio')
  const [modal, setModal] = useState(null)
  const names = useNames(snap)
  const market = snap.marketStatus || 'fechado'
  const activeCups = (snap.championships || []).filter((c) => c.status === 'ativo').length

  return (
    <section className="draft-xv admin">
      <div className="draft-hero">
        <div>
          <h2>Painel do Draft XV</h2>
          <p>
            Mercado {statusLabel(market).toLowerCase()} · {(snap.clubs || []).length} clubes · {activeCups} campeonato(s) ativo(s)
          </p>
        </div>
        <button className="link-btn draft-logout" onClick={onLogout}>
          Sair
        </button>
      </div>
      {err ? <div className="alert">{err}</div> : null}
      {ok ? <div className="okbox">{ok}</div> : null}
      <div className="draft-subnav">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'inicio' && <Overview snap={snap} go={setTab} />}
      {tab === 'campeonatos' && <Championships snap={snap} run={run} setModal={setModal} names={names} />}
      {tab === 'participantes' && <Participants snap={snap} run={run} setModal={setModal} busy={busy} />}
      {tab === 'elencos' && <Rosters snap={snap} run={run} setModal={setModal} />}
      {tab === 'mercado' && <Market snap={snap} run={run} busy={busy} />}
      {tab === 'auditoria' && <Audit snap={snap} />}
      {modal}
    </section>
  )
}
