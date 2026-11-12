// Avatar del integrante del equipo: foto (DataURL/URL en avatarUrl) o
// círculo con iniciales como fallback.
export default function AvatarPersonal({ persona: p, className = 'h-10 w-10', textoClassName = 'text-sm' }) {
  if (!p) return null
  if (p.avatarUrl) {
    return (
      <img
        src={p.avatarUrl}
        alt={`${p.nombre} ${p.apellido}`}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }
  const ini = `${p.nombre?.[0] || ''}${p.apellido?.[0] || ''}`.toUpperCase() || '?'
  const fondo = p.rol === 'admin' ? 'bg-rose-100 text-rose-600' : 'bg-brand-soft text-brand'
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-bold ${fondo} ${textoClassName} ${className}`}>
      {ini}
    </div>
  )
}
