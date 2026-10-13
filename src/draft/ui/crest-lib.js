export function pathFor(shape) {
  if (shape === 'circle') return 'M100 18 A82 82 0 1 1 99.9 18 Z'
  if (shape === 'diamond') return 'M100 12 L188 100 L100 188 L12 100 Z'
  if (shape === 'classic') return 'M24 28 L176 28 L176 118 C176 168 100 196 100 196 C100 196 24 168 24 118 Z'
  return 'M32 22 H168 L178 36 V112 C178 162 100 194 100 194 C100 194 22 162 22 112 V36 Z'
}

export function defaultLayerY(type) {
  if (type === 'star') return 82
  if (type === 'ball') return 108
  if (type === 'letter') return 122
  if (type === 'crown') return 44
  if (type === 'ring') return 108
  return 100
}

export function layerGeom(layer) {
  return {
    x: Number.isFinite(layer?.x) ? layer.x : 100,
    y: Number.isFinite(layer?.y) ? layer.y : defaultLayerY(layer?.type),
    scale: Number.isFinite(layer?.scale) ? layer.scale : 1,
    rotate: Number.isFinite(layer?.rotate) ? layer.rotate : 0,
  }
}
