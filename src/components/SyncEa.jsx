import { useEffect, useMemo, useRef, useState } from 'react'
import { EA_HOST } from '../lib/eaApi'
import { buildBookmarklet, EA_START_URL, syncRequests } from '../lib/eaSync'

const PASS_KEY = 'xv-sync-pass'
// Em dev o envio vai direto para o worker de produção (o Vite não tem /ingest).
const INGEST_URL = `${EA_HOST || (import.meta.env.DEV ? 'https://xv-piripiri.resisted-lycra.workers.dev' : '')}/ingest`

function readPass() {
  try {
    return localStorage.getItem(PASS_KEY) || ''
  } catch {
    return ''
  }
}

function keepPass(value) {
  try {
    localStorage.setItem(PASS_KEY, value)
  } catch {
    /* sem armazenamento: pede de novo na próxima vez */
  }
}

function fromEa(origin) {
  try {
    const u = new URL(origin)
    return u.protocol === 'https:' && (u.hostname === 'ea.com' || u.hostname.endsWith('.ea.com'))
  } catch {
    return false
  }
}

// Página aberta pelo favorito "Enviar para o XV": recebe os dados da EA e manda ao worker.
export default function SyncEa() {
  const receiverUrl = `${window.location.origin}${import.meta.env.BASE_URL}?receber=1`
  const bookmarklet = useMemo(() => buildBookmarklet(receiverUrl, syncRequests()), [receiverUrl])
  const linkRef = useRef(null)
  const [payload, setPayload] = useState(null)
  const [password, setPassword] = useState(readPass)
  const [state, setState] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const total = syncRequests().length

  // O React bloqueia href "javascript:", então o link do favorito é montado à mão.
  useEffect(() => {
    linkRef.current?.setAttribute('href', bookmarklet)
  }, [bookmarklet])

  useEffect(() => {
    function onMessage(e) {
      if (!fromEa(e.origin) || e.data?.type !== 'xv-ea-sync' || !Array.isArray(e.data.items)) return
      setPayload(e.data)
      setResult(null)
      setError('')
    }
    window.addEventListener('message', onMessage)
    // Avisa a página da EA que já dá para entregar os dados.
    const ping = setInterval(() => {
      if (window.opener) window.opener.postMessage('xv-ready', '*')
    }, 700)
    return () => {
      window.removeEventListener('message', onMessage)
      clearInterval(ping)
    }
  }, [])

  async function send(e) {
    e?.preventDefault()
    if (!payload || !password) return
    setState('sending')
    setError('')
    try {
      const res = await fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password, items: payload.items }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      keepPass(password)
      setResult(data)
      setState('done')
    } catch (err) {
      setError(String(err.message || err))
      setState('idle')
    }
  }

  const clubs = result ? Object.values(result.clubs || {}) : []

  return (
    <div className="page-wrap sync-page">
      <header className="sync-head">
        <h1>Enviar dados da EA</h1>
        <p>
          Quando a EA bloqueia o servidor do painel, os jogos novos param de chegar. Com este botão, o seu navegador
          busca os dados na EA e entrega aqui, e o painel atualiza para todo mundo.
        </p>
      </header>

      {payload ? (
        <section className="card sync-card">
          <h3>Dados recebidos</h3>
          <p className="card-lead">
            {payload.items.length} de {total} respostas da EA
            {payload.fail ? ` · ${payload.fail} falharam` : ''}. Falta só confirmar com a senha de administrador.
          </p>
          {state === 'done' ? (
            <>
              <div className="notice ok">
                Pronto: {result.saved} {result.saved === 1 ? 'resposta guardada' : 'respostas guardadas'}.
                {clubs.length ? (
                  <ul className="sync-clubs">
                    {clubs.map((c) => (
                      <li key={c.name}>
                        <b>{c.name}</b>: {c.received} jogos lidos,{' '}
                        {c.added ? `${c.added} ${c.added === 1 ? 'novo' : 'novos'} no histórico` : 'nenhum novo'}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="sync-actions">
                <a className="btn" href={import.meta.env.BASE_URL}>
                  Abrir o painel
                </a>
              </div>
            </>
          ) : (
            <form className="sync-form" onSubmit={send}>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Senha de administrador"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit" className="btn" disabled={!password || state === 'sending'}>
                {state === 'sending' ? 'Enviando…' : 'Enviar para o painel'}
              </button>
            </form>
          )}
          {error ? <div className="notice error">{error}</div> : null}
        </section>
      ) : null}

      <section className="card sync-card">
        <h3>Como usar</h3>
        <p className="card-lead">Funciona no navegador do computador. A primeira vez leva um minuto.</p>
        <ol className="sync-steps">
          <li>
            <span>Arraste este botão para a barra de favoritos (Ctrl+Shift+B mostra a barra):</span>
            <a
              ref={linkRef}
              className="btn sync-bookmarklet"
              onClick={(e) => e.preventDefault()}
              title="Arraste para a barra de favoritos"
            >
              Enviar para o XV
            </a>
          </li>
          <li>
            <span>Depois dos jogos, abra esta página da EA (mostra um texto técnico, é normal):</span>
            <a className="btn ghost" href={EA_START_URL} target="_blank" rel="noreferrer">
              Abrir a EA
            </a>
          </li>
          <li>
            <span>
              Com a página da EA aberta, clique no favorito <b>Enviar para o XV</b>. Ele busca os 3 clubes e abre esta
              tela com os dados. Aí é só confirmar com a senha.
            </span>
          </li>
        </ol>
        {!payload ? <p className="sync-wait">Esperando os dados da EA…</p> : null}
      </section>
    </div>
  )
}
