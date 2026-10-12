import { isXvClubId } from './eaApi'

export const LOGO_SRC = `${import.meta.env.BASE_URL}sem-fundo.png`
export const BARCARENA_LOGO_SRC = `${import.meta.env.BASE_URL}barcarena-mark.svg`

export function clubLogoSrc(club) {
  const id = club?.clubId || club
  if (isXvClubId(id)) return LOGO_SRC
  return BARCARENA_LOGO_SRC
}
