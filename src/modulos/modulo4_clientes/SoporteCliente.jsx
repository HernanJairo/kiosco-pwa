import {
  ArrowRight, CircleHelp, Clock3, MapPin, MessageCircle,
  PackageCheck, QrCode, Store, Wallet,
} from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { waLink } from '../../utils/whatsapp'
import './BilleteraCliente.css'

// Consultas frecuentes con acceso directo al módulo correspondiente.
const FAQ = [
  { icon: Wallet, titulo: 'Saldo y fiados', texto: 'Mirá tu saldo, tu límite de cuenta corriente y la libreta de fiados.', tab: 'billetera' },
  { icon: PackageCheck, titulo: 'Estado de encargos', texto: 'Seguí la preparación de tu pedido y retiralo con tu QR.', tab: 'encargos' },
  { icon: QrCode, titulo: 'Pagar en caja', texto: 'Mostrá tu carnet digital para cobrar con billetera o fiado.', tab: 'carnet' },
  { icon: Clock3, titulo: 'Historial completo', texto: 'Todas tus compras, encargos, recargas y pagos en un solo lugar.', tab: 'historial' },
]

// "Soporte" del menú lateral del cliente: panel de ayuda con accesos
// rápidos y contacto directo por el WhatsApp que configura el admin.
export default function SoporteCliente() {
  const { clienteSesion: a, config } = useKiosco()
  if (!a) return null

  const irTab = (key) => window.dispatchEvent(new CustomEvent('yapa:nav', { detail: key }))
  const whatsapp = String(config.whatsapp || '').trim()
  const link = whatsapp
    ? waLink(whatsapp, `Hola! Soy ${a.nombre} ${a.apellido} (DNI ${a.dni}), necesito ayuda con mi cuenta en ${config.nombreKiosco}.`)
    : null

  return (
    <div className="wallet-app">
      <div className="wallet-shell">
        <section className="wallet-panel wallet-panel-single" aria-label="Soporte">
          <div className="wallet-main-column">
            <div className="wallet-section-heading">
              <div>
                <p className="wallet-eyebrow">ESTAMOS PARA AYUDARTE</p>
                <h2>¿Necesitás una mano?</h2>
              </div>
            </div>

            {/* Consultas frecuentes → acceso directo al módulo */}
            <div className="flex flex-col gap-2">
              {FAQ.map(({ icon: Icon, titulo, texto, tab }) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => irTab(tab)}
                  className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-[0_3px_16px_rgba(32,33,37,.05)] transition-all duration-150 hover:bg-[#EBF7FD] active:scale-[0.98]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EBF7FD] text-[#007AB8]">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-bold text-[#202125]">{titulo}</strong>
                    <small className="block text-xs text-[#858993]">{texto}</small>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-[#B9BCC2]" />
                </button>
              ))}
            </div>

            {/* Contacto directo por WhatsApp del kiosco */}
            <article className="rounded-2xl bg-white p-5 shadow-[0_3px_16px_rgba(32,33,37,.05)]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E7F9EE] text-[#1FA855]">
                  <MessageCircle size={19} />
                </span>
                <div>
                  <strong className="block text-sm font-bold text-[#202125]">Escribinos por WhatsApp</strong>
                  <small className="block text-xs text-[#858993]">
                    {link ? `${config.nombreKiosco} · respuesta en horario de atención` : 'Contacto directo del kiosco'}
                  </small>
                </div>
              </div>
              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1FA855] px-5 py-3 text-sm font-bold text-white transition-all duration-150 hover:bg-[#188d45] active:scale-[0.98]"
                >
                  <MessageCircle size={17} /> Abrir chat con {config.nombreKiosco}
                </a>
              ) : (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                  <CircleHelp size={15} className="mt-0.5 shrink-0" />
                  <span>
                    El kiosco todavía no cargó su número de WhatsApp en Configuración. Mientras
                    tanto podés consultar directamente en el mostrador.
                  </span>
                </div>
              )}
            </article>

            {/* Datos del local */}
            <article className="flex flex-col gap-2 rounded-2xl bg-white px-5 py-4 shadow-[0_3px_16px_rgba(32,33,37,.05)] text-xs text-[#555963]">
              <p className="flex items-center gap-2 font-bold text-[#202125]"><Store size={14} className="text-[#007AB8]" /> {config.nombreKiosco}</p>
              <p className="flex items-center gap-2"><MapPin size={14} className="text-[#90929A]" /> {config.direccion}</p>
              <p className="flex items-center gap-2"><Clock3 size={14} className="text-[#90929A]" /> {config.horario}</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  )
}
