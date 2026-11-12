import { Camera } from 'lucide-react'

// Pill discreta con el conteo de fotos en la esquina del arte de la
// tarjeta cuando el producto tiene más de una foto cargada. El
// contenedor padre debe tener position: relative.
export default function FotosPill({ cantidad = 0, className = '' }) {
  if (cantidad < 2) return null
  return (
    <span
      className={`pointer-events-none absolute right-1.5 top-1.5 z-[3] inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm ${className}`}
    >
      <Camera size={9} strokeWidth={2.5} /> {cantidad}
    </span>
  )
}
