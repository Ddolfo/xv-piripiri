import { Component, useEffect, useState } from 'react'
import Escalacao from './components/Escalacao'
import Estatisticas from './components/Estatisticas'
import Header from './components/Header'
import Rivais from './components/Rivais'
import DraftApp from './draft/ui/DraftApp.jsx'
import { useStore } from './hooks/useStore'
import {
  applyRecorte,
  BARCARENA_CLUB,
  bundleToEa,
  clubById,
  isXvClubId,
  loadClubBundle,
  loadClubMembers,
  pickClubId,
  pickClubName,
  pickCurrentDivision,
  pickNamedClub,
  recorteHistoryMatches,
  searchClubs,
  XV_CLUB,
} from './lib/eaApi'
import { loadSeedHistory } from './lib/rivals'

const VIEW_KEY = 'xv-active-view'

function readView() {
  try {
    const v = sessionStorage.getItem(VIEW_KEY)
    if (v === 'draft' || v === BARCARENA_CLUB.clubId || v === XV_CLUB.clubId) return v
  } catch {
    /* ignore */
  }
  return XV_CLUB.clubId
}

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

async function hydrateClub(def, store, live) {
  const seed = isXvClubId(def.clubId) ? await loadSeedHistory() : { clubId: '', matches: [] }
  let hit = null
  try {
    const list = await searchClubs(def.name, def.platform)
    hit = pickNamedClub(list, def)
  } catch {
    /* busca vazia ou cai */
  }
  const id = String(pickClubId(hit) || def.clubId)
  if (live.current) {
    const seedMatches = !seed.clubId || seed.clubId === id ? seed.matches || [] : []
    const recorte = isXvClubId(id) ? recorteHistoryMatches() : []
    store.mergeMatchHistory([...seedMatches, ...recorte])
  }
  const membersPromise = loadClubMembers(id, def.platform).then((members) => {
    if (live.current && members.length) {
      store.upsertFromEa(members, {
        club: {
          name: pickClubName(hit) || def.name,
          clubId: id,
          platform: def.platform,
        },
      })
    }
    return members
  })
  const bundle = await loadClubBundle(id, def.platform, def.name)
  await membersPromise
  if (!live.current) return
  store.upsertFromEa(bundle.members.length ? bundle.members : await membersPromise, {
    club: {
      name: pickClubName(hit) || bundle.info?.name || def.name,
      clubId: id,
      platform: def.platform,
      currentDivision: bundle.season?.currentDivision || pickCurrentDivision(hit) || undefined,
    },
    ea: bundleToEa(bundle),
  })
}

export default function App() {
  const store = useStore()
  const [view, setView] = useState(readView)
  const [panel, setPanel] = useState('stats')
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_KEY, view)
    } catch {
      /* ignore */
    }
  }, [view])

  useEffect(() => {
    if (view === 'draft') {
      setBooting(false)
      return undefined
    }
    const def = clubById(view)
    store.switchClub(def.clubId)
    const live = { current: true }
    setBooting(true)
    hydrateClub(def, store, live).catch(async () => {
      if (!live.current) return
      try {
        const members = await loadClubMembers(def.clubId, def.platform)
        if (!live.current) return
        store.upsertFromEa(members, {
          club: { name: def.name, clubId: def.clubId, platform: def.platform },
          ea: isXvClubId(def.clubId) ? bundleToEa(applyRecorte({ clubId: def.clubId })) : { clubId: def.clubId },
        })
      } catch {
        if (live.current && isXvClubId(def.clubId)) {
          store.upsertFromEa([], { ea: bundleToEa(applyRecorte({ clubId: XV_CLUB.clubId })) })
        }
      }
    }).finally(() => {
      if (live.current) setBooting(false)
    })
    return () => {
      live.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const clubView = view !== 'draft'
  const clubName = clubView ? store.club?.name || clubById(view).name : XV_CLUB.name

  function selectView(next) {
    if (next !== 'draft') store.switchClub(next)
    setView(next)
  }

  return (
    <PanelError>
      <div className="app-shell">
        <Header
          view={view}
          setView={selectView}
          panel={panel}
          setPanel={setPanel}
          players={store.players}
          club={store.club}
          overall={store.ea?.overall}
          booting={booting && clubView}
          clubName={clubName}
        />
        <main className="main">
          <div className="page-wrap">
            {view === 'draft' && <DraftApp />}
            {clubView && panel === 'stats' && <Estatisticas key={view} store={store} />}
            {clubView && panel === 'rivais' && <Rivais key={view} store={store} />}
            {clubView && panel === 'escalacao' && <Escalacao key={view} store={store} />}
          </div>
        </main>
      </div>
    </PanelError>
  )
}
