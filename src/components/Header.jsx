import { COACH_CLUBS, XV_CLUB, clubById, divisionLabel } from '../lib/eaApi'
import { clubLogoSrc } from '../lib/brand'

export default function Header({
  view,
  setView,
  panel,
  setPanel,
  players,
  club,
  overall,
  booting,
  clubName,
}) {
  const clubView = view !== 'draft'
  const def = clubView ? clubById(view) : XV_CLUB
  const showing = clubView && String(club?.clubId) === String(view) ? club : def
  const logo = clubLogoSrc(showing)
  const title = showing.name || def.name
  const tagline = def.tagline || 'Painel técnico · FC 27'

  return (
    <header className="top-nav">
      <div className="page-wrap top-nav-inner">
        <div className="brand-block">
          <img src={logo} alt={title} />
          <div>
            <h1>{title}</h1>
            <p>{tagline}</p>
          </div>
        </div>

        <nav className="nav club-switch" aria-label="Times">
          {COACH_CLUBS.map((c) => (
            <button
              key={c.clubId}
              type="button"
              className={view === c.clubId ? 'active' : ''}
              onClick={() => setView(c.clubId)}
            >
              {c.name}
            </button>
          ))}
          <button
            type="button"
            className={view === 'draft' ? 'active' : ''}
            onClick={() => setView('draft')}
          >
            Draft XV
          </button>
        </nav>

        {clubView ? (
          <nav className="nav panel-nav" aria-label="Painel do clube">
            <button
              type="button"
              className={panel === 'stats' ? 'active' : ''}
              onClick={() => setPanel('stats')}
            >
              Estatísticas
            </button>
            <button
              type="button"
              className={panel === 'rivais' ? 'active' : ''}
              onClick={() => setPanel('rivais')}
            >
              Rivais
            </button>
          </nav>
        ) : null}

        <div className="top-meta">
          {view === 'draft' ? (
            <span>Em construção</span>
          ) : booting ? (
            <span>Carregando {clubName || def.name}…</span>
          ) : (
            <>
              <span>{club?.name || clubName}</span>
              <span>{players.length} jogadores</span>
              {club?.currentDivision ? <span>{divisionLabel(club.currentDivision)}</span> : null}
              {overall?.skillRating ? (
                <span>Habilidade {Number(overall.skillRating).toLocaleString('pt-BR')}</span>
              ) : null}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
