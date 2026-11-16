import { useState } from 'react'
import { Maximize2, ShieldCheck, Store, Sun } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import PseudoQR from './PseudoQR'
import AvatarCliente from '../../components/ui/AvatarCliente'
import SelectorAvatar from '../../components/ui/SelectorAvatar'
import Card from '../../components/ui/Card'
import './BilleteraCliente.css'

// "Mi Carnet QR" con la interfaz de credencial digital de v0: tarjeta
// celeste con la marca, avatar, DNI, QR identificatorio (PseudoQR del
// DNI, el mismo que lee el mostrador) y botón "Ampliar" que abre un
// modal interno blanco de alto contraste para escanear en caja.
export default function CarnetCliente() {
  const { clienteSesion: a, config } = useKiosco()
  const [qrGrande, setQrGrande] = useState(false)
  const [qrSize, setQrSize] = useState(300)
  if (!a) return null

  // "Ampliar": overlay modal interno de alto contraste (requestFullscreen
  // en Android no agranda el QR ni sube brillo). Fondo blanco puro y el
  // QR ocupando el 80% del ancho para que el lector lo tome al instante.
  const mostrarGrande = () => {
    setQrSize(Math.min(Math.round(window.innerWidth * 0.8), 380))
    setQrGrande(true)
  }

  return (
    <div className="wallet-app">
      <div className="wallet-shell">
        <section className="credential-panel" role="tabpanel" aria-label="Mi Carnet QR">
          <div className="credential-intro">
            <p className="wallet-eyebrow">TU CREDENCIAL DIGITAL</p>
            <h2>Un toque y listo.</h2>
            <p>Mostrá tu carnet en el mostrador para pagar con tu billetera o fiado.</p>
          </div>

          <article className="credential-card">
            <div className="credential-topline">
              <span className="wallet-brand credential-brand">
                <span className="wallet-brand-mark" aria-hidden="true">Y</span>
                <span>Yapa</span>
              </span>
              <span className="credential-verified"><ShieldCheck size={15} />CLIENTE VERIFICADO</span>
            </div>

            <div className="credential-customer">
              <span className="customer-avatar">
                <AvatarCliente cliente={a} className="h-full w-full" iconSize={26} textoClassName="text-base" />
              </span>
              <span>
                <strong>{a.nombre} {a.apellido}</strong>
                <small>DNI {a.dni}</small>
              </span>
              <span className="account-enabled">
                <i style={a.deuda > 0 ? { background: '#f59e0b' } : undefined} />
                {a.deuda > 0 ? 'Habilitada · Con deuda' : 'Habilitada · Al día'}
              </span>
            </div>

            <div className="credential-qr-wrap">
              <PseudoQR text={a.dni} size={220} />
            </div>

            <div className="credential-caption">
              <strong>Tu Yapa, siempre a mano</strong>
              <span>Acercá este QR al lector de caja</span>
            </div>

            <div className="credential-foot">
              <span><Store size={14} />{config.nombreKiosco}</span>
              <span>CLIENTE #{a.dni}</span>
            </div>
          </article>

          <button type="button" className="brightness-button" onClick={mostrarGrande}>
            <Sun size={18} /><span>Ampliar y subir brillo</span><Maximize2 size={16} />
          </button>
          <p className="credential-security">
            <ShieldCheck size={14} /> Tu código identifica tu cuenta. Nunca compartas una captura.
          </p>
        </section>

        <Card
          title="Personalizá tu carnet"
          subtitle="Elegí un avatar o subí tu foto (solo se guarda en este dispositivo)"
          className="mx-auto w-full max-w-sm"
        >
          <SelectorAvatar cliente={a} />
        </Card>
      </div>

      {/* Credencial ampliada: modal interno blanco puro de alto
          contraste, QR al 80% del ancho y nombre/DNI grandes. */}
      {qrGrande && (
        <div
          className="fade-in fixed inset-0 z-[120] flex flex-col items-center justify-center gap-5 bg-white px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Credencial ampliada"
          onClick={() => setQrGrande(false)}
        >
          <div className="flex flex-col items-center gap-1">
            <strong className="text-2xl font-extrabold tracking-tight text-[#202125]">
              {a.nombre} {a.apellido}
            </strong>
            <span className="text-lg font-semibold text-slate-500">DNI {a.dni}</span>
          </div>
          <PseudoQR text={a.dni} size={qrSize} />
          <p className="text-sm font-medium text-slate-400">Acercá el código al lector de caja</p>
          <button
            type="button"
            onClick={() => setQrGrande(false)}
            className="mt-2 rounded-full bg-[#202125] px-10 py-3.5 text-base font-bold text-white shadow-lg transition-transform active:scale-95"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}
