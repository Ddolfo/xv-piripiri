import { useMemo, useState } from 'react'
import { LOGO_SRC } from '../lib/brand'
import { MATCH_TYPE_LABEL, POS_LINE_LABEL } from '../lib/eaApi'
import { carryBoard, motmOf, pulseOf, takeLastTen } from '../lib/radar'
import JogadorPerfil from './JogadorPerfil'
import PartidaPerfil from './PartidaPerfil'
import PlayerMark from './PlayerMark'

function fmt(n, digits) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? (Number.isInteger(v) ? 0 : 2),
  })
}

function timeAgoLabel(ago) {
  if (!ago) return ''
  const unit = {
    seconds: 'segundos',
    minutes: 'minutos',
    hours: 'horas',
    days: 'dias',
    weeks: 'semanas',
    months: 'meses',
    years: 'anos',
  }[ago.unit] || ago.unit
  return `há ${ago.number} ${unit}`
}

function record(w, e, l) {
  return `${fmt(w)}-${fmt(e)}-${fmt(l)}`
}

function VersusBar({ label, us, them }) {
  const a = Number(us) || 0
  const b = Number(them) || 0
  const tot = a + b
  const usPct = tot ? (a / tot) * 100 : 50
  return (
    <div className="radar-versus">
      <div className="radar-versus-top">
        <b>{fmt(a)}</b>
        <span>{label}</span>
        <b>{fmt(b)}</b>
      </div>
      <i className="radar-versus-track" aria-hidden="true">
        <i style={{ width: `${usPct}%` }} />
      </i>
    </div>
  )
}

export default function Radar({ store }) {
  const matches = useMemo(() => takeLastTen(store.ea?.matches), [store.ea?.matches])
  const pulse = useMemo(() => pulseOf(matches), [matches])
  const board = useMemo(() => carryBoard(matches), [matches])
  const kit = store.ea?.info?.kit?.home || []
  const [focusId, setFocusId] = useState(null)
  const [openMatch, setOpenMatch] = useState(null)
  const [openPlayer, setOpenPlayer] = useState(null)

  const focus = matches.find((m) => m.id === focusId) || matches[0] || null
  const motm = motmOf(focus)
  const ratings = [...(focus?.us?.players || [])].sort(
    (a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name, 'pt-BR'),
  )

  function openStorePlayer(name) {
    const hit = store.players.find(
      (p) =>
        p.name.trim().toLowerCase() === String(name || '').trim().toLowerCase() ||
        (p.psn && p.psn.trim().toLowerCase() === String(name || '').trim().toLowerCase()),
    )
    if (hit) setOpenPlayer(hit)
  }

  if (openPlayer) {
    return (
      <JogadorPerfil player={openPlayer} store={store} onClose={() => setOpenPlayer(null)} />
    )
  }

  if (openMatch) {
    return (
      <PartidaPerfil
        match={openMatch}
        matches={matches}
        store={store}
        onClose={() => setOpenMatch(null)}
        onSelectMatch={setOpenMatch}
        onOpenPlayer={(name) => {
          setOpenMatch(null)
          openStorePlayer(name)
        }}
      />
    )
  }

  if (!matches.length) {
    return (
      <div className="notice">
        Sem súmula dos últimos jogos. Espere o XV carregar ou use Atualizar da EA na aba
        Estatísticas.
      </div>
    )
  }

  return (
    <div className="radar">
      <div className="topbar">
        <div>
          <h2>Radar dos 10</h2>
          <p>
            Leitura da súmula da EA: notas, passes, desarmes, faltas, escanteios e quem
            carregou a sequência. Sem chute de posse ou xG.
          </p>
        </div>
      </div>

      <div className="radar-pulse">
        <div>
          <span>Sequência</span>
          <b>{record(pulse.wins, pulse.ties, pulse.losses)}</b>
        </div>
        <div>
          <span>Gols</span>
          <b>
            {fmt(pulse.gf)}–{fmt(pulse.ga)}
          </b>
        </div>
        <div>
          <span>Nota média</span>
          <b>{pulse.avgRating ? fmt(pulse.avgRating, 2) : '—'}</b>
        </div>
        <div>
          <span>Passe</span>
          <b>{pulse.passPct}%</b>
          <small>
            {fmt(pulse.passes)}/{fmt(pulse.passAttempts)}
          </small>
        </div>
        <div>
          <span>Chutes</span>
          <b>{fmt(pulse.shots)}</b>
        </div>
        <div>
          <span>Desarmes</span>
          <b>{fmt(pulse.tackles)}</b>
        </div>
        <div>
          <span>Faltas</span>
          <b>{fmt(pulse.fouls)}</b>
        </div>
        <div>
          <span>Escanteios</span>
          <b>{fmt(pulse.corners)}</b>
        </div>
      </div>

      <div className="radar-film" role="list">
        {matches.map((m, i) => {
          const active = focus?.id === m.id
          return (
            <button
              key={m.id}
              type="button"
              role="listitem"
              className={`radar-ticket radar-ticket-${(m.result || '').toLowerCase()}${active ? ' active' : ''}`}
              onClick={() => setFocusId(m.id)}
            >
              <em>{String(i + 1).padStart(2, '0')}</em>
              <strong>
                {fmt(m.usGoals)}–{fmt(m.themGoals)}
              </strong>
              <span>{m.opponent}</span>
              <small>
                {m.result || '—'}
                {m.winnerByDnf ? ' WO' : ''}
                {m.timeAgo ? ` · ${timeAgoLabel(m.timeAgo)}` : ''}
              </small>
            </button>
          )
        })}
      </div>

      {focus ? (
        <section className="radar-board">
          <div className="radar-jumbo">
            <p className="radar-kicker">
              {MATCH_TYPE_LABEL[focus.type] || focus.type}
              {focus.timeAgo ? ` · ${timeAgoLabel(focus.timeAgo)}` : ''}
              {focus.winnerByDnf ? ' · ganhou por W.O.' : ''}
            </p>
            <div className="radar-scoreline">
              <div className="radar-club">
                <img src={LOGO_SRC} alt="" />
                <b>XV</b>
              </div>
              <p className="radar-score">
                {fmt(focus.usGoals)}
                <i>×</i>
                {fmt(focus.themGoals)}
              </p>
              <div className="radar-club">
                <span className="radar-opp-mark">{(focus.opponent || 'ADV').slice(0, 3).toUpperCase()}</span>
                <b>{focus.opponent}</b>
              </div>
            </div>
            <p className="radar-motm">
              {motm
                ? `Melhor em campo: ${motm.name} · nota ${fmt(motm.rating, 2)}`
                : 'Sem nota de melhor em campo nesta súmula'}
            </p>
            <button type="button" className="btn ghost" onClick={() => setOpenMatch(focus)}>
              Abrir súmula completa
            </button>
          </div>

          <div className="radar-duel">
            <h3>XV × {focus.opponent}</h3>
            <p className="card-lead">Números da súmula deste jogo, dos dois lados.</p>
            <VersusBar label="Finalizações" us={focus.us?.shots} them={focus.them?.shots} />
            <VersusBar label="Passes certos" us={focus.us?.passes} them={focus.them?.passes} />
            <VersusBar label="Desarmes" us={focus.us?.tackles} them={focus.them?.tackles} />
            <VersusBar label="Faltas" us={focus.us?.foulsCommitted} them={focus.them?.foulsCommitted} />
            <VersusBar label="Escanteios" us={focus.us?.corners} them={focus.them?.corners} />
            <VersusBar label="Impedimentos" us={focus.us?.offsides} them={focus.them?.offsides} />
            <VersusBar
              label="Nota média"
              us={focus.us?.avgRating}
              them={focus.them?.avgRating}
            />
          </div>

          <div className="radar-wall">
            <h3>Notas do XV</h3>
            <p className="card-lead">Como no placar da TV: nota da EA neste jogo, não na temporada.</p>
            {ratings.length ? (
              <ul>
                {ratings.map((p) => (
                  <li key={p.id || p.name}>
                    <button type="button" onClick={() => openStorePlayer(p.name)}>
                      <PlayerMark name={p.name} colors={kit} size={40} />
                      <span>
                        <b>{p.name}</b>
                        <small>
                          {POS_LINE_LABEL[p.position] || p.position || '—'}
                          {p.archetype ? ` · ${p.archetype}` : ''}
                          {p.minutes ? ` · ${p.minutes} min` : ''}
                        </small>
                      </span>
                      <em className={p.motm ? 'motm' : ''}>{p.rating ? fmt(p.rating, 1) : '—'}</em>
                      <i>
                        {p.goals || p.assists
                          ? `${p.goals}G ${p.assists}A`
                          : p.shots
                            ? `${p.shots} chutes`
                            : p.passes
                              ? `${p.passes} passes`
                              : ' '}
                      </i>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="notice">Esta partida não veio com a súmula dos 11.</div>
            )}
          </div>
        </section>
      ) : null}

      <section className="card radar-carry">
        <h3>Quem carregou os 10</h3>
        <p className="card-lead">
          Soma só destas súmulas. Passe pesado = certos por jogo vezes o aproveitamento - volume e
          qualidade juntos, não só o percentual.
        </p>
        {board.length ? (
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Jogos</th>
                <th>Min</th>
                <th>Nota</th>
                <th>Gols</th>
                <th>Ast</th>
                <th>G+A</th>
                <th>Passe pesado</th>
                <th>Certos/jogo</th>
                <th>% passe</th>
                <th>Desarmes</th>
                <th>MOTM</th>
              </tr>
            </thead>
            <tbody>
              {board.map((p, i) => (
                <tr
                  key={p.name}
                  className={`stats-row-click${i === 0 ? ' rank-top' : ''}`}
                  onClick={() => openStorePlayer(p.name)}
                >
                  <td>
                    <div className="player-rank">
                      <span className="rank-index">{i + 1}</span>
                      <PlayerMark name={p.name} colors={kit} size={34} />
                      <div>
                        {p.name}
                        <div>
                          <small>
                            {POS_LINE_LABEL[p.lastPos] || p.lastPos || '—'}
                            {p.lastArchetype ? ` · ${p.lastArchetype}` : ''}
                          </small>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{fmt(p.games)}</td>
                  <td>{fmt(p.minutes)}</td>
                  <td>{p.rating ? fmt(p.rating, 2) : '—'}</td>
                  <td>{fmt(p.goals)}</td>
                  <td>{fmt(p.assists)}</td>
                  <td>{fmt(p.involvement)}</td>
                  <td>{p.passWeight ? fmt(p.passWeight, 1) : '—'}</td>
                  <td>{p.certosPorJogo ? fmt(p.certosPorJogo, 1) : '—'}</td>
                  <td>{p.passPct ? `${p.passPct}%` : '—'}</td>
                  <td>{fmt(p.tackles)}</td>
                  <td>{fmt(p.motm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : (
          <div className="notice">As súmulas destes jogos ainda não listam jogadores.</div>
        )}
      </section>
    </div>
  )
}
