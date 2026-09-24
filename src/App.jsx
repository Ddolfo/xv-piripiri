import { Component, useEffect, useState } from 'react'
import Escalacao from './components/Escalacao'
import Estatisticas from './components/Estatisticas'
import Header from './components/Header'
import Rivais from './components/Rivais'
import { useStore } from './hooks/useStore'
import {
  applyRecorte,
  bundleToEa,
  loadClubBundle,
  loadClubMembers,
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
        const membersPromise = loadClubMembers(id, XV_CLUB.platform).then((members) => {
          if (live && members.length) {
            store.upsertFromEa(members, {
              club: {
                name: pickClubName(hit) || XV_CLUB.name,
                clubId: id,
                platform: XV_CLUB.platform,
              },
            })
          }
          return members
        })
        const bundle = await loadClubBundle(id, XV_CLUB.platform, XV_CLUB.name)
        await membersPromise
        if (!live) return
        store.upsertFromEa(bundle.members.length ? bundle.members : await membersPromise, {
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
        try {
          const id = XV_CLUB.clubId
          const members = await loadClubMembers(id, XV_CLUB.platform)
          if (live) {
            store.upsertFromEa(members, {
              club: { name: XV_CLUB.name, clubId: id, platform: XV_CLUB.platform },
              ea: bundleToEa(applyRecorte({ clubId: id })),
            })
          }
        } catch {
          if (live) store.upsertFromEa([], { ea: bundleToEa(applyRecorte({ clubId: XV_CLUB.clubId })) })
        }
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
            {tab === 'rivais' && <Rivais store={store} />}
            {tab === 'escalacao' && <Escalacao store={store} />}
          </div>
        </main>
      </div>
    </PanelError>
  )
}
