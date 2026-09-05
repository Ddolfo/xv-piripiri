import { useMemo, useState } from 'react'
import { summarizeRivals } from '../lib/rivals'

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR')
}

function PatoIcon() {
  return (
    <svg className="pato-icon" viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="30" cy="38" rx="18" ry="14" fill="#ffd200" />
      <circle cx="42" cy="24" r="10" fill="#ffd200" />
      <circle cx="46" cy="21" r="2.2" fill="#111" />
      <path d="M50 24c6 1 9 4 8 7-2 2-7 1-10-1" fill="#e4572e" />
      <path d="M16 42c-6 8-4 14 6 14h16c8 0 12-4 12-9" fill="#e6b800" />
      <path d="M24 50c2 6-2 10-8 9" fill="#e4572e" />
    </svg>
  )
}

const SORTS = [
  { key: 'games', label: 'Mais jogos' },
  { key: 'wins', label: 'Mais vitórias' },
  { key: 'losses', label: 'Mais derrotas' },
  { key: 'winPct', label: 'Melhor aproveitamento' },
  { key: 'gd', label: 'Saldo de gols' },
  { key: 'name', label: 'Nome A–Z' },
]

export default function Rivais({ store }) {
  const [sortKey, setSortKey] = useState('games')
  const [sortDir, setSortDir] = useState('desc')
  const summary = useMemo(() => summarizeRivals(store.history || []), [store.history])

  const ranked = useMemo(() => {
    const list = [...summary.list]
    return list.sort((a, b) => {
      if (sortKey === 'name') {
        const cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
        return sortDir === 'asc' ? cmp : -cmp
      }
      const av = Number(a[sortKey]) || 0
      const bv = Number(b[sortKey]) || 0
      if (av !== bv) return sortDir === 'asc' ? av - bv : bv - av
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [summary.list, sortKey, sortDir])

  function applySort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'name' ? 'asc' : 'desc')
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Rivais do XV</h2>
          <p>
            Histórico acumulado de confrontos. A EA só manda os 10 jogos mais recentes; o painel
            guarda cada partida nova e soma com o arquivo do site.
          </p>
        </div>
      </div>

      <div className="rival-kpis">
        <article className="rival-card pato">
          <span className="rival-card-kicker">
            <PatoIcon /> O Pato
          </span>
          <b>{summary.pato?.name || '—'}</b>
          <p>
            {summary.pato
              ? `O time que mais perde para o XV · ${fmt(summary.pato.wins)} vitória${summary.pato.wins === 1 ? '' : 's'} nossa${summary.pato.wins === 1 ? '' : 's'} em ${fmt(summary.pato.games)} jogo${summary.pato.games === 1 ? '' : 's'}`
              : 'Ainda não tem vítima frequente.'}
          </p>
        </article>
        <article className="rival-card algoz">
          <span className="rival-card-kicker">O algoz</span>
          <b>{summary.algoz?.name || '—'}</b>
          <p>
            {summary.algoz
              ? `O time que mais vence o XV · ${fmt(summary.algoz.losses)} derrota${summary.algoz.losses === 1 ? '' : 's'} em ${fmt(summary.algoz.games)} jogo${summary.algoz.games === 1 ? '' : 's'}`
              : 'Ainda não tem algoz no histórico.'}
          </p>
        </article>
        <article className="rival-card">
          <span className="rival-card-kicker">Mais enfrentado</span>
          <b>{summary.maisJogado?.name || '—'}</b>
          <p>
            {summary.maisJogado
              ? `${fmt(summary.maisJogado.games)} jogos · ${fmt(summary.maisJogado.wins)}V ${fmt(summary.maisJogado.draws)}E ${fmt(summary.maisJogado.losses)}D`
              : 'Sem confrontos acumulados.'}
          </p>
        </article>
        <article className="rival-card">
          <span className="rival-card-kicker">Mais disputado</span>
          <b>{summary.disputado?.name || '—'}</b>
          <p>
            {summary.disputado
              ? `Confronto mais equilibrado · ${fmt(summary.disputado.wins)}V ${fmt(summary.disputado.draws)}E ${fmt(summary.disputado.losses)}D`
              : 'Precisa de pelo menos dois jogos com o mesmo rival.'}
          </p>
        </article>
      </div>

      <section className="card">
        <h3>Todos os adversários</h3>
        <p className="card-lead">
          {fmt(summary.total)} partida{summary.total === 1 ? '' : 's'} no arquivo · {fmt(summary.list.length)} time
          {summary.list.length === 1 ? '' : 's'}. Cada sincronização com a EA acrescenta jogos novos, sem apagar os
          antigos.
        </p>
        <div className="stats-filters">
          <span className="stats-filters-label">Ordenar</span>
          {SORTS.map((opt) => (
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
        {ranked.length ? (
          <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Adversário</th>
                  <th>Jogos</th>
                  <th>V</th>
                  <th>E</th>
                  <th>D</th>
                  <th>Gols</th>
                  <th>Saldo</th>
                  <th>Aproveitamento</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <b>{r.name}</b>
                      {summary.pato && r.key === summary.pato.key ? (
                        <span className="pato-tag">
                          <PatoIcon /> Pato
                        </span>
                      ) : null}
                      {summary.algoz && r.key === summary.algoz.key && r.key !== summary.pato?.key ? (
                        <span className="algoz-tag">Algoz</span>
                      ) : null}
                    </td>
                    <td>{fmt(r.games)}</td>
                    <td>{fmt(r.wins)}</td>
                    <td>{fmt(r.draws)}</td>
                    <td>{fmt(r.losses)}</td>
                    <td>
                      {fmt(r.gf)}–{fmt(r.ga)}
                    </td>
                    <td>{r.gd > 0 ? `+${fmt(r.gd)}` : fmt(r.gd)}</td>
                    <td>{fmt(r.winPct)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="notice">
            Ainda não há histórico. Sincronize o clube na aba Estatísticas para começar a gravar os
            confrontos.
          </div>
        )}
      </section>
    </>
  )
}
