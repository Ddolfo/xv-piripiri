import { useEffect, useState } from 'react'
import Escalacao from './components/Escalacao'
import Estatisticas from './components/Estatisticas'
import Header from './components/Header'
import Rivais from './components/Rivais'
import { useStore } from './hooks/useStore'
import {
  bundleToEa,
  loadClubBundle,
  pickClubId,
  pickClubName,
  pickCurrentDivision,
  searchClubs,
  XV_CLUB,
} from './lib/eaApi'
import { loadSeedHistory } from './lib/rivals'

export default function App() {
  const store = useStore()
  const [tab, setTab] = useState('stats')
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const seed = await loadSeedHistory()
        if (live) store.mergeMatchHistory([...(seed || []), ...(store.ea?.matches || [])])
        let hit = null
        try {
          const list = await searchClubs(XV_CLUB.name, XV_CLUB.platform)
          hit =
            (list || []).find((c) => String(pickClubId(c)) === XV_CLUB.clubId) || list?.[0] || null
        } catch {
          /* playoff: a busca all-time volta vazia ou cai */
        }
        const id = String(pickClubId(hit) || XV_CLUB.clubId)
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
        /* o painel segue com o que já estiver salvo */
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
  )
}
