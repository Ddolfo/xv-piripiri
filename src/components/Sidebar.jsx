import { LOGO_SRC } from '../lib/brand'

export default function Sidebar({ tab, setTab, players, club }) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <img src={LOGO_SRC} alt="XV de PiriPiri" />
        <div>
          <h1>XV DE PIRIPIRI</h1>
          <p>Painel técnico · desde 2021</p>
        </div>
      </div>

      <nav className="nav">
        <button className={tab === 'elenco' ? 'active' : ''} onClick={() => setTab('elenco')}>
          Elenco
        </button>
        <button className={tab === 'escalacao' ? 'active' : ''} onClick={() => setTab('escalacao')}>
          Escalação
        </button>
        <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>
          Estatísticas EA
        </button>
      </nav>

      <div className="side-meta">
        <div>{players.length} jogadores cadastrados</div>
        <div>Clube: {club.name || 'XV de PiriPiri'}</div>
        <div>ID EA: {club.clubId || 'não sincronizado'}</div>
      </div>
    </aside>
  )
}
