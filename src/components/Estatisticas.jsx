import { useMemo, useState } from 'react'
import {
  getMembersCareer,
  getMembersStats,
  normalizeMembers,
  pickClubId,
  pickClubName,
  searchClubs,
} from '../lib/eaApi'

const SQUAD_SORTS = [
  { key: 'goals', label: 'Mais gols' },
  { key: 'games', label: 'Mais jogos' },
  { key: 'assists', label: 'Mais assistências' },
  { key: 'rating', label: 'Melhor nota' },
  { key: 'motm', label: 'Mais MOTM' },
  { key: 'name', label: 'Nome A–Z' },
]

function statNumber(player, key) {
  const v = player.stats?.[key]
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function sortSquad(players, sortKey, sortDir) {
  return [...players].sort((a, b) => {
    if (sortKey === 'name') {
      const cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    }
    const av = statNumber(a, sortKey)
    const bv = statNumber(b, sortKey)
    if (av == null && bv == null) return a.name.localeCompare(b.name, 'pt-BR')
    if (av == null) return 1
    if (bv == null) return -1
    if (av !== bv) return sortDir === 'asc' ? av - bv : bv - av
    return a.name.localeCompare(b.name, 'pt-BR')
  })
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

  async function importar(clubId, clubName) {
    setLoading(true)
    setError('')
    setStatus(`Importando elenco do clube ${clubId}…`)
    try {
      let payload = await getMembersStats(clubId, platform)
      let members = normalizeMembers(payload)
      if (!members.length) {
        payload = await getMembersCareer(clubId, platform)
        members = normalizeMembers(payload)
      }
      store.setClub({
        name: clubName || query,
        clubId: String(clubId),
        platform,
      })
      store.upsertFromEa(members)
      setStatus(
        members.length
          ? `${members.length} jogadores sincronizados da EA.`
          : 'Clube encontrado, mas a lista de membros veio vazia. Cadastre o elenco manualmente.',
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function syncSaved() {
    if (!store.club.clubId) return
    await importar(store.club.clubId, store.club.name)
  }

  const withStats = store.players.filter((p) => p.stats)

  const rankedPlayers = useMemo(
    () => sortSquad(store.players, sortKey, sortDir),
    [store.players, sortKey, sortDir],
  )

  function applySort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'name' ? 'asc' : 'desc')
  }

  const sortHint =
    sortKey === 'name'
      ? sortDir === 'asc'
        ? 'A–Z'
        : 'Z–A'
      : sortDir === 'desc'
        ? 'maior → menor'
        : 'menor → maior'

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Estatísticas EA FC 26</h2>
          <p>
            A API oficial de Community (FUTBIN/FUT.GG) é restrita. Este painel usa a API pública de
            Pro Clubs da EA (`proclubs.ea.com`) via proxy local.
          </p>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <span>Elenco</span>
          <b>{store.players.length}</b>
        </div>
        <div className="kpi">
          <span>Com stats EA</span>
          <b>{withStats.length}</b>
        </div>
        <div className="kpi">
          <span>Gols (soma)</span>
          <b>{withStats.reduce((a, p) => a + (p.stats?.goals || 0), 0)}</b>
        </div>
        <div className="kpi">
          <span>Último sync</span>
          <b style={{ fontSize: 13 }}>
            {store.club.lastSync
              ? new Date(store.club.lastSync).toLocaleString('pt-BR')
              : '—'}
          </b>
        </div>
      </div>

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
                <option value="ps4">PS4</option>
                <option value="xboxone">Xbox One</option>
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
              return (
                <article className="player-card" key={`${id}-${i}`}>
                  <div>
                    <b>{name}</b>
                    <small>ID {id || 'desconhecido'}</small>
                  </div>
                  <button
                    className="btn"
                    disabled={!id || loading}
                    onClick={() => importar(id, name)}
                  >
                    Importar
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        <section className="card">
          <h3>Números do elenco</h3>
          <div className="stats-filters">
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
          <p className="stats-sort-hint">
            {rankedPlayers.length
              ? `Lista: ${SQUAD_SORTS.find((s) => s.key === sortKey)?.label} (${sortHint}). Clique de novo para inverter.`
              : 'Sem jogadores para ordenar.'}
          </p>
          <table className="stats-table">
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    className={`th-sort${sortKey === 'name' ? ' active' : ''}`}
                    onClick={() => applySort('name')}
                  >
                    Jogador
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`th-sort num${sortKey === 'games' ? ' active' : ''}`}
                    onClick={() => applySort('games')}
                  >
                    J
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`th-sort num${sortKey === 'goals' ? ' active' : ''}`}
                    onClick={() => applySort('goals')}
                  >
                    G
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`th-sort num${sortKey === 'assists' ? ' active' : ''}`}
                    onClick={() => applySort('assists')}
                  >
                    A
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`th-sort num${sortKey === 'rating' ? ' active' : ''}`}
                    onClick={() => applySort('rating')}
                  >
                    Nota
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`th-sort num${sortKey === 'motm' ? ' active' : ''}`}
                    onClick={() => applySort('motm')}
                  >
                    MOTM
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.map((p, i) => (
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
                  <td className={sortKey === 'games' ? 'sorted-cell' : ''}>
                    {p.stats?.games ?? '—'}
                  </td>
                  <td className={sortKey === 'goals' ? 'sorted-cell' : ''}>
                    {p.stats?.goals ?? '—'}
                  </td>
                  <td className={sortKey === 'assists' ? 'sorted-cell' : ''}>
                    {p.stats?.assists ?? '—'}
                  </td>
                  <td className={sortKey === 'rating' ? 'sorted-cell' : ''}>
                    {p.stats?.rating ? Number(p.stats.rating).toFixed(2) : '—'}
                  </td>
                  <td className={sortKey === 'motm' ? 'sorted-cell' : ''}>
                    {p.stats?.motm ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {store.players.length === 0 && (
            <div className="notice" style={{ marginTop: 10 }}>
              Sem jogadores. Importe da EA ou cadastre na aba Elenco.
            </div>
          )}
        </section>
      </div>
    </>
  )
}
