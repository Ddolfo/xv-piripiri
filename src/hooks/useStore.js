import { useCallback, useEffect, useMemo, useState } from 'react'
import { FORMATIONS } from '../data/formations'
import { fixEaText, fixEaTree } from '../lib/eaApi'
import { loadState, saveState, uid } from '../lib/storage'

function healState(s) {
  if (!s) return s
  return {
    ...s,
    club: s.club ? { ...s.club, name: fixEaText(s.club.name || '') } : s.club,
    ea: s.ea ? fixEaTree(s.ea) : s.ea,
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
        club: {
          ...s.club,
          lastSync: new Date().toISOString(),
          ...(extra.club || {}),
        },
        ea: {
          ...s.ea,
          ...(extra.ea || {}),
        },
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
