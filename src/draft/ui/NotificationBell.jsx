import { useEffect, useRef, useState } from 'react'
import { routeForNotification } from './routes.js'

function ago(at) {
  const diff = Math.max(0, Date.now() - Number(at || 0))
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

// Sino no topo do Draft: contador de não lidas e lista que leva direto ao assunto.
export default function NotificationBell({ notifications, onOpen, onReadAll }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const list = [...(notifications || [])].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 25)
  const unread = (notifications || []).filter((n) => !n.read).length

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="bell" ref={box}>
      <button
        type="button"
        className={`bell-btn${unread ? ' has-unread' : ''}`}
        aria-label={unread ? `Notificações, ${unread} não lidas` : 'Notificações'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M12 3a6 6 0 0 0-6 6v3.6l-1.6 2.7A1 1 0 0 0 5.3 17h13.4a1 1 0 0 0 .9-1.7L18 12.6V9a6 6 0 0 0-6-6Zm-2.4 15.5a2.5 2.5 0 0 0 4.8 0Z"
            fill="currentColor"
          />
        </svg>
        {unread ? <span className="bell-count">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <div className="bell-panel" role="dialog" aria-label="Notificações">
          <div className="bell-head">
            <b>Notificações</b>
            {unread ? (
              <button type="button" className="link-btn" onClick={onReadAll}>
                Marcar todas como lidas
              </button>
            ) : null}
          </div>
          {!list.length ? <p className="bell-empty">Nada por aqui ainda.</p> : null}
          <ul>
            {list.map((n) => {
              const route = routeForNotification(n)
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`bell-item${n.read ? '' : ' unread'}`}
                    onClick={() => {
                      setOpen(false)
                      onOpen(n, route)
                    }}
                  >
                    <span className={`bell-icon ${route.icon}`} aria-hidden="true" />
                    <span className="bell-text">
                      <b>{n.title}</b>
                      <span>{n.body}</span>
                      <small>
                        {ago(n.at)}
                        {route.label ? ` · ${route.label} ›` : ''}
                      </small>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
