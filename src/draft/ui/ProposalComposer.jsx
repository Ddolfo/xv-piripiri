import { useState } from 'react'
import { coins, overallTone } from './api.js'
import CrestMark from './CrestMark.jsx'
import PlayerFace from './PlayerFace.jsx'

function PlayerPick({ players, selected, onToggle, lockedIds }) {
  const sorted = [...players].sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name, 'pt-BR'))
  return (
    <ul className="deal-list">
      {sorted.map((p) => {
        const on = selected.includes(p.id)
        const locked = lockedIds?.has(p.id) && !on
        return (
          <li key={p.id}>
            <label className={`deal-player${on ? ' on' : ''}${locked ? ' locked' : ''}`}>
              <input type="checkbox" checked={on} disabled={locked} onChange={() => onToggle(p.id)} />
              <PlayerFace src={p.image} name={p.name} className="lineup-face" />
              <span className="deal-player-text">
                <b>{p.name}</b>
                <small>
                  {p.position} · valor {coins(p.buy ?? 0)}
                  {locked ? ' · em outra negociação' : ''}
                </small>
              </span>
              <span className={`ovr ${overallTone(p.overall)}`}>{p.overall}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Janela de negociação: o que você leva, o que você dá e a diferença em dinheiro.
 * Serve para enviar proposta e para contrapropor.
 */
export default function ProposalComposer({ title, myClub, otherClub, initial, lockedIds, submitLabel, onSubmit, onClose }) {
  const [take, setTake] = useState(initial?.take || [])
  const [give, setGive] = useState(initial?.give || [])
  const [money, setMoney] = useState(initial?.pay ? 'pay' : initial?.receive ? 'receive' : 'none')
  const [amount, setAmount] = useState(String(initial?.pay || initial?.receive || ''))
  const [error, setError] = useState('')
  const myRoster = myClub.roster || []
  const theirRoster = otherClub.roster || []
  const value = Math.max(0, Math.round(Number(amount) || 0))
  const toggle = (list, setList) => (id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const sum = (ids, roster) => ids.reduce((a, id) => a + (roster.find((p) => p.id === id)?.buy || 0), 0)
  const takeValue = sum(take, theirRoster)
  const giveValue = sum(give, myRoster)
  const names = (ids, roster) => ids.map((id) => roster.find((p) => p.id === id)?.name).filter(Boolean).join(', ')
  const finalMine = myRoster.length - give.length + take.length
  const finalTheirs = theirRoster.length - take.length + give.length

  function submit(e) {
    e.preventDefault()
    if (!take.length && !give.length) return setError('Escolha pelo menos um jogador.')
    if (money !== 'none' && !value) return setError('Informe o valor em XV-Coins.')
    if (money === 'pay' && value > (myClub.spendable ?? myClub.balance ?? 0)) return setError('Seu saldo disponível não cobre esse valor.')
    onSubmit({ take, give, pay: money === 'pay' ? value : 0, receive: money === 'receive' ? value : 0 })
  }

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <form className="modal deal" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-label={title}>
        <h3>{title}</h3>
        <p className="muted">Monte a negociação: jogadores dos dois lados e, se precisar, a diferença em dinheiro.</p>

        <div className="deal-cols">
          <section>
            <header className="deal-head">
              <CrestMark crest={otherClub.crest} size={24} />
              <span>
                <b>Você leva</b>
                <small>do {otherClub.name}</small>
              </span>
            </header>
            <PlayerPick players={theirRoster} selected={take} onToggle={toggle(take, setTake)} lockedIds={lockedIds} />
          </section>
          <section>
            <header className="deal-head">
              <CrestMark crest={myClub.crest} size={24} />
              <span>
                <b>Você dá</b>
                <small>do seu elenco (opcional)</small>
              </span>
            </header>
            <PlayerPick players={myRoster} selected={give} onToggle={toggle(give, setGive)} lockedIds={lockedIds} />
          </section>
        </div>

        <div className="deal-money">
          <div className="segmented" role="group" aria-label="Dinheiro na negociação">
            {[
              ['none', 'Troca direta'],
              ['pay', 'Eu pago'],
              ['receive', 'Eu recebo'],
            ].map(([id, label]) => (
              <button key={id} type="button" className={money === id ? 'active' : ''} aria-pressed={money === id} onClick={() => setMoney(id)}>
                {label}
              </button>
            ))}
          </div>
          {money !== 'none' ? (
            <label className="deal-amount">
              <span>XV-Coins</span>
              <input type="number" inputMode="numeric" min="0" step="100" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </label>
          ) : null}
          <small className="muted">Seu saldo disponível: {coins(myClub.spendable ?? myClub.balance ?? 0)}</small>
        </div>

        <div className="deal-summary">
          <span>
            Você leva <b>{names(take, theirRoster) || 'ninguém'}</b>
          </span>
          <span>
            Você dá <b>{names(give, myRoster) || 'ninguém'}</b>
          </span>
          {money !== 'none' && value ? (
            <span>
              {money === 'pay' ? 'Você paga' : 'Você recebe'} <b>{coins(value)}</b>
            </span>
          ) : null}
          <small className="muted">
            Valor de tabela: leva {coins(takeValue)} · dá {coins(giveValue)} · elencos ficam {finalMine} e {finalTheirs}
          </small>
        </div>

        {error ? <div className="alert">{error}</div> : null}
        <div className="actions modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
