// Estilo Wolt: campos suaves en #F6F6F6 sin bordes duros, focus ring celeste.
const base =
  'w-full rounded-xl border border-transparent bg-[#F6F6F6] px-4 py-3 text-[15px] text-ink placeholder-slate-400 transition-all duration-200 ease-out focus:border-[#009DE0]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#009DE0]/25'

export default function Input({ label, className = '', ...props }) {
  const el = <input className={`${base} ${className}`} {...props} />
  if (!label) return el
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {el}
    </label>
  )
}

export function Select({ label, className = '', children, ...props }) {
  const el = (
    <select className={`${base} ${className}`} {...props}>
      {children}
    </select>
  )
  if (!label) return el
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {el}
    </label>
  )
}
