import { Component, useEffect, useState } from 'react'
import Escalacao from './components/Escalacao'
import Estatisticas from './components/Estatisticas'
import Header from './components/Header'
import Radar from './components/Radar'
import Rivais from './components/Rivais'
import { useStore } from './hooks/useStore'
import {
  applyRecorte,
  bundleToEa,
  loadClubBundle,
  pickClubId,
  pickClubName,
  pickCurrentDivision,
  pickXvClub,
  searchClubs,
  XV_CLUB,
} from './lib/eaApi'
import { loadSeedHistory } from './lib/rivals'

export class PanelError extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-wrap" style={{ padding: 24 }}>
          <div className="notice">
            O painel travou ao abrir: {String(this.state.error.message || this.state.error)}. Dê
            um Ctrl+F5. Se continuar, apague os dados do site neste navegador e recarregue.
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const store = useStore()
  const [tab, setTab] = useState('stats')
  const [booting, setBooting] = useState(true)
  const [syncing, setSyncing] = useState(false)

  async function syncEa() {
    if (!store.club.clubId || syncing) return
    setSyncing(true)
    try {
      const bundle = await loadClubBundle(
        store.club.clubId,
        store.club.platform || XV_CLUB.platform,
        store.club.name,
      )
      store.upsertFromEa(bundle.members, {
        club: {
          name: bundle.info?.name || store.club.name,
          clubId: String(store.club.clubId),
          currentDivision: bundle.season?.currentDivision || store.club.currentDivision,
        },
        ea: bundleToEa(bundle),
      })
    } catch {
      /* o Radar segue com o que já estiver */
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const seed = await loadSeedHistory()
        let hit = null
        try {
          const list = await searchClubs(XV_CLUB.name, XV_CLUB.platform)
          hit = pickXvClub(list)
        } catch {
          /* busca vazia ou cai */
        }
        const id = String(pickClubId(hit) || XV_CLUB.clubId)
        if (live) {
          const seedMatches = String(id) === '14693' ? seed || [] : []
          store.mergeMatchHistory([...seedMatches, ...(store.ea?.matches || [])])
        }
        const bundle = await loadClubBundle(id, XV_CLUB.platform, XV_CLUB.name)
        if (!live) return
        store.upsertFromEa(bundle.members, {
          club: {
            name: pickClubName(hit) || bundle.info?.name || XV_CLUB.name,
            clubId: id,
            platform: XV_CLUB.platform,
            currentDivision:
              bundle.season?.currentDivision ||
              pickCurrentDivision(hit) ||
              undefined,
          },
          ea: bundleToEa(bundle),
        })
      } catch {
        if (live) store.upsertFromEa([], { ea: bundleToEa(applyRecorte({ clubId: XV_CLUB.clubId })) })
      } finally {
        if (live) setBooting(false)
      }
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <PanelError>
      <div className="app-shell">
        <Header
          tab={tab}
          setTab={setTab}
          players={store.players}
          club={store.club}
          overall={store.ea?.overall}
          booting={booting}
        />
        <main className="main">
          <div className="page-wrap">
            {tab === 'stats' && <Estatisticas store={store} />}
            {tab === 'radar' && (
              <Radar
                key={store.club.lastSync || 'radar'}
                store={store}
                onSync={syncEa}
                syncing={syncing || booting}
              />
            )}
            {tab === 'rivais' && <Rivais store={store} />}
            {tab === 'escalacao' && <Escalacao store={store} />}
          </div>
        </main>
      </div>
    </PanelError>
  )
}
