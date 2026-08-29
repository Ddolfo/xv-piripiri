import { nationFlagUrl, playerInitials } from '../lib/eaApi'

function contrastOn(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length < 6) return '#111'
  const n = parseInt(h.slice(0, 6), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return light > 0.62 ? '#111' : '#ffd200'
}

export default function PlayerMark({ name, nationId, colors, size = 56 }) {
  const bg = colors?.[0] || '#ffd200'
  const ring = colors?.[1] || '#111'
  const flag = nationFlagUrl(nationId)
  return (
    <span
      className="player-mark"
      style={{ width: size, height: size, fontSize: size, '--mark-ring': ring }}
    >
      <i className="player-mark-face" style={{ background: bg, color: contrastOn(bg) }}>
        {playerInitials(name)}
      </i>
      {flag ? (
        <img className="player-mark-flag" src={flag} alt="" />
      ) : null}
    </span>
  )
}
