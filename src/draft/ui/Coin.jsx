import { useId } from 'react'

// Moeda do Draft: disco dourado com borda serrilhada e "XV" cunhado no centro.
export function CoinIcon({ size = 16, className = '' }) {
  const id = useId().replace(/:/g, '')
  const teeth = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2
    return `${50 + Math.cos(a) * 47},${50 + Math.sin(a) * 47}`
  })
  return (
    <svg className={`coin-icon ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-face`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="0.35" stopColor="#ffd60a" />
          <stop offset="0.8" stopColor="#d99a00" />
          <stop offset="1" stopColor="#a86f00" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe9a0" />
          <stop offset="1" stopColor="#8a5a00" />
        </linearGradient>
      </defs>
      <polygon points={teeth.join(' ')} fill={`url(#${id}-rim)`} stroke="#7a4f00" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="41" fill={`url(#${id}-face)`} />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#a86f00" strokeOpacity="0.55" strokeWidth="2.5" />
      <text
        x="50"
        y="61"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif"
        fontSize="30"
        fontWeight="900"
        letterSpacing="-1"
        fill="#8a5a00"
        stroke="#fff3b0"
        strokeOpacity="0.6"
        strokeWidth="1"
      >
        XV
      </text>
      <path d="M28 30 A28 28 0 0 1 58 20" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

// Valor em XV-Coins com a moeda ao lado. "signed" mostra + e − e pinta entrada/saída.
export function Coins({ value, size = 15, signed = false, className = '' }) {
  const n = Number(value || 0)
  const tone = signed ? (n > 0 ? ' in' : n < 0 ? ' out' : '') : ''
  const text = `${signed && n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('pt-BR')}`
  return (
    <span className={`coins${tone} ${className}`} title={`${n.toLocaleString('pt-BR')} XV-Coins`}>
      <CoinIcon size={size} />
      <span className="coins-value">{text}</span>
      <span className="sr-only"> XV-Coins</span>
    </span>
  )
}

// Carteira do clube no topo do Draft.
export function WalletCard({ spendable, reserved }) {
  return (
    <div className="wallet-card">
      <CoinIcon size={46} className="wallet-coin" />
      <div>
        <span className="wallet-label">Carteira</span>
        <b className="wallet-amount">{Number(spendable || 0).toLocaleString('pt-BR')}</b>
        <span className="wallet-unit">XV-Coins disponíveis</span>
        {reserved ? (
          <span className="wallet-reserved">
            <Coins value={reserved} size={12} /> reservados em lances e propostas
          </span>
        ) : null}
      </div>
    </div>
  )
}
