import { useCallback, useEffect, useMemo, useState } from 'react'
import { FORMATIONS } from '../data/formations'
import {
  applyRecorte,
  fixEaText,
  fixEaTree,
  isHollowOverall,
  isHollowSeason,
  mergeMatchLists,
} from '../lib/eaApi'
import { mergeHistory } from '../lib/rivals'
import { loadState, saveState, uid } from '../lib/storage'

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
  const [state, setState] = useState(() => healState(loadState()))
  const healed = useMemo(() => healState(state), [state])

  useEffect(() => {
    saveState(healed)
  }, [healed])

  const addPlayer = useCallback((player) => {
    setState((s) => ({
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
  }, [])

  const updatePlayer = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }, [])

  const removePlayer = useCallback((id) => {
    setState((s) => {
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
  }, [])

  const setFormation = useCallback((formation) => {
    setState((s) => ({ ...s, formation, lineup: {} }))
  }, [])

  const assignPlayer = useCallback((slotId, playerId) => {
    setState((s) => {
      const lineup = { ...s.lineup }
      Object.keys(lineup).forEach((k) => {
        if (lineup[k] === playerId) delete lineup[k]
      })
      lineup[slotId] = playerId
      return { ...s, lineup }
    })
  }, [])

  const clearSlot = useCallback((slotId) => {
    setState((s) => {
      const lineup = { ...s.lineup }
      delete lineup[slotId]
      return { ...s, lineup }
    })
  }, [])

  const resetLineup = useCallback(() => {
    setState((s) => ({ ...s, lineup: {} }))
  }, [])

  const setClub = useCallback((club) => {
    setState((s) => ({ ...s, club: { ...s.club, ...club } }))
  }, [])

  const upsertFromEa = useCallback((members, extra = {}) => {
    setState((s) => {
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
        history: clubChanged
          ? mergeHistory([], extra.ea?.matches)
          : mergeHistory(s.history, extra.ea?.matches),
      }
    })
  }, [])

  const mergeMatchHistory = useCallback((matches) => {
    setState((s) => ({
      ...s,
      history: mergeHistory(s.history, matches),
    }))
  }, [])

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
    slots,
    assignedIds,
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
