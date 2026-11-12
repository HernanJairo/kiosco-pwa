import { useState } from 'react'
import { HandCoins, PackageCheck } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import SwitchEstado from './SwitchEstado'

// Panel rápido "Estado del Servicio": interruptores de contingencia para
// pausar/reactivar fiados y encargos sin cerrar el local. Cada cambio pasa
// por updateConfig(), que lo audita con autor/rol/hora y avisa al admin.
export default function EstadoServicio() {
  const { config, updateConfig, notify } = useKiosco()
  const [busy, setBusy] = useState(null)

  const toggle = async (clave, etiqueta) => {
    if (busy) return
    setBusy(clave)
    try {
      const activar = config[clave] === false
      await updateConfig({ [clave]: activar })
      notify(`${etiqueta} ${activar ? 'reactivados' : 'pausados'} temporalmente.`, 'info')
    } finally {
      setBusy(null)
    }
  }

  const filas = [
    {
      clave: 'fiadosActivos',
      icon: HandCoins,
      tono: 'bg-amber-50 text-amber-600',
      titulo: 'Fiados (Cta. Corriente)',
      texto: 'Las ventas fiadas del POS y la billetera del cliente.',
    },
    {
      clave: 'encargosActivos',
      icon: PackageCheck,
      tono: 'bg-[#EBF7FD] text-[#007AB8]',
      titulo: 'Encargos (pedidos del catálogo)',
      texto: 'Los pedidos para retirar en local; el QR Express sigue activo.',
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {filas.map(({ clave, icon: Icon, tono, titulo, texto }) => {
        const activo = config[clave] !== false
        return (
          <div key={clave} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tono}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {titulo} <span className={activo ? 'text-emerald-600' : 'text-rose-500'}>· {activo ? 'Activos' : 'Pausados'}</span>
                </p>
                <p className="text-xs text-slate-400">{texto}</p>
              </div>
            </div>
            <SwitchEstado
              abierto={activo}
              busy={busy === clave}
              conEtiqueta={false}
              onToggle={() => toggle(clave, titulo)}
            />
          </div>
        )
      })}
    </div>
  )
}
