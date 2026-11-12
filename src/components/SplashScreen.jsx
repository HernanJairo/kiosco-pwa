import { useEffect, useRef, useState } from 'react'
import Logo from '../assets/logo'

// Splash de bienvenida estilo app nativa (~2.5s):
//  1) 0.0–0.7s  isotipo Yapa con zoom-in y pulso
//  2) 0.7–1.5s  el logo se acomoda y entra el texto de bienvenida
//  3) 1.5s+     crédito institucional abajo (estilo "from Meta")
//  4) 2.4–2.8s  fade-out suave que revela la app
// Se muestra una vez por sesión de pestaña (App.jsx usa sessionStorage).
const INICIO_SALIDA = 2400
const DURACION_SALIDA = 380

export default function SplashScreen({ onFin }) {
  const [cerrando, setCerrando] = useState(false)
  const terminado = useRef(false)

  const finalizar = () => {
    if (terminado.current) return
    terminado.current = true
    onFin()
  }

  useEffect(() => {
    const t1 = setTimeout(() => setCerrando(true), INICIO_SALIDA)
    const t2 = setTimeout(finalizar, INICIO_SALIDA + DURACION_SALIDA)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saltar = () => {
    setCerrando(true)
    setTimeout(finalizar, DURACION_SALIDA)
  }

  return (
    <div
      role="status"
      aria-label="Cargando Yapa"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white transition-all duration-300 ease-out ${
        cerrando ? 'pointer-events-none -translate-y-3 opacity-0' : 'opacity-100'
      }`}
    >
      {/* Botón discreto para omitir */}
      <button
        type="button"
        onClick={saltar}
        className="absolute right-4 top-4 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-400 transition-colors duration-200 hover:bg-[#F6F6F6] hover:text-slate-600"
      >
        Saltar
      </button>

      {/* Héroe: logo + texto. En móvil apilado; en desktop en fila. */}
      <div className="flex flex-col items-center gap-4 px-6 text-center sm:flex-row sm:gap-5 sm:text-left">
        <div className="relative">
          <span
            aria-hidden="true"
            className="splash-glow absolute inset-0 rounded-3xl bg-[#009DE0]/25 blur-xl"
          />
          <Logo className="splash-logo relative h-24 w-24 drop-shadow-md sm:h-28 sm:w-28" />
        </div>
        <div className="splash-text">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#202125] sm:text-3xl">
            ¡Bienvenido a Yapa!
          </h1>
          <p className="mt-1.5 text-sm font-medium text-slate-500">
            Tu kiosco inteligente, rápido y sin vueltas
          </p>
        </div>
      </div>

      {/* Crédito institucional (estilo "from Meta") */}
      <p className="splash-credit absolute inset-x-0 bottom-8 px-6 text-center text-[11px] font-medium leading-relaxed text-slate-400">
        Desarrollado por estudiantes de la Tecnicatura Superior en
        Ciencia de Datos e Inteligencia Artificial · IES N° 6
      </p>
    </div>
  )
}
