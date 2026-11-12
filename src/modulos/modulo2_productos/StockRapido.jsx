import { useMemo, useState } from 'react'
import { Minus, Plus, Search } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye } from '../../utils/busqueda'
import { money } from '../../utils/format'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'

function FilaStock({ p }) {
  const { updateProducto, notify } = useKiosco()
  const [precio, setPrecio] = useState(String(p.precio))

  const mover = async (delta) => {
    const nuevo = Math.max(0, p.stock + delta)
    await updateProducto(p.id, { stock: nuevo })
  }

  const guardarPrecio = async () => {
    const v = Number(precio)
    if (!v || v <= 0) {
      setPrecio(String(p.precio))
      return notify('Precio inválido.', 'warn')
    }
    if (v === p.precio) return
    await updateProducto(p.id, { precio: v })
    notify(`${p.nombre}: precio actualizado a ${money(v)}.`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-50 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{p.nombre}</p>
        <p className="text-xs text-slate-400">{p.categoria}</p>
      </div>
      {p.stock < p.stockMin && <Badge tone="amber">Bajo mínimo</Badge>}
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
        <Button variant="ghost" size="sm" onClick={() => mover(-1)} disabled={p.stock <= 0} aria-label="Restar">
          <Minus size={14} />
        </Button>
        <span className={`w-10 text-center text-sm font-bold ${p.stock <= 0 ? 'text-rose-500' : 'text-slate-800'}`}>
          {p.stock}
        </span>
        <Button variant="ghost" size="sm" onClick={() => mover(1)} aria-label="Sumar">
          <Plus size={14} />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm text-slate-400">$</span>
        <input
          value={precio}
          onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ''))}
          onBlur={guardarPrecio}
          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
          inputMode="numeric"
          className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold text-emerald-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>
    </div>
  )
}

export default function StockRapido() {
  const { productos } = useKiosco()
  const [q, setQ] = useState('')

  const list = useMemo(
    () => productos.filter((p) => incluye(p.nombre, q)),
    [productos, q]
  )

  return (
    <Card title="Control de Stock en Mostrador" subtitle="Edición rápida de stock y precios de venta">
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>
      {list.length === 0 ? (
        <EmptyState title="Sin resultados" />
      ) : (
        <div>{list.map((p) => <FilaStock key={p.id} p={p} />)}</div>
      )}
    </Card>
  )
}
