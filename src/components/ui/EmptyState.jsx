import { PackageOpen } from 'lucide-react'

export default function EmptyState({ icon: Icon = PackageOpen, title = 'Sin resultados', sub }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-3xl bg-[#F6F6F6] px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#009DE0] shadow-soft">
        <Icon size={24} strokeWidth={1.8} />
      </div>
      <p className="text-sm font-bold text-[#202125]">{title}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
