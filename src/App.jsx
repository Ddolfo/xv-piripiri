import { useState } from 'react'
import Elenco from './components/Elenco'
import Escalacao from './components/Escalacao'
import Estatisticas from './components/Estatisticas'
import Sidebar from './components/Sidebar'
import { useStore } from './hooks/useStore'

export default function App() {
  const store = useStore()
  const [tab, setTab] = useState('elenco')

  return (
    <div className="app-shell">
      <Sidebar tab={tab} setTab={setTab} players={store.players} club={store.club} />
      <main className="main">
        {tab === 'elenco' && <Elenco store={store} />}
        {tab === 'escalacao' && <Escalacao store={store} />}
        {tab === 'stats' && <Estatisticas store={store} />}
      </main>
    </div>
  )
}
