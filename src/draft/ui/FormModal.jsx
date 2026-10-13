import { useState } from 'react'

// Janela com campos e confirmação, no lugar do prompt() do navegador.
// fields: [{ name, label, type: 'number' | 'select' | 'password' | 'text', defaultValue, options, min, hint }]
export default function FormModal({ title, intro, fields, submitLabel, onSubmit, onClose, danger = false }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === 'select' ? f.options?.[0]?.value ?? '' : '')])),
  )
  const [error, setError] = useState('')

  function submit(e) {
    e.preventDefault()
    for (const f of fields) {
      const v = values[f.name]
      if (f.required !== false && (v === '' || v == null)) return setError(`Preencha ${f.label.toLowerCase()}.`)
      if (f.type === 'number') {
        const n = Number(v)
        if (!Number.isFinite(n) || n < (f.min ?? 0)) return setError(`${f.label} precisa ser no mínimo ${(f.min ?? 0).toLocaleString('pt-BR')}.`)
      }
    }
    const out = Object.fromEntries(fields.map((f) => [f.name, f.type === 'number' ? Number(values[f.name]) : values[f.name]]))
    onSubmit(out)
  }

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-label={title}>
        <h3>{title}</h3>
        {intro ? <p className="muted">{intro}</p> : null}
        {fields.map((f) => (
          <label key={f.name} className="field modal-field">
            {f.label}
            {f.type === 'select' ? (
              <select value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : f.type || 'text'}
                inputMode={f.type === 'number' ? 'numeric' : undefined}
                min={f.type === 'number' ? (f.min ?? 0) : undefined}
                step={f.type === 'number' ? 'any' : undefined}
                autoFocus={fields[0] === f}
                value={values[f.name]}
                onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
              />
            )}
            {f.hint ? <small className="muted">{f.hint}</small> : null}
          </label>
        ))}
        {error ? <div className="alert">{error}</div> : null}
        <div className="actions modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={danger ? 'btn danger-solid' : 'btn'} autoFocus={!fields.length && !danger}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
