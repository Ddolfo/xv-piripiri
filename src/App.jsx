import { Component, lazy, Suspense, useEffect, useState } from 'react'
import Estatisticas from './components/Estatisticas'
import Header from './components/Header'
import Rivais from './components/Rivais'
import { useStore } from './hooks/useStore'
import {
  applyRecorte,
  COACH_CLUBS,
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
import { loadSeedHistory, loadSharedHistory } from './lib/rivals'

const SHARED_POLL_MS = 5 * 60 * 1000

// Draft XV carregado sob demanda: só baixa o código quando a pessoa abre a aba.
const DraftApp = lazy(() => import('./draft/ui/DraftApp.jsx'))

const VIEW_KEY = 'xv-active-view'

function readView() {
  try {
    const v = sessionStorage.getItem(VIEW_KEY)
    if (v === 'draft' || COACH_CLUBS.some((c) => c.clubId === v)) return v
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
    loadSharedHistory(id).then((shared) => {
      if (live.current && shared.length) store.mergeMatchHistory(shared)
    })
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
    const poll = setInterval(() => {
      loadSharedHistory(def.clubId).then((shared) => {
        if (live.current && shared.length) store.mergeMatchHistory(shared)
      })
    }, SHARED_POLL_MS)
    return () => {
      live.current = false
      clearInterval(poll)
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
      <div className={`app-shell${view === 'draft' && !DraftApp ? ' is-draft' : ''}`}>
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
          {view === 'draft' && DraftApp ? (
            <div className="page-wrap">
              <Suspense fallback={<div className="card">Carregando o Draft XV…</div>}>
                <DraftApp />
              </Suspense>
            </div>
          ) : view === 'draft' ? (
            <div className="draft-soon">
              <img
                src={`${import.meta.env.BASE_URL}draft-em-construcao.jpg`}
                alt="O Draft está em construção. Em breve novidades!"
              />
            </div>
          ) : (
            <div className="page-wrap">
              {panel === 'stats' && <Estatisticas key={view} store={store} />}
              {panel === 'rivais' && <Rivais key={view} store={store} />}
            </div>
          )}
        </main>
      </div>
    </PanelError>
  )
}
