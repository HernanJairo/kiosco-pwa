// ==== Núcleo de negocio puro (sin React ni JSX) ====
// Todas las funciones operan sobre el objeto `db` (estado completo de la
// app) o sobre entidades sueltas. KioscoContext las invoca dentro de
// `mutate()` (borrador clonado) y scripts/qa-flujos.mjs las ejerce en
// consola sobre copias del seed, así la lógica queda testeada de verdad.

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)

// PIN que asigna el mostrador al aprobar un recupero o al restablecer
// la clave desde el panel de clientes.
export const PIN_TEMPORAL = '1234'

export const TIPOS_SOLICITUD = { RESET_PIN: 'RESET_PIN', TRANSFERENCIA: 'TRANSFERENCIA_PENDIENTE' }

/* ================= CLIENTES ================= */

// Estructura oficial del Cliente.
export function nuevoCliente({ nombre, apellido = '', dni, telefono = '', pin, limiteFiado = 0 }) {
  return {
    id: uid(),
    dni: String(dni).trim(),
    nombre: String(nombre).trim(),
    apellido: String(apellido).trim(),
    telefono: String(telefono ?? '').trim(),
    pin: String(pin).trim(),
    saldo: 0,
    deuda: 0,
    limiteFiado: Math.max(0, Number(limiteFiado) || 0),
    avatar: null,
    fiados: [],
    movimientos: [],
  }
}

// Validación estricta del alta: campos obligatorios, formatos y DNI único.
// Se usa tanto en el alta administrativa como en el auto-registro público.
export function validarAltaCliente(clientes, { nombre, apellido, dni, pin, telefono }) {
  if (!String(nombre ?? '').trim()) throw new Error('Ingresá el nombre del cliente.')
  if (!String(apellido ?? '').trim()) throw new Error('Ingresá el apellido del cliente.')
  const dniStr = String(dni ?? '').trim()
  if (!/^\d{6,10}$/.test(dniStr)) throw new Error('Ingresá un DNI válido (6 a 10 dígitos, solo números).')
  if ((clientes || []).some((c) => c.dni === dniStr)) {
    throw new Error(`Ya existe un cliente registrado con DNI ${dniStr}.`)
  }
  if (!/^\d{4}$/.test(String(pin ?? '').trim())) {
    throw new Error('El PIN debe tener exactamente 4 dígitos numéricos.')
  }
  if (telefono !== undefined && telefono !== null && String(telefono).trim() && !/^\d{6,15}$/.test(String(telefono).replace(/\D/g, ''))) {
    throw new Error('Ingresá un teléfono válido (solo números).')
  }
  return dniStr
}

// Regla de integridad: un cliente con deuda abierta no se puede eliminar.
export function eliminarClienteDb(db, clienteId) {
  const c = (db.clientes || []).find((x) => x.id === clienteId)
  if (!c) throw new Error('Cliente no encontrado.')
  if (c.deuda > 0) {
    throw new Error(
      `No se puede eliminar a ${c.nombre} ${c.apellido}: tiene una deuda pendiente de $ ${c.deuda.toLocaleString('es-AR')}. Saldala primero.`
    )
  }
  db.clientes = db.clientes.filter((x) => x.id !== clienteId)
  // Las solicitudes abiertas de ese cliente pierden sentido: se descartan.
  for (const s of db.solicitudes || []) {
    if (s.clienteId === clienteId && s.estado === 'pendiente') s.estado = 'descartada'
  }
  return c
}

/* ================= FIADOS / CUENTA CORRIENTE ================= */

// Aplica un abono a los fiados más antiguos del cliente (in-place) y
// devuelve { resto, abonado }. El excedente va al saldo a favor.
export function abonarFiados(cliente, monto) {
  let resto = monto
  let abonado = 0
  const pendientes = [...cliente.fiados]
    .filter((f) => !f.pagado && f.pendiente > 0)
    .sort((x, y) => new Date(x.fecha) - new Date(y.fecha))
  for (const f of pendientes) {
    if (resto <= 0) break
    const pago = Math.min(resto, f.pendiente)
    f.pendiente -= pago
    f.pagado = f.pendiente <= 0.009
    if (f.pagado) f.pendiente = 0
    resto -= pago
    abonado += pago
  }
  cliente.deuda = cliente.fiados.reduce((s, f) => s + f.pendiente, 0)
  if (resto > 0) cliente.saldo += resto
  return { resto, abonado }
}

// Límite de cuenta corriente vigente para el cliente: su tope propio si
// tiene uno cargado; si no, el global del kiosco.
export function limiteFiadoVigente(cliente, config) {
  const propio = Number(cliente?.limiteFiado) || 0
  if (propio > 0) return propio
  return Number(config?.limiteFiadoGlobal) || 0
}

/* ================= VENTAS ================= */

// Valida un ticket sin mutar nada y devuelve { detalle, total, cliente }.
// - Carrito no vacío, cantidades consolidadas por producto y stock alcanza.
// - Contado (efectivo/transferencia): el cliente es opcional (venta libre).
// - Cuenta corriente (fiado): exige cliente con saldo a favor o límite
//   habilitado; si hay límite, la deuda proyectada no puede superarlo
//   salvo excepción expresa del vendedor.
export function validarVenta(db, { items, metodo, clienteId = null, excepcionFiado = false }) {
  if (!items?.length) throw new Error('El carrito está vacío.')

  const porProducto = new Map()
  for (const it of items) {
    porProducto.set(it.productoId, (porProducto.get(it.productoId) || 0) + Number(it.cantidad || 0))
  }
  const detalle = []
  let total = 0
  for (const [productoId, cantidad] of porProducto) {
    const p = db.productos.find((x) => x.id === productoId)
    if (!p) throw new Error('Producto no encontrado.')
    if (cantidad < 1) throw new Error('Cantidad inválida.')
    if (p.stock < cantidad) throw new Error(`Stock insuficiente: ${p.nombre}.`)
    detalle.push({ productoId: p.id, nombre: p.nombre, cantidad, precio: p.precio, costo: p.costo })
    total += p.precio * cantidad
  }

  let cliente = null
  if (clienteId) cliente = db.clientes.find((c) => c.id === clienteId) || null
  if (metodo === 'fiado') {
    if (!cliente) throw new Error('La venta en cuenta corriente exige seleccionar un cliente registrado.')
    const limite = limiteFiadoVigente(cliente, db.config)
    if (limite <= 0 && !(cliente.saldo > 0)) {
      throw new Error(`${cliente.nombre} ${cliente.apellido} no tiene saldo a favor ni límite de cuenta corriente habilitado.`)
    }
    const deudaProyectada = cliente.deuda + total
    if (!excepcionFiado && limite > 0 && deudaProyectada > limite) {
      const err = new Error(
        `Límite de cuenta corriente superado: ${cliente.nombre} quedaría debiendo $ ${deudaProyectada.toLocaleString('es-AR')} (límite $ ${limite.toLocaleString('es-AR')}).`
      )
      err.code = 'FIADO_LIMITE'
      err.deudaProyectada = deudaProyectada
      throw err
    }
  }
  return { detalle, total, cliente }
}

// Asienta la venta ya validada sobre el borrador `db`: descuenta stock,
// registra el ticket y, si es fiado, impacta la cuenta corriente.
export function aplicarVentaDb(db, { venta, detalle, metodo, clienteId }) {
  for (const it of detalle) {
    const p = db.productos.find((x) => x.id === it.productoId)
    if (!p || p.stock - it.cantidad < 0) throw new Error(`Stock insuficiente: ${it.nombre}.`)
    p.stock -= it.cantidad
  }
  db.ventas.unshift(venta)
  if (metodo === 'fiado' && clienteId) {
    const c = db.clientes.find((x) => x.id === clienteId)
    if (!c) throw new Error('Cliente no encontrado.')
    c.deuda += venta.total
    c.fiados.unshift({
      id: uid(),
      ventaId: venta.id,
      fecha: venta.fecha,
      items: detalle.map((d) => ({ nombre: d.nombre, cantidad: d.cantidad, precio: d.precio })),
      monto: venta.total,
      pendiente: venta.total,
      pagado: false,
    })
    c.movimientos.unshift({
      id: uid(),
      fecha: venta.fecha,
      tipo: 'fiado',
      detalle: `Compra fiada · ${detalle.reduce((s, d) => s + d.cantidad, 0)} ítem(s)`,
      monto: venta.total,
    })
  }
  return venta
}

// Reversa de una venta: repone stock y, si era fiada, quita la deuda.
export function anularVentaDb(db, ventaId) {
  const v = db.ventas.find((x) => x.id === ventaId)
  if (!v) throw new Error('Venta no encontrada.')
  if (v.anulada) throw new Error('La venta ya está anulada.')
  v.anulada = true
  for (const it of v.items) {
    const p = db.productos.find((x) => x.id === it.productoId)
    if (p) p.stock += it.cantidad
  }
  if (v.metodo === 'fiado' && v.clienteId) {
    const c = db.clientes.find((x) => x.id === v.clienteId)
    if (c) {
      const f = c.fiados.find((x) => x.ventaId === v.id)
      const revertir = f ? f.pendiente : v.total
      if (f) {
        f.pendiente = 0
        f.pagado = true
      }
      c.deuda = Math.max(0, c.deuda - revertir)
      c.movimientos.unshift({
        id: uid(),
        fecha: new Date().toISOString(),
        tipo: 'anulacion',
        detalle: `Anulación de venta fiada #${v.id.slice(0, 8).toUpperCase()}`,
        monto: -revertir,
      })
    }
  }
  return v
}

/* ================= PAGOS / RECARGAS ================= */

// Pago (abono) a la cuenta corriente: primero salda fiados viejos y el
// excedente queda como saldo a favor. Asienta el movimiento.
export function aplicarPagoDb(db, clienteId, monto, detalle) {
  const c = db.clientes.find((x) => x.id === clienteId)
  if (!c) throw new Error('Cliente no encontrado.')
  const { resto } = abonarFiados(c, monto)
  c.movimientos.unshift({
    id: uid(),
    fecha: new Date().toISOString(),
    tipo: 'abono',
    detalle: `Pago de deuda · ${detalle}` + (resto > 0 ? ' (excedente a saldo)' : ''),
    monto: -Math.min(monto, monto - resto),
  })
  return { cliente: c, resto }
}

// Recarga de saldo: también cubre deuda primero (fiados más antiguos).
export function aplicarRecargaDb(db, clienteId, monto, detalle) {
  const c = db.clientes.find((x) => x.id === clienteId)
  if (!c) throw new Error('Cliente no encontrado.')
  const { abonado } = abonarFiados(c, monto)
  c.movimientos.unshift({
    id: uid(),
    fecha: new Date().toISOString(),
    tipo: 'recarga',
    detalle:
      `Recarga de saldo · ${detalle}` +
      (abonado > 0 ? ` ($ ${abonado.toLocaleString('es-AR')} aplicados a deuda)` : ''),
    monto,
  })
  return { cliente: c, abonado }
}

/* ================= SOLICITUDES ================= */

// El cliente informa una transferencia: queda pendiente hasta que el
// mostrador la valide (sin tocar deuda ni saldo todavía). Anti-spam: una
// sola solicitud de transferencia abierta por cliente.
export function nuevaSolicitudTransferencia(db, { clienteId, monto, origen = 'cliente', tipoOperacion = 'deuda' }) {
  monto = Number(monto)
  if (!monto || monto <= 0) throw new Error('Ingresá un monto válido.')
  const c = db.clientes.find((x) => x.id === clienteId)
  if (!c) throw new Error('Cliente no encontrado.')
  if ((db.solicitudes || []).some((s) => s.clienteId === clienteId && s.tipo === TIPOS_SOLICITUD.TRANSFERENCIA && s.estado === 'pendiente')) {
    throw new Error('Ya tenés una transferencia en proceso de revisión. El kiosco debe acreditarla antes de informar otra.')
  }
  return {
    id: uid(),
    tipo: TIPOS_SOLICITUD.TRANSFERENCIA,
    clienteId,
    nombre: `${c.nombre} ${c.apellido}`,
    monto,
    tipoOperacion, // 'deuda' | 'recarga'
    origen,
    fechaHora: new Date().toISOString(),
    estado: 'pendiente',
  }
}

// Recupero de PIN desde el login público: el DNI debe existir y no puede
// haber otro pedido de reseteo abierto para ese cliente.
export function nuevaSolicitudResetPin(db, { dni }) {
  const c = (db.clientes || []).find((x) => x.dni === String(dni ?? '').trim())
  if (!c) return null
  if ((db.solicitudes || []).some((s) => s.tipo === TIPOS_SOLICITUD.RESET_PIN && s.clienteId === c.id && s.estado === 'pendiente')) {
    return { duplicada: true, solicitud: db.solicitudes.find((s) => s.tipo === TIPOS_SOLICITUD.RESET_PIN && s.clienteId === c.id && s.estado === 'pendiente'), cliente: c }
  }
  return {
    duplicada: false,
    cliente: c,
    solicitud: {
      id: uid(),
      tipo: TIPOS_SOLICITUD.RESET_PIN,
      clienteId: c.id,
      nombre: `${c.nombre} ${c.apellido}`,
      dni: c.dni,
      origen: 'cliente',
      fechaHora: new Date().toISOString(),
      estado: 'pendiente',
    },
  }
}

// Aprueba una solicitud pendiente (muta el borrador):
//   RESET_PIN                → PIN del cliente = PIN_TEMPORAL.
//   TRANSFERENCIA_PENDIENTE  → impacta saldo/deuda según tipoOperacion.
export function aprobarSolicitudDb(db, solicitudId, { pinTemporal = PIN_TEMPORAL } = {}) {
  const s = (db.solicitudes || []).find((x) => x.id === solicitudId)
  if (!s || s.estado !== 'pendiente') throw new Error('La solicitud ya fue procesada.')
  const c = db.clientes.find((x) => x.id === s.clienteId)
  if (!c) throw new Error('El cliente ya no existe.')
  s.estado = 'aprobada'
  s.fechaResolucion = new Date().toISOString()
  if (s.tipo === TIPOS_SOLICITUD.RESET_PIN) {
    c.pin = pinTemporal
    c.movimientos.unshift({
      id: uid(),
      fecha: s.fechaResolucion,
      tipo: 'seguridad',
      detalle: `PIN restablecido por el kiosco · temporal ${pinTemporal}`,
      monto: 0,
    })
    return { solicitud: s, cliente: c }
  }
  if (s.tipo === TIPOS_SOLICITUD.TRANSFERENCIA) {
    const aplicado =
      s.tipoOperacion === 'recarga'
        ? aplicarRecargaDb(db, s.clienteId, s.monto, 'Transferencia acreditada')
        : aplicarPagoDb(db, s.clienteId, s.monto, 'Transferencia acreditada')
    return { solicitud: s, cliente: c, aplicado }
  }
  throw new Error(`Tipo de solicitud desconocido: ${s.tipo}`)
}

export function descartarSolicitudDb(db, solicitudId) {
  const s = (db.solicitudes || []).find((x) => x.id === solicitudId)
  if (!s || s.estado !== 'pendiente') throw new Error('La solicitud ya fue procesada.')
  s.estado = 'descartada'
  s.fechaResolucion = new Date().toISOString()
  return s
}

export const solicitudesPendientesDe = (db) =>
  (db.solicitudes || []).filter((s) => s.estado === 'pendiente')
