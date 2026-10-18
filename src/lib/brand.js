import { CARMO_CLUB, isXvClubId } from './eaApi'

export const LOGO_SRC = `${import.meta.env.BASE_URL}sem-fundo.png`
export const BARCARENA_LOGO_SRC = `${import.meta.env.BASE_URL}barcarena-mark.svg`

// Escudo do Carmo do Cajuru baixado da EA (crestAssetId 99161105).
export const CARMO_LOGO_SRC = `${import.meta.env.BASE_URL}carmo-crest.png`

export function clubLogoSrc(club) {
  const id = club?.clubId || club
  if (isXvClubId(id)) return LOGO_SRC
  if (String(id) === CARMO_CLUB.clubId) return CARMO_LOGO_SRC
  return BARCARENA_LOGO_SRC
}
