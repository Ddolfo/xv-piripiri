import { useId } from 'react'
import { divisionLabel } from '../lib/eaApi'

// Metal do escudo por faixa de divisão: bronze embaixo, prata no meio, ouro em cima,
// e a Elite em preto com borda de ouro e coroa.
const METALS = {
  bronze: { top: '#e3a06a', bottom: '#8a4f28', rim: '#f2c49b', ink: '#3b1f0c' },
  silver: { top: '#f4f5f7', bottom: '#8e949d', rim: '#ffffff', ink: '#2a2d33' },
  gold: { top: '#ffe58a', bottom: '#c99112', rim: '#fff3c2', ink: '#3d2a00' },
  elite: { top: '#3a3a3c', bottom: '#0b0b0c', rim: '#ffd60a', ink: '#ffd60a' },
}

// Código da EA: 1 = Elite, 2 = Divisão 1 … 11 = Divisão 10.
function tierOf(code) {
  const n = Number(code)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n === 1) return { metal: 'elite', number: null, star: false }
  const division = n - 1
  if (division >= 8) return { metal: 'bronze', number: division, star: false }
  if (division >= 5) return { metal: 'silver', number: division, star: false }
  return { metal: 'gold', number: division, star: division === 1 }
}

const SHIELD = 'M24 3 L41 9 V24 C41 34.5 33.8 41.6 24 45 C14.2 41.6 7 34.5 7 24 V9 Z'

export default function DivisionBadge({ code, size = 32, title }) {
  const id = useId()
  const tier = tierOf(code)
  const label = title || divisionLabel(code)
  if (!tier) return null
  const m = METALS[tier.metal]
  const fill = `${id}-fill`
  const shine = `${id}-shine`

  return (
    <svg
      className={`division-badge ${tier.metal}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.top} />
          <stop offset="1" stopColor={m.bottom} />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={SHIELD} fill={`url(#${fill})`} stroke={m.rim} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M24 6.5 L38 11.4 V23 C38 27 36.6 30.4 34 33 L14 12.6 Z" fill={`url(#${shine})`} />
      {tier.metal === 'elite' ? (
        <path
          d="M14.5 30 L13 18.5 L19.2 23.4 L24 15 L28.8 23.4 L35 18.5 L33.5 30 Z M15 32.5 H33 V35 H15 Z"
          fill={m.ink}
        />
      ) : (
        <text
          x="24"
          y={tier.star ? 35.5 : 30.5}
          textAnchor="middle"
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif"
          fontSize={tier.star ? 16 : tier.number >= 10 ? 15 : 19}
          fontWeight="700"
          letterSpacing="-0.5"
          fill={m.ink}
        >
          {tier.number}
        </text>
      )}
      {tier.star ? (
        <path
          d="M24 11.2 L25.4 14.2 L28.6 14.5 L26.2 16.6 L26.9 19.8 L24 18.1 L21.1 19.8 L21.8 16.6 L19.4 14.5 L22.6 14.2 Z"
          fill={m.ink}
        />
      ) : null}
    </svg>
  )
}
