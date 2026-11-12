import { createElement } from 'react'
import { useKiosco } from '../../context/KioscoContext'
import { iconoCategoria } from '../../utils/icons'

// Ícono de categoría: si el admin eligió un emoji al crearla (se guarda
// en config.iconosCategorias y se sincroniza por Firestore) se muestra el
// emoji; si no, cae al ícono lucide por palabra clave.
export default function IconoCat({ categoria, size = 20, strokeWidth = 1.9, className = '' }) {
  const { config } = useKiosco()
  const emoji = config?.iconosCategorias?.[categoria]
  if (emoji) {
    return (
      <span aria-hidden="true" className={className} style={{ fontSize: size, lineHeight: 1 }}>
        {emoji}
      </span>
    )
  }
  return createElement(iconoCategoria(categoria), { size, strokeWidth, className })
}
