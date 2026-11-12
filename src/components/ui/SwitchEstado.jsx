import { Loader2 } from 'lucide-react'

// Toggle tipo iOS para el estado del kiosco (Abierto / Cerrado).
// Verde esmeralda cuando está abierto, neutro suave cuando cerrado.
// Si no recibe onToggle funciona como indicador de solo lectura.
export default function SwitchEstado({ abierto, onToggle, busy = false, conEtiqueta = true, className = '' }) {
  const interactivo = typeof onToggle === 'function'

  const pista = (
    <span
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-300 ease-out ${
        abierto ? 'bg-emerald-500' : 'bg-slate-300'
      } ${interactivo ? 'group-hover:brightness-105' : ''}`}
    >
      <span
        className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${
          abierto ? 'translate-x-7' : 'translate-x-1'
        }`}
      >
        {busy && <Loader2 size={12} className="animate-spin text-slate-400" />}
      </span>
    </span>
  )

  const etiqueta = conEtiqueta && (
    <span className={`text-xs font-bold ${abierto ? 'text-emerald-600' : 'text-slate-400'}`}>
      {abierto ? 'Abierto' : 'Cerrado'}
    </span>
  )

  if (!interactivo) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`} role="status" aria-label={abierto ? 'Kiosco abierto' : 'Kiosco cerrado'}>
        {pista}
        {etiqueta}
      </span>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={abierto}
      aria-label={abierto ? 'Marcar kiosco como cerrado' : 'Marcar kiosco como abierto'}
      onClick={onToggle}
      disabled={busy}
      className={`group inline-flex items-center gap-2 rounded-full transition-transform duration-200 ease-out active:scale-95 disabled:opacity-60 ${className}`}
    >
      {pista}
      {etiqueta}
    </button>
  )
}
