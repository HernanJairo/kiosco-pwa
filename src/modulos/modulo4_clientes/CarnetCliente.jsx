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
// DNI, el mismo que lee el mostrador) y botón de pantalla completa con
// brillo alto para escanear en caja.
export default function CarnetCliente() {
  const { clienteSesion: a, config } = useKiosco()
  const [bright, setBright] = useState(false)
  if (!a) return null

  // Pantalla completa + brillo visual para que el lector tome el QR al
  // instante. Si el navegador deniega fullscreen, queda el modo brillante.
  const mostrarGrande = async () => {
    setBright((b) => !b)
    try {
      await document.documentElement.requestFullscreen?.()
    } catch {
      /* fullscreen denegado: el modo brillante sigue disponible */
    }
  }

  return (
    <div className={`wallet-app${bright ? ' wallet-bright' : ''}`}>
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
    </div>
  )
}
