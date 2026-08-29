import { useMemo, useState } from 'react'
import {
  loadClubBundle,
  MATCH_TYPE_LABEL,
  POS_LINE_LABEL,
  pickClubId,
  pickClubName,
  pickCurrentDivision,
  searchClubs,
} from '../lib/eaApi'

const SQUAD_SORTS = [
  { key: 'goals', label: 'Mais gols' },
  { key: 'games', label: 'Mais jogos' },
  { key: 'assists', label: 'Mais assistências' },
  { key: 'rating', label: 'Melhor nota' },
  { key: 'motm', label: 'Mais MOTM' },
  { key: 'winRate', label: 'Melhor aproveitamento' },
  { key: 'proOverall', label: 'Maior overall' },
  { key: 'name', label: 'Nome A–Z' },
]

function statNumber(player, key, view) {
  const pack = view === 'career' ? player.stats?.career : player.stats
  const v = pack?.[key] ?? player.stats?.[key]
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function sortSquad(players, sortKey, sortDir, view) {
  return [...players].sort((a, b) => {
    if (sortKey === 'name') {
      const cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    }
    const av = statNumber(a, sortKey, view)
    const bv = statNumber(b, sortKey, view)
    if (av == null && bv == null) return a.name.localeCompare(b.name, 'pt-BR')
    if (av == null) return 1
    if (bv == null) return -1
    if (av !== bv) return sortDir === 'asc' ? av - bv : bv - av
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

function fmt(n, digits) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  return digits != null ? v.toFixed(digits) : String(v)
}

function timeAgoLabel(ago) {
  if (!ago) return ''
  const n = ago.number
  const unit = {
    seconds: 's',
    minutes: 'min',
    hours: 'h',
    days: 'd',
    weeks: 'sem',
    months: 'mês',
    years: 'a',
  }[ago.unit] || ago.unit
  return `${n}${unit}`
}

export default function Estatisticas({ store }) {
  const [query, setQuery] = useState(store.club.name || 'XV de PiriPiri')
  const [platform, setPlatform] = useState(store.club.platform || 'common-gen5')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState('goals')
  const [sortDir, setSortDir] = useState('desc')
  const [view, setView] = useState('club')

  const ea = store.ea || {}
  const overall = ea.overall
  const withStats = store.players.filter((p) => p.stats)

  const rankedPlayers = useMemo(
    () => sortSquad(store.players, sortKey, sortDir, view),
    [store.players, sortKey, sortDir, view],
  )

  function applySort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'name' ? 'asc' : 'desc')
  }

  async function buscar() {
    setLoading(true)
    setError('')
    setStatus('Consultando API pública de Pro Clubs da EA…')
    try {
      const list = await searchClubs(query, platform)
      setResults(list)
      setStatus(`${list.length} clube(s) encontrado(s).`)
      if (!list.length) {
        setError(
          'Nenhum clube retornou. Confira o nome exato no FC 26 e a plataforma (current-gen = PS5/Xbox Series/PC).',
        )
      }
    } catch (e) {
      setError(
        `${e.message}. A EA às vezes bloqueia o proxy. Tente de novo na sua rede ou informe o Club ID manualmente.`,
      )
    } finally {
      setLoading(false)
    }
  }

  async function importar(clubId, clubName, extra = {}) {
    setLoading(true)
    setError('')
    setStatus(`Importando dados do clube ${clubId}…`)
    try {
      const bundle = await loadClubBundle(clubId, platform)
      store.setClub({
        name: clubName || extra.name || query,
        clubId: String(clubId),
        platform,
        currentDivision: extra.currentDivision ?? null,
      })
      store.upsertFromEa(bundle.members, {
        club: { currentDivision: extra.currentDivision ?? store.club.currentDivision },
        ea: {
          overall: bundle.overall,
          info: bundle.info,
          playoffs: bundle.playoffs,
          matches: bundle.matches,
          positionCount: bundle.positionCount,
        },
      })
      const bits = []
      if (bundle.members.length) bits.push(`${bundle.members.length} jogadores`)
      if (bundle.matches.length) bits.push(`${bundle.matches.length} jogos`)
      if (bundle.playoffs.length) bits.push(`${bundle.playoffs.length} temporadas de playoff`)
      setStatus(
        bits.length
          ? `Sincronizado: ${bits.join(', ')}.`
          : 'Clube encontrado, mas a EA não devolveu números. Cadastre o elenco manualmente.',
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function syncSaved() {
    if (!store.club.clubId) return
    await importar(store.club.clubId, store.club.name, {
      currentDivision: store.club.currentDivision,
    })
  }

  const pack = (p) => (view === 'career' && p.stats?.career ? p.stats.career : p.stats)

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Estatísticas EA FC 26</h2>
          <p>
            Painel puxa a API pública de Pro Clubs: clube, elenco, carreira, jogos da liga e
            histórico de playoff.
          </p>
        </div>
      </div>

      <div className="kpi-row kpi-row-6">
        <div className="kpi">
          <span>Skill rating</span>
          <b>{overall ? fmt(overall.skillRating) : '—'}</b>
        </div>
        <div className="kpi">
          <span>V — E — D</span>
          <b style={{ fontSize: 18 }}>
            {overall ? `${overall.wins}-${overall.ties}-${overall.losses}` : '—'}
          </b>
        </div>
        <div className="kpi">
          <span>Divisão atual</span>
          <b>{store.club.currentDivision || '—'}</b>
        </div>
        <div className="kpi">
          <span>Melhor divisão</span>
          <b>{overall ? fmt(overall.bestDivision) : '—'}</b>
        </div>
        <div className="kpi">
          <span>Gols / sofridos</span>
          <b style={{ fontSize: 18 }}>
            {overall ? `${overall.goals}/${overall.goalsAgainst}` : '—'}
          </b>
        </div>
        <div className="kpi">
          <span>Sequência</span>
          <b style={{ fontSize: 16 }}>
            {overall
              ? `${overall.winStreak} V · ${overall.unbeatenStreak} s/ derrota`
              : '—'}
          </b>
        </div>
      </div>

      {overall?.form?.length ? (
        <div className="form-strip">
          <span>Últimos resultados</span>
          <div className="form-dots">
            {overall.form.map((r, i) => (
              <i key={i} className={`form-dot ${r.toLowerCase()}`}>
                {r}
              </i>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid-2">
        <section className="card">
          <h3>Buscar clube na EA</h3>
          <div className="form-grid">
            <div className="field">
              <label>Nome do clube</label>
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="field">
              <label>Plataforma</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="common-gen5">PS5 / Xbox Series / PC</option>
                <option value="common-gen4">PS4 / Xbox One</option>
                <option value="nx">Switch</option>
              </select>
            </div>
            <div className="field">
              <label>Club ID (opcional)</label>
              <input
                value={store.club.clubId}
                onChange={(e) => store.setClub({ clubId: e.target.value })}
                placeholder="Cole o ID se já souber"
              />
            </div>
          </div>
          <div className="actions">
            <button className="btn" onClick={buscar} disabled={loading}>
              Buscar XV de PiriPiri
            </button>
            <button
              className="btn ghost"
              onClick={syncSaved}
              disabled={loading || !store.club.clubId}
            >
              Sincronizar clube salvo
            </button>
          </div>
          {status && <div className="notice ok" style={{ marginTop: 12 }}>{status}</div>}
          {error && <div className="notice error" style={{ marginTop: 12 }}>{error}</div>}

          <div className="player-list" style={{ marginTop: 14 }}>
            {results.map((r, i) => {
              const id = pickClubId(r)
              const name = pickClubName(r)
              const div = pickCurrentDivision(r)
              return (
                <article className="player-card" key={`${id}-${i}`}>
                  <div>
                    <b>{name}</b>
                    <small>
                      ID {id || 'desconhecido'}
                      {div ? ` · Divisão ${div}` : ''}
                      {r.skillRating ? ` · SR ${r.skillRating}` : ''}
                    </small>
                  </div>
                  <button
                    className="btn"
                    disabled={!id || loading}
                    onClick={() => importar(id, name, { currentDivision: div })}
                  >
                    Importar
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        <section className="card">
          <h3>Clube</h3>
          {overall ? (
            <dl className="club-facts">
              <div>
                <dt>Jogos (geral)</dt>
                <dd>{overall.games}</dd>
              </div>
              <div>
                <dt>Jogos de liga</dt>
                <dd>{overall.leagueGames}</dd>
              </div>
              <div>
                <dt>Jogos de playoff</dt>
                <dd>{overall.playoffGames}</dd>
              </div>
              <div>
                <dt>Aproveitamento</dt>
                <dd>
                  {overall.games
                    ? `${Math.round((overall.wins / overall.games) * 100)}%`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Acessos</dt>
                <dd>{overall.promotions}</dd>
              </div>
              <div>
                <dt>Quedas</dt>
                <dd>{overall.relegations}</dd>
              </div>
              <div>
                <dt>Reputação</dt>
                <dd>{overall.reputation}</dd>
              </div>
              <div>
                <dt>Estádio</dt>
                <dd>{ea.info?.stadium || '—'}</dd>
              </div>
              <div>
                <dt>Último sync</dt>
                <dd>
                  {store.club.lastSync
                    ? new Date(store.club.lastSync).toLocaleString('pt-BR')
                    : '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="notice">Importe o clube para ver o retrato da temporada.</div>
          )}
          {ea.positionCount ? (
            <div className="pos-count">
              {Object.entries(ea.positionCount).map(([k, v]) => (
                <span key={k}>
                  {POS_LINE_LABEL[k] || k}: <b>{v}</b>
                </span>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <section className="card">
          <h3>Últimos jogos</h3>
          {ea.matches?.length ? (
            <div className="match-list">
              {ea.matches.map((m) => (
                <article key={m.id} className={`match-row ${m.result.toLowerCase()}`}>
                  <span className={`match-res ${m.result.toLowerCase()}`}>{m.result || '—'}</span>
                  <div>
                    <b>
                      {m.usGoals} x {m.themGoals} {m.opponent}
                    </b>
                    <small>
                      {MATCH_TYPE_LABEL[m.type] || m.type}
                      {m.timeAgo ? ` · ${timeAgoLabel(m.timeAgo)}` : ''}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="notice">Nenhum jogo recente na API. Sincronize o clube.</div>
          )}
        </section>

        <section className="card">
          <h3>Playoffs por temporada</h3>
          {ea.playoffs?.length ? (
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Temporada</th>
                  <th>Melhor divisão</th>
                  <th>Grupo</th>
                </tr>
              </thead>
              <tbody>
                {ea.playoffs.map((p) => (
                  <tr key={p.seasonId}>
                    <td>{p.seasonName || p.seasonId}</td>
                    <td>{p.bestDivision}</td>
                    <td>{p.bestFinishGroup}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="notice">Sem histórico de playoff na EA.</div>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Números do elenco</h3>
        <div className="stats-filters">
          <span className="stats-filters-label">Visão</span>
          <button
            type="button"
            className={`filter-chip${view === 'club' ? ' active' : ''}`}
            onClick={() => setView('club')}
          >
            No clube
          </button>
          <button
            type="button"
            className={`filter-chip${view === 'career' ? ' active' : ''}`}
            onClick={() => setView('career')}
          >
            Carreira
          </button>
          <span className="stats-filters-label">Ordenar por</span>
          {SQUAD_SORTS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`filter-chip${sortKey === opt.key ? ' active' : ''}`}
              onClick={() => applySort(opt.key)}
            >
              {opt.label}
              {sortKey === opt.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
            </button>
          ))}
        </div>
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Linha</th>
                {view === 'club' ? <th>OVR</th> : null}
                <th>J</th>
                {view === 'club' ? <th>V%</th> : null}
                <th>G</th>
                <th>A</th>
                <th>Nota</th>
                <th>MOTM</th>
                {view === 'club' ? (
                  <>
                    <th>Passe%</th>
                    <th>Chute%</th>
                    <th>Des.</th>
                    <th>Verm</th>
                    <th>CS</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.map((p, i) => {
                const s = pack(p) || {}
                return (
                  <tr key={p.id} className={i === 0 && rankedPlayers.length > 1 ? 'rank-top' : ''}>
                    <td>
                      <div className="player-rank">
                        <span className="rank-index">{i + 1}</span>
                        <div>
                          {p.name}
                          <div>
                            <small>{p.psn}</small>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{POS_LINE_LABEL[p.stats?.favoritePosition] || p.stats?.favoritePosition || '—'}</td>
                    {view === 'club' ? <td>{fmt(p.stats?.proOverall)}</td> : null}
                    <td>{fmt(s.games)}</td>
                    {view === 'club' ? <td>{s.winRate != null ? `${s.winRate}%` : '—'}</td> : null}
                    <td>{fmt(s.goals)}</td>
                    <td>{fmt(s.assists)}</td>
                    <td>{s.rating ? Number(s.rating).toFixed(2) : '—'}</td>
                    <td>{fmt(s.motm)}</td>
                    {view === 'club' ? (
                      <>
                        <td>{p.stats?.passSuccess != null ? `${p.stats.passSuccess}%` : '—'}</td>
                        <td>{p.stats?.shotSuccess != null ? `${p.stats.shotSuccess}%` : '—'}</td>
                        <td>{fmt(p.stats?.tackles)}</td>
                        <td>{fmt(p.stats?.redCards)}</td>
                        <td>
                          {fmt((p.stats?.cleanSheetsDef || 0) + (p.stats?.cleanSheetsGK || 0))}
                        </td>
                      </>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {store.players.length === 0 && (
          <div className="notice" style={{ marginTop: 10 }}>
            Sem jogadores. Importe da EA ou cadastre na aba Elenco.
          </div>
        )}
        <p className="stats-sort-hint">
          {withStats.length} com números da EA. Visão {view === 'club' ? 'no clube' : 'de carreira'}.
        </p>
      </section>
    </>
  )
}
