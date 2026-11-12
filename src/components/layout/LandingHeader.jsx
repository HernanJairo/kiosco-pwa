import { useState } from 'react'
import { Info, LogIn, Mail, Store } from 'lucide-react'
import Logo from '../../assets/logo'
import Button from '../ui/Button'
import AcercaDeModal from '../AcercaDeModal'

export default function LandingHeader({ onContact, onCatalog, enCatalogo = false, onLogin }) {
  const [acercaOpen, setAcercaOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4">
          <div className="flex justify-start">
            <Button variant="secondary" size="sm" onClick={onContact}>
              <Mail size={14} />
              <span className="hidden sm:inline">Contacto</span>
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAcercaOpen(true)}
              title="Acerca de Yapa"
              aria-label="Ver versión y créditos de la app"
              className="flex items-center gap-2 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-slate-50"
            >
              <Logo className="h-8 w-8" />
              <p className="text-sm font-bold text-slate-800">
                Yapa
              </p>
            </button>
            <button
              onClick={() => setAcercaOpen(true)}
              title="Versión y créditos"
              aria-label="Acerca de Yapa"
              className="rounded-full p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
            >
              <Info size={14} />
            </button>
          </div>
          <div className="flex justify-end">
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
