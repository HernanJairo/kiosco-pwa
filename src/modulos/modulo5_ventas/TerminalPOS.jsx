import { createElement, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Banknote, CheckCircle2, ChevronDown, ChevronUp, Grid2X2, HandCoins, Hourglass, Landmark, Loader2, Minus, PackageCheck, Plus, ScanLine, Search, ShoppingCart, Trash2, Wallet, X } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye, norm } from '../../utils/busqueda'
import { fotosDe } from '../../utils/imagen'
import { fmtFechaHora, money } from '../../utils/format'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import AvatarCliente from '../../components/ui/AvatarCliente'
import ProductoImg from '../../components/ui/ProductoImg'
import FotosPill from '../../components/ui/FotosPill'
import { iconoCategoria } from '../../utils/icons'
import EscanerCamara from '../../components/ui/EscanerCamara'
import TicketVenta from './TicketVenta'
import { limiteFiadoVigente } from '../../context/operaciones'
import '../modulo1_catalogo_auth/CatalogoPublico.css'

const METODOS = [
  { k: 'efectivo', label: 'Efectivo', icon: Banknote, active: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { k: 'transferencia', label: 'Transferencia', icon: Landmark, active: 'border-indigo-400 bg-indigo-50 text-indigo-700' },
  { k: 'saldo', label: 'Billetera', icon: Wallet, active: 'border-[#009DE0] bg-[#EBF7FD] text-[#007AB8]' },
  { k: 'fiado', label: 'Cta. Corriente', icon: HandCoins, active: 'border-amber-400 bg-amber-50 text-amber-700' },
]

// Tonos pastel del kit v0 (mismos nombres que el catálogo público).
const TONOS = ['blue', 'yellow', 'pink', 'mint', 'aqua', 'lilac']
const ILIMITADO = 999 // stock 999 = venta libre sin tope (∞)

// Clave de sessionStorage donde vive el ticket en curso: sobrevive a
// cambios de pestaña del menú (desmontaje del componente) y se descarta
// al cerrar la pestaña del navegador.
const CART_KEY = 'kiosco_cart_temp'

// Buscador de clientes reutilizable: se usa en modo fiado (obligatorio) y
// en contado cuando el vendedor elige asociar la venta a un cliente.
function BuscadorCliente({ q, onQ, resultados, onSelect, borde = 'border-transparent' }) {
  return (
    <>
      <input
        value={q}
        onChange={(e) => onQ(e.target.value)}
        placeholder="Buscar cliente por nombre, DNI o teléfono…"
        className={`h-11 w-full rounded-xl border ${borde} bg-[#F6F6F6] px-4 text-base outline-none transition-shadow focus:bg-white focus:ring-2 focus:ring-[#009DE0]/30 sm:text-sm`}
      />
      <ul className="mt-2 flex max-h-48 flex-col gap-1.5 overflow-y-auto">
        {resultados.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => onSelect(a)}
              className="flex w-full items-center gap-3 rounded-xl bg-[#F6F6F6] px-3 py-2.5 text-left transition-all duration-150 hover:bg-[#EBF7FD] active:scale-[0.99]"
            >
              <AvatarCliente cliente={a} className="h-9 w-9" textoClassName="text-[10px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[#202125]">{a.nombre} {a.apellido}</span>
                <span className="block text-[11px] text-slate-400">DNI {a.dni}</span>
              </span>
              <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${a.deuda > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {a.deuda > 0 ? `debe ${money(a.deuda)}` : `saldo ${money(a.saldo || 0)}`}
              </span>
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

// Tarjeta del cliente ya seleccionado, con opción de quitarlo.
function ClienteElegido({ cliente, onQuitar, detalle }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <AvatarCliente cliente={cliente} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">
          {cliente.nombre} {cliente.apellido}
        </p>
        <p className="text-[11px] text-slate-500">{detalle}</p>
      </div>
      <button onClick={onQuitar} className="rounded-lg p-1 text-slate-400 hover:bg-white" aria-label="Quitar cliente">
        <X size={15} />
      </button>
    </div>
  )
}

export default function TerminalPOS() {
  const { productos, clientes, categorias, ventas, registrarVenta, aprobarCobroEspera, anularVenta, notify, session, config, encargos, entregarEncargo } = useKiosco()
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
  const [qCliente, setQCliente] = useState('')
  const [clienteSel, setClienteSel] = useState(null)
  const [buscarCliente, setBuscarCliente] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ticket, setTicket] = useState(null)
  const [transfOpen, setTransfOpen] = useState(false)
  const [excepcionOpen, setExcepcionOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false) // ticket desplegado (mobile)
  const [esperaOpen, setEsperaOpen] = useState(false)
  const [encargosSel, setEncargosSel] = useState(null) // {encargos:[], retiradoPor} vinculado al cobro
  const [cobroOpen, setCobroOpen] = useState(false) // modal obligatorio antes de asentar la venta

  // Límite de cuenta corriente vigente: el tope propio del cliente si lo
  // tiene cargado; si no, el global del kiosco.
  const limiteFiado = clienteSel ? limiteFiadoVigente(clienteSel, config) : Number(config.limiteFiadoGlobal) || 0

  // Contingencia operativa: con los fiados pausados la Cta. Corriente se
  // apaga en el modal de cobro (validarVenta también la rechaza).
  const fiadosPausados = config.fiadosActivos === false

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
  // quedaron sin stock, y limita cantidades al stock disponible. Se ajusta
  // durante el render (en vez de un efecto) comparando la lista previa.
  const [prodsVistos, setProdsVistos] = useState(productos)
  if (productos.length && prodsVistos !== productos) {
    setProdsVistos(productos)
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
  }

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

  const clientesFiltrados = useMemo(
    () =>
      clientes
        .filter((a) =>
          incluye(`${a.nombre} ${a.apellido} ${a.dni} ${a.telefono || ''}`, qCliente)
        )
        .slice(0, 6),
    [clientes, qCliente]
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

  const deudaProyectada = (clienteSel?.deuda || 0) + total
  const superaLimite = metodo === 'fiado' && !!clienteSel && limiteFiado > 0 && deudaProyectada > limiteFiado

  // Transferencias guardadas en espera de acreditación (stock ya descontado).
  const enEspera = useMemo(
    () => ventas.filter((v) => v.estado === 'en_espera_transferencia' && !v.anulada),
    [ventas]
  )

  const cantItems = cart.reduce((s, i) => s + i.cantidad, 0)

  const limpiarTicket = () => {
    setCart([])
    setMetodo('efectivo')
    setClienteSel(null)
    setQCliente('')
    setBuscarCliente(false)
    setSheetOpen(false)
    setCobroOpen(false)
    setEncargosSel(null)
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
        clienteId: clienteSel?.id,
        vendedor: session?.nombre || 'mostrador',
        excepcionFiado,
        enEspera: enEsperaFlag,
        retiradoPor: encargosSel?.retiradoPor || null,
        // Retiro de encargo: la mercadería ya quedó reservada (fuera de
        // góndola) al crear el pedido; no se vuelve a descontar.
        reservado: !!encargosSel,
      })
      limpiarTicket()
      // Retiro de encargo(s): al cobrarse, todas las bolsas quedan entregadas.
      if (encargosSel) {
        for (const e of encargosSel.encargos) {
          try {
            await entregarEncargo(e.id, encargosSel.retiradoPor)
          } catch {
            /* ya cerrado: no bloquea la venta */
          }
        }
        setEncargosSel(null)
      }
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
    if (metodo === 'saldo' && !clienteSel) return notify('Pagar con billetera exige seleccionar un cliente registrado.', 'warn')
    if (metodo === 'saldo' && clienteSel && (clienteSel.saldo || 0) < total) {
      return notify(`Saldo insuficiente: tiene ${money(clienteSel.saldo || 0)} y el ticket es ${money(total)}.`, 'warn')
    }
    if (metodo === 'fiado' && !clienteSel) return notify('La cuenta corriente exige seleccionar un cliente registrado.', 'warn')
    if (metodo === 'fiado' && clienteSel && limiteFiado <= 0 && !(clienteSel.saldo > 0)) {
      return notify('El cliente no tiene saldo ni límite de cuenta corriente habilitado.', 'warn')
    }
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

  // Consolida ítems [{p, c}] del QR contra stock disponible y arma el
  // carrito. Devuelve el carrito o null si nada quedó válido.
  const carritoDesdeQR = (itemsQR) => {
    const acumulado = new Map()
    const omitidos = []
    for (const it of itemsQR) {
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
    if (!nuevoCart.length) return { cart: null, omitidos }
    return { cart: nuevoCart, omitidos }
  }

  // Carga un pedido express (QR del cliente o de un invitado). Si el QR
  // no trae clienteId, la venta corre como "Consumidor Final".
  const cargarPedidoQR = (data) => {
    const cliente = data.clienteId ? clientes.find((a) => a.id === data.clienteId) : null
    if (data.clienteId && !cliente) return notify('El QR no corresponde a un cliente registrado.', 'error')
    if (!Array.isArray(data.items) || !data.items.length) return notify('El pedido está vacío.', 'warn')

    const { cart: nuevoCart, omitidos } = carritoDesdeQR(data.items)
    if (!nuevoCart) return notify('Ningún producto del pedido tiene stock disponible.', 'warn')

    setCart(nuevoCart)
    setClienteSel(cliente)
    setEncargosSel(null)
    // Invitado → contado; cliente registrado → propone fiado (editable).
    setMetodo(cliente && !fiadosPausados ? 'fiado' : 'efectivo')
    setQCliente('')
    setScanOpen(false)
    if (omitidos.length) notify(`Sin stock completo: ${omitidos.join(', ')}.`, 'warn')
    notify(
      cliente
        ? `Pedido de ${data.nombre || cliente.nombre} cargado · ${nuevoCart.length} producto(s).`
        : `Pedido express cargado · Consumidor Final · Venta Libre (${nuevoCart.length} producto(s)).`
    )
  }

  // QR de retiro de encargo: vincula el cobro a los encargos para
  // cerrarlos cuando la venta se confirme. El stock ya está reservado,
  // así que la venta no lo vuelve a validar contra góndola.
  // Acepta `encargoIds` (QR multi-pedido del cliente) o `encargoId` suelto.
  const cargarEncargoQR = (data, retiradoPorHint = null) => {
    const ids = Array.isArray(data.encargoIds) && data.encargoIds.length
      ? data.encargoIds
      : [data.encargoId]
    const elegidos = []
    for (const id of ids) {
      const encargo = (encargos || []).find((e) => e.id === id)
      if (!encargo) return notify('El QR no corresponde a un encargo vigente.', 'error')
      if (encargo.estado === 'entregado' || encargo.estado === 'cancelado') {
        return notify(`El pedido #${encargo.id.slice(0, 8).toUpperCase()} ya fue entregado o cancelado.`, 'warn')
      }
      if (encargo.estado === 'en_preparacion') {
        return notify(`La bolsa #${encargo.id.slice(0, 8).toUpperCase()} todavía se está preparando: marcala "lista" primero.`, 'warn')
      }
      elegidos.push(encargo)
    }
    const cliente = clientes.find((a) => a.id === elegidos[0].clienteId) || null
    // El carrito sale de los encargos guardados (post-ajustes), no del
    // QR: así respeta los faltantes descontados al armar las bolsas.
    const acumulado = new Map()
    for (const e of elegidos) {
      for (const i of e.items) {
        acumulado.set(i.productoId, (acumulado.get(i.productoId) || 0) + i.cantidad)
      }
    }
    const nuevoCart = [...acumulado].map(([productoId, cantidad]) => ({ productoId, cantidad }))
    if (!nuevoCart.length) return notify('El pedido está vacío.', 'warn')

    const retiradoPor = retiradoPorHint || `${elegidos[0].clienteNombre} (titular · QR)`
    setCart(nuevoCart)
    setClienteSel(cliente)
    setEncargosSel({ encargos: elegidos, retiradoPor })
    setMetodo('efectivo')
    setQCliente('')
    setScanOpen(false)
    const refs = elegidos.map((e) => `#${e.id.slice(0, 8).toUpperCase()}`).join(', ')
    notify(`Retiro de ${elegidos.length > 1 ? 'encargos' : 'encargo'} ${refs} · retira ${retiradoPor}. Cobrá para entregar.`)
  }

  // "Cobrar en caja" desde la vista Encargos: llega el id del pedido
  // listo y se carga directo en el ticket. Dos vías: el evento en vivo
  // (POS ya montado) y el handoff por sessionStorage para cuando esta
  // vista recién se monta tras la navegación (el evento ya había pasado).
  useEffect(() => {
    const onCobrar = (ev) => {
      const encargoId = ev.detail?.encargoId
      if (encargoId) cargarEncargoQR({ encargoId })
    }
    window.addEventListener('yapa:cobrar-encargo', onCobrar)
    try {
      const pendiente = sessionStorage.getItem('yapa_cobrar_encargo')
      if (pendiente) {
        sessionStorage.removeItem('yapa_cobrar_encargo')
        cargarEncargoQR({ encargoId: pendiente })
      }
    } catch { /* storage bloqueado: solo el evento en vivo */ }
    return () => window.removeEventListener('yapa:cobrar-encargo', onCobrar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encargos, clientes])

  // La cámara distingue QR de pedido (JSON) vs código de barras de producto.
  const procesarEscaneo = (text) => {
    try {
      const data = JSON.parse(text)
      if (data?.tipo === 'KIOSCO_PEDIDO') return cargarPedidoQR(data)
      if (data?.tipo === 'ENCARGO_RETIRO') return cargarEncargoQR(data)
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
  // ítems, método de pago y selección de cliente.
  const itemsTicket =
    cart.length === 0 ? (
      <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-xs text-slate-400">
        Tocá productos para agregarlos al ticket
      </p>
    ) : (
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {METODOS.map(({ k, label, icon: Icon, active }) => {
            const bloqueado = k === 'fiado' && fiadosPausados
            return (
              <button
                key={k}
                onClick={() => !bloqueado && setMetodo(k)}
                disabled={bloqueado}
                title={bloqueado ? 'Fiados pausados temporalmente' : undefined}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3.5 text-xs font-bold transition-all duration-150 active:scale-[0.97] sm:text-sm ${
                  bloqueado
                    ? 'cursor-not-allowed border-slate-200 text-slate-300 opacity-60'
                    : metodo === k ? active : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <Icon size={19} />
                {label}
              </button>
            )
          })}
        </div>
        {fiadosPausados && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-600">
            <AlertTriangle size={13} /> Fiados pausados temporalmente
          </p>
        )}
      </div>

      {/* Cliente: el POS opera por defecto en modo Consumidor Final /
          Venta Libre (anónima, sin datos). Asociar un cliente es opcional
          en efectivo y transferencia; billetera y cuenta corriente lo
          exigen (el saldo o la deuda se asientan en su libreta). */}
      {metodo === 'saldo' ? (
        <div className="rounded-xl border border-[#009DE0]/30 bg-[#EBF7FD] p-3">
          {clienteSel ? (
            <ClienteElegido
              cliente={clienteSel}
              onQuitar={() => setClienteSel(null)}
              detalle={`DNI ${clienteSel.dni} · Saldo disponible ${money(clienteSel.saldo || 0)}${(clienteSel.saldo || 0) < total ? ' — insuficiente' : ''}`}
            />
          ) : (
            <>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#007AB8]">
                Cliente registrado obligatorio (usa su saldo)
              </p>
              <BuscadorCliente
                q={qCliente}
                onQ={setQCliente}
                resultados={clientesFiltrados}
                onSelect={setClienteSel}
                borde="border-[#009DE0]/30"
              />
            </>
          )}
        </div>
      ) : metodo === 'fiado' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          {clienteSel ? (
            <ClienteElegido
              cliente={clienteSel}
              onQuitar={() => setClienteSel(null)}
              detalle={`DNI ${clienteSel.dni} · Deuda actual ${money(clienteSel.deuda)}${limiteFiado > 0 ? ` · Límite cta. cte. ${money(limiteFiado)}` : ''}${clienteSel.saldo > 0 ? ` · Saldo a favor ${money(clienteSel.saldo)}` : ''}`}
            />
          ) : (
            <>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Cliente registrado obligatorio (saldo o límite habilitado)
              </p>
              <BuscadorCliente
                q={qCliente}
                onQ={setQCliente}
                resultados={clientesFiltrados}
                onSelect={setClienteSel}
                borde="border-amber-200"
              />
            </>
          )}
        </div>
      ) : clienteSel ? (
        <div className="rounded-xl border border-transparent bg-[#F6F6F6] p-3">
          <ClienteElegido
            cliente={clienteSel}
            onQuitar={() => setClienteSel(null)}
            detalle={`DNI ${clienteSel.dni} · La venta queda en su historial (sin fiar)`}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Consumidor Final · Venta Libre</span> · sin datos del cliente
            </p>
            <button
              onClick={() => setBuscarCliente((v) => !v)}
              className="shrink-0 text-xs font-semibold text-brand transition-colors hover:text-brand-dark"
            >
              {buscarCliente ? 'Ocultar' : 'Asociar cliente'}
            </button>
          </div>
          {buscarCliente && (
            <div className="mt-2">
              <BuscadorCliente
                q={qCliente}
                onQ={setQCliente}
                resultados={clientesFiltrados}
                onSelect={(a) => { setClienteSel(a); setBuscarCliente(false) }}
              />
            </div>
          )}
        </div>
      )}

      {metodo === 'saldo' && clienteSel && (clienteSel.saldo || 0) < total && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            Saldo insuficiente: {clienteSel.nombre} tiene {money(clienteSel.saldo || 0)} y el ticket
            es {money(total)}. Recargale saldo o elegí otro método.
          </span>
        </div>
      )}

      {encargosSel && (
        <div className="flex items-start gap-2 rounded-xl bg-[#EBF7FD] px-3 py-2.5 text-xs font-medium text-[#007AB8]">
          <PackageCheck size={15} className="mt-0.5 shrink-0" />
          <span>
            Retiro de {encargosSel.encargos.length > 1 ? 'encargos' : 'encargo'}{' '}
            {encargosSel.encargos.map((e) => `#${e.id.slice(0, 8).toUpperCase()}`).join(', ')} · retira{' '}
            <b>{encargosSel.retiradoPor}</b>. Al cobrar queda entregado.
          </span>
        </div>
      )}

      {metodo === 'fiado' && clienteSel && limiteFiado <= 0 && !(clienteSel.saldo > 0) && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            {clienteSel.nombre} no tiene saldo a favor ni límite de cuenta corriente habilitado:
            no se le puede fiar.
          </span>
        </div>
      )}

      {superaLimite && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            Excede el límite de cuenta corriente ({money(limiteFiado)}). Deuda proyectada:{' '}
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
      variant={superaLimite ? 'danger' : 'primary'}
      size={size}
      onClick={abrirCobro}
      disabled={busy || !cart.length || !config.abierto}
      className={`${className} rounded-2xl py-3.5 text-base font-extrabold`}
    >
      {busy ? <Loader2 size={18} className="animate-spin" /> : <Banknote size={18} />}
      {!config.abierto ? 'Kiosco cerrado' : busy ? 'Procesando…' : `Cobrar ${money(total)}`}
    </Button>
  )

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
      {/* Productos (padding inferior para no quedar detrás de la barra de ticket) */}
      <div className="flex min-w-0 flex-col gap-4 pb-28 xl:pb-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar producto o código de barras…"
              className="w-full rounded-xl border border-transparent bg-[#F6F6F6] py-3 pl-10 pr-3 text-base outline-none transition-shadow focus:bg-white focus:ring-2 focus:ring-[#009DE0]/30 sm:text-sm"
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
        </div>

        {/* Kit visual del catálogo v0: tarjetas pastel de categoría +
            grilla de productos con arte por tono (reuso de .catalog-app). */}
        <div className="catalog-app cat-embed">
          <div className="category-scroller">
            <button
              className={`category-card category-all${cat === 'Todas' ? ' category-active' : ''}`}
              aria-pressed={cat === 'Todas'}
              onClick={() => setCat('Todas')}
            >
              <span className="category-art" aria-hidden="true">
                <Grid2X2 size={23} strokeWidth={1.9} />
              </span>
              <span>Todas</span>
            </button>
            {categorias.map((c, i) => (
              <button
                key={c}
                className={`category-card category-${TONOS[i % TONOS.length]}${cat === c ? ' category-active' : ''}`}
                aria-pressed={cat === c}
                onClick={() => setCat(cat === c ? 'Todas' : c)}
              >
                <span className="category-art" aria-hidden="true">
                  {createElement(iconoCategoria(c), { size: 23, strokeWidth: 1.9 })}
                </span>
                <span>{c}</span>
              </button>
            ))}
          </div>

          <section className="products-section">
            <div className="product-grid">
              {list.map((p) => {
                const agotado = p.stock <= 0
                const disabled = agotado || !config.abierto
                const tono = TONOS[Math.max(0, categorias.indexOf(p.categoria)) % TONOS.length]
                const fotos = fotosDe(p)
                return (
                  <article className={`product-card${disabled ? ' is-disabled' : ''}`} key={p.id}>
                    <button
                      className="product-card-main"
                      onClick={() => agregar(p)}
                      disabled={disabled}
                      aria-label={`${p.nombre}, ${money(p.precio)}. Agregar al ticket`}
                    >
                      <div className={`product-art art-${tono}`} aria-hidden="true">
                        {fotos.length ? (
                          <img src={fotos[0]} alt="" className="art-photo" loading="lazy" />
                        ) : (
                          <>
                            <span className="art-orbit" />
                            <span className="art-icon">
                              {createElement(iconoCategoria(p.categoria), {})}
                            </span>
                            <span className="art-shine" />
                          </>
                        )}
                        <FotosPill cantidad={fotos.length} />
                      </div>
                      <span className="product-category">
                        {p.categoria} <span>·</span> unidad
                      </span>
                      <strong className="product-name">{p.nombre}</strong>
                      <span className="product-price">{money(p.precio)}</span>
                      {agotado ? (
                        <span className="stock-pill stock-empty">Sin stock</span>
                      ) : p.stock <= 5 ? (
                        <span className="stock-pill stock-low">Últimas {p.stock}</span>
                      ) : p.stock >= ILIMITADO ? (
                        <span className="stock-pill stock-plenty">∞</span>
                      ) : (
                        <span className="stock-pill stock-plenty">{p.stock} u.</span>
                      )}
                    </button>
                    {/* Stepper rápido − / +: visible cuando el producto ya
                        tiene unidades en el ticket. Hermano del botón de la
                        tarjeta (no se puede anidar botones); el − resta sin
                        tocar la tarjeta (stopPropagation). */}
                    {!disabled &&
                      (enCarrito(p.id) ? (
                        <div className="quick-stepper" role="group" aria-label={`Unidades de ${p.nombre} en el ticket`}>
                          <button
                            type="button"
                            className="qs-minus"
                            aria-label={`Quitar una unidad de ${p.nombre}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setCantidad(p.id, enCarrito(p.id) - 1)
                            }}
                          >
                            <Minus size={15} />
                          </button>
                          <span className="qs-count" aria-live="polite">
                            {enCarrito(p.id)}
                          </span>
                          <button
                            type="button"
                            className="qs-plus"
                            aria-label={`Agregar ${p.nombre} al ticket`}
                            onClick={(e) => {
                              e.stopPropagation()
                              agregar(p)
                            }}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="add-button" aria-hidden="true">
                          <Plus size={19} />
                        </span>
                      ))}
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Carrito: columna lateral fija solo en pantallas grandes (xl).
          En pantallas chicas el ticket vive en la barra flotante inferior. */}
      <aside className="hidden h-fit flex-col gap-5 rounded-3xl bg-white p-6 shadow-soft xl:sticky xl:top-20 xl:flex">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ShoppingCart size={16} className="text-brand" /> Ticket actual
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
          mano sin hacer scroll; el chevron despliega el detalle. */}
      <div className="fixed inset-x-0 bottom-0 z-30 xl:hidden">
        {sheetOpen && (
          <div className="fade-in mx-auto max-h-[55vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white px-4 py-4 shadow-[0_-10px_30px_rgba(15,23,42,0.15)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ShoppingCart size={15} className="text-brand" /> Ticket actual
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
        <div className="rounded-t-3xl bg-white/95 px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-4px_20px_rgba(15,23,42,0.10)] backdrop-blur">
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
      <Modal open={cobroOpen} onClose={() => setCobroOpen(false)} title="Confirmar cobro" className="sm:max-w-xl" bodyClassName="sm:px-7 sm:py-6">
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-transparent bg-[#F6F6F6] px-4 py-3">
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
          <ul className="flex flex-col gap-4">
            {enEspera.map((v) => (
              <li key={v.id} className="overflow-hidden rounded-3xl bg-white shadow-soft">
                {/* Encabezado: orden, estado activo y total destacado */}
                <div className="flex items-center justify-between gap-3 bg-[#F6F6F6] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight text-slate-800">
                        Orden #{v.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {fmtFechaHora(v.fecha)} · {v.clienteNombre || 'Consumidor final'} · Atendió {v.vendedor}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-lg font-bold text-brand">{money(v.total)}</span>
                </div>

                {/* Ítems con foto y cantidad */}
                <ul className="flex flex-col divide-y divide-slate-50 px-4">
                  {v.items.map((it) => {
                    const p = productos.find((x) => x.id === it.productoId)
                    return (
                      <li key={`${v.id}-${it.productoId || it.nombre}`} className="flex items-center gap-3 py-2.5">
                        {p ? (
                          <ProductoImg producto={p} className="h-10 w-10 rounded-lg" iconSize={16} />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                            <ShoppingCart size={16} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-700">{it.nombre}</span>
                          <span className="text-[11px] text-slate-400">{money(it.precio)} c/u</span>
                        </span>
                        <Badge tone="brand" className="shrink-0 rounded-full">{it.cantidad}×</Badge>
                        <span className="w-16 shrink-0 text-right text-sm font-semibold text-slate-700">
                          {money(it.precio * it.cantidad)}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {/* Acciones */}
                <div className="flex gap-2 px-4 pb-4 pt-3">
                  <Button
                    className="flex-1 rounded-2xl py-3 text-sm font-bold"
                    disabled={busy}
                    onClick={() => resolverEspera(v, true)}
                  >
                    <CheckCircle2 size={16} /> Aprobar cobro
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => resolverEspera(v, false)}
                    className="rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100"
                  >
                    <Trash2 size={14} /> Cancelar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>


      {/* Excepción de límite de cuenta corriente. Cancelar vuelve al modal
          de cobro con el carrito intacto. */}
      <Modal open={excepcionOpen} onClose={() => { setExcepcionOpen(false); setCobroOpen(true) }} title="Excepción de límite de fiado">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              <b>{clienteSel?.nombre} {clienteSel?.apellido}</b> supera el límite de cuenta corriente de{' '}
              <b>{money(limiteFiado)}</b>. Deuda actual {money(clienteSel?.deuda)} → proyectada{' '}
              <b>{money(deudaProyectada)}</b>.
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Podés autorizar la excepción bajo tu responsabilidad como vendedor. La venta quedará
            registrada en la libreta del cliente.
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
