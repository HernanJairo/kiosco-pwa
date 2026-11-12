import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { diasHasta, diasTxt, fmtFecha } from '../../utils/format'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'

const ESTADO_META = {
  rojo: { bar: 'border-l-rose-500', dot: 'bg-rose-500', tone: 'rose', label: 'Crítico' },
  amarillo: { bar: 'border-l-amber-400', dot: 'bg-amber-400', tone: 'amber', label: 'Preventivo' },
  verde: { bar: 'border-l-emerald-500', dot: 'bg-emerald-500', tone: 'emerald', label: 'Óptimo' },
}
const ORDEN = { rojo: 0, amarillo: 1, verde: 2 }

function evalProducto(p) {
  const dias = diasHasta(p.vencimiento)
  const razones = []
  let estado = 'verde'
  if (dias !== null && dias < 0) {
    estado = 'rojo'
    razones.push(diasTxt(dias))
  }
  if (p.stock < p.stockMin) {
    estado = 'rojo'
    razones.push(`Stock crítico (${p.stock}/${p.stockMin} u.)`)
  }
  if (estado === 'verde' && dias !== null && dias <= 7) {
    estado = 'amarillo'
    razones.push(diasTxt(dias))
  }
  if (!razones.length) razones.push('Óptimo')
  return { estado, dias, razones }
}

export default function VencimientosPanel() {
  const { productos } = useKiosco()
  const [filtro, setFiltro] = useState('todos')

  const evaluados = useMemo(
    () =>
      productos
        .map((p) => ({ ...p, ...evalProducto(p) }))
        .sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || (a.dias ?? 9999) - (b.dias ?? 9999)),
    [productos]
  )

  const conteos = useMemo(
    () => evaluados.reduce((acc, p) => ({ ...acc, [p.estado]: (acc[p.estado] || 0) + 1 }), {}),
    [evaluados]
  )

  const list = filtro === 'todos' ? evaluados : evaluados.filter((p) => p.estado === filtro)

  return (
    <Card
      title="Control de Vencimientos"
      subtitle="Semáforo preventivo: vencidos o stock crítico (rojo), vencen en ≤7 días (amarillo), óptimos (verde)"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CalendarClock size={16} className="text-slate-400" />
        {[
          { k: 'todos', label: `Todos (${evaluados.length})` },
          { k: 'rojo', label: `🔴 Críticos (${conteos.rojo || 0})` },
          { k: 'amarillo', label: `🟡 Preventivos (${conteos.amarillo || 0})` },
          { k: 'verde', label: `🟢 Óptimos (${conteos.verde || 0})` },
        ].map((f) => (
          <button
            key={f.k}
            onClick={() => setFiltro(f.k)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filtro === f.k
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No hay productos en este estado" />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((p) => {
            const meta = ESTADO_META[p.estado]
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border border-slate-200 border-l-4 bg-white px-4 py-3 ${meta.bar}`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {p.categoria} · Stock {p.stock}/{p.stockMin} u.
                    {p.vencimiento ? ` · Vence ${fmtFecha(p.vencimiento)}` : ' · Sin vencimiento'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="text-[11px] text-slate-400">{p.razones.join(' · ')}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
