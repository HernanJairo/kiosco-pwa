const VARIANTS = {
  primary: 'bg-[#009DE0] text-white hover:bg-[#0086C0] shadow-sm',
  secondary: 'bg-[#EBF7FD] text-[#007AB8] hover:bg-[#D6EFFB]',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
  danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm',
  warn: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100',
}

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-3 text-sm sm:text-base gap-2',
  lg: 'px-5 py-3.5 text-base gap-2',
}

export default function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009DE0]/40 disabled:pointer-events-none disabled:opacity-50 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
