import { useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import Logo from '../../assets/logo'
import PseudoQR from './PseudoQR'
import AvatarCliente from '../../components/ui/AvatarCliente'
import SelectorAvatar from '../../components/ui/SelectorAvatar'
import Card from '../../components/ui/Card'

export default function CarnetCliente() {
  const { clienteSesion: a, config } = useKiosco()
  const [anio] = useState(() => new Date().getFullYear())
  if (!a) return null

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand to-brand-dark p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <div>
            <p className="text-sm font-bold leading-tight">{config.nombreKiosco}</p>
            <p className="text-[11px] text-blue-200">Carnet digital del cliente</p>
          </div>
        </div>

        <div className="relative mt-6 rounded-2xl bg-white p-4 text-slate-800 shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-xl border border-slate-100 bg-white p-1.5 shadow-sm">
                <PseudoQR text={a.dni} size={118} />
              </div>
              <AvatarCliente cliente={a} className="h-12 w-12 ring-2 ring-brand-soft" iconSize={22} textoClassName="text-sm" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight text-slate-800">
                {a.nombre} {a.apellido}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand">
                <BadgeCheck size={13} /> Cliente verificado
              </p>
              <p className="mt-2 font-mono text-xs tracking-wider text-slate-500">DNI {a.dni}</p>
              <div className="mt-2 flex h-6 items-end gap-[2px]" aria-hidden="true">
                {a.dni.split('').map((d, i) => (
                  <span
                    key={i}
                    className="inline-block w-[3px] bg-slate-800"
                    style={{ height: `${8 + ((Number(d) * 7 + i * 3) % 16)}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="relative mt-4 text-center text-[11px] text-blue-200">
          Presentá este carnet en el mostrador · Válido {anio}
        </p>
      </div>

      <Card
        title="Personalizá tu carnet"
        subtitle="Elegí un avatar o subí tu foto (solo se guarda en este dispositivo)"
        className="w-full max-w-sm"
      >
        <SelectorAvatar cliente={a} />
      </Card>
    </div>
  )
}
