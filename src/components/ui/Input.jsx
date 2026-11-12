const base =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100'

export default function Input({ label, className = '', ...props }) {
  const el = <input className={`${base} ${className}`} {...props} />
  if (!label) return el
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
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
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {el}
    </label>
  )
}
