import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'

/* Visor de galería a pantalla completa: imagen en alta resolución con
   object-contain, contador `i / N`, flechas ‹ ›, zoom 100%↔200% (clic en
   la imagen o botones ±) con paneo por scroll nativo, y cierre con X o Esc. */
export default function LightboxGaleria({ fotos = [], inicial = 0, nombre = '', onClose }) {
  const [idx, setIdx] = useState(Math.min(inicial, Math.max(0, fotos.length - 1)))
  const [zoom, setZoom] = useState(false)
  const touch = useRef(null)
  const n = fotos.length
  const prev = () => setIdx((i) => (i - 1 + n) % n)
  const next = () => setIdx((i) => (i + 1) % n)

  useEffect(() => {
    if (n === 0) return
    const onKey = (e) => {
      if (e.key === 'Escape') return onClose()
      if (n < 2) return
      if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + n) % n)
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [n, onClose])

  // Bloquea el scroll de fondo mientras el visor está abierto.
  useEffect(() => {
    if (n === 0) return
    const prev_ = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev_
    }
  }, [n])

  if (n === 0) return null

  const onTouchStart = (e) => (touch.current = e.touches[0].clientX)
  const onTouchEnd = (e) => {
    if (touch.current == null || n < 2 || zoom) return
    const dx = e.changedTouches[0].clientX - touch.current
    touch.current = null
    if (dx < -35) next()
    else if (dx > 35) prev()
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-slate-950/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Galería de ${nombre || 'producto'}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Barra superior: contador + controles */}
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold sm:text-sm">{nombre}</p>
          <p className="text-[10px] text-white/60 sm:text-xs">
            {idx + 1} / {n}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => !z)}
            aria-label={zoom ? 'Alejar (100%)' : 'Acercar (200%)'}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95"
          >
            {zoom ? <ZoomOut size={17} /> : <ZoomIn size={17} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar galería"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Lienzo: scroll nativo = paneo cuando está en 200% */}
      <div className="relative min-h-0 flex-1 overflow-auto">
        <div className={`grid min-h-full min-w-full place-items-center p-3 ${zoom ? 'h-[200%] w-[200%]' : ''}`}>
          <img
            src={fotos[idx]}
            alt={`${nombre} · foto ${idx + 1}`}
            onClick={() => setZoom((z) => !z)}
            draggable={false}
            className={`select-none object-contain ${
              zoom ? 'h-full w-full cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in'
            }`}
          />
        </div>

        {n > 1 && !zoom && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Foto anterior"
              className="fixed left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 active:scale-95"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Foto siguiente"
              className="fixed right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 active:scale-95"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
