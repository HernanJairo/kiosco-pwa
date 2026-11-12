import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, Flashlight, FlashlightOff, ScanLine } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

const COOLDOWN_MS = 2500

function mensajeError(err) {
  const name = err?.name || ''
  const msg = String(err?.message || err || '')
  if (name === 'NotAllowedError' || /permission|denied|dismissed/i.test(msg)) {
    return 'Permiso de cámara denegado. Habilitalo desde el candado de la barra de direcciones y volvé a intentar.'
  }
  if (name === 'NotFoundError' || /not ?found|no device|no camera/i.test(msg)) {
    return 'No se encontró ninguna cámara en este dispositivo.'
  }
  if (name === 'NotReadableError' || /in use|busy|trackstart/i.test(msg)) {
    return 'La cámara está siendo usada por otra aplicación. Cerrala y reintentá.'
  }
  if (!window.isSecureContext) {
    return 'El escáner requiere una conexión segura (HTTPS) o localhost.'
  }
  return `No se pudo iniciar la cámara. (${msg || 'error desconocido'})`
}

// Modal con visor de cámara: lee QR y códigos de barra (EAN, CODE-128, UPC…).
// Llama a onResult(texto) por cada detección; mismo código ignorado por COOLDOWN_MS.
// html5-qrcode se carga bajo demanda (dynamic import) para no inflar el bundle inicial.
export default function EscanerCamara({ open, onClose, onResult, titulo = 'Escanear con Cámara' }) {
  return (
    <Modal open={open} onClose={onClose} title={titulo}>
      {open && <VisorCamara onResult={onResult} onClose={onClose} />}
    </Modal>
  )
}

// Se monta solo al abrir: el estado arranca limpio y la cámara se libera al desmontar.
function VisorCamara({ onResult, onClose }) {
  const mountId = 'escaner-' + useId().replace(/:/g, '')
  const scannerRef = useRef(null)
  const lastRef = useRef({ text: null, t: 0 })
  const onResultRef = useRef(onResult)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchOk, setTorchOk] = useState(false)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    let cancelled = false
    let scanner = null
    const detener = () => {
      if (!scanner) return
      try {
        if (scanner.isScanning) scanner.stop().then(() => scanner.clear()).catch(() => {})
        else scanner.clear()
      } catch {
        /* cierre defensivo */
      }
    }

    ;(async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelled) return
        scanner = new Html5Qrcode(mountId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
          ],
          verbose: false,
        })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (w, h) => {
              const s = Math.floor(Math.min(w, h) * 0.72)
              return { width: s, height: s }
            },
            aspectRatio: 1.3,
          },
          (text) => {
            const now = Date.now()
            if (text === lastRef.current.text && now - lastRef.current.t < COOLDOWN_MS) return
            lastRef.current = { text, t: now }
            onResultRef.current?.(text)
          },
          () => {} // errores de frame sin código: ignorar
        )
        if (cancelled) return detener()
        setListo(true)
        try {
          const caps = scanner.getRunningTrackCapabilities?.()
          if (caps && 'torch' in caps) setTorchOk(true)
        } catch {
          /* dispositivo sin linterna */
        }
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    })()

    return () => {
      cancelled = true
      scannerRef.current = null
      detener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleTorch = async () => {
    const s = scannerRef.current
    if (!s) return
    const next = !torchOn
    try {
      await s.applyVideoConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch {
      setTorchOk(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl bg-slate-900">
        <div id={mountId} className="min-h-64 w-full [&_video]:w-full [&_video]:object-cover" />
        {!error && !listo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
            <ScanLine size={28} className="animate-pulse" />
            <p className="text-xs">Iniciando cámara…</p>
          </div>
        )}
        {torchOk && !error && (
          <button
            onClick={toggleTorch}
            aria-label={torchOn ? 'Apagar linterna' : 'Encender linterna'}
            className={`absolute right-3 top-3 rounded-lg p-2 shadow transition-colors ${
              torchOn ? 'bg-amber-400 text-slate-900' : 'bg-white/85 text-slate-700 hover:bg-white'
            }`}
          >
            {torchOn ? <Flashlight size={18} /> : <FlashlightOff size={18} />}
          </button>
        )}
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-700">Cámara no disponible</p>
            <p className="mt-0.5 text-xs text-rose-600">{error}</p>
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-slate-400">
          Apuntá al código QR del pedido o al código de barras del producto.
        </p>
      )}

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  )
}
