import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function PwaUpdateBanner() {
  const [waitingWorker, setWaitingWorker] = useState(null)
  const [segundos, setSegundos] = useState(3)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

    let reg = null
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        reg = registration
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting)
        }
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing
          if (!nuevo) return
          nuevo.addEventListener('statechange', () => {
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(nuevo)
            }
          })
        })
      })
      .catch(() => {})

    // Cuando un worker nuevo toma el control (skipWaiting + clients.claim),
    // recarga todas las pestañas para servir la versión nueva al instante.
    let recargando = false
    const onControllerChange = () => {
      if (recargando) return
      recargando = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const actualizar = () => {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    setTimeout(() => window.location.reload(), 1500)
  }

  // Auto-actualización: si el usuario no toca el botón en 3 s, se aplica
  // la nueva versión igual (SKIP_WAITING dispara controllerchange -> reload).
  useEffect(() => {
    if (!waitingWorker) return
    setSegundos(3)
    const intervalo = setInterval(() => setSegundos((s) => Math.max(0, s - 1)), 1000)
    const timer = setTimeout(actualizar, 3000)
    return () => {
      clearInterval(intervalo)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingWorker])

  if (!waitingWorker) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl ring-1 ring-white/10">
        <span className="text-sm font-medium">
          Nueva versión disponible 🚀
          <span className="block text-xs font-normal text-slate-400">
            Actualizando automáticamente en {segundos}s…
          </span>
        </span>
        <button
          onClick={actualizar}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>
    </div>
  )
}
