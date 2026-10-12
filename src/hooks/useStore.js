import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FORMATIONS } from '../data/formations'
import {
  applyRecorte,
  clubById,
  fixEaText,
  fixEaTree,
  isHollowOverall,
  isHollowSeason,
  isXvClubId,
  mergeMatchLists,
  recorteHistoryMatches,
  XV_CLUB,
} from '../lib/eaApi'
import { mergeHistory } from '../lib/rivals'
import { emptyClubState, loadAllClubStates, saveClubState, uid } from '../lib/storage'

function keepLastEa(prev, next) {
  if (!next) return applyRecorte(prev || {})
  const prevId = prev?.clubId ? String(prev.clubId) : ''
  const nextId = next?.clubId ? String(next.clubId) : ''
  if (prevId && nextId && prevId !== nextId) return applyRecorte({ ...next, clubId: nextId })
  const out = { ...prev, ...next, clubId: nextId || prevId || null }
  const nextGames = Number(next?.overall?.games) || 0
  const prevGames = Number(prev?.overall?.games) || 0
  if (!isHollowOverall(next.overall) && nextGames >= prevGames) {
    out.overall = next.overall
    out.season = next.season || null
    if (next.board) out.board = next.board
  } else {
    if (isHollowOverall(next.overall) && !isHollowOverall(prev?.overall)) out.overall = prev.overall
    if (isHollowSeason(next.season) && !isHollowSeason(prev?.season)) out.season = prev.season
    if (!next.board && prev?.board) out.board = prev.board
  }
  if (!next.info && prev?.info) out.info = prev.info
  if (!next.positionCount && prev?.positionCount) out.positionCount = prev.positionCount
  out.playoffs = Array.isArray(next.playoffs) ? next.playoffs : []
  if (!Number(out.overall?.playoffGames)) out.playoffs = []
  out.matches = mergeMatchLists(next?.matches, prev?.matches).slice(0, 10)
  const prevBuilds = prev?.builds && Object.keys(prev.builds).length
  const nextBuilds = next.builds && Object.keys(next.builds).length
  if (!nextBuilds && prevBuilds) out.builds = prev.builds
  return applyRecorte(out)
}

function healState(s) {
  if (!s) return s
  return {
    ...s,
    club: s.club ? { ...s.club, name: fixEaText(s.club.name || '') } : s.club,
    ea: applyRecorte(fixEaTree(s.ea || {})),
    history: Array.isArray(s.history) ? s.history : [],
    players: Array.isArray(s.players)
      ? s.players.map((p) => ({
          ...p,
          name: fixEaText(p.name || ''),
          psn: p.psn ? fixEaText(p.psn) : p.psn,
        }))
      : s.players,
  }
}

export function useStore() {
  const [activeClubId, setActiveClubId] = useState(String(XV_CLUB.clubId))
  const activeRef = useRef(activeClubId)
  useEffect(() => {
    activeRef.current = activeClubId
  }, [activeClubId])

  const [bags, setBags] = useState(() => {
    const loaded = loadAllClubStates()
    const next = {}
    for (const [id, bag] of Object.entries(loaded)) next[id] = healState(bag)
    return next
  })

  const state = bags[activeClubId] || emptyClubState(clubById(activeClubId))
  const healed = useMemo(() => healState(state), [state])

  useEffect(() => {
    saveClubState(clubById(activeClubId), healed)
  }, [activeClubId, healed])

  const patch = useCallback((fn) => {
    setBags((prev) => {
      const id = activeRef.current
      const cur = prev[id] || emptyClubState(clubById(id))
      const nxt = fn(cur)
      if (nxt === cur) return prev
      return { ...prev, [id]: nxt }
    })
  }, [])

  const switchClub = useCallback((clubId) => {
    const id = String(clubId)
    activeRef.current = id
    setBags((prev) => {
      if (prev[id]) return prev
      return { ...prev, [id]: healState(emptyClubState(clubById(id))) }
    })
    setActiveClubId(id)
  }, [])

  const addPlayer = useCallback((player) => {
    patch((s) => ({
      ...s,
      players: [
        ...s.players,
        {
          id: uid(),
          extraPositions: [],
          stats: null,
          ...player,
        },
      ],
    }))
  }, [patch])

  const updatePlayer = useCallback((id, next) => {
    patch((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === id ? { ...p, ...next } : p)),
    }))
  }, [patch])

  const removePlayer = useCallback((id) => {
    patch((s) => {
      const lineup = { ...s.lineup }
      Object.keys(lineup).forEach((slot) => {
        if (lineup[slot] === id) delete lineup[slot]
      })
      return {
        ...s,
        players: s.players.filter((p) => p.id !== id),
        lineup,
      }
    })
  }, [patch])

  const setFormation = useCallback((formation) => {
    patch((s) => ({ ...s, formation, lineup: {} }))
  }, [patch])

  const assignPlayer = useCallback((slotId, playerId) => {
    patch((s) => {
      const lineup = { ...s.lineup }
      Object.keys(lineup).forEach((k) => {
        if (lineup[k] === playerId) delete lineup[k]
      })
      lineup[slotId] = playerId
      return { ...s, lineup }
    })
  }, [patch])

  const clearSlot = useCallback((slotId) => {
    patch((s) => {
      const lineup = { ...s.lineup }
      delete lineup[slotId]
      return { ...s, lineup }
    })
  }, [patch])

  const resetLineup = useCallback(() => {
    patch((s) => ({ ...s, lineup: {} }))
  }, [patch])

  const setClub = useCallback((club) => {
    patch((s) => ({ ...s, club: { ...s.club, ...club } }))
  }, [patch])

  const upsertFromEa = useCallback((members, extra = {}) => {
    patch((s) => {
      const nextId = String(extra.club?.clubId || extra.ea?.clubId || s.club.clubId || '')
      const clubChanged = Boolean(s.club.clubId && nextId && nextId !== String(s.club.clubId))
      const list = members || []
      const players = []
      if (list.length) {
        list.forEach((m) => {
          const key = (m.name || '').trim().toLowerCase()
          if (!key) return
          const old = (clubChanged ? [] : s.players).find(
            (p) =>
              p.name.trim().toLowerCase() === key ||
              (p.psn && p.psn.trim().toLowerCase() === key),
          )
          const stats = {
            games: m.games,
            winRate: m.winRate,
            goals: m.goals,
            assists: m.assists,
            rating: m.rating,
            motm: m.motm,
            cleanSheetsDef: m.cleanSheetsDef,
            cleanSheetsGK: m.cleanSheetsGK,
            shotSuccess: m.shotSuccess,
            passes: m.passes,
            passSuccess: m.passSuccess,
            tackles: m.tackles,
            tackleSuccess: m.tackleSuccess,
            redCards: m.redCards,
            proOverall: m.proOverall,
            proHeight: m.proHeight,
            proNationality: m.proNationality,
            proPos: m.proPos,
            proStyle: m.proStyle,
            favoritePosition: m.favoritePosition,
            lastTenGoals: m.lastTenGoals || [],
            lastTenSum: m.lastTenSum || 0,
            build: m.build || extra.ea?.builds?.[(m.name || '').trim().toLowerCase()] || null,
            career: m.career || null,
            source: 'EA Pro Clubs',
          }
          players.push({
            id: old?.id || uid(),
            name: m.name,
            psn: old?.psn || m.psn || m.name,
            primaryPos: old?.primaryPos || guessPos(m.favoritePosition),
            secondaryPos: old?.secondaryPos || '',
            extraPositions: old?.extraPositions || [],
            stats,
          })
        })
      } else if (!clubChanged) {
        players.push(...s.players)
      }
      const keepIds = new Set(players.map((p) => p.id))
      const lineup = { ...s.lineup }
      Object.keys(lineup).forEach((slot) => {
        if (!keepIds.has(lineup[slot])) delete lineup[slot]
      })
      return {
        ...s,
        players,
        lineup,
        club: {
          ...s.club,
          lastSync: new Date().toISOString(),
          ...Object.fromEntries(
            Object.entries(extra.club || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
          ),
        },
        ea: keepLastEa(clubChanged ? {} : s.ea, extra.ea),
        history: mergeHistory(
          clubChanged ? [] : s.history,
          extra.ea?.matches,
          extra.ea?.rivalMatches,
          isXvClubId(nextId) ? recorteHistoryMatches() : [],
        ),
      }
    })
  }, [patch])

  const mergeMatchHistory = useCallback((matches) => {
    patch((s) => ({
      ...s,
      history: mergeHistory(s.history, matches),
    }))
  }, [patch])

  const slots = useMemo(
    () => FORMATIONS[state.formation] || FORMATIONS['4-2-3-1'],
    [state.formation],
  )

  const assignedIds = useMemo(
    () => new Set(Object.values(state.lineup)),
    [state.lineup],
  )

  return {
    ...healed,
    activeClubId,
    slots,
    assignedIds,
    switchClub,
    addPlayer,
    updatePlayer,
    removePlayer,
    setFormation,
    assignPlayer,
    clearSlot,
    resetLineup,
    setClub,
    upsertFromEa,
    mergeMatchHistory,
  }
}

function guessPos(raw) {
  if (!raw) return 'CM'
  const v = String(raw).toUpperCase()
  const map = {
    goalkeeper: 'GK',
    defender: 'CB',
    midfielder: 'CM',
    forward: 'ST',
    any: 'CM',
  }
  return map[v.toLowerCase()] || v
}
