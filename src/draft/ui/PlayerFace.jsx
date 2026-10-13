import { useState } from 'react'
import { initialsOf } from './api.js'

// Foto do jogador com iniciais no lugar quando a imagem falta ou quebra.
export default function PlayerFace({ src, name, className = 'fut-face' }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <span className={`${className} face-fallback`} aria-hidden="true">
        {initialsOf(name)}
      </span>
    )
  }
  return <img className={className} src={src} alt="" loading="lazy" onError={() => setBroken(true)} />
}
