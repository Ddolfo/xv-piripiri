import { useCallback, useEffect, useMemo, useState } from 'react'
import { FORMATIONS } from '../data/formations'
import { loadState, saveState, uid } from '../lib/storage'

export function useStore() {
  const [state, setState] = useState(() => loadState())

  useEffect(() => {
    saveState(state)
  }, [state])

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

  const upsertFromEa = useCallback((members) => {
    setState((s) => {
      const players = [...s.players]
      members.forEach((m) => {
        const key = (m.name || '').trim().toLowerCase()
        if (!key) return
        const idx = players.findIndex(
          (p) =>
            p.name.trim().toLowerCase() === key ||
            (p.psn && p.psn.trim().toLowerCase() === key),
        )
        const stats = {
          games: m.games,
          goals: m.goals,
          assists: m.assists,
          rating: m.rating,
          motm: m.motm,
          favoritePosition: m.favoritePosition,
          source: 'EA Pro Clubs',
        }
        if (idx >= 0) {
          players[idx] = {
            ...players[idx],
            stats,
            psn: players[idx].psn || m.psn || players[idx].name,
          }
        } else {
          players.push({
            id: uid(),
            name: m.name,
            psn: m.psn || m.name,
            primaryPos: guessPos(m.favoritePosition),
            secondaryPos: '',
            extraPositions: [],
            stats,
          })
        }
      })
      return {
        ...s,
        players,
        club: { ...s.club, lastSync: new Date().toISOString() },
      }
    })
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
    ...state,
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
