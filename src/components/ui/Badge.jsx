const TONES = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  brand: 'bg-brand-soft text-brand ring-blue-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  white: 'bg-white/20 text-white ring-white/30',
}

export default function Badge({ tone = 'slate', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
