import { useState } from 'react'
import {
  CREST_PALETTES,
  CREST_PATTERNS,
  CREST_SHAPES,
  CREST_SYMBOLS,
  MONOGRAM_MAX,
  STARS_MAX,
  cleanCrest,
  monogramFrom,
  randomCrest,
} from '../lib/crest.js'
import CrestArt from './CrestArt.jsx'

const TABS = [
  ['forma', 'Forma'],
  ['padrao', 'Padrão'],
  ['cores', 'Cores'],
  ['simbolo', 'Símbolo'],
  ['texto', 'Texto'],
]

export function startingCrest(clubName) {
  return cleanCrest({
    shape: 'classico',
    pattern: 'listras',
    symbol: 'bola',
    ...CREST_PALETTES[0],
    monogram: monogramFrom(clubName),
    ribbon: '',
    stars: 0,
  })
}

function Tile({ active, label, onClick, children }) {
  return (
    <button type="button" className={`studio-tile${active ? ' on' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
      <span>{label}</span>
    </button>
  )
}

function ColorField({ label, value, onChange }) {
  return (
    <label className="studio-color">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <span>
        <b>{label}</b>
        <small>{value.toUpperCase()}</small>
      </span>
    </label>
  )
}

// Ateliê do escudo: escolhas guiadas que sempre resultam num escudo bem acabado.
export default function CrestEditor({ value, onChange, clubName = '' }) {
  const crest = cleanCrest(value || startingCrest(clubName))
  const [tab, setTab] = useState('forma')
  const [history, setHistory] = useState([])

  function update(patch) {
    setHistory((h) => [...h.slice(-30), crest])
    onChange(cleanCrest({ ...crest, ...patch }))
  }

  function undo() {
    if (!history.length) return
    onChange(history[history.length - 1])
    setHistory(history.slice(0, -1))
  }

  const preview = (patch) => cleanCrest({ ...crest, ...patch })
  const samePalette = (p) => p.primary === crest.primary && p.secondary === crest.secondary && p.accent === crest.accent

  return (
    <div className="studio">
      <div className="studio-stage">
        <div className="studio-pedestal">
          <CrestArt crest={crest} size={260} title={`Escudo do ${clubName || 'clube'}`} />
        </div>
        <div className="studio-sizes" aria-label="Como o escudo aparece pequeno">
          <CrestArt crest={crest} size={56} />
          <CrestArt crest={crest} size={32} />
          <CrestArt crest={crest} size={20} />
          <small>Na tabela e nas listas</small>
        </div>
        <div className="studio-stage-actions">
          <button type="button" className="btn ghost" onClick={() => update(randomCrest(clubName))}>
            Sortear
          </button>
          <button type="button" className="btn ghost" onClick={undo} disabled={!history.length}>
            Desfazer
          </button>
        </div>
      </div>

      <div className="studio-panel">
        <div className="draft-subnav studio-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'forma' && (
          <div className="studio-grid">
            {CREST_SHAPES.map((s) => (
              <Tile key={s.id} label={s.label} active={crest.shape === s.id} onClick={() => update({ shape: s.id })}>
                <CrestArt crest={preview({ shape: s.id })} size={72} />
              </Tile>
            ))}
          </div>
        )}

        {tab === 'padrao' && (
          <div className="studio-grid">
            {CREST_PATTERNS.map((p) => (
              <Tile key={p.id} label={p.label} active={crest.pattern === p.id} onClick={() => update({ pattern: p.id })}>
                <CrestArt crest={preview({ pattern: p.id })} size={72} />
              </Tile>
            ))}
          </div>
        )}

        {tab === 'cores' && (
          <>
            <p className="studio-hint">Combinações prontas</p>
            <div className="studio-palettes">
              {CREST_PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`studio-palette${samePalette(p) ? ' on' : ''}`}
                  aria-pressed={samePalette(p)}
                  onClick={() => update({ primary: p.primary, secondary: p.secondary, accent: p.accent })}
                >
                  <span className="studio-swatches" aria-hidden="true">
                    <i style={{ background: p.primary }} />
                    <i style={{ background: p.secondary }} />
                    <i style={{ background: p.accent }} />
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="studio-hint">Ou escolha cada cor</p>
            <div className="studio-colors">
              <ColorField label="Principal" value={crest.primary} onChange={(primary) => update({ primary })} />
              <ColorField label="Detalhe" value={crest.secondary} onChange={(secondary) => update({ secondary })} />
              <ColorField label="Destaque" value={crest.accent} onChange={(accent) => update({ accent })} />
            </div>
            <p className="muted studio-note">Principal pinta o campo, detalhe pinta o padrão e destaque vai na borda, no símbolo e no texto.</p>
          </>
        )}

        {tab === 'simbolo' && (
          <div className="studio-grid">
            {CREST_SYMBOLS.map((s) => (
              <Tile key={s.id} label={s.label} active={crest.symbol === s.id} onClick={() => update({ symbol: s.id })}>
                <CrestArt crest={preview({ symbol: s.id, ribbon: '' })} size={72} />
              </Tile>
            ))}
          </div>
        )}

        {tab === 'texto' && (
          <div className="studio-text">
            <label className="field">
              Sigla
              <input
                value={crest.monogram}
                maxLength={MONOGRAM_MAX}
                placeholder={monogramFrom(clubName)}
                onChange={(e) => update({ monogram: e.target.value })}
              />
              <small className="muted">Até {MONOGRAM_MAX} letras. Deixe vazio para usar só o símbolo.</small>
            </label>

            <div className="studio-row">
              <span>
                <b>Faixa com o nome</b>
                <small className="muted">{clubName ? clubName.toUpperCase() : 'Nome do clube'}</small>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={!!crest.ribbon}
                className={`studio-switch${crest.ribbon ? ' on' : ''}`}
                onClick={() => update({ ribbon: crest.ribbon ? '' : clubName })}
              >
                <i />
              </button>
            </div>

            <div className="studio-row">
              <span>
                <b>Estrelas de título</b>
                <small className="muted">Ficam acima do escudo</small>
              </span>
              <div className="segmented">
                {Array.from({ length: STARS_MAX + 1 }, (_, n) => (
                  <button key={n} type="button" className={crest.stars === n ? 'active' : ''} aria-pressed={crest.stars === n} onClick={() => update({ stars: n })}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
