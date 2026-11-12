import { useMemo, useState } from 'react'
import { Loader2, Minus, PackageCheck, Plus, QrCode, Search, ShoppingBag, Store, X } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye } from '../../utils/busqueda'
import { money } from '../../utils/format'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import ProductoImg from '../../components/ui/ProductoImg'
import CategoriaTile3D from '../../components/ui/CategoriaTile3D'
import PedidoQRModal from '../modulo4_clientes/PedidoQRModal'

// Catálogo estilo Wolt Groceries: fila de categorías 3D pastel arriba,
// tarjetas suaves sin bordes duros, detalle en bottom sheet y dock
// flotante oscuro (#202125) con buscador rápido + botón celeste de pedido.
export default function CatalogoPublico() {
  const { productos, categorias, session, clienteSesion, config, encargos, enviarEncargo, notify } = useKiosco()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Todas')
  const [pedido, setPedido] = useState([]) // {productoId, cantidad} — clientes e invitados
  const [detalle, setDetalle] = useState(null) // producto abierto en el sheet
  const [cantDetalle, setCantDetalle] = useState(1)
  const [carritoOpen, setCarritoOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [pasoEncargo, setPasoEncargo] = useState('carrito') // 'carrito' | 'quien'
  const [quienRetira, setQuienRetira] = useState('titular') // 'titular' | 'tercero'
  const [terceroNombre, setTerceroNombre] = useState('')
  const [terceroDni, setTerceroDni] = useState('')

  const esCliente = session?.rol === 'cliente'

  // Encargos propios del cliente logueado (tira "Mis pedidos para retirar").
  const misEncargos = useMemo(
    () =>
      esCliente
        ? (encargos || []).filter(
            (e) => e.clienteId === clienteSesion?.id && (e.estado === 'en_preparacion' || e.estado === 'listo_retiro')
          )
        : [],
    [esCliente, encargos, clienteSesion]
  )
  const hayListos = misEncargos.some((e) => e.estado === 'listo_retiro')

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

  const agregarPedido = (p, cantidad = 1) => {
    const actual = enPedido(p.id)
    const nueva = Math.min(actual + cantidad, p.stock)
    if (nueva <= actual) return
    setPedido((c) =>
      actual ? c.map((i) => (i.productoId === p.id ? { ...i, cantidad: nueva } : i)) : [...c, { productoId: p.id, cantidad: nueva }]
    )
  }

  const restarPedido = (id) =>
    setPedido((c) =>
      c.map((i) => (i.productoId === id ? { ...i, cantidad: i.cantidad - 1 } : i)).filter((i) => i.cantidad > 0)
    )

  const abrirDetalle = (p) => {
    setDetalle(p)
    setCantDetalle(1)
  }

  const itemsDetalle = pedido
    .map((i) => {
      const p = productos.find((x) => x.id === i.productoId)
      return p ? { ...i, nombre: p.nombre, precio: p.precio, foto: p.foto, categoria: p.categoria } : null
    })
    .filter(Boolean)

  const totalPedido = itemsDetalle.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const cantPedido = itemsDetalle.reduce((s, i) => s + i.cantidad, 0)

  // Modo B: el cliente logueado envía el carrito para que el mostrador
  // arme la bolsa; luego lo retira con QR. No paga acá: paga al retirar.
  const mandarEncargo = async () => {
    setEnviando(true)
    try {
      // Tercero autorizado: solo si el paso "¿Quién retira?" eligió esa vía.
      const tercero =
        quienRetira === 'tercero' && terceroNombre.trim() && terceroDni.trim()
          ? { nombre: terceroNombre.trim(), dni: terceroDni.trim() }
          : null
      await enviarEncargo(pedido, tercero)
      setPedido([])
      setCarritoOpen(false)
      setPasoEncargo('carrito')
      setQuienRetira('titular')
      setTerceroNombre('')
      setTerceroDni('')
      notify('Pedido enviado al mostrador. Te avisamos cuando esté listo para retirar.', 'success')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Encargos activos del cliente: banner que lleva a "Mis Encargos"
          (ahí ve el detalle y genera el QR de retiro, incluso multi-pedido). */}
      {misEncargos.length > 0 && (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('yapa:nav', { detail: 'encargos' }))}
          className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-soft transition-all duration-200 ease-out hover:shadow-lift active:scale-[0.99]"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${hayListos ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${hayListos ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#202125]">
              {misEncargos.length === 1 ? 'Tenés 1 pedido' : `Tenés ${misEncargos.length} pedidos`}
              {hayListos ? ' listo para retirar' : ' en preparación'}
            </p>
            <p className="text-[11px] font-medium text-slate-400">
              {hayListos ? 'Tocá para ver tu QR de retiro' : 'Te avisamos cuando esté listo'}
            </p>
          </div>
          <PackageCheck size={18} className="shrink-0 text-[#009DE0]" />
        </button>
      )}

      {/* Fila horizontal de Categorías 3D pastel */}
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" style={{ scrollBehavior: 'smooth' }}>
        <CategoriaTile3D nombre="Todas" activo={cat === 'Todas'} onClick={() => setCat('Todas')} />
        {categorias.map((c) => (
          <CategoriaTile3D key={c} nombre={c} activo={cat === c} onClick={() => setCat(cat === c ? 'Todas' : c)} />
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title="No encontramos productos" sub="Probá con otro nombre o categoría." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const sinStock = p.stock <= 0
            const cant = enPedido(p.id)
            return (
              <article
                key={p.id}
                onClick={() => abrirDetalle(p)}
                className={`group flex cursor-pointer gap-3 rounded-3xl bg-white p-3 shadow-soft transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98] ${sinStock ? 'opacity-70' : ''}`}
              >
                {/* Info a la izquierda */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-sm font-bold text-[#202125]">{p.nombre}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400">
                    {p.descripcion || p.categoria}
                  </p>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <p className="text-base font-extrabold tracking-tight text-[#202125]">{money(p.precio)}</p>
                    {sinStock ? (
                      <Badge tone="rose">Sin stock</Badge>
                    ) : p.stock < p.stockMin ? (
                      <Badge tone="amber">Últimas {p.stock}</Badge>
                    ) : null}
                  </div>
                </div>

                {/* Foto real a la derecha + botón flotante celeste */}
                <div className="relative shrink-0">
                  <ProductoImg producto={p} className="h-24 w-24 rounded-2xl sm:h-28 sm:w-28" iconSize={30} />
                  {!sinStock && (
                    cant === 0 ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); agregarPedido(p) }}
                        aria-label={`Agregar ${p.nombre} al pedido`}
                        className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#009DE0] text-white shadow-lg transition-all duration-150 ease-out hover:bg-[#0086C0] active:scale-90"
                      >
                        <Plus size={18} strokeWidth={2.5} />
                      </button>
                    ) : (
                      <div className="absolute -bottom-2 -right-2 flex items-center gap-0.5 rounded-full bg-[#009DE0] p-1 text-white shadow-lg">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); restarPedido(p.id) }}
                          aria-label="Quitar uno"
                          className="rounded-full p-1 transition-transform hover:bg-white/15 active:scale-90"
                        >
                          <Minus size={13} strokeWidth={2.5} />
                        </button>
                        <span className="min-w-4 text-center text-xs font-bold">{cant}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); agregarPedido(p) }}
                          disabled={cant >= p.stock}
                          aria-label="Agregar uno"
                          className="rounded-full p-1 transition-transform hover:bg-white/15 active:scale-90 disabled:opacity-40"
                        >
                          <Plus size={13} strokeWidth={2.5} />
                        </button>
                      </div>
                    )
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Dock flotante inferior: buscador rápido + carrito celeste */}
      <div className="fixed inset-x-0 bottom-4 z-30 px-4 md:bottom-6">
        <div className="mx-auto flex w-full max-w-lg items-center gap-2 rounded-full bg-[#202125] p-2 pl-4 shadow-lift ring-1 ring-white/10">
          <Search size={16} className="shrink-0 text-white/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en el kiosco…"
            aria-label="Buscar producto"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white placeholder-white/40 focus:outline-none"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Limpiar búsqueda"
              className="rounded-full p-1 text-white/40 transition-colors hover:text-white/80"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => pedido.length > 0 && setCarritoOpen(true)}
            disabled={pedido.length === 0}
            className="flex shrink-0 items-center gap-2 rounded-full bg-[#009DE0] px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-200 ease-out hover:bg-[#0086C0] active:scale-95 disabled:opacity-50"
            title="Ver tu pedido"
          >
            <ShoppingBag size={16} />
            {cantPedido > 0 && <span>{cantPedido}</span>}
            {totalPedido > 0 && <span className="hidden sm:inline">{money(totalPedido)}</span>}
          </button>
        </div>
      </div>

      {/* Bottom sheet de producto: foto grande + cantidad + agregar */}
      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={detalle?.nombre || ''}>
        {detalle && (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-3xl bg-[#F6F6F6]">
              <ProductoImg producto={detalle} className="h-52 w-full sm:h-64" iconSize={56} />
            </div>
            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-extrabold tracking-tight text-[#202125]">{detalle.nombre}</p>
                <Badge tone="brand">{detalle.categoria}</Badge>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {detalle.descripcion || 'Producto disponible en el kiosco.'}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-400">
                {detalle.stock > 0 ? `${detalle.stock} en stock` : 'Sin stock por ahora'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full bg-[#F6F6F6] p-1.5">
                <button
                  type="button"
                  onClick={() => setCantDetalle((c) => Math.max(1, c - 1))}
                  aria-label="Restar unidad"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm transition-all duration-150 active:scale-90 disabled:opacity-40"
                  disabled={cantDetalle <= 1}
                >
                  <Minus size={16} strokeWidth={2.5} />
                </button>
                <span className="min-w-8 text-center text-base font-extrabold text-[#202125]">{cantDetalle}</span>
                <button
                  type="button"
                  onClick={() => setCantDetalle((c) => Math.min(detalle.stock - enPedido(detalle.id), c + 1))}
                  aria-label="Sumar unidad"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm transition-all duration-150 active:scale-90 disabled:opacity-40"
                  disabled={cantDetalle + enPedido(detalle.id) >= detalle.stock}
                >
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
              <button
                type="button"
                disabled={detalle.stock <= 0 || cantDetalle > detalle.stock - enPedido(detalle.id)}
                onClick={() => { agregarPedido(detalle, cantDetalle); setDetalle(null) }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#009DE0] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-200 ease-out hover:bg-[#0086C0] active:scale-[0.98] disabled:opacity-50"
              >
                <ShoppingBag size={17} />
                Agregar al pedido {money(detalle.precio * cantDetalle)}
              </button>
            </div>
            {enPedido(detalle.id) > 0 && (
              <p className="text-center text-xs font-medium text-[#007AB8]">
                Ya llevás {enPedido(detalle.id)} en tu pedido
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Carrito como bottom sheet */}
      <Modal open={carritoOpen} onClose={() => { setCarritoOpen(false); setPasoEncargo('carrito') }} title="Tu pedido">
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y divide-slate-100">
            {itemsDetalle.map((i) => (
              <li key={i.productoId} className="flex items-center gap-3 py-3">
                <ProductoImg producto={i} className="h-12 w-12 rounded-xl" iconSize={18} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#202125]">{i.nombre}</p>
                  <p className="text-xs text-slate-400">{money(i.precio)} c/u</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-[#F6F6F6] p-1">
                  <button
                    type="button"
                    onClick={() => restarPedido(i.productoId)}
                    aria-label="Quitar uno"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition-all duration-150 active:scale-90"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="min-w-5 text-center text-sm font-bold text-[#202125]">{i.cantidad}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const p = productos.find((x) => x.id === i.productoId)
                      if (p) agregarPedido(p)
                    }}
                    aria-label="Agregar uno"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition-all duration-150 active:scale-90"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <span className="w-16 shrink-0 text-right text-sm font-bold text-[#202125]">
                  {money(i.precio * i.cantidad)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-semibold text-slate-500">Total</span>
            <span className="text-lg font-extrabold tracking-tight text-[#202125]">{money(totalPedido)}</span>
          </div>
          {pasoEncargo === 'carrito' ? (
            <>
              {/* Paso 1: elegir el modo del pedido */}
              <Button
                size="lg"
                className="w-full rounded-2xl"
                onClick={() => { setCarritoOpen(false); setQrOpen(true) }}
              >
                <QrCode size={17} /> Generar QR Express
              </Button>
              <p className="-mt-1 text-center text-[11px] text-slate-400">
                Sin registro: se cobra en mostrador como consumidor final.
              </p>

              {/* Encargo anticipado: solo clientes logueados con recepción activa */}
              {esCliente &&
                (config.recibiendoEncargos ? (
                  <button
                    type="button"
                    onClick={() => setPasoEncargo('quien')}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#009DE0] px-4 py-4 text-[15px] font-bold text-white transition-all duration-200 ease-out hover:bg-[#0086C0] active:scale-[0.98]"
                  >
                    <Store size={17} /> Retirar pedido en local (Encargo)
                  </button>
                ) : (
                  <p className="rounded-2xl bg-[#F6F6F6] px-4 py-3 text-center text-xs font-medium text-slate-400">
                    El kiosco no está recibiendo encargos en este momento.
                  </p>
                ))}
            </>
          ) : (
            <>
              {/* Paso 2: quién retira la bolsa */}
              <p className="text-center text-sm font-extrabold text-[#202125]">
                ¿Quién retira el pedido?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: 'titular', label: 'Retiro yo', sub: 'Titular de la cuenta' },
                  { k: 'tercero', label: 'Retira otra persona', sub: 'Autorizado con DNI' },
                ].map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => setQuienRetira(o.k)}
                    className={`flex flex-col items-center gap-0.5 rounded-2xl px-3 py-3.5 text-center transition-all duration-200 ease-out active:scale-[0.97] ${
                      quienRetira === o.k
                        ? 'bg-[#009DE0] text-white shadow-md'
                        : 'bg-[#F6F6F6] text-slate-600 hover:bg-[#EBF7FD] hover:text-[#007AB8]'
                    }`}
                  >
                    <span className="text-sm font-bold">{o.label}</span>
                    <span className={`text-[11px] ${quienRetira === o.k ? 'text-white/80' : 'text-slate-400'}`}>
                      {o.sub}
                    </span>
                  </button>
                ))}
              </div>

              {/* Los datos del autorizado solo aparecen si retira un tercero */}
              {quienRetira === 'tercero' && (
                <div className="fade-in grid grid-cols-2 gap-2 rounded-2xl bg-[#F6F6F6] px-4 py-3">
                  <input
                    value={terceroNombre}
                    onChange={(e) => setTerceroNombre(e.target.value)}
                    placeholder="Nombre y apellido"
                    className="min-w-0 rounded-xl border border-transparent bg-white px-3 py-2.5 text-sm focus:border-[#009DE0]/40 focus:outline-none focus:ring-2 focus:ring-[#009DE0]/25"
                  />
                  <input
                    value={terceroDni}
                    onChange={(e) => setTerceroDni(e.target.value.replace(/\D/g, ''))}
                    placeholder="DNI"
                    inputMode="numeric"
                    className="min-w-0 rounded-xl border border-transparent bg-white px-3 py-2.5 text-sm focus:border-[#009DE0]/40 focus:outline-none focus:ring-2 focus:ring-[#009DE0]/25"
                  />
                </div>
              )}

              <button
                type="button"
                disabled={enviando || (quienRetira === 'tercero' && (!terceroNombre.trim() || !terceroDni.trim()))}
                onClick={mandarEncargo}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#009DE0] px-4 py-4 text-[15px] font-bold text-white transition-all duration-200 ease-out hover:bg-[#0086C0] active:scale-[0.98] disabled:opacity-50"
              >
                {enviando ? <Loader2 size={17} className="animate-spin" /> : <PackageCheck size={17} />}
                {enviando ? 'Enviando…' : `Confirmar encargo · ${money(totalPedido)}`}
              </button>
              <button
                type="button"
                onClick={() => setPasoEncargo('carrito')}
                className="w-full text-center text-xs font-semibold text-slate-400 transition-colors hover:text-[#007AB8]"
              >
                Volver al pedido
              </button>
            </>
          )}
        </div>
      </Modal>

      <PedidoQRModal cliente={clienteSesion} items={itemsDetalle} open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  )
}
