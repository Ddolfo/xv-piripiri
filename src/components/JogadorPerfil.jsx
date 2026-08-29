import { useEffect, useState } from 'react'
import {
  loadPlayerDossier,
  MATCH_TYPE_LABEL,
  NATIONS,
  POS_LINE_LABEL,
  PRO_POS_LABEL,
} from '../lib/eaApi'
import PlayerMark from './PlayerMark'

function fmt(n, digits) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? (Number.isInteger(v) ? 0 : 2),
  })
}

function perGame(total, games) {
  const t = Number(total)
  const g = Number(games)
  if (!g || !Number.isFinite(t)) return null
  return (t / g).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function timeAgoLabel(ago) {
  if (!ago) return ''
  const n = ago.number
  const unit = {
    seconds: 'segundos',
    minutes: 'minutos',
    hours: 'horas',
    days: 'dias',
    weeks: 'semanas',
    months: 'meses',
    years: 'anos',
  }[ago.unit] || ago.unit
  return `há ${n} ${unit}`
}

function resultLabel(code) {
  if (code === 'V') return 'Vitória'
  if (code === 'E') return 'Empate'
  if (code === 'D') return 'Derrota'
  return 'Sem resultado'
}

function passSplit(stats) {
  const total = Number(stats?.passes)
  const pct = Number(stats?.passSuccess)
  if (!Number.isFinite(total) || total <= 0) {
    return { total: null, ok: null, bad: null, pct: Number.isFinite(pct) ? pct : null }
  }
  const ok = Number.isFinite(pct) ? Math.round((total * pct) / 100) : null
  const bad = ok != null ? Math.max(0, total - ok) : null
  return { total, ok, bad, pct: Number.isFinite(pct) ? pct : null }
}

function Stat({ label, value, hint }) {
  return (
    <div className="stat-box">
      <span className="stat-box-label">{label}</span>
      <b className="stat-box-value">{value}</b>
      {hint ? <small className="stat-box-hint">{hint}</small> : null}
    </div>
  )
}

function Group({ title, children }) {
  return (
    <section className="stat-group">
      <h4>{title}</h4>
      <div className="stat-group-grid">{children}</div>
    </section>
  )
}

function MatchFact({ label, value }) {
  return (
    <span>
      {label} <b>{value}</b>
    </span>
  )
}

export default function JogadorPerfil({ player, store, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dossier, setDossier] = useState(null)
  const [clubId, setClubId] = useState('')
  const [tab, setTab] = useState('numeros')

  useEffect(() => {
    let live = true
    async function run() {
      setLoading(true)
      setError('')
      try {
        const data = await loadPlayerDossier(
          player.name,
          store.club.clubId,
          store.club.name,
          store.club.platform,
        )
        if (!live) return
        setDossier(data)
        const atual = data.clubs.find((c) => c.current) || data.clubs[0]
        setClubId(atual?.id || '')
      } catch (e) {
        if (live) setError(e.message || 'Não deu para carregar o jogador.')
      } finally {
        if (live) setLoading(false)
      }
    }
    run()
    return () => {
      live = false
    }
  }, [player, store.club.clubId, store.club.name, store.club.platform])

  const selected = dossier?.clubs.find((c) => c.id === clubId) || dossier?.clubs[0]
  const stats = selected?.stats || player.stats || {}
  const full = !selected?.estimated
  const games = Number(stats.games) || 0
  const line =
    POS_LINE_LABEL[stats.favoritePosition || player.stats?.favoritePosition] || 'Não informado'
  const height = player.stats?.proHeight || dossier?.raw?.proHeight
  const nation = NATIONS[String(dossier?.raw?.proNationality || player.stats?.proNationality || '')]
  const overall = player.stats?.proOverall
  const proPos = PRO_POS_LABEL[player.stats?.proPos || dossier?.raw?.proPos]
  const golsJogo = perGame(stats.goals, games)
  const assistJogo = perGame(stats.assists, games)
  const passes = passSplit(full ? stats : null)
  const recent = dossier?.recent
  const canSeeMatches = clubId === 'geral' || selected?.current

  return (
    <div className="player-stage">
      <aside className="player-nav">
        <button type="button" className="player-back" onClick={onClose}>
          ← Voltar à lista
        </button>
        <p className="player-nav-kicker">Jogador</p>
        <div className="player-nav-mark">
          <PlayerMark
            name={player.name}
            nationId={player.stats?.proNationality || dossier?.raw?.proNationality}
            colors={store.ea?.info?.kit?.home}
            size={64}
          />
        </div>
        <h3>{player.name}</h3>
        <small className="player-nav-psn">PSN / ID: {player.psn}</small>
        <p className="player-id-line">{line}{proPos ? ` · ${proPos}` : ''}</p>

        <p className="player-nav-kicker" style={{ marginTop: 18 }}>
          Escolha a visão
        </p>
        <nav>
          {(dossier?.clubs || []).map((c) => (
            <button
              key={c.id}
              type="button"
              className={c.id === selected?.id ? 'active' : ''}
              onClick={() => {
                setClubId(c.id)
                setTab('numeros')
              }}
            >
              <b>{c.label}</b>
              <small>{c.hint}</small>
              {c.stats?.games != null ? <em>{c.stats.games} jogos</em> : null}
            </button>
          ))}
        </nav>
        {dossier?.clubs?.some((c) => c.estimated) ? (
          <p className="player-nav-note">
            A EA não informa o nome dos clubes antigos. “Passagens anteriores” é o total de carreira
            menos os números neste clube.
          </p>
        ) : null}
      </aside>

      <div className="player-main">
        <header className="player-hero">
          <div>
            <p className="player-nav-kicker">Você está vendo</p>
            <h2>{selected?.label || player.name}</h2>
            <p>
              {selected?.id === 'geral'
                ? 'Soma de todos os clubes que este jogador já defendeu.'
                : selected?.estimated
                  ? 'Números fora do clube atual, sem o nome dos times na API.'
                  : `Números só com ${selected?.label}.`}
            </p>
          </div>
          <div className="player-tabs">
            <button
              type="button"
              className={tab === 'numeros' ? 'active' : ''}
              onClick={() => setTab('numeros')}
            >
              Números
            </button>
            <button
              type="button"
              className={tab === 'jogos' ? 'active' : ''}
              onClick={() => setTab('jogos')}
            >
              Últimos jogos
            </button>
          </div>
        </header>

        {loading ? <div className="notice">Buscando o histórico deste jogador na EA…</div> : null}
        {error ? <div className="notice error">{error}</div> : null}

        <div className="player-frame">
          <div className="player-id-card">
            <div>
              <span>Nome no clube</span>
              <b>{player.name}</b>
            </div>
            <div>
              <span>Linha</span>
              <b>{line}</b>
            </div>
            <div>
              <span>Posição do Pro</span>
              <b>{proPos || '—'}</b>
            </div>
            <div>
              <span>Nota do Pro</span>
              <b>{overall ? overall : '—'}</b>
              <small>De 1 a 99 no FC 26</small>
            </div>
            <div>
              <span>Altura</span>
              <b>{height ? `${height} cm` : '—'}</b>
            </div>
            <div>
              <span>Nacionalidade</span>
              <b>{nation || '—'}</b>
            </div>
          </div>

          <div className="stat-hero stat-hero-4">
            <div className="stat-hero-item gold">
              <span>Gols</span>
              <b>{fmt(stats.goals)}</b>
              <small>{golsJogo ? `${golsJogo} por jogo` : 'Média indisponível'}</small>
            </div>
            <div className="stat-hero-item">
              <span>Assistências</span>
              <b>{fmt(stats.assists)}</b>
              <small>{assistJogo ? `${assistJogo} por jogo` : 'Média indisponível'}</small>
            </div>
            <div className="stat-hero-item">
              <span>Participações em gol</span>
              <b>{fmt((stats.goals || 0) + (stats.assists || 0))}</b>
              <small>Gols + assistências</small>
            </div>
            <div className="stat-hero-item">
              <span>Nota média</span>
              <b>{stats.rating ? fmt(stats.rating, 2) : '—'}</b>
              <small>{fmt(stats.games)} jogos nesta visão</small>
            </div>
          </div>

          {tab === 'numeros' && (
            <>
              <Group title="Ataque">
                <Stat label="Gols marcados" value={fmt(stats.goals)} hint="Bolas na rede neste recorte" />
                <Stat label="Assistências" value={fmt(stats.assists)} hint="Passes que viraram gol" />
                <Stat
                  label="Participações em gol"
                  value={fmt((stats.goals || 0) + (stats.assists || 0))}
                  hint="Gols + assistências"
                />
                <Stat label="Gols por jogo" value={golsJogo || '—'} hint="Média a cada partida" />
                <Stat label="Assistências por jogo" value={assistJogo || '—'} hint="Média a cada partida" />
                <Stat
                  label="Chutes que viram gol"
                  value={full && stats.shotSuccess != null ? `${stats.shotSuccess}%` : '—'}
                  hint="Porcentagem de finalizações convertidas"
                />
              </Group>

              <Group title="Rendimento">
                <Stat label="Jogos" value={fmt(stats.games)} hint="Partidas contabilizadas pela EA" />
                <Stat
                  label="Percentual de vitórias"
                  value={full && stats.winRate != null ? `${stats.winRate}%` : '—'}
                  hint="Jogos que o time ganhou com ele em campo"
                />
                <Stat
                  label="Nota média da partida"
                  value={stats.rating ? fmt(stats.rating, 2) : '—'}
                  hint="Média de 0 a 10 dada pelo jogo"
                />
                <Stat
                  label="Vezes melhor em campo"
                  value={fmt(stats.motm)}
                  hint="Partidas em que foi o destaque (MOTM)"
                />
              </Group>

              <Group title="Passe e desarme">
                <Stat
                  label="Passes totais"
                  value={fmt(passes.total ?? stats.passes)}
                  hint="Tentativas contabilizadas nesta visão"
                />
                <Stat
                  label="Passes certos"
                  value={fmt(passes.ok)}
                  hint={passes.pct != null ? `${passes.pct}% de acerto` : 'Estimado pela % da EA'}
                />
                <Stat
                  label="Passes errados"
                  value={fmt(passes.bad)}
                  hint="Total menos os certos"
                />
                <Stat
                  label="% de passes certos"
                  value={full && stats.passSuccess != null ? `${stats.passSuccess}%` : '—'}
                  hint="Porcentagem de passes completados"
                />
                <Stat label="Desarmes" value={fmt(stats.tackles)} hint="Bolas recuperadas no chão" />
                <Stat
                  label="Acerto no desarme"
                  value={full && stats.tackleSuccess != null ? `${stats.tackleSuccess}%` : '—'}
                  hint="Porcentagem de desarmes bem-sucedidos"
                />
              </Group>

              <Group title="Defesa e disciplina">
                <Stat
                  label="Jogos sem sofrer gol (linha)"
                  value={fmt(stats.cleanSheetsDef)}
                  hint="Como zagueiro ou lateral, o time não levou gol"
                />
                <Stat
                  label="Jogos sem sofrer gol (goleiro)"
                  value={fmt(stats.cleanSheetsGK)}
                  hint="Como goleiro, não sofreu gol"
                />
                <Stat
                  label="Cartões vermelhos"
                  value={fmt(stats.redCards)}
                  hint="Expulsões nesta visão"
                />
              </Group>

              {recent?.games && canSeeMatches ? (
                <Group title="Soma das súmulas recentes da EA">
                  <Stat
                    label="Jogos nesta lista"
                    value={fmt(recent.games)}
                    hint="Últimas partidas publicadas deste clube"
                  />
                  <Stat label="Gols" value={fmt(recent.goals)} hint="O que ele marcou nessas partidas" />
                  <Stat label="Assistências" value={fmt(recent.assists)} hint="Passes para gol nessas partidas" />
                  <Stat
                    label="Participações em gol"
                    value={fmt(recent.involvement)}
                    hint="Gols + assistências nessas partidas"
                  />
                  <Stat
                    label="Nota média"
                    value={recent.rating ? fmt(recent.rating, 2) : '—'}
                    hint="Média 0 a 10 nas súmulas"
                  />
                  <Stat label="Melhor em campo" value={fmt(recent.motm)} hint="MOTM nessas partidas" />
                  <Stat label="Minutos em campo" value={fmt(recent.minutes)} hint="Tempo jogado nessas partidas" />
                  <Stat label="Finalizações" value={fmt(recent.shots)} hint="Chutes nessas partidas" />
                  <Stat
                    label="Passes certos / tentados"
                    value={
                      recent.passAttempts
                        ? `${fmt(recent.passes)}/${fmt(recent.passAttempts)}`
                        : '—'
                    }
                    hint={recent.passPct != null ? `${recent.passPct}% de acerto` : ''}
                  />
                  <Stat label="Desarmes" value={fmt(recent.tackles)} hint="Desarmes nessas partidas" />
                  <Stat
                    label="Faltas cometidas"
                    value={fmt(recent.fouls)}
                    hint="Infrações nessas partidas"
                  />
                  <Stat
                    label="Faltas sofridas"
                    value={fmt(recent.foulsWon)}
                    hint="Vezes em que foi derrubado"
                  />
                </Group>
              ) : null}

              {canSeeMatches && dossier?.matches?.length ? (
                <section className="goal-form">
                  <h4>Gols, assistências e nota nas partidas recentes</h4>
                  <p>
                    Cada cartão é uma súmula deste clube. Os números são só de <b>{player.name}</b>{' '}
                    naquela partida — não o placar do time.
                  </p>
                  <div className="goal-form-row form-chip-row">
                    {dossier.matches.slice(0, 10).map((m) => (
                      <article
                        key={m.id}
                        className={`form-chip${m.involvement > 0 ? ' hot' : ''}${m.motm ? ' star' : ''}`}
                      >
                        <span>Contra {m.opponent}</span>
                        <div className="form-chip-nums">
                          <div>
                            <em>Gols</em>
                            <b>{m.goals}</b>
                          </div>
                          <div>
                            <em>Assist.</em>
                            <b>{m.assists}</b>
                          </div>
                          <div>
                            <em>Nota</em>
                            <b>{m.rating ? fmt(m.rating, 1) : '—'}</b>
                          </div>
                        </div>
                        <small>
                          {MATCH_TYPE_LABEL[m.type] || m.type}
                          {m.motm ? ' · MOTM' : ''}
                          {m.timeAgo ? ` · ${timeAgoLabel(m.timeAgo)}` : ''}
                        </small>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {selected?.estimated ? (
                <p className="stats-sort-hint">
                  Nesta visão a EA só deixa estimar jogos, gols, assistências, melhores em campo e
                  nota. O restante aparece em branco porque não vem separado por time antigo.
                </p>
              ) : null}
            </>
          )}

          {tab === 'jogos' && (
            <>
              {canSeeMatches ? (
                dossier?.matches?.length ? (
                  <div className="match-list">
                    {dossier.matches.map((m) => (
                      <article key={m.id} className="match-card">
                        <div className="match-card-top">
                          <span className={`match-res ${(m.result || '').toLowerCase()}`}>
                            {m.result || '—'}
                          </span>
                          <div>
                            <b>
                              {store.club.name || 'XV'} {m.usGoals} × {m.themGoals} {m.opponent}
                            </b>
                            <small>
                              {resultLabel(m.result)} · {MATCH_TYPE_LABEL[m.type] || m.type}
                              {m.timeAgo ? ` · ${timeAgoLabel(m.timeAgo)}` : ''}
                              {m.position ? ` · ${POS_LINE_LABEL[m.position] || m.position}` : ''}
                              {m.minutes ? ` · ${m.minutes} min` : ''}
                              {m.winnerByDnf ? ' · W.O.' : ''}
                            </small>
                          </div>
                        </div>

                        <div className="match-card-block">
                          <h5>Ataque</h5>
                          <div className="match-card-stats">
                            <MatchFact label="Gols" value={fmt(m.goals)} />
                            <MatchFact label="Assistências" value={fmt(m.assists)} />
                            <MatchFact label="Participações em gol" value={fmt(m.involvement)} />
                            <MatchFact label="Finalizações" value={fmt(m.shots)} />
                          </div>
                        </div>

                        <div className="match-card-block">
                          <h5>Passe e desarme</h5>
                          <div className="match-card-stats">
                            <MatchFact
                              label="Passes certos / tentados"
                              value={
                                m.passAttempts
                                  ? `${fmt(m.passes)}/${fmt(m.passAttempts)}`
                                  : fmt(m.passes)
                              }
                            />
                            <MatchFact
                              label="% de passes certos"
                              value={m.passPct != null ? `${m.passPct}%` : '—'}
                            />
                            <MatchFact
                              label="Desarmes certos / tentados"
                              value={
                                m.tackleAttempts
                                  ? `${fmt(m.tackles)}/${fmt(m.tackleAttempts)}`
                                  : fmt(m.tackles)
                              }
                            />
                            <MatchFact
                              label="% de desarmes"
                              value={m.tacklePct != null ? `${m.tacklePct}%` : '—'}
                            />
                          </div>
                        </div>

                        <div className="match-card-block">
                          <h5>Disciplina e partida</h5>
                          <div className="match-card-stats">
                            <MatchFact label="Faltas cometidas" value={fmt(m.fouls)} />
                            <MatchFact label="Faltas sofridas" value={fmt(m.foulsWon)} />
                            <MatchFact label="Cartões vermelhos" value={fmt(m.redCards)} />
                            <MatchFact
                              label="Nota da partida"
                              value={m.rating ? fmt(m.rating, 2) : '—'}
                            />
                            <MatchFact label="Melhor em campo" value={m.motm ? 'Sim' : 'Não'} />
                            <MatchFact label="Minutos em campo" value={fmt(m.minutes)} />
                            {m.cleanSheet ? (
                              <MatchFact label="Jogo sem sofrer gol" value="Sim" />
                            ) : null}
                            {m.isKeeper ? (
                              <MatchFact label="Defesas" value={fmt(m.saves)} />
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="notice">A EA não devolveu jogos recentes com este jogador.</div>
                )
              ) : (
                <div className="notice">
                  A API só publica a súmula dos jogos do clube atual. Não dá para ver partidas dos
                  times antigos.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
