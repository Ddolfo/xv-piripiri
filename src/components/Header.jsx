import { LOGO_SRC } from '../lib/brand'
import { divisionLabel } from '../lib/eaApi'

export default function Header({ tab, setTab, players, club, overall, booting }) {
  return (
    <header className="top-nav">
      <div className="brand-block">
        <img src={LOGO_SRC} alt="XV de PiriPiri" />
        <div>
          <h1>XV DE PIRIPIRI</h1>
          <p>Painel técnico · desde 2021</p>
        </div>
      </div>

      <nav className="nav">
        <button
          type="button"
          className={tab === 'stats' ? 'active' : ''}
          onClick={() => setTab('stats')}
        >
          Estatísticas
        </button>
        <button
          type="button"
          className={tab === 'escalacao' ? 'active' : ''}
          onClick={() => setTab('escalacao')}
        >
          Escalação
        </button>
      </nav>

      <div className="top-meta">
        {booting ? (
          <span>Carregando o XV de PiriPiri…</span>
        ) : (
          <>
            <span>{club.name}</span>
            <span>{players.length} jogadores</span>
            {club.currentDivision ? <span>{divisionLabel(club.currentDivision)}</span> : null}
            {overall?.skillRating ? (
              <span>Habilidade {Number(overall.skillRating).toLocaleString('pt-BR')}</span>
            ) : null}
          </>
        )}
      </div>
    </header>
  )
}
