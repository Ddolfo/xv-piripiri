import { useId } from 'react'
import { layerGeom, pathFor } from './crest-lib.js'

function LayerShape({ layer, secondary = '#111' }) {
  const fill = layer.fill || secondary
  if (layer.type === 'stripe') return <rect x="-100" y="-22" width="200" height="44" fill={fill} />
  if (layer.type === 'bar') return <rect x="-14" y="-80" width="28" height="160" fill={fill} />
  if (layer.type === 'diagonal') return <polygon points="-110,-28 110,28 110,52 -110,-4" fill={fill} />
  if (layer.type === 'chevron') return <polygon points="0,-38 92,42 70,58 0,-4 -70,58 -92,42" fill={fill} />
  if (layer.type === 'cross') {
    return (
      <g fill={fill}>
        <rect x="-12" y="-70" width="24" height="140" />
        <rect x="-70" y="-12" width="140" height="24" />
      </g>
    )
  }
  if (layer.type === 'star') {
    return <polygon fill={fill} points="0,-34 10,0 46,0 16,22 28,58 0,36 -28,58 -16,22 -46,0 -10,0" />
  }
  if (layer.type === 'ball') return <circle cx="0" cy="0" r="28" fill={fill} />
  if (layer.type === 'ring') {
    return <circle cx="0" cy="0" r="34" fill="none" stroke={fill} strokeWidth="10" />
  }
  if (layer.type === 'crown') {
    return <polygon fill={fill} points="-40,18 -40,-6 -22,10 -2,-22 18,10 38,-6 38,18" />
  }
  if (layer.type === 'letter') {
    return (
      <text
        x="0"
        y="8"
        textAnchor="middle"
        fontFamily="Oswald, sans-serif"
        fontSize="54"
        fontWeight="700"
        fill={fill}
      >
        {String(layer.text || 'XV').slice(0, 3)}
      </text>
    )
  }
  return null
}

export default function CrestMark({ crest, size = 72, title = 'Emblema', selectedId, onSelect, onPointerDownLayer }) {
  const shape = crest?.shape || 'heater'
  const layers = (crest?.layers || []).filter((layer) => layer.type && layer.type !== 'shape')
  const primary = crest?.primary || '#ffd200'
  const secondary = crest?.secondary || '#111'
  const clipId = useId().replace(/:/g, '')
  const interactive = Boolean(onSelect || onPointerDownLayer)

  return (
    <svg
      className={`crest-mark${interactive ? ' crest-mark-live' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={title}
    >
      <defs>
        <clipPath id={`crest-clip-${clipId}`}>
          <path d={pathFor(shape)} />
        </clipPath>
      </defs>
      <path d={pathFor(shape)} fill={primary} stroke="#0b0c10" strokeWidth="6" />
      <g clipPath={`url(#crest-clip-${clipId})`}>
        {layers.map((layer, i) => {
          const geom = layerGeom(layer)
          const id = layer.id || `i${i}`
          return (
            <g
              key={id}
              data-layer={id}
              transform={`translate(${geom.x} ${geom.y}) rotate(${geom.rotate}) scale(${geom.scale})`}
              onPointerDown={onPointerDownLayer ? (e) => onPointerDownLayer(e, layer, i) : undefined}
              onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(id) } : undefined}
              style={interactive ? { cursor: 'grab' } : undefined}
            >
              <LayerShape layer={layer} secondary={secondary} />
              {selectedId && selectedId === id ? (
                <circle r="46" fill="none" stroke="#ffd200" strokeWidth="2" strokeDasharray="4 4" opacity="0.9" />
              ) : null}
            </g>
          )
        })}
      </g>
      {interactive ? (
        <path d={pathFor(shape)} fill="transparent" stroke="#ffd200" strokeWidth="2" pointerEvents="none" opacity="0.35" />
      ) : null}
    </svg>
  )
}
