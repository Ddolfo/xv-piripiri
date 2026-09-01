import { useMemo, useState } from 'react'
import {
  bundleToEa,
  divisionLabel,
  groupFinishLabel,
  loadClubBundle,
  MATCH_TYPE_LABEL,
  NATIONS,
  POS_LINE_LABEL,
  PRO_POS_LABEL,
  pickClubId,
  pickClubName,
  pickCurrentDivision,
  searchClubs,
} from '../lib/eaApi'
import JogadorPerfil from './JogadorPerfil'
import PartidaPerfil from './PartidaPerfil'
import PlayerMark from './PlayerMark'

const SQUAD_SORTS = [
  { key: 'goals', label: 'Mais gols' },
  { key: 'games', label: 'Mais jogos' },
  { key: 'assists', label: 'Mais assistências' },
  { key: 'rating', label: 'Melhor nota' },
  { key: 'motm', label: 'Mais MOTM' },
  { key: 'winRate', label: 'Melhor aproveitamento' },
  { key: 'proOverall', label: 'Maior overall' },
  { key: 'lastTenSum', label: 'Gols nos últimos 10' },
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
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? (Number.isInteger(v) ? 0 : 2),
  })
}

function perGame(total, games) {
  const t = Number(total)
  const g = Number(games)
  if (!g || !Number.isFinite(t)) return '—'
  return (t / g).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function record(w, e, l) {
  if (w == null && e == null && l == null) return '—'
  return `${fmt(w)}-${fmt(e)}-${fmt(l)}`
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

function Fact({ label, value, hint }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value}
        {hint ? <small className="fact-hint">{hint}</small> : null}
      </dd>
    </div>
  )
}

function Kpi({ label, value, hint }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <b>{value}</b>
      {hint ? <small className="kpi-hint">{hint}</small> : null}
    </div>
  )
}

function KitRow({ label, colors }) {
  if (!colors?.length) return null
  return (
    <div className="kit-row">
      <span>{label}</span>
      <div className="kit-dots">
        {colors.map((c, i) => (
          <i key={`${c}-${i}`} style={{ background: c }} title={c} />
        ))}
      </div>
    </div>
  )
}

function Spark({ values }) {
  const list = values || []
  if (!list.length) return <span>—</span>
  const max = Math.max(1, ...list)
  return (
    <span className="spark" title={list.join(', ')}>
      {list.map((n, i) => (
        <i
          key={i}
          style={{ height: `${Math.max(12, Math.round((n / max) * 100))}%` }}
        />
      ))}
      <em>{list.reduce((a, n) => a + n, 0)}</em>
    </span>
  )
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
  const [matchFilter, setMatchFilter] = useState('all')
  const [openPlayer, setOpenPlayer] = useState(null)
  const [openMatch, setOpenMatch] = useState(null)

  const ea = store.ea || {}
  const overall = ea.overall
  const season = ea.season
  const board = ea.board
  const info = ea.info
  const recent = ea.recent
  const withStats = store.players.filter((p) => p.stats)
  const divisionCode = season?.currentDivision || store.club.currentDivision
  const peakCode = overall?.bestDivision

  const rankedPlayers = useMemo(
    () => sortSquad(store.players, sortKey, sortDir, view),
    [store.players, sortKey, sortDir, view],
  )

  const kitColors = info?.kit?.home || []

  const rosterByLine = useMemo(() => {
    const order = ['any', 'forward', 'midfielder', 'defender', 'goalkeeper']
    const groups = order.map((key) => ({
      key,
      label: POS_LINE_LABEL[key],
      players: store.players.filter((p) => p.stats?.favoritePosition === key),
    }))
    const rest = store.players.filter(
      (p) => !order.includes(p.stats?.favoritePosition),
    )
    if (rest.length) groups.push({ key: 'other', label: 'Outros', players: rest })
    return groups.filter((g) => g.players.length)
  }, [store.players])

  const shownMatches = useMemo(() => {
    const list = ea.matches || []
    if (matchFilter === 'all') return list
    return list.filter((m) => m.type === matchFilter)
  }, [ea.matches, matchFilter])

  const teamTotals = useMemo(() => {
    const rows = store.players.filter((p) => p.stats)
    const sum = (key) => rows.reduce((a, p) => a + (Number(p.stats?.[key]) || 0), 0)
    return {
      games: rows.length,
      goals: sum('goals'),
      assists: sum('assists'),
      motm: sum('motm'),
      passes: sum('passes'),
      tackles: sum('tackles'),
    }
  }, [store.players])

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
          'Nenhum clube retornou. Confira o nome exato no FC 26 e a plataforma (geração atual = PS5 / Xbox Series / PC).',
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
      const bundle = await loadClubBundle(clubId, platform, clubName || query)
      store.setClub({
        name: clubName || extra.name || query,
        clubId: String(clubId),
        platform,
        currentDivision: bundle.season?.currentDivision || extra.currentDivision || null,
      })
      store.upsertFromEa(bundle.members, {
        club: {
          currentDivision:
            bundle.season?.currentDivision || extra.currentDivision || store.club.currentDivision,
        },
        ea: bundleToEa(bundle),
      })
      const bits = []
      if (bundle.members.length) bits.push(`${bundle.members.length} jogadores`)
      if (bundle.matches.length) bits.push(`${bundle.matches.length} jogos recentes`)
      if (bundle.playoffs.length) bits.push(`${bundle.playoffs.length} temporadas de playoff`)
      if (bundle.season) bits.push('temporada atual')
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

  if (openPlayer) {
    return (
      <JogadorPerfil
        player={openPlayer}
        store={store}
        onClose={() => setOpenPlayer(null)}
      />
    )
  }

  if (openMatch) {
    return (
      <PartidaPerfil
        match={openMatch}
        matches={ea.matches || []}
        store={store}
        onClose={() => setOpenMatch(null)}
        onSelectMatch={setOpenMatch}
        onOpenPlayer={(name) => {
          const hit = store.players.find(
            (p) =>
              p.name.trim().toLowerCase() === String(name || '').trim().toLowerCase() ||
              (p.psn && p.psn.trim().toLowerCase() === String(name || '').trim().toLowerCase()),
          )
          if (hit) setOpenPlayer(hit)
        }}
      />
    )
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Estatísticas do clube</h2>
          <p>
            Tudo o que a API da EA devolve para o {store.club.name || 'XV de PiriPiri'}. Clique em
            um jogador para abrir a ficha.
          </p>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn ghost" onClick={syncSaved} disabled={loading || !store.club.clubId}>
            {loading ? 'Sincronizando…' : 'Atualizar da EA'}
          </button>
        </div>
      </div>

      <div className="kpi-row kpi-row-6">
        <Kpi
          label="Divisão atual"
          value={divisionLabel(divisionCode)}
          hint="Liga em curso"
        />
        <Kpi
          label="Habilidade"
          value={overall ? fmt(overall.skillRating) : '—'}
          hint="Nota da EA para o clube"
        />
        <Kpi
          label="Carreira V-E-D"
          value={overall ? record(overall.wins, overall.ties, overall.losses) : '—'}
          hint={overall ? `${fmt(overall.games)} jogos` : ''}
        />
        <Kpi
          label="Melhor divisão"
          value={divisionLabel(peakCode)}
          hint={
            overall?.bestFinishGroup
              ? `Pico da carreira · ${groupFinishLabel(overall.bestFinishGroup)}`
              : 'Pico da carreira'
          }
        />
        <Kpi
          label="Saldo de gols"
          value={overall ? fmt(overall.goalDiff) : '—'}
          hint={overall ? `${fmt(overall.goals)} marcados · ${fmt(overall.goalsAgainst)} sofridos` : ''}
        />
        <Kpi
          label="Aproveitamento"
          value={overall ? `${overall.winPct}%` : '—'}
          hint="Vitórias na carreira"
        />
      </div>

      {overall?.form?.length ? (
        <div className="form-strip">
          <span>Últimos resultados da EA</span>
          <div className="form-dots">
            {overall.form.map((r, i) => (
              <i key={i} className={`form-dot ${r.toLowerCase()}`}>
                {r}
              </i>
            ))}
          </div>
          <span>
            Sequência: {fmt(overall.winStreak)} vitórias · {fmt(overall.unbeatenStreak)} sem derrota
          </span>
        </div>
      ) : null}

      <div className="grid-2">
        <section className="card">
          <h3>Temporada atual</h3>
          <p className="card-lead">
            Liga em curso. Os pontos da tabela são 3 por vitória e 1 por empate — separados da
            carreira.
          </p>
          {season ? (
            <dl className="club-facts club-facts-3">
              <Fact
                label="Divisão agora"
                value={divisionLabel(season.currentDivision)}
                hint="Onde o XV está nesta temporada"
              />
              <Fact
                label="Pontos na tabela"
                value={fmt(season.pointsClassic)}
                hint="3 por vitória, 1 por empate"
              />
              <Fact label="Vitórias · empates · derrotas" value={record(season.wins, season.ties, season.losses)} />
              <Fact label="Jogos" value={fmt(season.games)} />
              <Fact label="Aproveitamento" value={`${season.winPct}%`} />
              <Fact
                label="Melhor divisão nesta temporada"
                value={divisionLabel(season.bestDivision)}
              />
              <Fact label="Gols marcados" value={fmt(season.goals)} hint={`${fmt(season.goalsPerGame, 2)} por jogo`} />
              <Fact
                label="Gols sofridos"
                value={fmt(season.goalsAgainst)}
                hint={`${fmt(season.concededPerGame, 2)} por jogo`}
              />
              <Fact label="Saldo" value={fmt(season.goalDiff)} />
              <Fact label="Jogos sem sofrer gol" value={fmt(season.cleanSheets)} />
              <Fact label="Jogos de playoff" value={fmt(season.playoffGames)} />
              <Fact label="Acessos nesta temporada" value={fmt(season.promotions)} hint="Subidas de divisão" />
              <Fact label="Quedas nesta temporada" value={fmt(season.relegations)} hint="Rebaixamentos" />
              <Fact
                label="Pontos no ranking da EA"
                value={fmt(season.points)}
                hint="Índice interno da EA, não é a tabela"
              />
              <Fact label="Reputação na temporada" value={`Nível ${fmt(season.reputation)}`} />
            </dl>
          ) : (
            <div className="notice">Sincronize o clube para ver a temporada atual.</div>
          )}
        </section>

        <section className="card">
          <h3>Carreira do clube</h3>
          <p className="card-lead">
            Histórico completo. A melhor divisão aqui é o pico de todos os tempos, não a divisão
            atual.
          </p>
          {overall ? (
            <>
              <dl className="club-facts club-facts-3">
                <Fact
                  label="Melhor divisão da história"
                  value={divisionLabel(overall.bestDivision)}
                  hint={
                    overall.bestFinishGroup
                      ? `Já chegou na primeira · ${groupFinishLabel(overall.bestFinishGroup)}`
                      : 'Pico em todas as temporadas'
                  }
                />
                <Fact label="Jogos no total" value={fmt(overall.games)} />
                <Fact label="Jogos de liga" value={fmt(overall.leagueGames)} />
                <Fact label="Jogos de playoff" value={fmt(overall.playoffGames)} />
                <Fact label="Pontos na carreira (3 por vitória)" value={fmt(overall.pointsClassic)} />
                <Fact label="Gols marcados" value={fmt(overall.goals)} hint={`${fmt(overall.goalsPerGame, 2)} por jogo`} />
                <Fact
                  label="Gols sofridos"
                  value={fmt(overall.goalsAgainst)}
                  hint={`${fmt(overall.concededPerGame, 2)} por jogo`}
                />
                <Fact label="Acessos" value={fmt(overall.promotions)} hint="Subidas de divisão" />
                <Fact label="Quedas" value={fmt(overall.relegations)} hint="Rebaixamentos" />
                <Fact label="Reputação na carreira" value={`Nível ${fmt(overall.reputation)}`} />
                <Fact
                  label="Última atualização"
                  value={
                    store.club.lastSync
                      ? new Date(store.club.lastSync).toLocaleString('pt-BR')
                      : '—'
                  }
                />
              </dl>
              {overall.finishes?.some((f) => f.titles) ? (
                <div className="finish-row">
                  {overall.finishes
                    .filter((f) => f.titles)
                    .map((f) => (
                      <span key={f.code || f.division || f.label}>
                        1º do grupo na {f.label || divisionLabel(f.code || f.division)}: <b>{f.titles}</b>
                      </span>
                    ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="notice">Importe o clube para ver o retrato da carreira.</div>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
          <h3>Identidade do clube</h3>
          <dl className="club-facts">
            <Fact label="Clube" value={info?.name || store.club.name || '—'} />
            <Fact label="Código do clube" value={store.club.clubId || '—'} />
            <Fact label="Estádio" value={info?.stadium || '—'} />
            <Fact
              label="Plataforma"
              value={
                store.club.platform === 'common-gen5'
                  ? 'PS5 / Xbox Series / PC'
                  : store.club.platform || '—'
              }
            />
          </dl>
          <div className="kit-block">
            <KitRow label="Casa" colors={info?.kit?.home} />
            <KitRow label="Fora" colors={info?.kit?.away} />
            <KitRow label="Terceiro" colors={info?.kit?.third} />
          </div>
          {ea.positionCount ? (
            <div className="pos-count">
              {Object.entries(ea.positionCount).map(([k, v]) => (
                <span key={k}>
                  {POS_LINE_LABEL[k] || k}: <b>{v}</b>
                </span>
              ))}
            </div>
          ) : null}
          {board && board.games && board.games !== season?.games ? (
            <p className="stats-sort-hint" style={{ marginTop: 12 }}>
              A EA ainda publica um recorte all-time separado ({fmt(board.games)} jogos). Isso não
              é a divisão atual nem o pico da carreira.
            </p>
          ) : null}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Elenco</h3>
        <p className="card-lead">
          A EA não publica foto do Pro. Cada cartão usa as cores da camisa, as iniciais e a
          bandeira. O arquétipo vem das súmulas recentes — a API não entrega AP, PlayStyles nem
          especialização.
        </p>
        {rosterByLine.length ? (
          rosterByLine.map((group) => (
            <div key={group.key} className="roster-line">
              <h4>{group.label}</h4>
              <div className="roster-grid">
                {group.players
                  .slice()
                  .sort((a, b) => (Number(b.stats?.games) || 0) - (Number(a.stats?.games) || 0))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="roster-card"
                      onClick={() => setOpenPlayer(p)}
                    >
                      <PlayerMark
                        name={p.name}
                        nationId={p.stats?.proNationality}
                        colors={kitColors}
                        size={64}
                      />
                      <b>{p.name}</b>
                      <small>
                        {PRO_POS_LABEL[p.stats?.proPos] ||
                          POS_LINE_LABEL[p.stats?.favoritePosition] ||
                          '—'}
                      </small>
                      {p.stats?.build?.lastLabel ? (
                        <span className="build-tag">{p.stats.build.lastLabel}</span>
                      ) : null}
                      <span>
                        {fmt(p.stats?.games)} jogos
                        {p.stats?.proOverall ? ` · ${p.stats.proOverall}` : ''}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ))
        ) : (
          <div className="notice">Sem jogadores carregados.</div>
        )}
      </section>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <section className="card">
          <h3>Últimos jogos do XV</h3>
          <p className="card-lead">
            Clique numa partida para abrir a súmula completa contra aquele time. A EA só entrega os
            10 mais recentes de cada tipo.
          </p>
          {recent ? (
            <div className="recent-strip">
              <span>
                Nos {recent.games} jogos carregados: {record(recent.wins, recent.ties, recent.losses)}
              </span>
              <span>
                Gols {fmt(recent.goals)}–{fmt(recent.goalsAgainst)}
              </span>
              <span>
                Passes {fmt(recent.passes)}/{fmt(recent.passAttempts)} ({fmt(recent.passPct)}%)
              </span>
              <span>Finalizações {fmt(recent.shots)}</span>
            </div>
          ) : null}
          <div className="stats-filters" style={{ marginTop: 8 }}>
            {[
              ['all', 'Todos'],
              ['leagueMatch', 'Liga'],
              ['playoffMatch', 'Playoff'],
              ['friendlyMatch', 'Amistoso'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`filter-chip${matchFilter === key ? ' active' : ''}`}
                onClick={() => setMatchFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {shownMatches.length ? (
            <div className="match-list" style={{ marginTop: 10 }}>
              {shownMatches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`match-row ${m.result.toLowerCase()}`}
                  onClick={() => setOpenMatch(m)}
                >
                  <span className={`match-res ${m.result.toLowerCase()}`}>{m.result || '—'}</span>
                  <div>
                    <b>
                      {m.usGoals} × {m.themGoals} {m.opponent}
                    </b>
                    <small>
                      {MATCH_TYPE_LABEL[m.type] || m.type}
                      {m.timeAgo ? ` · ${timeAgoLabel(m.timeAgo)}` : ''}
                      {m.winnerByDnf ? ' · ganhou por W.O.' : ''}
                      {m.shots ? ` · ${m.shots} finalizações` : ''}
                      {m.passAttempts
                        ? ` · ${m.passes}/${m.passAttempts} passes`
                        : ''}
                      {m.avgRating ? ` · nota ${fmt(m.avgRating, 2)}` : ''}
                      {m.motm ? ' · teve MOTM' : ''}
                    </small>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="notice">Nenhum jogo deste tipo na API. Sincronize o clube.</div>
          )}
        </section>

        <section className="card">
          <h3>Playoffs por temporada</h3>
        {ea.playoffs?.length ? (
          <table className="stats-table" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Temporada da EA</th>
                <th>Melhor divisão</th>
                <th>Colocação no grupo</th>
              </tr>
            </thead>
            <tbody>
              {ea.playoffs.map((p) => (
                <tr key={p.seasonId}>
                  <td>{p.seasonName || p.seasonId}</td>
                  <td>{p.bestDivisionLabel || divisionLabel(p.bestDivision)}</td>
                  <td>
                    {p.bestFinishLabel ||
                      groupFinishLabel(p.bestFinishGroup) ||
                      p.bestFinishGroup}
                  </td>
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
        <p className="card-lead">
          Soma do plantel no clube: {fmt(teamTotals.goals)} gols, {fmt(teamTotals.assists)}{' '}
          assistências, {fmt(teamTotals.motm)} melhores em campo.
        </p>
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
                {view === 'club' ? <th>Posição do Pro</th> : null}
                {view === 'club' ? <th>Arquétipo</th> : null}
                {view === 'club' ? <th>Nota do Pro</th> : null}
                <th>Jogos</th>
                {view === 'club' ? <th>Vitórias</th> : null}
                <th>Gols</th>
                <th>Gols/jogo</th>
                <th>Assistências</th>
                <th>Assist./jogo</th>
                <th>Nota</th>
                <th>Melhor em campo</th>
                {view === 'club' ? (
                  <>
                    <th>Passes totais</th>
                    <th>Passes certos</th>
                    <th>Passes errados</th>
                    <th>% de passes certos</th>
                    <th>Chute certo</th>
                    <th>Desarmes</th>
                    <th>% desarmes</th>
                    <th>Vermelhos</th>
                    <th>Sem sofrer gol</th>
                    <th>Gols nos últimos 10</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.map((p, i) => {
                const s = pack(p) || {}
                const passes = passSplit(view === 'club' ? p.stats : s)
                const nation = NATIONS[String(p.stats?.proNationality || '')]
                const pos = PRO_POS_LABEL[p.stats?.proPos] || ''
                return (
                  <tr
                    key={p.id}
                    className={`stats-row-click${i === 0 && rankedPlayers.length > 1 ? ' rank-top' : ''}`}
                    onClick={() => setOpenPlayer(p)}
                  >
                    <td>
                      <div className="player-rank">
                        <span className="rank-index">{i + 1}</span>
                        <PlayerMark
                          name={p.name}
                          nationId={p.stats?.proNationality}
                          colors={kitColors}
                          size={34}
                        />
                        <div>
                          {p.name}
                          <div>
                            <small>
                              {p.psn}
                              {nation ? ` · ${nation}` : ''}
                              {p.stats?.proHeight ? ` · ${p.stats.proHeight} cm` : ''}
                            </small>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{POS_LINE_LABEL[p.stats?.favoritePosition] || p.stats?.favoritePosition || '—'}</td>
                    {view === 'club' ? <td>{pos || '—'}</td> : null}
                    {view === 'club' ? (
                      <td>
                        {p.stats?.build?.lastLabel || '—'}
                        {p.stats?.build?.history?.length > 1 ? (
                          <div>
                            <small>
                              {p.stats.build.history
                                .filter((h) => h.id !== p.stats.build.lastId)
                                .map((h) => `${h.label} ${h.games}`)
                                .join(' · ')}
                            </small>
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                    {view === 'club' ? <td>{fmt(p.stats?.proOverall)}</td> : null}
                    <td>{fmt(s.games)}</td>
                    {view === 'club' ? <td>{s.winRate != null ? `${s.winRate}%` : '—'}</td> : null}
                    <td>{fmt(s.goals)}</td>
                    <td>{perGame(s.goals, s.games)}</td>
                    <td>{fmt(s.assists)}</td>
                    <td>{perGame(s.assists, s.games)}</td>
                    <td>
                      {s.rating
                        ? Number(s.rating).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '—'}
                    </td>
                    <td>{fmt(s.motm)}</td>
                    {view === 'club' ? (
                      <>
                        <td>{fmt(passes.total)}</td>
                        <td>{fmt(passes.ok)}</td>
                        <td>{fmt(passes.bad)}</td>
                        <td>{passes.pct != null ? `${passes.pct}%` : '—'}</td>
                        <td>{p.stats?.shotSuccess != null ? `${p.stats.shotSuccess}%` : '—'}</td>
                        <td>{fmt(p.stats?.tackles)}</td>
                        <td>
                          {p.stats?.tackleSuccess != null ? `${p.stats.tackleSuccess}%` : '—'}
                        </td>
                        <td>{fmt(p.stats?.redCards)}</td>
                        <td>
                          {fmt((p.stats?.cleanSheetsDef || 0) + (p.stats?.cleanSheetsGK || 0))}
                        </td>
                        <td>
                          <Spark values={p.stats?.lastTenGoals} />
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
            Sem jogadores. Espere o XV carregar ou use Atualizar da EA.
          </div>
        )}
        <p className="stats-sort-hint">
          {withStats.length} com números da EA. Clique no jogador para abrir a ficha completa.
        </p>
      </section>

      <details className="card" style={{ marginTop: 18 }}>
        <summary className="search-summary">Buscar outro clube na EA</summary>
        <div className="form-grid" style={{ marginTop: 14 }}>
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
            <label>Código do clube (opcional)</label>
            <input
              value={store.club.clubId}
              onChange={(e) => store.setClub({ clubId: e.target.value })}
              placeholder="Cole o ID se já souber"
            />
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={buscar} disabled={loading}>
            Buscar
          </button>
          <button
            className="btn ghost"
            onClick={syncSaved}
            disabled={loading || !store.club.clubId}
          >
            Sincronizar clube salvo
          </button>
        </div>
        {status && (
          <div className="notice ok" style={{ marginTop: 12 }}>
            {status}
          </div>
        )}
        {error && (
          <div className="notice error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
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
                    {div ? ` · ${divisionLabel(div)}` : ''}
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
      </details>
    </>
  )
}
