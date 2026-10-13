// Busca nomes de clubes e jogadores a partir do snapshot do Draft.
export function useNames(snap) {
  const clubs = snap.clubs || []
  const players = [...(snap.club?.roster || []), ...clubs.flatMap((c) => c.roster || []), ...(snap.players || [])]
  return {
    club: (id) => clubs.find((c) => c.id === id) || (snap.club?.id === id ? snap.club : null),
    clubName: (id) => clubs.find((c) => c.id === id)?.name || (snap.club?.id === id ? snap.club.name : 'Clube'),
    playerName: (id) => players.find((p) => p.id === id)?.name || null,
    playerPosition: (id) => players.find((p) => p.id === id)?.position || null,
  }
}
