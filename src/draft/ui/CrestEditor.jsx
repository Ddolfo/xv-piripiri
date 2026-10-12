import { useRef, useState } from 'react'
import { CREST_COLOR_MAX, CREST_COLOR_MIN } from '../lib/constants.js'
import { uniqueColors } from '../lib/util.js'
import { SHIELD_SHAPES, defaultLayerY, emptyCrest, layerGeom } from './crest-lib.js'
import CrestMark from './CrestMark.jsx'

const PIECES = [
  { type: 'stripe', label: 'Faixa' },
  { type: 'bar', label: 'Pilar' },
  { type: 'diagonal', label: 'Banda' },
  { type: 'chevron', label: 'Chevron' },
  { type: 'cross', label: 'Cruz' },
  { type: 'star', label: 'Estrela' },
  { type: 'ball', label: 'Bola' },
  { type: 'ring', label: 'Anel' },
  { type: 'crown', label: 'Coroa' },
  { type: 'letter', label: 'Iniciais' },
]

function pieceId() {
  return `ly_${Math.random().toString(36).slice(2, 9)}`
}

function ensureLayers(crest, primary, secondary) {
  const layers = (crest?.layers || [])
    .filter((l) => l.type && l.type !== 'shape')
    .map((l, i) => ({
      ...l,
      id: l.id || `ly_${i}`,
      x: Number.isFinite(l.x) ? l.x : 100,
      y: Number.isFinite(l.y) ? l.y : defaultLayerY(l.type),
      scale: Number.isFinite(l.scale) ? l.scale : 1,
      rotate: Number.isFinite(l.rotate) ? l.rotate : 0,
    }))
  return {
    shape: crest?.shape || 'heater',
    primary,
    secondary,
    layers,
  }
}

function clientToViewBox(svg, clientX, clientY) {
  const rect = svg.getBoundingClientRect()
  if (!rect.width || !rect.height) return { x: 100, y: 100 }
  return {
    x: ((clientX - rect.left) / rect.width) * 200,
    y: ((clientY - rect.top) / rect.height) * 200,
  }
}

export default function CrestEditor({ primary, secondary, value, onChange }) {
  const crest = ensureLayers(value || emptyCrest(primary, secondary), primary, secondary)
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [selectedId, setSelectedId] = useState(crest.layers[crest.layers.length - 1]?.id || null)
  const [liveLayers, setLiveLayers] = useState(null)
  const drag = useRef(null)
  const svgWrap = useRef(null)
  const layers = liveLayers || crest.layers
  const liveCrest = { ...crest, layers, primary, secondary }
  const colors = uniqueColors(liveCrest)
  const selected = layers.find((l) => l.id === selectedId) || null
  const palette = [primary, secondary, '#f4f4f6', '#111111', '#8b1e1e', '#1c4b9b'].filter(
    (c, i, arr) => arr.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i,
  )

  function commit(next, { keepFuture = false } = {}) {
    setPast((p) => [...p.slice(-30), crest])
    if (!keepFuture) setFuture([])
    setLiveLayers(null)
    onChange({ ...next, primary, secondary })
  }

  function undo() {
    if (!past.length) return
    const prev = past[past.length - 1]
    setPast(past.slice(0, -1))
    setFuture((f) => [crest, ...f])
    setLiveLayers(null)
    onChange({ ...prev, primary, secondary })
  }

  function redo() {
    if (!future.length) return
    const nxt = future[0]
    setFuture(future.slice(1))
    setPast((p) => [...p, crest])
    setLiveLayers(null)
    onChange({ ...nxt, primary, secondary })
  }

  function addPiece(type) {
    const same = layers.filter((l) => l.type === type).length
    const piece = {
      id: pieceId(),
      type,
      fill: type === 'letter' || type === 'star' || type === 'crown' || type === 'ball' ? '#f4f4f6' : secondary,
      text: type === 'letter' ? 'XV' : undefined,
      x: 100 + (same % 3) * 10 - 10,
      y: defaultLayerY(type) + Math.floor(same / 3) * 10,
      scale: 1,
      rotate: 0,
    }
    const next = { ...crest, layers: [...layers, piece] }
    setSelectedId(piece.id)
    commit(next)
  }

  function patchSelected(patch) {
    if (!selected) return
    commit({
      ...crest,
      layers: layers.map((l) => (l.id === selected.id ? { ...l, ...patch } : l)),
    })
  }

  function removeSelected() {
    if (!selected) return
    const nextLayers = layers.filter((l) => l.id !== selected.id)
    setSelectedId(nextLayers[nextLayers.length - 1]?.id || null)
    commit({ ...crest, layers: nextLayers })
  }

  function moveLayer(dir) {
    if (!selected) return
    const i = layers.findIndex((l) => l.id === selected.id)
    const j = i + dir
    if (j < 0 || j >= layers.length) return
    const next = [...layers]
    const [item] = next.splice(i, 1)
    next.splice(j, 0, item)
    commit({ ...crest, layers: next })
  }

  function onPointerDownLayer(e, layer) {
    e.preventDefault()
    e.stopPropagation()
    setSelectedId(layer.id)
    const svg = svgWrap.current?.querySelector('svg')
    if (!svg) return
    const pt = clientToViewBox(svg, e.clientX, e.clientY)
    const geom = layerGeom(layer)
    drag.current = {
      id: layer.id,
      dx: geom.x - pt.x,
      dy: geom.y - pt.y,
      moved: false,
      origin: layers,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e) {
    if (!drag.current) return
    const svg = svgWrap.current?.querySelector('svg')
    if (!svg) return
    const pt = clientToViewBox(svg, e.clientX, e.clientY)
    const x = Math.max(18, Math.min(182, pt.x + drag.current.dx))
    const y = Math.max(18, Math.min(182, pt.y + drag.current.dy))
    drag.current.moved = true
    setLiveLayers(
      (drag.current.origin || layers).map((l) => (l.id === drag.current.id ? { ...l, x, y } : l)),
    )
  }

  function onPointerUp() {
    if (!drag.current) return
    const nextLayers = liveLayers || layers
    const moved = drag.current.moved
    drag.current = null
    if (moved) commit({ ...crest, layers: nextLayers })
    else setLiveLayers(null)
  }

  const valid = colors.length >= CREST_COLOR_MIN && colors.length <= CREST_COLOR_MAX

  return (
    <div className="crest-shop">
      <aside className="crest-kit">
        <p className="crest-kit-label">Formato do metal</p>
        <div className="crest-shape-row">
          {SHIELD_SHAPES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={crest.shape === s.id ? 'crest-shape on' : 'crest-shape'}
              onClick={() => commit({ ...crest, shape: s.id })}
              title={s.label}
            >
              <CrestMark crest={{ ...liveCrest, shape: s.id, layers: [] }} size={42} title={s.label} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
        <p className="crest-kit-label">Peças do esmalte</p>
        <div className="crest-piece-grid">
          {PIECES.map((p) => (
            <button key={p.type} type="button" className="crest-piece" onClick={() => addPiece(p.type)}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="muted">Toque numa peça para cravar no escudo. Depois arraste, pinte e gire.</p>
      </aside>

      <div className="crest-bench">
        <div
          className="crest-anvil"
          ref={svgWrap}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <CrestMark
            crest={liveCrest}
            size={240}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPointerDownLayer={onPointerDownLayer}
          />
        </div>
        <p className={valid ? 'ok-text' : 'err-text'}>
          {colors.length} cor{colors.length === 1 ? '' : 'es'} no emblema · use de {CREST_COLOR_MIN} a {CREST_COLOR_MAX}
        </p>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={undo} disabled={!past.length}>
            Desfazer
          </button>
          <button type="button" className="btn ghost" onClick={redo} disabled={!future.length}>
            Refazer
          </button>
        </div>
      </div>

      <aside className="crest-inspector">
        {selected ? (
          <>
            <p className="crest-kit-label">Peça selecionada</p>
            <strong>{PIECES.find((p) => p.type === selected.type)?.label || selected.type}</strong>
            <label className="field">
              Cor da peça
              <input type="color" value={selected.fill || '#ffffff'} onChange={(e) => patchSelected({ fill: e.target.value })} />
            </label>
            <div className="crest-swatches">
              {palette.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="crest-swatch"
                  style={{ background: c }}
                  onClick={() => patchSelected({ fill: c })}
                  aria-label={`Pintar com ${c}`}
                />
              ))}
            </div>
            {selected.type === 'letter' ? (
              <label className="field">
                Iniciais
                <input
                  maxLength={3}
                  value={selected.text || ''}
                  onChange={(e) => patchSelected({ text: e.target.value.toUpperCase() })}
                />
              </label>
            ) : null}
            <label className="field">
              Tamanho {Math.round((selected.scale || 1) * 100)}%
              <input
                type="range"
                min="0.4"
                max="2.2"
                step="0.05"
                value={selected.scale || 1}
                onChange={(e) => patchSelected({ scale: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              Giro {Math.round(selected.rotate || 0)}°
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={selected.rotate || 0}
                onChange={(e) => patchSelected({ rotate: Number(e.target.value) })}
              />
            </label>
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => moveLayer(1)}>
                Trazer à frente
              </button>
              <button type="button" className="btn ghost" onClick={() => moveLayer(-1)}>
                Enviar atrás
              </button>
              <button type="button" className="btn danger" onClick={removeSelected}>
                Tirar peça
              </button>
            </div>
          </>
        ) : (
          <p className="muted">Clique numa peça no escudo para pintar, girar ou reposicionar. O emblema monta na hora.</p>
        )}
      </aside>
    </div>
  )
}
