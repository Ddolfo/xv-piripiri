import { FORMATIONS } from '../../data/formations.js'

// Campinho com as 11 posições da formação, visto de baixo para cima (goleiro embaixo).
function MiniPitch({ slots }) {
  return (
    <svg className="mini-pitch" viewBox="0 0 100 130" aria-hidden="true">
      <rect x="1" y="1" width="98" height="128" rx="8" className="mini-pitch-turf" />
      <line x1="1" y1="65" x2="99" y2="65" className="mini-pitch-line" />
      <circle cx="50" cy="65" r="11" className="mini-pitch-line" />
      <rect x="28" y="108" width="44" height="21" className="mini-pitch-line" />
      <rect x="28" y="1" width="44" height="21" className="mini-pitch-line" />
      {slots.map((s) => (
        <g key={s.id} transform={`translate(${s.x} ${128 - s.y * 1.32})`}>
          <circle r="5.2" className={s.code === 'GK' ? 'mini-dot gk' : 'mini-dot'} />
        </g>
      ))}
    </svg>
  )
}

function lineSummary(slots) {
  const counts = {}
  for (const s of slots) if (s.code !== 'GK') counts[s.code] = (counts[s.code] || 0) + 1
  return Object.entries(counts)
    .map(([code, n]) => (n > 1 ? `${n} ${code}` : code))
    .join(' · ')
}

export default function FormationPicker({ value, onChange }) {
  return (
    <div className="formation-picker" role="radiogroup" aria-label="Formação preferida">
      {Object.entries(FORMATIONS).map(([id, slots]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className={`formation-option${value === id ? ' on' : ''}`}
          onClick={() => onChange(id)}
        >
          <MiniPitch slots={slots} />
          <b>{id}</b>
          <small>{lineSummary(slots)}</small>
        </button>
      ))}
    </div>
  )
}
