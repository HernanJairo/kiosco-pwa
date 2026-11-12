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

// Formato básico de correo electrónico (campo opcional del cliente).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Estructura oficial del Cliente.
export function nuevoCliente({ nombre, apellido = '', dni, telefono = '', email = '', pin, limiteFiado = 0 }) {
  return {
    id: uid(),
    dni: String(dni).trim(),
    nombre: String(nombre).trim(),
    apellido: String(apellido).trim(),
    telefono: String(telefono ?? '').trim(),
    email: String(email ?? '').trim().toLowerCase(),
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
export function validarAltaCliente(clientes, { nombre, apellido, dni, pin, telefono, email }) {
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
  // El correo es opcional; si se carga debe tener formato válido y ser
  // único, porque también funciona como identificador de acceso.
  const emailStr = String(email ?? '').trim().toLowerCase()
  if (emailStr) {
    if (!EMAIL_RE.test(emailStr)) throw new Error('Ingresá un correo electrónico válido.')
    if ((clientes || []).some((c) => c.email && c.email === emailStr)) {
      throw new Error(`Ya existe un cliente registrado con el correo ${emailStr}.`)
    }
  }
  return dniStr
}

/* ================= PERSONAL / EQUIPO ================= */

export const ROLES_PERSONAL = ['admin', 'vendedor']

// Estructura oficial del integrante del equipo (admins y vendedores).
// usuario = DNI o username único · pin = 4 dígitos · avatarUrl = foto
// opcional (DataURL/URL) · activo = acceso habilitado.
export function nuevoPersonal({ usuario, nombre, apellido = '', rol = 'vendedor', pin, avatarUrl = '', activo = true, puesto = '' }) {
  return {
    id: uid(),
    usuario: String(usuario).trim().toLowerCase(),
    nombre: String(nombre).trim(),
    apellido: String(apellido).trim(),
    rol: ROLES_PERSONAL.includes(rol) ? rol : 'vendedor',
    pin: String(pin).trim(),
    avatarUrl: String(avatarUrl ?? '').trim(),
    activo: activo !== false,
    puesto: String(puesto ?? '').trim(),
  }
}

// Validación estricta del alta de equipo: usuario único, PIN de 4
// dígitos y rol válido.
export function validarAltaPersonal(personal, { usuario, nombre, rol, pin }) {
  if (!String(nombre ?? '').trim()) throw new Error('Ingresá el nombre del integrante.')
  const user = String(usuario ?? '').trim().toLowerCase()
  if (!user) throw new Error('Ingresá el usuario (DNI o nombre de usuario).')
  if ((personal || []).some((p) => p.usuario === user)) {
    throw new Error(`Ya existe un integrante con el usuario "${user}".`)
  }
  if (!/^\d{4}$/.test(String(pin ?? '').trim())) {
    throw new Error('El PIN debe tener exactamente 4 dígitos numéricos.')
  }
  if (!ROLES_PERSONAL.includes(rol)) {
    throw new Error('Rol inválido: elegí admin o vendedor.')
  }
  return user
}

// ¿Queda otro administrador ACTIVO además de `excluirId`?
const hayOtroAdminActivo = (personal, excluirId) =>
  (personal || []).some((p) => p.id !== excluirId && p.rol === 'admin' && p.activo !== false)

// Edición administrativa del equipo: datos, rol y estado de acceso.
// Regla de negocio: nunca puede quedar el sistema sin administrador
// activo (ni por desactivar ni por degradar el rol).
export function actualizarPersonalDb(db, id, patch = {}) {
  const p = (db.personal || []).find((x) => x.id === id)
  if (!p) throw new Error('Integrante no encontrado.')
  const limpio = { ...patch }
  if (limpio.usuario !== undefined) {
    const user = String(limpio.usuario).trim().toLowerCase()
    if (!user) throw new Error('El usuario no puede quedar vacío.')
    if (db.personal.some((x) => x.id !== id && x.usuario === user)) {
      throw new Error(`Ya existe otro integrante con el usuario "${user}".`)
    }
    limpio.usuario = user
  }
  if (limpio.pin !== undefined) {
    if (!/^\d{4}$/.test(String(limpio.pin).trim())) {
      throw new Error('El PIN debe tener exactamente 4 dígitos numéricos.')
    }
    limpio.pin = String(limpio.pin).trim()
  }
  if (limpio.rol !== undefined && !ROLES_PERSONAL.includes(limpio.rol)) {
    throw new Error('Rol inválido: elegí admin o vendedor.')
  }
  if (limpio.nombre !== undefined && !String(limpio.nombre).trim()) {
    throw new Error('El nombre no puede quedar vacío.')
  }
  const quitaAdmin = limpio.activo === false || (limpio.rol !== undefined && limpio.rol !== 'admin')
  if (quitaAdmin && p.rol === 'admin' && p.activo !== false && !hayOtroAdminActivo(db.personal, id)) {
    throw new Error('No se puede quitar al último administrador activo del sistema.')
  }
  Object.assign(p, limpio)
  return p
}

// Baja del equipo: bloqueada si es el último administrador activo.
export function eliminarPersonalDb(db, id) {
  const p = (db.personal || []).find((x) => x.id === id)
  if (!p) throw new Error('Integrante no encontrado.')
  if (p.rol === 'admin' && p.activo !== false && !hayOtroAdminActivo(db.personal, id)) {
    throw new Error('No se puede eliminar al último administrador activo del sistema.')
  }
  db.personal = db.personal.filter((x) => x.id !== id)
  return p
}

// Cambio de PIN propio ("Mi Perfil"): exige conocer el PIN vigente.
export function cambiarPinPersonalDb(db, id, pinActual, pinNuevo) {
  const p = (db.personal || []).find((x) => x.id === id)
  if (!p) throw new Error('Integrante no encontrado.')
  if (p.pin !== String(pinActual ?? '').trim()) throw new Error('El PIN actual no es correcto.')
  if (!/^\d{4}$/.test(String(pinNuevo ?? '').trim())) {
    throw new Error('El PIN nuevo debe tener exactamente 4 dígitos numéricos.')
  }
  p.pin = String(pinNuevo).trim()
  return p
}

// Resolución de acceso del mostrador: usuario (DNI o username) + PIN.
// Devuelve el integrante o lanza el motivo concreto del rechazo.
export function autenticarPersonal(db, { usuario, pin }) {
  const user = String(usuario ?? '').trim().toLowerCase()
  const p = (db.personal || []).find((x) => x.usuario === user)
  if (!p || p.pin !== String(pin ?? '').trim()) {
    throw new Error('Usuario o PIN incorrectos.')
  }
  if (p.activo === false) throw new Error('Este usuario está desactivado. Consultá al administrador.')
  return p
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
export function validarVenta(db, { items, metodo, clienteId = null, excepcionFiado = false, omitirStock = false }) {
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
    // Retiro de encargo: el stock ya está reservado fuera de góndola.
    if (!omitirStock && p.stock < cantidad) throw new Error(`Stock insuficiente: ${p.nombre}.`)
    detalle.push({ productoId: p.id, nombre: p.nombre, cantidad, precio: p.precio, costo: p.costo })
    total += p.precio * cantidad
  }

  let cliente = null
  if (clienteId) cliente = db.clientes.find((c) => c.id === clienteId) || null
  if (metodo === 'saldo') {
    if (!cliente) throw new Error('Pagar con saldo de billetera exige seleccionar un cliente registrado.')
    if ((cliente.saldo || 0) < total) {
      throw new Error(
        `Saldo insuficiente: ${cliente.nombre} tiene $ ${(cliente.saldo || 0).toLocaleString('es-AR')} y el ticket es $ ${total.toLocaleString('es-AR')}.`
      )
    }
  }
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
export function aplicarVentaDb(db, { venta, detalle, metodo, clienteId, descontarStock = true }) {
  for (const it of detalle) {
    const p = db.productos.find((x) => x.id === it.productoId)
    if (!p) throw new Error(`Producto no encontrado: ${it.nombre}.`)
    if (descontarStock) {
      if (p.stock - it.cantidad < 0) throw new Error(`Stock insuficiente: ${it.nombre}.`)
      p.stock -= it.cantidad
    }
  }
  db.ventas.unshift(venta)
  if (metodo === 'saldo' && clienteId) {
    const c = db.clientes.find((x) => x.id === clienteId)
    if (!c) throw new Error('Cliente no encontrado.')
    if ((c.saldo || 0) < venta.total) throw new Error('Saldo insuficiente.')
    c.saldo -= venta.total
    c.movimientos.unshift({
      id: uid(),
      fecha: venta.fecha,
      tipo: 'consumo',
      detalle: `Compra con saldo · ${detalle.reduce((s, d) => s + d.cantidad, 0)} ítem(s)` + (venta.retiradoPor ? ` · Retiró: ${venta.retiradoPor}` : ''),
      monto: -venta.total,
    })
  }
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
      detalle: `Compra fiada · ${detalle.reduce((s, d) => s + d.cantidad, 0)} ítem(s)` + (venta.retiradoPor ? ` · Retiró: ${venta.retiradoPor}` : ''),
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
  if (v.metodo === 'saldo' && v.clienteId) {
    const c = db.clientes.find((x) => x.id === v.clienteId)
    if (c) {
      c.saldo += v.total
      c.movimientos.unshift({
        id: uid(),
        fecha: new Date().toISOString(),
        tipo: 'anulacion',
        detalle: `Anulación de compra con saldo #${v.id.slice(0, 8).toUpperCase()}`,
        monto: v.total,
      })
    }
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

/* ================= ENCARGOS (pedido anticipado para retiro) =================
   Un cliente logueado envía su carrito "para armar" sin pagar todavía.
   Flujo: en_preparacion → listo_retiro → entregado (al cobrar en mostrador).
   El stock se RESERVA al crear el encargo: si se cancela o se ajusta por
   faltante de góndola, la mercadería vuelve a stock. `preparadoPor`
   registra qué empleado armó la bolsa y `retiradoPor` quién la retiró. */

export const ESTADOS_ENCARGO = ['en_preparacion', 'listo_retiro', 'entregado', 'cancelado']

export function nuevoEncargo(db, { clienteId, items, retiroTercero = null }) {
  const cliente = (db.clientes || []).find((c) => c.id === clienteId)
  if (!cliente) throw new Error('El encargo exige un cliente registrado.')
  if (!Array.isArray(items) || !items.length) throw new Error('El pedido está vacío.')

  const detalle = []
  for (const it of items) {
    const p = (db.productos || []).find((x) => x.id === it.productoId)
    const cantidad = Math.max(0, Number(it.cantidad) || 0)
    if (!p || cantidad <= 0) continue
    const prev = detalle.find((d) => d.productoId === p.id)
    if (prev) prev.cantidad += cantidad
    else detalle.push({ productoId: p.id, nombre: p.nombre, cantidad, precio: p.precio })
  }
  if (!detalle.length) throw new Error('Ningún producto del pedido es válido.')

  // Reserva de stock: la mercadería queda comprometida hasta que el
  // encargo se entregue, se ajuste o se cancele.
  for (const d of detalle) {
    const p = db.productos.find((x) => x.id === d.productoId)
    if (p.stock < d.cantidad) throw new Error(`Stock insuficiente para reservar ${p.nombre}.`)
  }
  for (const d of detalle) {
    const p = db.productos.find((x) => x.id === d.productoId)
    p.stock -= d.cantidad
  }

  const encargo = {
    id: uid(),
    fecha: new Date().toISOString(),
    clienteId: cliente.id,
    clienteNombre: `${cliente.nombre} ${cliente.apellido}`.trim(),
    items: detalle,
    itemsFaltantes: [],
    total: detalle.reduce((s, d) => s + d.precio * d.cantidad, 0),
    estado: 'en_preparacion',
    retiroTercero: retiroTercero && retiroTercero.dni ? { nombre: String(retiroTercero.nombre || '').trim(), dni: String(retiroTercero.dni).trim() } : null,
    preparadoPor: null,
    preparadoEn: null,
    retiradoPor: null,
    entregadoEn: null,
  }
  if (!Array.isArray(db.encargos)) db.encargos = []
  db.encargos.unshift(encargo)
  return encargo
}

// Faltante en góndola ("caso 999"): el empleado quita `cantidad` unidades
// de un ítem del pedido (0 = quita la línea). La mercadería reservada
// vuelve a stock, el total se recalcula y la baja queda registrada.
export function ajustarItemEncargoDb(db, encargoId, productoId, cantidadQuitar, { ajustadoPor } = {}) {
  const e = (db.encargos || []).find((x) => x.id === encargoId)
  if (!e) throw new Error('Encargo no encontrado.')
  if (e.estado !== 'en_preparacion') throw new Error('Solo se puede ajustar un pedido en preparación.')
  const item = e.items.find((i) => i.productoId === productoId)
  if (!item) throw new Error('El producto no está en el pedido.')
  const quitar = Math.max(0, Math.min(Number(cantidadQuitar) || 0, item.cantidad))
  if (quitar <= 0) throw new Error('Cantidad a quitar inválida.')

  item.cantidad -= quitar
  const p = (db.productos || []).find((x) => x.id === productoId)
  if (p) p.stock += quitar // la reserva sobrante vuelve a la góndola

  if (!Array.isArray(e.itemsFaltantes)) e.itemsFaltantes = []
  const fal = e.itemsFaltantes.find((f) => f.productoId === productoId)
  if (fal) fal.cantidad += quitar
  else e.itemsFaltantes.push({ productoId, nombre: item.nombre, cantidad: quitar, ajustadoPor: ajustadoPor || 'mostrador' })

  if (item.cantidad <= 0) e.items = e.items.filter((i) => i.productoId !== productoId)
  e.total = e.items.reduce((s, d) => s + d.precio * d.cantidad, 0)
  if (!e.items.length) throw new Error('El pedido quedó vacío: cancelá el encargo.')
  return e
}

// Tercero autorizado para retirar (opcional, lo carga el titular).
export function guardarTerceroEncargoDb(db, encargoId, { nombre, dni }) {
  const e = (db.encargos || []).find((x) => x.id === encargoId)
  if (!e) throw new Error('Encargo no encontrado.')
  if (e.estado !== 'en_preparacion' && e.estado !== 'listo_retiro') {
    throw new Error('Este encargo ya fue cerrado.')
  }
  const d = String(dni ?? '').trim()
  if (!d || !String(nombre ?? '').trim()) throw new Error('Ingresá nombre y DNI del autorizado.')
  e.retiroTercero = { nombre: String(nombre).trim(), dni: d }
  return e
}

// Despacho en caja por DNI: busca el encargo listo del titular o de su
// tercero autorizado y devuelve quién retira físicamente la bolsa.
export function buscarEncargoListoPorDni(db, dni) {
  const d = String(dni ?? '').trim()
  if (!d) throw new Error('Ingresá un DNI para buscar.')
  const cliente = (db.clientes || []).find((c) => String(c.dni) === d)
  const porTercero = (db.encargos || []).find(
    (e) => e.estado === 'listo_retiro' && e.retiroTercero?.dni === d
  )
  const porTitular = cliente
    ? (db.encargos || []).find((e) => e.estado === 'listo_retiro' && e.clienteId === cliente.id)
    : null
  const e = porTitular || porTercero
  if (!e) throw new Error('No hay pedidos listos para retirar con ese DNI.')
  const retiradoPor = porTitular
    ? `${e.clienteNombre} (titular)`
    : `${e.retiroTercero.nombre} (autorizado · DNI ${d})`
  return { encargo: e, retiradoPor }
}

export function marcarEncargoListoDb(db, encargoId, { preparadoPor }) {
  const e = (db.encargos || []).find((x) => x.id === encargoId)
  if (!e) throw new Error('Encargo no encontrado.')
  if (e.estado !== 'en_preparacion') throw new Error('El encargo ya no está en preparación.')
  e.estado = 'listo_retiro'
  e.preparadoPor = preparadoPor || 'mostrador'
  e.preparadoEn = new Date().toISOString()
  return e
}

// Se cobra/retira en mostrador: solo se puede entregar un encargo activo.
export function entregarEncargoDb(db, encargoId, { retiradoPor } = {}) {
  const e = (db.encargos || []).find((x) => x.id === encargoId)
  if (!e) throw new Error('Encargo no encontrado.')
  if (e.estado === 'entregado' || e.estado === 'cancelado') {
    throw new Error('Este encargo ya fue cerrado.')
  }
  e.estado = 'entregado'
  e.retiradoPor = retiradoPor || e.retiradoPor || e.clienteNombre
  e.entregadoEn = new Date().toISOString()
  return e
}

// Cancelación: devuelve la mercadería reservada a la góndola.
export function cancelarEncargoDb(db, encargoId) {
  const e = (db.encargos || []).find((x) => x.id === encargoId)
  if (!e) throw new Error('Encargo no encontrado.')
  if (e.estado === 'entregado' || e.estado === 'cancelado') {
    throw new Error('Este encargo ya fue cerrado.')
  }
  for (const it of e.items) {
    const p = (db.productos || []).find((x) => x.id === it.productoId)
    if (p) p.stock += it.cantidad
  }
  e.estado = 'cancelado'
  return e
}

export const encargosActivosDe = (db) =>
  (db.encargos || []).filter((e) => e.estado === 'en_preparacion' || e.estado === 'listo_retiro')

/* ================= AUDITORÍA DE ESTADO =================
   Cada cambio operativo del local (abierto/cerrado, encargos
   activos/pausados) queda registrado con autor, rol y hora. */
export function registrarAuditoriaDb(db, { autor, rol, accion, detalle }) {
  if (!Array.isArray(db.auditoria)) db.auditoria = []
  const entrada = {
    id: uid(),
    fecha: new Date().toISOString(),
    autor: autor || 'sistema',
    rol: rol || 'sistema',
    accion,
    detalle,
  }
  db.auditoria.unshift(entrada)
  if (db.auditoria.length > 300) db.auditoria.length = 300
  return entrada
}
