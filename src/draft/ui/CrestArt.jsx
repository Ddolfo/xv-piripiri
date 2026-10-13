import { useId } from 'react'

// Silhuetas no quadro 200×200, deixando o topo livre para as estrelas de título.
const SHAPE_PATH = {
  classico: 'M34 26 H166 Q174 26 174 34 V104 C174 148 142 176 100 194 C58 176 26 148 26 104 V34 Q26 26 34 26 Z',
  moderno: 'M52 24 H148 L176 46 V108 C176 150 144 178 100 196 C56 178 24 150 24 108 V46 Z',
  redondo: 'M100 22 A86 86 0 1 1 99.99 22 Z',
  italiano: 'M100 20 L172 40 V118 C172 156 140 182 100 196 C60 182 28 156 28 118 V40 Z',
  frances: 'M28 26 H172 V136 C172 152 164 162 150 170 L100 196 L50 170 C36 162 28 152 28 136 Z',
  hexagono: 'M100 20 L174 60 V146 L100 194 L26 146 V60 Z',
}

export function shapePath(shape) {
  return SHAPE_PATH[shape] || SHAPE_PATH.classico
}

function Pattern({ id, color }) {
  if (id === 'listras') {
    return (
      <g fill={color}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={40 + i * 36} y="0" width="18" height="200" />
        ))}
      </g>
    )
  }
  if (id === 'faixas') {
    return (
      <g fill={color}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="0" y={44 + i * 40} width="200" height="20" />
        ))}
      </g>
    )
  }
  if (id === 'diagonal') return <polygon fill={color} points="0,40 40,0 200,160 160,200" />
  if (id === 'faixa') return <rect fill={color} x="76" y="0" width="48" height="200" />
  if (id === 'meio') return <rect fill={color} x="100" y="0" width="100" height="200" />
  if (id === 'quartos') {
    return (
      <g fill={color}>
        <rect x="100" y="0" width="100" height="104" />
        <rect x="0" y="104" width="100" height="100" />
      </g>
    )
  }
  if (id === 'chevron') return <polygon fill={color} points="0,96 100,150 200,96 200,132 100,186 0,132" />
  return null
}

// Símbolos desenhados em torno da origem, cabendo num quadrado de ~80.
function Symbol({ id, color, outline }) {
  const stroke = { stroke: outline, strokeWidth: 5, strokeLinejoin: 'round', paintOrder: 'stroke' }
  if (id === 'bola') {
    return (
      <g>
        <circle r="34" fill={color} {...stroke} />
        <polygon points="0,-13 12.4,-4 7.6,10.5 -7.6,10.5 -12.4,-4" fill={outline} />
        <g stroke={outline} strokeWidth="3.4" strokeLinecap="round">
          <line x1="0" y1="-13" x2="0" y2="-33" />
          <line x1="12.4" y1="-4" x2="31" y2="-10" />
          <line x1="7.6" y1="10.5" x2="19" y2="27" />
          <line x1="-7.6" y1="10.5" x2="-19" y2="27" />
          <line x1="-12.4" y1="-4" x2="-31" y2="-10" />
        </g>
      </g>
    )
  }
  if (id === 'estrela') {
    return <polygon fill={color} {...stroke} points="0,-40 11,-13 40,-12 17,6 25,35 0,18 -25,35 -17,6 -40,-12 -11,-13" />
  }
  if (id === 'coroa') {
    return (
      <g fill={color} {...stroke}>
        <path d="M-40 22 L-44 -18 L-22 0 L0 -32 L22 0 L44 -18 L40 22 Z" />
        <rect x="-40" y="26" width="80" height="10" rx="2" />
      </g>
    )
  }
  if (id === 'raio') return <polygon fill={color} {...stroke} points="10,-42 -26,6 -4,6 -12,42 26,-8 4,-8" />
  if (id === 'chama') {
    return (
      <path
        fill={color}
        {...stroke}
        d="M2 -42 C10 -20 30 -12 30 12 C30 30 16 42 0 42 C-16 42 -30 30 -30 12 C-30 -4 -18 -10 -16 -26 C-8 -16 -6 -8 -2 -4 C4 -16 6 -28 2 -42 Z"
      />
    )
  }
  if (id === 'controle') {
    return (
      <g>
        <path
          fill={color}
          {...stroke}
          d="M-26 -20 H26 C38 -20 46 -8 48 6 L52 26 C54 36 44 42 36 34 L26 22 H-26 L-36 34 C-44 42 -54 36 -52 26 L-48 6 C-46 -8 -38 -20 -26 -20 Z"
        />
        <g fill={outline}>
          <rect x="-34" y="-4" width="18" height="6" rx="2" />
          <rect x="-28" y="-10" width="6" height="18" rx="2" />
          <circle cx="24" cy="-6" r="4" />
          <circle cx="34" cy="2" r="4" />
          <circle cx="16" cy="4" r="4" />
        </g>
      </g>
    )
  }
  if (id === 'torre') {
    return (
      <path
        fill={color}
        {...stroke}
        d="M-30 40 V-6 H-36 V-38 H-24 V-28 H-6 V-38 H6 V-28 H24 V-38 H36 V-6 H30 V40 Z M-8 40 V18 A8 8 0 0 1 8 18 V40 Z"
        fillRule="evenodd"
      />
    )
  }
  return null
}

function luminance(hex) {
  const n = parseInt(String(hex || '#000000').slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

const textOn = (hex) => (luminance(hex) > 0.45 ? '#111111' : '#ffffff')
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, 'Segoe UI', sans-serif"

export default function CrestArt({ crest, title = 'Escudo', size = 72 }) {
  const uid = useId().replace(/:/g, '')
  const path = shapePath(crest.shape)
  const { primary, secondary, accent } = crest
  const outline = '#0b0b0c'
  const hasSymbol = crest.symbol && crest.symbol !== 'nenhum'
  const mono = crest.monogram || ''
  const ribbon = crest.ribbon || ''
  // Com faixa, o conteúdo sobe um pouco para dar espaço.
  const lift = ribbon ? -10 : 0
  const monoSize = mono.length >= 4 ? 30 : mono.length === 3 ? 36 : 44

  return (
    <svg className="crest-mark" width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <clipPath id={`${uid}-clip`}>
          <path d={path} />
        </clipPath>
        <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="0.46" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>

      {/* Borda: contorno escuro, aro no destaque e o campo por cima. */}
      <path d={path} fill={outline} stroke={outline} strokeWidth="14" strokeLinejoin="round" />
      <path d={path} fill={accent} stroke={accent} strokeWidth="7" strokeLinejoin="round" />
      <g clipPath={`url(#${uid}-clip)`}>
        <path d={path} fill={primary} />
        <Pattern id={crest.pattern} color={secondary} />
        <rect x="0" y="0" width="200" height="200" fill={`url(#${uid}-gloss)`} />
      </g>
      <path d={path} fill="none" stroke={outline} strokeOpacity="0.55" strokeWidth="2.5" />

      {hasSymbol && mono ? (
        <>
          <text
            x="100"
            y={74 + lift}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize={monoSize * 0.62}
            fontWeight="800"
            letterSpacing="2"
            fill={accent}
            stroke={outline}
            strokeWidth="4"
            paintOrder="stroke"
          >
            {mono}
          </text>
          <g transform={`translate(100 ${124 + lift}) scale(0.92)`}>
            <Symbol id={crest.symbol} color={accent} outline={outline} />
          </g>
        </>
      ) : hasSymbol ? (
        <g transform={`translate(100 ${108 + lift}) scale(1.12)`}>
          <Symbol id={crest.symbol} color={accent} outline={outline} />
        </g>
      ) : mono ? (
        <text
          x="100"
          y={108 + lift + monoSize * 0.36}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={monoSize * 1.25}
          fontWeight="800"
          letterSpacing="1"
          fill={accent}
          stroke={outline}
          strokeWidth="6"
          paintOrder="stroke"
        >
          {mono}
        </text>
      ) : null}

      {ribbon ? (
        <g>
          <path d="M8 150 L22 146 L22 176 L8 180 L16 165 Z" fill={outline} opacity="0.85" />
          <path d="M192 150 L178 146 L178 176 L192 180 L184 165 Z" fill={outline} opacity="0.85" />
          <path d="M18 144 Q100 132 182 144 L182 172 Q100 160 18 172 Z" fill={accent} stroke={outline} strokeWidth="3" strokeLinejoin="round" />
          <text
            x="100"
            y="162"
            textAnchor="middle"
            fontFamily={FONT}
            fontSize="15"
            fontWeight="800"
            letterSpacing="1.5"
            fill={textOn(accent)}
            textLength={Math.min(150, ribbon.length * 11)}
            lengthAdjust="spacingAndGlyphs"
          >
            {ribbon}
          </text>
        </g>
      ) : null}

      {crest.stars ? (
        <g fill={accent} stroke={outline} strokeWidth="2" paintOrder="stroke">
          {Array.from({ length: crest.stars }, (_, i) => {
            const x = 100 + (i - (crest.stars - 1) / 2) * 18
            return <polygon key={i} transform={`translate(${x} 11)`} points="0,-8 2.4,-2.6 8,-2.4 3.6,1.2 5,7 0,3.8 -5,7 -3.6,1.2 -8,-2.4 -2.4,-2.6" />
          })}
        </g>
      ) : null}
    </svg>
  )
}
