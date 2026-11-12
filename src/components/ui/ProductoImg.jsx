import { createElement, useState } from 'react'
import { iconoCategoria } from '../../utils/icons'
import { fotosDe } from '../../utils/imagen'

// Foto principal del producto (fotos[0]) con fallback al ícono de su
// categoría.
export default function ProductoImg({ producto: p, className = '', iconSize = 18 }) {
  const [error, setError] = useState(false)
  const principal = fotosDe(p)[0]
  if (principal && !error) {
    return (
      <img
        src={principal}
        alt={p.nombre}
        loading="lazy"
        onError={() => setError(true)}
        className={`shrink-0 object-cover ${className}`}
      />
    )
  }
  return (
    <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-brand-soft via-slate-50 to-blue-100/60 text-brand ${className}`}>
      {createElement(iconoCategoria(p.categoria), { size: iconSize, strokeWidth: 2 })}
    </div>
  )
}
