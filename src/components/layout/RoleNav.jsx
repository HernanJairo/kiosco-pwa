import { Info, X } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import Logo from '../../assets/logo'
import AvatarCliente from '../ui/AvatarCliente'
import AvatarPersonal from '../ui/AvatarPersonal'

// Paleta pastel rotativa para los contenedores de ícono (estética Wolt/v0).
const NAV_TONES = [
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-emerald-100 text-emerald-700',
  'bg-cyan-100 text-cyan-700',
  'bg-violet-100 text-violet-700',
]

// Navegación por rol:
//  - Desktop (md+): sidebar vertical blanca, ítems con ícono en tile
//    pastel; el activo se destaca en celeste hielo con tile sólido #009DE0.
//  - Mobile/tablet (<md): cajón lateral (Drawer) con perfil del usuario
//    que se abre desde el botón hamburguesa del TopBar y se cierra solo
//    al elegir sección.
export default function RoleNav({ items, active, onChange, open = false, onClose }) {
  const { session, clienteSesion, personal } = useKiosco()

  const elegir = (key) => {
    onChange(key)
    onClose?.()
  }

  const itemCls = (key, base = 'px-3 py-2.5 text-sm') =>
    `flex w-full items-center gap-3 rounded-xl font-bold transition-all duration-150 active:scale-[0.98] ${base} ${
      active === key
        ? 'bg-[#EBF7FD] text-[#007AB8]'
        : 'text-[#555963] hover:bg-[#F6F6F6] hover:text-[#202125]'
    }`

  const tileCls = (key, i) =>
    `grid h-8 w-8 shrink-0 place-items-center rounded-[10px] transition-colors ${
      active === key ? 'bg-[#009DE0] text-white shadow-sm' : NAV_TONES[i % NAV_TONES.length]
    }`

  // Perfil visible del usuario en el cajón lateral (mobile).
  const perfil =
    session?.rol === 'cliente'
      ? clienteSesion
      : (personal || []).find((p) => p.id === session?.id)

  return (
    <>
      {/* Desktop: sidebar */}
      <nav className="sticky top-20 hidden h-fit w-56 shrink-0 flex-col gap-1 rounded-2xl bg-white p-3 shadow-[0_4px_20px_rgba(32,33,37,0.05)] md:flex">
        {items.map(({ key, label, icon: Icon }, i) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={itemCls(key)}
          >
            <span className={tileCls(key, i)}>
              <Icon size={16} strokeWidth={2} />
            </span>
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
          <nav className="slide-in-left absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F3F3F3] p-4 pb-3">
              <div className="flex items-center gap-2.5">
                <Logo className="h-8 w-8" />
                <p className="text-sm font-extrabold tracking-tight text-[#202125]">Yapa</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar menú"
                className="rounded-xl bg-[#F6F6F6] p-1.5 text-[#555963] transition-colors hover:bg-[#EBF7FD] hover:text-[#007AB8]"
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
                className="flex items-center gap-3 border-b border-[#F3F3F3] px-4 py-4 text-left transition-colors hover:bg-[#F8F8F8]"
              >
                {session.rol === 'cliente' ? (
                  <AvatarCliente cliente={perfil} className="h-11 w-11" iconSize={20} textoClassName="text-sm" />
                ) : (
                  <AvatarPersonal persona={perfil} className="h-11 w-11" textoClassName="text-sm" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[#202125]">{session.nombre}</span>
                  <span className="text-[11px] font-semibold text-[#007AB8]">
                    {session.rol === 'cliente' ? 'Cliente · ver mi billetera' : session.rol === 'admin' ? 'Administración · Mi Perfil' : 'Mostrador · Mi Perfil'}
                  </span>
                </span>
              </button>
            )}

            <div className="flex flex-col gap-1 p-4 pt-3">
              {items.map(({ key, label, icon: Icon }, i) => (
                <button
                  key={key}
                  onClick={() => elegir(key)}
                  className={itemCls(key, 'px-3 py-3 text-sm')}
                >
                  <span className={tileCls(key, i)}>
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  {label}
                </button>
              ))}
            </div>

            {/* Acerca de la app: ítem limpio al pie del cajón */}
            <div className="mt-auto border-t border-[#F3F3F3] p-4 pt-3">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('yapa:acerca'))
                  onClose?.()
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#555963] transition-colors hover:bg-[#F6F6F6] hover:text-[#202125]"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#EBF7FD] text-[#007AB8]">
                  <Info size={16} strokeWidth={2} />
                </span>
                Acerca de Yapa
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
