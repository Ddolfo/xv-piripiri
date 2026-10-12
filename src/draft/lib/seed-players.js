import catalog from '../data/ea-fc27-players.json' with { type: 'json' }
import { PLAYER_STATUS } from './constants.js'

export const PLAYER_BANK_VERSION = 'ea-fc27-1'

export function buildPlayerBank() {
  return catalog.map((row) => ({
    id: row.id,
    eaId: row.eaId || null,
    name: row.name,
    overall: Number(row.overall),
    position: row.position || 'CM',
    image: row.image || null,
    shield: row.shield || null,
    nation: row.nation || null,
    club: row.club || null,
    league: row.league || null,
    pace: Number(row.pace || row.overall),
    shooting: Number(row.shooting || row.overall),
    passing: Number(row.passing || row.overall),
    dribbling: Number(row.dribbling || row.overall),
    defending: Number(row.defending || row.overall),
    physical: Number(row.physical || row.overall),
    status: PLAYER_STATUS.FREE,
    clubId: null,
    history: [],
  }))
}

export function playersByBand(players, min, max, { freeOnly = true, excludeIds = new Set() } = {}) {
  return players.filter((p) => {
    if (excludeIds.has(p.id)) return false
    if (freeOnly && p.status !== PLAYER_STATUS.FREE) return false
    if (p.clubId) return false
    return p.overall >= min && p.overall <= max
  })
}
