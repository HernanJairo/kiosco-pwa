import { createElement, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import { iconoCategoria } from '../../utils/icons'
import LightboxGaleria from './LightboxGaleria'

/* Galería del producto dentro del modal de detalle: imagen activa completa
   (object-contain, sin recortes), contador `i / N`, flechas ‹ ›, fila de
   miniaturas, navegación por teclado (← →) y por swipe táctil. Clic en la
   imagen abre el visor LightboxGaleria a pantalla completa. */
export default function GaleriaProducto({
  fotos = [],
  nombre = '',
  categoria = '',
  altura = 'h-56 sm:h-64',
  tonoIcono = 'text-[#007AB8]',
  fondoFallback = 'bg-[#EBF7FD]',
}) {
  const [idx, setIdx] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const touch = useRef(null)
  const n = fotos.length
  const actual = Math.min(idx, Math.max(0, n - 1))

  const prev = () => setIdx((i) => (i - 1 + n) % n)
  const next = () => setIdx((i) => (i + 1) % n)

  // Flechas del teclado (desactivadas mientras el lightbox las consume).
  useEffect(() => {
    if (n < 2 || lightbox) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + n) % n)
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [n, lightbox])

  const onTouchStart = (e) => (touch.current = e.touches[0].clientX)
  const onTouchEnd = (e) => {
    if (touch.current == null || n < 2) return
    const dx = e.changedTouches[0].clientX - touch.current
    touch.current = null
    if (dx < -35) next()
    else if (dx > 35) prev()
  }

  if (n === 0) {
    return (
      <div className={`grid ${altura} w-full place-items-center rounded-2xl ${fondoFallback}`}>
        {createElement(iconoCategoria(categoria), { size: 52, strokeWidth: 1.6, className: tonoIcono })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`group relative w-full overflow-hidden rounded-2xl bg-[#F8FAFC] ${altura}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          onClick={() => setLightbox(true)}
          aria-label={`Ampliar foto ${actual + 1} de ${nombre}`}
          title="Ampliar imagen"
          className="grid h-full w-full cursor-zoom-in place-items-center"
        >
          <img
            src={fotos[actual]}
            alt={`${nombre} · foto ${actual + 1}`}
            draggable={false}
            className="max-h-72 w-full select-none object-contain"
          />
        </button>

        {/* Contador i / N */}
        <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-slate-900/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          {actual + 1} / {n}
        </span>

        {/* Lupa discreta: insinúa que la imagen se amplía */}
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-white/85 text-slate-500 shadow-sm transition group-hover:text-[#009DE0]">
          <ZoomIn size={14} />
        </span>

        {n > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-600 shadow-md transition hover:text-[#009DE0] active:scale-95"
            >
              <ChevronLeft size={19} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-600 shadow-md transition hover:text-[#009DE0] active:scale-95"
            >
              <ChevronRight size={19} />
            </button>
          </>
        )}
      </div>

      {/* Miniaturas seleccionables */}
      {n > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {fotos.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Ver foto ${i + 1}`}
              className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border-2 bg-[#F8FAFC] transition active:scale-95 ${
                i === actual ? 'border-[#009DE0]' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img src={f} alt="" draggable={false} className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <LightboxGaleria fotos={fotos} inicial={actual} nombre={nombre} onClose={() => setLightbox(false)} />
      )}
    </div>
  )
}
