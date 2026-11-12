import { avatarDe, fondoAvatar } from '../../utils/avatares'

// Muestra la foto (DataURL), el avatar (ícono vectorial) o las iniciales del cliente.
export default function AvatarCliente({ cliente: a, className = 'h-10 w-10', textoClassName = 'text-xs', iconSize = 20 }) {
  if (!a) return null
  if (a.foto) {
    return (
      <img
        src={a.foto}
        alt={`${a.nombre} ${a.apellido}`}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }
  const av = avatarDe(a.avatar)
  if (av) {
    const Icon = av.icon
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full ${fondoAvatar(a.avatar)} ${className}`}
        title={av.nombre}
      >
        <Icon size={iconSize} strokeWidth={2} />
      </div>
    )
  }
  const ini = `${a.nombre?.[0] || ''}${a.apellido?.[0] || ''}`.toUpperCase() || '?'
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-500 ${textoClassName} ${className}`}>
      {ini}
    </div>
  )
}
