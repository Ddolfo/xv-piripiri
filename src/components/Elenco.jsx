import { useState } from 'react'
import { POSITIONS, POSITION_LABELS } from '../data/positions'

const blank = {
  name: '',
  psn: '',
  primaryPos: 'ST',
  secondaryPos: 'CF',
  extraPositions: [],
}

export default function Elenco({ store }) {
  const [form, setForm] = useState(blank)
  const [extra, setExtra] = useState('')
  const [editing, setEditing] = useState(null)

  function onSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.psn.trim()) return
    if (editing) {
      store.updatePlayer(editing, form)
      setEditing(null)
    } else {
      store.addPlayer(form)
    }
    setForm(blank)
    setExtra('')
  }

  function addExtra() {
    if (!extra || form.extraPositions.includes(extra)) return
    if (extra === form.primaryPos || extra === form.secondaryPos) return
    setForm((f) => ({ ...f, extraPositions: [...f.extraPositions, extra] }))
    setExtra('')
  }

  function startEdit(p) {
    setEditing(p.id)
    setForm({
      name: p.name,
      psn: p.psn,
      primaryPos: p.primaryPos,
      secondaryPos: p.secondaryPos || '',
      extraPositions: p.extraPositions || [],
    })
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Elenco</h2>
          <p>Cadastre nome, PSN e posições. Os dados ficam salvos neste navegador.</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>{editing ? 'Editar jogador' : 'Novo jogador'}</h3>
          <form onSubmit={onSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>Nome</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome no clube"
                  required
                />
              </div>
              <div className="field">
                <label>PSN</label>
                <input
                  value={form.psn}
                  onChange={(e) => setForm({ ...form, psn: e.target.value })}
                  placeholder="ID PlayStation / gamertag"
                  required
                />
              </div>
              <div className="field">
                <label>Posição primária</label>
                <select
                  value={form.primaryPos}
                  onChange={(e) => setForm({ ...form, primaryPos: e.target.value })}
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p} · {POSITION_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Posição secundária</label>
                <select
                  value={form.secondaryPos}
                  onChange={(e) => setForm({ ...form, secondaryPos: e.target.value })}
                >
                  <option value="">Nenhuma</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p} · {POSITION_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label>Adicionar mais posições</label>
                <div className="extra-row">
                  <select value={extra} onChange={(e) => setExtra(e.target.value)}>
                    <option value="">Selecionar</option>
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn ghost" onClick={addExtra}>
                    + Posição
                  </button>
                </div>
                <div className="extra-row" style={{ marginTop: 8 }}>
                  {form.extraPositions.map((p) => (
                    <span className="chip" key={p}>
                      {p}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            extraPositions: f.extraPositions.filter((x) => x !== p),
                          }))
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="actions">
              <button className="btn" type="submit">
                {editing ? 'Salvar alterações' : 'Salvar jogador'}
              </button>
              {editing && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setEditing(null)
                    setForm(blank)
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="card">
          <h3>Lista do elenco</h3>
          <div className="player-list">
            {store.players.length === 0 && (
              <div className="notice">Nenhum jogador ainda. Cadastre o primeiro à esquerda.</div>
            )}
            {store.players.map((p) => (
              <article className="player-card" key={p.id}>
                <div>
                  <b>{p.name}</b>
                  <small>PSN {p.psn}</small>
                  <div className="pos-pills">
                    <span className="pill">{p.primaryPos}</span>
                    {p.secondaryPos ? <span className="pill">{p.secondaryPos}</span> : null}
                    {(p.extraPositions || []).map((x) => (
                      <span className="pill" key={x}>
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="actions" style={{ marginTop: 0 }}>
                  <button className="btn ghost" type="button" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                  <button className="btn danger" type="button" onClick={() => store.removePlayer(p.id)}>
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
