import { Info, X } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import Logo from '../../assets/logo'
import AvatarCliente from '../ui/AvatarCliente'
import AvatarPersonal from '../ui/AvatarPersonal'

// Navegación por rol:
//  - Desktop (md+): sidebar vertical fija con activos en Azul Cobalto.
//  - Mobile/tablet (<md): cajón lateral (Drawer) con perfil del usuario
//    que se abre desde el botón hamburguesa del TopBar y se cierra solo
//    al elegir sección.
export default function RoleNav({ items, active, onChange, open = false, onClose }) {
  const { session, clienteSesion, personal } = useKiosco()

  const elegir = (key) => {
    onChange(key)
    onClose?.()
  }

  const itemCls = (key, base = 'px-3.5 py-2.5 text-sm') =>
    `flex items-center gap-3 rounded-xl font-medium transition-colors ${base} ${
      active === key
        ? 'bg-brand-soft text-brand'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`

  // Perfil visible del usuario en el cajón lateral (mobile).
  const perfil =
    session?.rol === 'cliente'
      ? clienteSesion
      : (personal || []).find((p) => p.id === session?.id)

  return (
    <>
      {/* Desktop: sidebar */}
      <nav className="sticky top-20 hidden h-fit w-56 shrink-0 flex-col gap-1 rounded-2xl bg-white shadow-soft p-3 shadow-sm md:flex">
        {items.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={itemCls(key)}
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </button>
        ))}
      </nav>

      {/* Mobile/tablet: cajón lateral deslizable */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <div
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <nav className="slide-in-left absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 pb-3">
              <div className="flex items-center gap-2.5">
                <Logo className="h-8 w-8" />
                <p className="text-sm font-extrabold tracking-tight text-slate-900">Yapa</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar menú"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Perfil del usuario: en staff abre "Mi Perfil"; en cliente
                navega a la billetera (donde edita avatar/foto). */}
            {perfil && (
              <button
                type="button"
                onClick={() => {
                  if (session.rol === 'cliente') elegir('billetera')
                  else {
                    window.dispatchEvent(new CustomEvent('yapa:perfil'))
                    onClose?.()
                  }
                }}
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 text-left transition-colors hover:bg-slate-50"
              >
                {session.rol === 'cliente' ? (
                  <AvatarCliente cliente={perfil} className="h-11 w-11" iconSize={20} textoClassName="text-sm" />
                ) : (
                  <AvatarPersonal persona={perfil} className="h-11 w-11" textoClassName="text-sm" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-800">{session.nombre}</span>
                  <span className="text-[11px] font-medium text-brand">
                    {session.rol === 'cliente' ? 'Cliente · ver mi billetera' : session.rol === 'admin' ? 'Administración · Mi Perfil' : 'Mostrador · Mi Perfil'}
                  </span>
                </span>
              </button>
            )}

            <div className="flex flex-col gap-1 p-4 pt-3">
              {items.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => elegir(key)}
                  className={itemCls(key, 'px-3.5 py-3 text-sm')}
                >
                  <Icon size={19} strokeWidth={2} />
                  {label}
                </button>
              ))}
            </div>

            {/* Acerca de la app: ítem limpio al pie del cajón */}
            <div className="mt-auto border-t border-slate-100 p-4 pt-3">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('yapa:acerca'))
                  onClose?.()
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <Info size={19} strokeWidth={2} />
                Acerca de Yapa
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
