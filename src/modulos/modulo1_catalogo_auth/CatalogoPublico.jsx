import { useMemo, useState } from 'react'
import { Minus, Plus, QrCode, Search } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye } from '../../utils/busqueda'
import { money } from '../../utils/format'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import ProductoImg from '../../components/ui/ProductoImg'
import PedidoQRModal from '../modulo4_clientes/PedidoQRModal'

export default function CatalogoPublico() {
  const { productos, categorias, session, clienteSesion } = useKiosco()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Todas')
  const [pedido, setPedido] = useState([]) // {productoId, cantidad} — solo rol cliente
  const [qrOpen, setQrOpen] = useState(false)

  const esCliente = session?.rol === 'cliente'

  const list = useMemo(
    () =>
      productos.filter(
        (p) =>
          (cat === 'Todas' || p.categoria === cat) &&
          incluye(p.nombre, q)
      ),
    [productos, q, cat]
  )

  const enPedido = (id) => pedido.find((i) => i.productoId === id)?.cantidad || 0

  const agregarPedido = (p) => {
    const actual = enPedido(p.id)
    if (actual + 1 > p.stock) return
    setPedido((c) =>
      actual ? c.map((i) => (i.productoId === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)) : [...c, { productoId: p.id, cantidad: 1 }]
    )
  }

  const restarPedido = (id) =>
    setPedido((c) =>
      c.map((i) => (i.productoId === id ? { ...i, cantidad: i.cantidad - 1 } : i)).filter((i) => i.cantidad > 0)
    )

  const itemsDetalle = pedido
    .map((i) => {
      const p = productos.find((x) => x.id === i.productoId)
      return p ? { ...i, nombre: p.nombre, precio: p.precio } : null
    })
    .filter(Boolean)

  const totalPedido = itemsDetalle.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const cantPedido = itemsDetalle.reduce((s, i) => s + i.cantidad, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto por nombre…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['Todas', ...categorias].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                cat === c
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState title="No encontramos productos" sub="Probá con otro nombre o categoría." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((p) => {
            const sinStock = p.stock <= 0
            const cant = enPedido(p.id)
            return (
              <article
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <ProductoImg producto={p} className="h-36 w-full sm:h-44" iconSize={44} />
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-sm font-semibold leading-snug text-slate-800">{p.nombre}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{p.categoria}</p>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                    <p className="text-base font-bold text-emerald-600">{money(p.precio)}</p>
                    {sinStock ? (
                      <Badge tone="rose">Sin stock</Badge>
                    ) : p.stock < p.stockMin ? (
                      <Badge tone="amber">Últimas {p.stock}</Badge>
                    ) : (
                      <Badge tone="emerald">Disponible</Badge>
                    )}
                  </div>
                </div>
                {esCliente && (
                  <div className="px-4 pb-4">
                    {cant === 0 ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        disabled={sinStock}
                        onClick={() => agregarPedido(p)}
                      >
                        <Plus size={14} /> Agregar al pedido
                      </Button>
                    ) : (
                      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-1">
                        <button onClick={() => restarPedido(p.id)} className="rounded-md p-1.5 text-emerald-700 hover:bg-white" aria-label="Quitar uno">
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-bold text-emerald-800">{cant}</span>
                        <button
                          onClick={() => agregarPedido(p)}
                          disabled={cant >= p.stock}
                          className="rounded-md p-1.5 text-emerald-700 hover:bg-white disabled:opacity-40"
                          aria-label="Agregar uno"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* Barra flotante del pedido express */}
      {esCliente && pedido.length > 0 && (
        <div className="pop-in fixed inset-x-0 bottom-16 z-30 px-4 lg:bottom-6">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <div className="min-w-0 px-1">
              <p className="text-sm font-bold text-slate-800">{cantPedido} ítem(s)</p>
              <p className="text-xs text-slate-500">Total {money(totalPedido)}</p>
            </div>
            <Button onClick={() => setQrOpen(true)}>
              <QrCode size={16} /> Generar QR de Pedido
            </Button>
          </div>
        </div>
      )}

      <PedidoQRModal cliente={clienteSesion} items={itemsDetalle} open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  )
}
