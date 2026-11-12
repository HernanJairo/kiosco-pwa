import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Banknote, CheckCircle2, ChevronDown, ChevronUp, HandCoins, Hourglass, Landmark, Loader2, Minus, Plus, ScanLine, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye, norm } from '../../utils/busqueda'
import { fmtFechaHora, money } from '../../utils/format'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import ProductoImg from '../../components/ui/ProductoImg'
import EscanerCamara from '../../components/ui/EscanerCamara'
import TicketVenta from './TicketVenta'

const METODOS = [
  { k: 'efectivo', label: 'Efectivo', icon: Banknote, active: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { k: 'transferencia', label: 'Transferencia', icon: Landmark, active: 'border-indigo-400 bg-indigo-50 text-indigo-700' },
  { k: 'fiado', label: 'Fiado', icon: HandCoins, active: 'border-amber-400 bg-amber-50 text-amber-700' },
]

// Clave de sessionStorage donde vive el ticket en curso: sobrevive a
// cambios de pestaña del menú (desmontaje del componente) y se descarta
// al cerrar la pestaña del navegador.
const CART_KEY = 'kiosco_cart_temp'

// Buscador de alumnos reutilizable: se usa en modo fiado (obligatorio) y
// en contado cuando el vendedor elige asociar la venta a un alumno.
function BuscadorAlumno({ q, onQ, resultados, onSelect, borde = 'border-slate-200' }) {
  return (
    <>
      <input
        value={q}
        onChange={(e) => onQ(e.target.value)}
        placeholder="Buscar alumno por nombre, DNI o curso…"
        className={`w-full rounded-lg border ${borde} bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100`}
      />
      <ul className="mt-2 flex max-h-44 flex-col gap-1 overflow-y-auto">
        {resultados.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => onSelect(a)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white"
            >
              <AvatarAlumno alumno={a} className="h-7 w-7" emojiClassName="text-sm" textoClassName="text-[9px]" />
              <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{a.nombre} {a.apellido} · {a.curso}</span>
              <span className="text-[11px] text-slate-400">debe {money(a.deuda)}</span>
            </button>
          </li>
        ))}
        {resultados.length === 0 && (
          <li className="px-3 py-2 text-xs text-slate-400">Sin coincidencias</li>
        )}
      </ul>
    </>
  )
}

// Tarjeta del alumno ya seleccionado, con opción de quitarlo.
function AlumnoElegido({ alumno, onQuitar, detalle }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <AvatarAlumno alumno={alumno} className="h-9 w-9" emojiClassName="text-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">
          {alumno.nombre} {alumno.apellido}
        </p>
        <p className="text-[11px] text-slate-500">{detalle}</p>
      </div>
      <button onClick={onQuitar} className="rounded-lg p-1 text-slate-400 hover:bg-white" aria-label="Quitar alumno">
        <X size={15} />
      </button>
    </div>
  )
}

export default function TerminalPOS() {
  const { productos, alumnos, categorias, ventas, registrarVenta, aprobarCobroEspera, anularVenta, notify, session, config } = useKiosco()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Todas')
  const [cart, setCart] = useState(() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(CART_KEY) || '[]')
      return Array.isArray(raw)
        ? raw.filter((i) => i && i.productoId && Number(i.cantidad) > 0)
        : []
    } catch {
      return []
    }
  }) // {productoId, cantidad} — se restaura de sessionStorage al montar
  const [metodo, setMetodo] = useState('efectivo')
  const [qAlumno, setQAlumno] = useState('')
  const [alumnoSel, setAlumnoSel] = useState(null)
  const [buscarAlumno, setBuscarAlumno] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ticket, setTicket] = useState(null)
  const [transfOpen, setTransfOpen] = useState(false)
  const [excepcionOpen, setExcepcionOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false) // ticket desplegado (mobile)
  const [esperaOpen, setEsperaOpen] = useState(false)
  const [cobroOpen, setCobroOpen] = useState(false) // modal obligatorio antes de asentar la venta

  const limiteFiado = Number(config.limiteFiadoGlobal) || 0

  // Persistencia del ticket: cada cambio del carrito se refleja en
  // sessionStorage (el estado inicial ya lo restauró al montar). Se
  // limpia solo cuando el carrito queda vacío: venta confirmada o
  // "Vaciar carrito" explícito.
  useEffect(() => {
    try {
      if (cart.length) sessionStorage.setItem(CART_KEY, JSON.stringify(cart))
      else sessionStorage.removeItem(CART_KEY)
    } catch {
      /* storage bloqueado o lleno: el ticket sigue solo en memoria */
    }
  }, [cart])

  // Sanea el ticket restaurado: descarta productos que ya no existen o
  // quedaron sin stock, y limita cantidades al stock disponible.
  useEffect(() => {
    if (!productos.length) return
    setCart((c) => {
      let cambio = false
      const limpia = []
      for (const i of c) {
        const p = productos.find((x) => x.id === i.productoId)
        if (!p || p.stock <= 0) { cambio = true; continue }
        const cant = Math.min(i.cantidad, p.stock)
        if (cant !== i.cantidad) cambio = true
        limpia.push({ productoId: i.productoId, cantidad: cant })
      }
      return cambio ? limpia : c
    })
  }, [productos])

  const list = useMemo(
    () =>
      productos.filter((p) => {
        const t = norm(q).trim()
        return (
          (cat === 'Todas' || p.categoria === cat) &&
          (incluye(p.nombre, q) || p.codigos?.some((c) => c.includes(t)))
        )
      }),
    [productos, q, cat]
  )

  const alumnosFiltrados = useMemo(
    () =>
      alumnos
        .filter((a) =>
          incluye(`${a.nombre} ${a.apellido} ${a.dni} ${a.curso}`, qAlumno)
        )
        .slice(0, 6),
    [alumnos, qAlumno]
  )

  const enCarrito = (id) => cart.find((i) => i.productoId === id)?.cantidad || 0

  const agregar = (p) => {
    if (!config.abierto) return notify('Kiosco cerrado: no se pueden registrar ventas.', 'warn')
    const actual = enCarrito(p.id)
    if (actual + 1 > p.stock) return notify(`Sin stock suficiente de ${p.nombre}.`, 'warn')
    setCart((c) =>
      actual ? c.map((i) => (i.productoId === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)) : [...c, { productoId: p.id, cantidad: 1 }]
    )
  }

  const setCantidad = (id, cantidad) => {
    const p = productos.find((x) => x.id === id)
    if (cantidad <= 0) return setCart((c) => c.filter((i) => i.productoId !== id))
    if (cantidad > p.stock) return notify(`Stock máximo: ${p.stock}.`, 'warn')
    setCart((c) => c.map((i) => (i.productoId === id ? { ...i, cantidad } : i)))
  }

  const total = cart.reduce((s, i) => {
    const p = productos.find((x) => x.id === i.productoId)
    return s + (p ? p.precio * i.cantidad : 0)
  }, 0)

  const deudaProyectada = (alumnoSel?.deuda || 0) + total
  const superaLimite = metodo === 'fiado' && !!alumnoSel && limiteFiado > 0 && deudaProyectada > limiteFiado

  // Transferencias guardadas en espera de acreditación (stock ya descontado).
  const enEspera = useMemo(
    () => ventas.filter((v) => v.estado === 'en_espera_transferencia' && !v.anulada),
    [ventas]
  )
  const cantItems = cart.reduce((s, i) => s + i.cantidad, 0)

  const limpiarTicket = () => {
    setCart([])
    setMetodo('efectivo')
    setAlumnoSel(null)
    setQAlumno('')
    setBuscarAlumno(false)
    setSheetOpen(false)
    setCobroOpen(false)
  }

  // Vacío explícito: única vía, junto con una venta confirmada, para
  // descartar el ticket persistido en sessionStorage.
  const vaciarCarrito = () => {
    limpiarTicket()
    notify('Carrito vaciado.', 'info')
  }

  const ejecutarVenta = async ({ excepcionFiado = false, enEspera: enEsperaFlag = false } = {}) => {
    setBusy(true)
    try {
      const venta = await registrarVenta({
        items: cart,
        metodo,
        alumnoId: alumnoSel?.id,
        vendedor: session?.nombre || 'mostrador',
        excepcionFiado,
        enEspera: enEsperaFlag,
      })
      limpiarTicket()
      if (enEsperaFlag) {
        notify(`Venta en espera · ${money(venta.total)}. Aprobala cuando impacte la transferencia.`, 'info')
      } else {
        setTicket(venta)
        notify(`Venta registrada · ${money(venta.total)}`)
      }
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  // El botón "Cobrar $X" nunca asienta la venta: solo abre el modal de
  // cobro, donde se elige método y se confirma en un segundo paso.
  const abrirCobro = () => {
    if (!config.abierto) return notify('Kiosco cerrado: no se pueden registrar ventas.', 'warn')
    if (!cart.length) return notify('El carrito está vacío.', 'warn')
    setCobroOpen(true)
  }

  // "Confirmar Cobro" del modal (o tecla Enter): valida el ticket y
  // deriva al flujo propio de cada método de pago.
  const confirmarCobro = () => {
    if (busy) return
    if (!config.abierto) return notify('Kiosco cerrado: no se pueden registrar ventas.', 'warn')
    if (!cart.length) return notify('El carrito está vacío.', 'warn')
    if (metodo === 'fiado' && !alumnoSel) return notify('El fiado exige seleccionar un alumno.', 'warn')
    if (superaLimite) { setCobroOpen(false); return setExcepcionOpen(true) }
    if (metodo === 'transferencia') { setCobroOpen(false); return setTransfOpen(true) }
    ejecutarVenta()
  }

  // Atajo de teclado del modal de cobro: Enter confirma si el ticket es
  // válido. Escape ya lo maneja Modal (vuelve sin perder el carrito).
  useEffect(() => {
    if (!cobroOpen) return
    const onKey = (e) => {
      if (e.key !== 'Enter') return
      if (e.target?.tagName === 'BUTTON') return // Enter nativo sobre el botón enfocado
      e.preventDefault()
      confirmarCobro()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const resolverEspera = async (v, aprobar) => {
    setBusy(true)
    try {
      if (aprobar) {
        await aprobarCobroEspera(v.id)
        notify(`Cobro aprobado · ${money(v.total)}`)
      } else {
        await anularVenta(v.id)
        notify('Operación cancelada: el stock fue restaurado.', 'info')
      }
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  // Carga un pedido express (QR del alumno): setea alumno + carrito, método fiado.
  const cargarPedidoQR = (data) => {
    const alumno = alumnos.find((a) => a.id === data.alumnoId)
    if (!alumno) return notify('El QR no corresponde a un alumno registrado.', 'error')
    if (!Array.isArray(data.items) || !data.items.length) return notify('El pedido está vacío.', 'warn')

    // Consolida por productoId: si el pedido repite un ítem, la suma total
    // no puede superar el stock disponible.
    const acumulado = new Map()
    const omitidos = []
    for (const it of data.items) {
      const p = productos.find((x) => x.id === it.p)
      if (!p) { omitidos.push(`#${it.p}`); continue }
      acumulado.set(p.id, (acumulado.get(p.id) || 0) + Math.max(0, Number(it.c) || 0))
    }
    const nuevoCart = []
    for (const [pid, pedida] of acumulado) {
      const p = productos.find((x) => x.id === pid)
      const cant = Math.min(pedida, p.stock)
      if (cant <= 0) omitidos.push(p.nombre)
      else {
        nuevoCart.push({ productoId: pid, cantidad: cant })
        if (cant < pedida) omitidos.push(`${p.nombre} (parcial)`)
      }
    }
    if (!nuevoCart.length) return notify('Ningún producto del pedido tiene stock disponible.', 'warn')

    setCart(nuevoCart)
    setAlumnoSel(alumno)
    setMetodo('fiado')
    setQAlumno('')
    setScanOpen(false)
    if (omitidos.length) notify(`Sin stock completo: ${omitidos.join(', ')}.`, 'warn')
    notify(`Pedido de ${data.nombre || alumno.nombre} cargado · ${nuevoCart.length} producto(s).`)
  }

  // La cámara distingue QR de pedido (JSON) vs código de barras de producto.
  const procesarEscaneo = (text) => {
    try {
      const data = JSON.parse(text)
      if (data?.tipo === 'KIOSCO_PEDIDO') return cargarPedidoQR(data)
    } catch {
      /* no es JSON: sigue como código de barras */
    }
    const codigo = String(text).trim()
    const p = productos.find((x) => x.codigos?.includes(codigo))
    if (!p) return notify(`Código ${codigo} sin producto asociado.`, 'warn')
    agregar(p)
    notify(`${p.nombre} agregado al ticket.`)
  }

  // Contenido del ticket compartido entre la columna lateral (xl) y el
  // sheet desplegable de la barra flotante (pantallas chicas): mismos
  // ítems, método de pago y selección de alumno.
  const itemsTicket =
    cart.length === 0 ? (
      <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-xs text-slate-400">
        Tocá productos para agregarlos al ticket
      </p>
    ) : (
      <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {cart.map((i) => {
          const p = productos.find((x) => x.id === i.productoId)
          if (!p) return null
          return (
            <li key={i.productoId} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800">{p.nombre}</p>
                <p className="text-[11px] text-slate-400">{money(p.precio)} c/u</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setCantidad(i.productoId, i.cantidad - 1)} className="rounded-md p-1 text-slate-500 hover:bg-white" aria-label="Restar">
                  <Minus size={13} />
                </button>
                <span className="w-6 text-center text-sm font-bold">{i.cantidad}</span>
                <button onClick={() => setCantidad(i.productoId, i.cantidad + 1)} className="rounded-md p-1 text-slate-500 hover:bg-white" aria-label="Sumar">
                  <Plus size={13} />
                </button>
              </div>
              <span className="w-16 text-right text-sm font-bold text-slate-800">{money(p.precio * i.cantidad)}</span>
              <button onClick={() => setCantidad(i.productoId, 0)} className="rounded-md p-1 text-rose-400 hover:bg-rose-50" aria-label="Quitar">
                <Trash2 size={13} />
              </button>
            </li>
          )
        })}
      </ul>
    )

  const detalleCobro = (
    <>
      <div>
        <p className="mb-2 text-xs font-medium text-slate-500">Método de pago *</p>
        <div className="grid grid-cols-3 gap-2">
          {METODOS.map(({ k, label, icon: Icon, active }) => (
            <button
              key={k}
              onClick={() => setMetodo(k)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition-colors ${
                metodo === k ? active : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cliente: por defecto es venta libre al mostrador (anónima, sin
          datos). Asociar un alumno es opcional en contado; solo el fiado
          lo exige para anotar la deuda en su libreta. */}
      {metodo === 'fiado' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          {alumnoSel ? (
            <AlumnoElegido
              alumno={alumnoSel}
              onQuitar={() => setAlumnoSel(null)}
              detalle={`${alumnoSel.curso} · Deuda actual ${money(alumnoSel.deuda)}${limiteFiado > 0 ? ` · Límite fiado ${money(limiteFiado)}` : ''}`}
            />
          ) : (
            <>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Alumno obligatorio para fiar
              </p>
              <BuscadorAlumno
                q={qAlumno}
                onQ={setQAlumno}
                resultados={alumnosFiltrados}
                onSelect={setAlumnoSel}
                borde="border-amber-200"
              />
            </>
          )}
        </div>
      ) : alumnoSel ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <AlumnoElegido
            alumno={alumnoSel}
            onQuitar={() => setAlumnoSel(null)}
            detalle={`${alumnoSel.curso} · La venta queda en su historial (sin fiar)`}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Venta libre</span> · al mostrador, sin datos del cliente
            </p>
            <button
              onClick={() => setBuscarAlumno((v) => !v)}
              className="shrink-0 text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
            >
              {buscarAlumno ? 'Ocultar' : 'Asociar alumno'}
            </button>
          </div>
          {buscarAlumno && (
            <div className="mt-2">
              <BuscadorAlumno
                q={qAlumno}
                onQ={setQAlumno}
                resultados={alumnosFiltrados}
                onSelect={(a) => { setAlumnoSel(a); setBuscarAlumno(false) }}
              />
            </div>
          )}
        </div>
      )}

      {superaLimite && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            Excede el límite de fiado global ({money(limiteFiado)}). Deuda proyectada:{' '}
            <b>{money(deudaProyectada)}</b>. Al cobrar se pedirá confirmación de excepción.
          </span>
        </div>
      )}

      {!config.abierto && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>Kiosco cerrado: las ventas están bloqueadas hasta reabrir el mostrador.</span>
        </div>
      )}
    </>
  )

  const botonCobrar = (size = 'lg', className = 'w-full') => (
    <Button
      variant={superaLimite ? 'danger' : 'success'}
      size={size}
      onClick={abrirCobro}
      disabled={busy || !cart.length || !config.abierto}
      className={className}
    >
      {busy ? <Loader2 size={18} className="animate-spin" /> : <Banknote size={18} />}
      {!config.abierto ? 'Kiosco cerrado' : busy ? 'Procesando…' : `Cobrar ${money(total)}`}
    </Button>
  )

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
      {/* Productos (padding inferior para no quedar detrás de la barra de ticket) */}
      <div className="flex min-w-0 flex-col gap-4 pb-28 xl:pb-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar producto o código de barras…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <Button variant="secondary" onClick={() => setScanOpen(true)} className="shrink-0">
            <ScanLine size={16} /> Escanear
          </Button>
          <Button variant="secondary" onClick={() => setEsperaOpen(true)} className="shrink-0">
            <Hourglass size={16} className={enEspera.length ? 'text-amber-500' : ''} /> En espera
            {enEspera.length > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold leading-none text-amber-700">
                {enEspera.length}
              </span>
            )}
          </Button>
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['Todas', ...categorias].map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  cat === c ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => {
            const agotado = p.stock <= 0
            return (
              <button
                key={p.id}
                onClick={() => agregar(p)}
                disabled={agotado || !config.abierto}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
              >
                <div className="relative">
                  <ProductoImg producto={p} className="h-36 w-full sm:h-44" iconSize={40} />
                  {enCarrito(p.id) > 0 && (
                    <Badge tone="emerald" className="absolute right-2 top-2 shadow-sm">×{enCarrito(p.id)}</Badge>
                  )}
                </div>
                <div className="flex w-full flex-1 flex-col p-3">
                  <p className="text-sm font-semibold leading-snug text-slate-800">{p.nombre}</p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-sm font-bold text-emerald-600">{money(p.precio)}</span>
                    <span className={`text-[11px] ${agotado ? 'text-rose-500' : 'text-slate-400'}`}>
                      {agotado ? 'Agotado' : `stock ${p.stock}`}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Carrito: columna lateral fija solo en pantallas grandes (xl).
          En pantallas chicas el ticket vive en la barra flotante inferior. */}
      <aside className="hidden h-fit flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-20 xl:flex">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ShoppingCart size={16} className="text-emerald-600" /> Ticket actual
          </h3>
          {cart.length > 0 && (
            <button
              onClick={vaciarCarrito}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-500 transition-colors hover:bg-rose-50"
            >
              <Trash2 size={12} /> Vaciar carrito
            </button>
          )}
        </div>

        {itemsTicket}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-sm font-medium text-slate-500">Total</span>
          <span className="text-xl font-bold text-slate-800">{money(total)}</span>
        </div>

        {botonCobrar()}
      </aside>

      {/* Barra flotante de ticket (mobile/tablet): total y cobro siempre a
          mano sin hacer scroll; el chevron despliega el detalle. En <lg
          queda sobre el BottomNav; en lg-xl no hay BottomNav. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 lg:bottom-0 xl:hidden">
        {sheetOpen && (
          <div className="fade-in mx-auto max-h-[55vh] w-full max-w-lg overflow-y-auto border border-b-0 border-slate-200 bg-white px-4 py-4 shadow-[0_-10px_30px_rgba(15,23,42,0.15)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ShoppingCart size={15} className="text-emerald-600" /> Ticket actual
              </p>
              <div className="flex items-center gap-1">
                {cart.length > 0 && (
                  <button
                    onClick={vaciarCarrito}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-500 transition-colors hover:bg-rose-50"
                  >
                    <Trash2 size={12} /> Vaciar
                  </button>
                )}
                <button
                  onClick={() => setSheetOpen(false)}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100"
                  aria-label="Plegar ticket"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {itemsTicket}
            </div>
          </div>
        )}
        <div className="rounded-t-2xl border-t border-slate-200 bg-white/95 px-3 py-2.5 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center gap-2">
            <button
              onClick={() => setSheetOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              aria-expanded={sheetOpen}
            >
              {sheetOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              Ticket ({cantItems} {cantItems === 1 ? 'ítem' : 'ítems'})
            </button>
            <span className="text-lg font-bold text-slate-800">{money(total)}</span>
            {botonCobrar('md', 'ml-auto shrink-0')}
          </div>
        </div>
      </div>

      <TicketVenta venta={ticket} onClose={() => setTicket(null)} />

      <EscanerCamara open={scanOpen} onClose={() => setScanOpen(false)} onResult={procesarEscaneo} />

      {/* Modal de cobro: paso obligatorio entre "Cobrar $X" y asentar la
          venta. Resume el ticket, elige método y confirma con Enter;
          cancelar (botón, backdrop o Escape) conserva el carrito. */}
      <Modal open={cobroOpen} onClose={() => setCobroOpen(false)} title="Confirmar cobro">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">
                {cantItems} {cantItems === 1 ? 'ítem' : 'ítems'} · Total a cobrar
              </span>
              <span className="text-xl font-bold text-slate-800">{money(total)}</span>
            </div>
            <ul className="mt-2 flex max-h-36 flex-col gap-1 overflow-y-auto border-t border-slate-200 pt-2">
              {cart.map((i) => {
                const p = productos.find((x) => x.id === i.productoId)
                if (!p) return null
                return (
                  <li key={i.productoId} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="min-w-0 truncate"><b>{i.cantidad}×</b> {p.nombre}</span>
                    <span className="shrink-0 font-semibold">{money(p.precio * i.cantidad)}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          {detalleCobro}

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => setCobroOpen(false)}>
              <X size={15} /> Cancelar / Volver
            </Button>
            <Button
              variant={superaLimite ? 'danger' : 'success'}
              size="lg"
              onClick={confirmarCobro}
              disabled={busy || !cart.length || !config.abierto}
              className="flex-1"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {busy ? 'Procesando…' : `Confirmar Cobro · ${money(total)}`}
            </Button>
          </div>
          <p className="text-center text-[11px] text-slate-400">
            Enter confirma el cobro · Esc vuelve al mostrador (el ticket se conserva)
          </p>
        </div>
      </Modal>

      {/* Cobro por transferencia: confirmar ya acreditada o dejarla en
          espera para liberar el mostrador hasta que impacte el pago.
          Cancelar vuelve al modal de cobro con el carrito intacto. */}
      <Modal open={transfOpen} onClose={() => { setTransfOpen(false); setCobroOpen(true) }} title="Cobro por transferencia">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            Cobro por transferencia de <b>{money(total)}</b>. Si ya impactó, confirmala
            acreditada; si todavía no ingresó, dejala <b>en espera</b> y seguí atendiendo:
            la retomás desde "En espera" para aprobarla o cancelarla.
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="success"
              size="lg"
              disabled={busy}
              onClick={() => { setTransfOpen(false); ejecutarVenta() }}
            >
              <Landmark size={16} /> {busy ? 'Procesando…' : 'Confirmar Acreditada'}
            </Button>
            <Button
              variant="warn"
              disabled={busy}
              onClick={() => { setTransfOpen(false); ejecutarVenta({ enEspera: true }) }}
            >
              <Hourglass size={15} /> Guardar en espera / Pendiente
            </Button>
            <Button variant="secondary" onClick={() => { setTransfOpen(false); setCobroOpen(true) }}>Volver al cobro</Button>
          </div>
          <p className="text-[11px] text-slate-400">
            "En espera" descuenta el stock preventivamente; al cancelar la operación se repone.
          </p>
        </div>
      </Modal>

      {/* Transferencias en espera: un toque para aprobar el cobro o cancelar */}
      <Modal open={esperaOpen} onClose={() => setEsperaOpen(false)} title={`En espera (${enEspera.length})`}>
        {enEspera.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            No hay transferencias pendientes de acreditar.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {enEspera.map((v) => (
              <li key={v.id} className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-500">
                    #{v.id.slice(0, 8).toUpperCase()} · {fmtFechaHora(v.fecha)}
                  </p>
                  <span className="text-sm font-bold text-slate-800">{money(v.total)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {v.items.map((it) => `${it.cantidad}× ${it.nombre}`).join(' · ')}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {v.alumnoNombre ? `Alumno: ${v.alumnoNombre} · ` : 'Venta libre · '}Atendió {v.vendedor}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => resolverEspera(v, true)}
                  >
                    <CheckCircle2 size={14} /> Aprobar cobro
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => resolverEspera(v, false)}
                    className="text-rose-500"
                  >
                    <Trash2 size={13} /> Cancelar operación
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Excepción de límite de fiado global. Cancelar vuelve al modal
          de cobro con el carrito intacto. */}
      <Modal open={excepcionOpen} onClose={() => { setExcepcionOpen(false); setCobroOpen(true) }} title="Excepción de límite de fiado">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              <b>{alumnoSel?.nombre} {alumnoSel?.apellido}</b> supera el límite de fiado global de{' '}
              <b>{money(limiteFiado)}</b>. Deuda actual {money(alumnoSel?.deuda)} → proyectada{' '}
              <b>{money(deudaProyectada)}</b>.
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Podés autorizar la excepción bajo tu responsabilidad como vendedor. La venta quedará
            registrada en la libreta del alumno.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setExcepcionOpen(false); setCobroOpen(true) }}>Volver al cobro</Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => { setExcepcionOpen(false); ejecutarVenta({ excepcionFiado: true }) }}
            >
              <AlertTriangle size={15} /> Confirmar excepción y cobrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
