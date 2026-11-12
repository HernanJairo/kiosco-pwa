import { createElement, useState } from 'react'
import { iconoCategoria } from '../../utils/icons'

// Foto del producto con fallback al ícono de su categoría.
export default function ProductoImg({ producto: p, className = '', iconSize = 18 }) {
  const [error, setError] = useState(false)
  if (p.foto && !error) {
    return (
      <img
        src={p.foto}
        alt={p.nombre}
        loading="lazy"
        onError={() => setError(true)}
        className={`shrink-0 object-cover ${className}`}
      />
    )
  }
  return (
    <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-100/70 text-emerald-500 ${className}`}>
      {createElement(iconoCategoria(p.categoria), { size: iconSize })}
    </div>
  )
}
