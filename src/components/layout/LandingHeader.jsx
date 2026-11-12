import { useState } from 'react'
import { LogIn, Mail, Store } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import Button from '../ui/Button'
import AcercaDeModal from '../AcercaDeModal'

// Header público (visitante): marca Yapa centrada, pill informativo de
// solo lectura con el estado del local, Contacto e Ingresar/Catálogo.
export default function LandingHeader({ onContact, onCatalog, enCatalogo = false, onLogin }) {
  const { config } = useKiosco()
  const [acercaOpen, setAcercaOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#F3F3F3] bg-white/95 shadow-[0_4px_20px_rgba(32,33,37,0.05)] backdrop-blur">
        <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4">
          <div className="flex justify-start">
            <Button variant="secondary" size="sm" onClick={onContact}>
              <Mail size={14} />
              <span className="hidden sm:inline">Contacto</span>
            </Button>
          </div>
          <button
            onClick={() => setAcercaOpen(true)}
            title="Acerca de Yapa"
            aria-label="Ver versión y créditos de la app"
            className="flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-[#F6F6F6]"
          >
            {/* Isotipo oficial v0: cuadrado celeste -4° con "Y" blanca */}
            <span className="grid h-8 w-8 -rotate-[4deg] place-items-center rounded-[10px] bg-[#009DE0] shadow-[0_5px_12px_rgba(0,157,224,0.18)]">
              <span className="rotate-[4deg] text-lg font-black leading-none text-white">Y</span>
            </span>
            <p className="text-base font-extrabold tracking-tight text-[#202125]">Yapa</p>
          </button>
          <div className="flex items-center justify-end gap-2">
            {/* Estado del local: solo lectura — el visitante nunca lo alterna */}
            <span
              role="status"
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                config.abierto ? 'bg-[#EAF8EF] text-[#45875F]' : 'bg-[#FDF0EA] text-[#A25A3C]'
              }`}
            >
              <i className={`h-1.5 w-1.5 rounded-full ${config.abierto ? 'bg-[#43BD72]' : 'bg-[#E49B77]'}`} />
              {config.abierto ? 'Abierto' : 'Cerrado'}
            </span>
            {enCatalogo ? (
              <Button size="sm" onClick={onLogin}>
                <LogIn size={14} />
                <span className="hidden sm:inline">Ingresar</span>
              </Button>
            ) : (
              <Button size="sm" onClick={onCatalog}>
                <Store size={14} />
                <span className="hidden sm:inline">Ver Catálogo</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <AcercaDeModal open={acercaOpen} onClose={() => setAcercaOpen(false)} />
    </>
  )
}
