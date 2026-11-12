// Batería de pruebas del Módulo 1: ejerce la lógica de negocio pura
// (src/context/operaciones.js) contra copias del seed, sin levantar la app.
// Correr: node scripts/qa-flujos.mjs
import { buildSeed } from '../src/context/seedData.js'
import { clientePorIdentificador } from '../src/utils/acceso.js'
import {
  ajustarItemEncargoDb,
  anularVentaDb,
  aplicarPagoDb,
  aplicarRecargaDb,
  aplicarVentaDb,
  aprobarSolicitudDb,
  autenticarPersonal,
  buscarEncargoListoPorDni,
  cambiarPinPersonalDb,
  cancelarEncargoDb,
  descartarSolicitudDb,
  desbloquearFiadoDb,
  eliminarClienteDb,
  eliminarPersonalDb,
  encargosActivosDe,
  entregarEncargoDb,
  guardarTerceroEncargoDb,
  limiteFiadoVigente,
  marcarEncargoListoDb,
  nuevaSolicitudResetPin,
  nuevaSolicitudTransferencia,
  progresoFiado,
  nuevoCliente,
  nuevoEncargo,
  nuevoPersonal,
  registrarAuditoriaDb,
  solicitudesPendientesDe,
  actualizarPersonalDb,
  validarAltaCliente,
  validarAltaPersonal,
  validarVenta,
  PIN_TEMPORAL,
} from '../src/context/operaciones.js'

let pasadas = 0
let fallidas = 0
const ok = (cond, nombre) => {
  if (cond) { pasadas++; console.log(`  ✔ ${nombre}`) }
  else { fallidas++; console.log(`  ✘ ${nombre}`) }
}
const tira = (fn, match, nombre) => {
  try { fn(); fallidas++; console.log(`  ✘ ${nombre} — no lanzó error`) }
  catch (e) {
    if (!match || e.message.includes(match) || e.code === match) { pasadas++; console.log(`  ✔ ${nombre} (${e.message.slice(0, 70)})`) }
    else { fallidas++; console.log(`  ✘ ${nombre} — error inesperado: ${e.message}`) }
  }
}
const clonar = (db) => JSON.parse(JSON.stringify(db))

console.log('\n═══ 1. Alta de cliente y DNI único ═══')
{
  const db = clonar(buildSeed())
  const datos = { nombre: 'Ana', apellido: 'Prueba', dni: '99888777', telefono: '+5493885551234', pin: '5678' }
  validarAltaCliente(db.clientes, datos)
  const c = nuevoCliente(datos)
  db.clientes.push(c)
  ok(db.clientes.some((x) => x.dni === '99888777'), 'alta con DNI nuevo funciona')
  ok(c.saldo === 0 && c.deuda === 0 && Array.isArray(c.fiados) && Array.isArray(c.movimientos), 'estructura oficial del cliente')
  tira(() => validarAltaCliente(db.clientes, { ...datos, nombre: 'Otro' }), 'DNI', 'DNI duplicado rechazado')
  tira(() => validarAltaCliente(db.clientes, { ...datos, dni: '11223344', pin: '12a4' }), '4 dígitos', 'PIN no numérico rechazado')
  tira(() => validarAltaCliente(db.clientes, { ...datos, dni: '22334455', pin: '12345' }), '4 dígitos', 'PIN de 5 dígitos rechazado')

  // Email opcional: vacío pasa, válido pasa, malformado y duplicado no.
  validarAltaCliente(db.clientes, { ...datos, dni: '33445566', email: '' })
  ok(true, 'alta sin email permitida (campo opcional)')
  validarAltaCliente(db.clientes, { ...datos, dni: '44556677', email: 'ana@correo.com' })
  ok(true, 'alta con email válido permitida')
  tira(() => validarAltaCliente(db.clientes, { ...datos, dni: '55667788', email: 'no-es-un-mail' }), 'correo', 'email malformado rechazado')
  tira(() => validarAltaCliente(db.clientes, { ...datos, dni: '66778899', email: 'maria.gonzalez@correo.com' }), 'correo', 'email duplicado rechazado')
}

console.log('\n═══ 1b. Login por DNI o correo + PIN ═══')
{
  const db = clonar(buildSeed())
  const conMail = db.clientes.find((x) => x.email)
  ok(
    clientePorIdentificador(db.clientes, conMail.dni)?.id === conMail.id,
    'identificador por DNI resuelve al cliente'
  )
  ok(
    clientePorIdentificador(db.clientes, conMail.email.toUpperCase())?.id === conMail.id,
    'identificador por correo (case-insensitive) resuelve al cliente'
  )
  ok(clientePorIdentificador(db.clientes, 'nadie@correo.com') === null, 'correo inexistente no resuelve')
  ok(clientePorIdentificador(db.clientes, '') === null, 'identificador vacío no resuelve')
}

console.log('\n═══ 2. Venta libre sin cliente (efectivo y transferencia) ═══')
{
  const db = clonar(buildSeed())
  const prod = db.productos.find((p) => p.stock >= 2)
  const stockAntes = prod.stock
  const items = [{ productoId: prod.id, cantidad: 2 }]
  for (const metodo of ['efectivo', 'transferencia']) {
    const { detalle, total, cliente } = validarVenta(db, { items, metodo, clienteId: null })
    const venta = { id: `v-${metodo}`, fecha: new Date().toISOString(), items: detalle, total, metodo, vendedor: 'qa', clienteId: null, clienteNombre: null }
    aplicarVentaDb(db, { venta, detalle, metodo, clienteId: null })
    ok(cliente === null, `${metodo}: no exige cliente`)
  }
  ok(prod.stock === stockAntes - 4, 'stock descontado en ambas ventas libres')
}

console.log('\n═══ 3. Venta fiada: exige cliente e incrementa deuda ═══')
{
  const db = clonar(buildSeed())
  const prod = db.productos[0]
  const items = [{ productoId: prod.id, cantidad: 1 }]
  tira(() => validarVenta(db, { items, metodo: 'fiado', clienteId: null }), 'cliente', 'fiado sin cliente rechazado')

  const c = db.clientes.find((x) => limiteFiadoVigente(x, db.config) > 0)
  const deudaAntes = c.deuda
  const { detalle, total } = validarVenta(db, { items, metodo: 'fiado', clienteId: c.id })
  aplicarVentaDb(db, { venta: { id: 'v-fiada', fecha: new Date().toISOString(), items: detalle, total, metodo: 'fiado', vendedor: 'qa', clienteId: c.id, clienteNombre: `${c.nombre} ${c.apellido}` }, detalle, metodo: 'fiado', clienteId: c.id })
  ok(c.deuda === deudaAntes + total, `deuda incrementada (${deudaAntes} → ${c.deuda})`)
  ok(c.fiados[0].ventaId === 'v-fiada' && c.fiados[0].pendiente === total, 'fiado asentado en la libreta')
  ok(c.movimientos[0].tipo === 'fiado', 'movimiento registrado')

  // Cliente nuevo (antifraude): nace sin Cuenta Corriente, solo prepago
  db.config.limiteFiadoGlobal = 0
  const sinCredito = nuevoCliente({ nombre: 'Sin', apellido: 'Credito', dni: '55555555', pin: '9999', limiteFiado: 0 })
  db.clientes.push(sinCredito)
  tira(() => validarVenta(db, { items, metodo: 'fiado', clienteId: sinCredito.id }), 'Cuenta Corriente habilitada', 'cliente nuevo sin fiado habilitado rechazado')

  // Bloqueo manual del admin: aunque tenga saldo, el fiado queda cortado
  sinCredito.saldo = 500
  sinCredito.fiadoHabilitado = true
  sinCredito.fiadoBloqueado = true
  tira(() => validarVenta(db, { items, metodo: 'fiado', clienteId: sinCredito.id }), 'bloqueada', 'fiado bloqueado por admin rechazado')

  // Legado (base vieja sin flags): sin saldo ni límite, mensaje clásico
  const legado = nuevoCliente({ nombre: 'Legado', apellido: 'Viejo', dni: '66666666', pin: '1111', limiteFiado: 0 })
  delete legado.fiadoHabilitado
  delete legado.fiadoBloqueado
  legado.saldo = 0
  db.clientes.push(legado)
  tira(() => validarVenta(db, { items, metodo: 'fiado', clienteId: legado.id }), 'saldo a favor ni límite', 'cliente legado sin límite ni saldo rechazado')
}

console.log('\n═══ 3ab. Contingencia operativa: fiados y encargos pausados ═══')
{
  const semilla = buildSeed()
  ok(semilla.config.fiadosActivos === true && semilla.config.encargosActivos === true, 'interruptores de contingencia activos por defecto')

  const db = clonar(buildSeed())
  db.config.fiadosActivos = false
  const cli = db.clientes.find((x) => limiteFiadoVigente(x, db.config) > 0)
  tira(() => validarVenta(db, { items: [{ productoId: db.productos[0].id, cantidad: 1 }], metodo: 'fiado', clienteId: cli.id }), 'pausados', 'fiado rechazado con contingencia activa')
  db.config.fiadosActivos = true
  ok(!!validarVenta(db, { items: [{ productoId: db.productos[0].id, cantidad: 1 }], metodo: 'fiado', clienteId: cli.id }), 'fiado vuelve a validar al reactivar')

  db.config.encargosActivos = false
  tira(() => nuevoEncargo(db, { clienteId: cli.id, items: [{ productoId: db.productos[0].id, cantidad: 1 }] }), 'pausados', 'encargo rechazado con contingencia activa')
  db.config.encargosActivos = true
  const enc = nuevoEncargo(db, { clienteId: cli.id, items: [{ productoId: db.productos[0].id, cantidad: 1 }] })
  ok(!!enc && enc.clienteId === cli.id, 'encargo vuelve a crearse al reactivar')
}

console.log('\n═══ 3b. Desbloqueo automático del fiado (regla mixta) ═══')
{
  const db = clonar(buildSeed())
  db.config.comprasMinimasParaFiado = 3
  db.config.montoMinimoParaFiado = 5000
  db.config.limiteFiadoInicialDesbloqueado = 8000
  const prod = db.productos[0]
  const cli = nuevoCliente({ nombre: 'Fiel', apellido: 'Compra', dni: '77777777', pin: '1234', limiteFiado: 0 })
  db.clientes.push(cli)

  // Dos compras chicas: cantidad ok en progreso, monto todavía bajo
  for (let i = 0; i < 2; i++) {
    const { detalle, total } = validarVenta(db, { items: [{ productoId: prod.id, cantidad: 1 }], metodo: 'efectivo', clienteId: cli.id })
    aplicarVentaDb(db, { venta: { id: `v-des-${i}`, fecha: new Date().toISOString(), items: detalle, total, metodo: 'efectivo', vendedor: 'qa', clienteId: cli.id }, detalle, metodo: 'efectivo', clienteId: cli.id })
  }
  const p1 = progresoFiado(db, cli)
  ok(p1.compras === 2 && desbloquearFiadoDb(db, cli.id) === null, `progreso ${p1.compras}/${p1.minCompras} compras · sin desbloquear aún`)

  // Tercera compra que además supera el monto → desbloqueo exacto una vez
  const { detalle: d3, total: t3 } = validarVenta(db, { items: [{ productoId: prod.id, cantidad: 8 }], metodo: 'efectivo', clienteId: cli.id })
  aplicarVentaDb(db, { venta: { id: 'v-des-2', fecha: new Date().toISOString(), items: d3, total: t3, metodo: 'efectivo', vendedor: 'qa', clienteId: cli.id }, detalle: d3, metodo: 'efectivo', clienteId: cli.id })
  const des = desbloquearFiadoDb(db, cli.id)
  ok(des && des.limite === 8000 && cli.fiadoHabilitado === true, `desbloqueo aplicado · límite ${des?.limite}`)
  ok(desbloquearFiadoDb(db, cli.id) === null, 'el desbloqueo no se repite')

  // Cliente bloqueado por admin jamás se auto-desbloquea
  const bloq = nuevoCliente({ nombre: 'Bloq', apellido: 'Ueado', dni: '88888888', pin: '1234', limiteFiado: 0 })
  bloq.fiadoBloqueado = true
  db.clientes.push(bloq)
  ok(desbloquearFiadoDb(db, bloq.id) === null, 'bloqueado por admin no se auto-desbloquea')
}

console.log('\n═══ 4. Integridad: no eliminar cliente con deuda ═══')
{
  const db = clonar(buildSeed())
  const conDeuda = db.clientes.find((x) => x.deuda > 0)
  tira(() => eliminarClienteDb(db, conDeuda.id), 'deuda', 'cliente con deuda bloqueado')
  const sinDeuda = nuevoCliente({ nombre: 'Libre', apellido: 'Deuda', dni: '44444444', pin: '1111' })
  db.clientes.push(sinDeuda)
  const antes = db.clientes.length
  eliminarClienteDb(db, sinDeuda.id)
  ok(db.clientes.length === antes - 1 && !db.clientes.some((x) => x.id === sinDeuda.id), 'cliente sin deuda eliminado')
}

console.log('\n═══ 5. Recupero de PIN → bandeja → aprobación ═══')
{
  const db = clonar(buildSeed())
  const c = db.clientes[0]
  ok(nuevaSolicitudResetPin(db, { dni: '00000000' }) === null, 'DNI inexistente no genera solicitud')
  const r = nuevaSolicitudResetPin(db, { dni: c.dni })
  ok(r && !r.duplicada && r.solicitud.tipo === 'RESET_PIN', 'solicitud RESET_PIN creada')
  db.solicitudes.push(r.solicitud)
  const dup = nuevaSolicitudResetPin(db, { dni: c.dni })
  ok(dup.duplicada === true, 'segundo pedido marcado como duplicado')
  ok(solicitudesPendientesDe(db).length === 1, 'aparece en la bandeja de pendientes')
  c.pin = '9999'
  const pinAntes = c.pin
  aprobarSolicitudDb(db, r.solicitud.id)
  ok(c.pin === PIN_TEMPORAL && c.pin !== pinAntes, `PIN reseteado al temporal ${PIN_TEMPORAL}`)
  ok(solicitudesPendientesDe(db).length === 0, 'sale de la bandeja tras aprobar')
  tira(() => aprobarSolicitudDb(db, r.solicitud.id), 'procesada', 're-aprobar rechazado')
}

console.log('\n═══ 6. Transferencia informada → validar e impactar ═══')
{
  const db = clonar(buildSeed())
  const c = db.clientes.find((x) => x.deuda > 0)
  const deudaAntes = c.deuda
  const s = nuevaSolicitudTransferencia(db, { clienteId: c.id, monto: 100, origen: 'cliente', tipoOperacion: 'deuda' })
  db.solicitudes.push(s)
  tira(() => nuevaSolicitudTransferencia(db, { clienteId: c.id, monto: 50, origen: 'cliente' }), 'en proceso de revisión', 'anti-spam: una sola transferencia pendiente')
  ok(c.deuda === deudaAntes, 'deuda intacta hasta validar (no impacta de inmediato)')
  aprobarSolicitudDb(db, s.id)
  ok(c.deuda === deudaAntes - 100, `validación impacta deuda (${deudaAntes} → ${c.deuda})`)

  // Descarte: no toca la cuenta
  const s2 = nuevaSolicitudTransferencia(db, { clienteId: c.id, monto: 200, origen: 'cliente' })
  db.solicitudes.push(s2)
  descartarSolicitudDb(db, s2.id)
  ok(c.deuda === deudaAntes - 100, 'descarte no modifica la cuenta')
}

console.log('\n═══ 7. Equipo: alta, edición, PIN y último admin ═══')
{
  const db = clonar(buildSeed())
  const admins = db.personal.filter((p) => p.rol === 'admin')
  const vendedores = db.personal.filter((p) => p.rol === 'vendedor')
  ok(admins.length >= 1 && vendedores.length >= 1, 'seed incluye al menos un admin y un vendedor')
  ok(db.personal.every((p) => p.pin && /^\d{4}$/.test(p.pin) && p.activo !== undefined), 'estructura oficial del personal (pin 4 dígitos + activo)')

  // Alta de administrador
  const admin2 = { nombre: 'Segunda', apellido: 'Admin', usuario: 'admin2', rol: 'admin', pin: '4321' }
  validarAltaPersonal(db.personal, admin2)
  db.personal.push(nuevoPersonal(admin2))
  ok(db.personal.some((p) => p.usuario === 'admin2' && p.rol === 'admin'), 'alta de administrador funciona')

  // Alta de vendedor
  const vend2 = { nombre: 'Otro', apellido: 'Vendedor', usuario: 'vendedor2', rol: 'vendedor', pin: '2468' }
  validarAltaPersonal(db.personal, vend2)
  db.personal.push(nuevoPersonal(vend2))
  ok(db.personal.some((p) => p.usuario === 'vendedor2' && p.rol === 'vendedor'), 'alta de vendedor funciona')

  // Validaciones del alta
  tira(() => validarAltaPersonal(db.personal, { ...vend2, usuario: 'VENDEDOR2' }), 'Ya existe', 'usuario duplicado rechazado (case-insensitive)')
  tira(() => validarAltaPersonal(db.personal, { ...vend2, usuario: 'nuevo1', pin: '12' }), '4 dígitos', 'PIN corto rechazado')
  tira(() => validarAltaPersonal(db.personal, { ...vend2, usuario: 'nuevo1', pin: 'abcd' }), '4 dígitos', 'PIN no numérico rechazado')
  tira(() => validarAltaPersonal(db.personal, { ...vend2, usuario: 'nuevo1', pin: '1111', rol: 'super' }), 'Rol', 'rol inválido rechazado')
  tira(() => validarAltaPersonal(db.personal, { ...vend2, usuario: 'nuevo1', pin: '1111', nombre: '  ' }), 'nombre', 'nombre vacío rechazado')
}
{
  // Último administrador activo: intocable
  const db = clonar(buildSeed())
  const admin = db.personal.find((p) => p.rol === 'admin')
  const vendedor = db.personal.find((p) => p.rol === 'vendedor')
  ok(db.personal.filter((p) => p.rol === 'admin' && p.activo !== false).length === 1, 'seed con un único admin activo (precondición)')
  tira(() => eliminarPersonalDb(db, admin.id), 'último administrador', 'no se puede eliminar al último admin activo')
  tira(() => actualizarPersonalDb(db, admin.id, { activo: false }), 'último administrador', 'no se puede desactivar al último admin activo')
  tira(() => actualizarPersonalDb(db, admin.id, { rol: 'vendedor' }), 'último administrador', 'no se puede degradar al último admin activo')
  ok(db.personal.find((p) => p.id === admin.id)?.rol === 'admin', 'el admin conserva su rol tras los intentos')

  // Con un segundo admin activo, el primero sí se puede tocar
  db.personal.push(nuevoPersonal({ nombre: 'B', apellido: 'Admin', usuario: 'adminb', rol: 'admin', pin: '1111' }))
  actualizarPersonalDb(db, admin.id, { activo: false })
  ok(db.personal.find((p) => p.id === admin.id).activo === false, 'con otro admin activo, desactivar funciona')

  // Eliminación de un vendedor siempre permitida
  eliminarPersonalDb(db, vendedor.id)
  ok(!db.personal.some((p) => p.id === vendedor.id), 'eliminar vendedor funciona')
}
{
  // Edición de perfil y cambio de PIN propio
  const db = clonar(buildSeed())
  const marcos = db.personal.find((p) => p.usuario === 'vendedor')
  const editado = actualizarPersonalDb(db, marcos.id, { nombre: 'Marcos A.', apellido: 'López', usuario: 'marcos' })
  ok(editado.usuario === 'marcos' && editado.nombre === 'Marcos A.', 'edición de perfil (nombre/apellido/usuario) funciona')
  tira(() => actualizarPersonalDb(db, marcos.id, { usuario: 'admin' }), 'Ya existe', 'usuario en uso por otro integrante rechazado')

  // Foto de perfil (DataURL/URL)
  actualizarPersonalDb(db, marcos.id, { avatarUrl: 'data:image/png;base64,AAA' })
  ok(db.personal.find((p) => p.id === marcos.id).avatarUrl.startsWith('data:image'), 'foto de perfil persistida')

  // Cambio de PIN propio: exige el actual
  tira(() => cambiarPinPersonalDb(db, marcos.id, '0000', '7777'), 'PIN actual', 'cambio de PIN sin el actual correcto rechazado')
  tira(() => cambiarPinPersonalDb(db, marcos.id, '1234', '77'), '4 dígitos', 'PIN nuevo corto rechazado')
  const cambiado = cambiarPinPersonalDb(db, marcos.id, '1234', '7777')
  ok(cambiado.pin === '7777', 'cambio de PIN propio con validación funciona')

  // Restablecer PIN (admin): pisar directo valida formato
  actualizarPersonalDb(db, marcos.id, { pin: '5555' })
  ok(db.personal.find((p) => p.id === marcos.id).pin === '5555', 'restablecer PIN del integrante funciona')
  tira(() => actualizarPersonalDb(db, marcos.id, { pin: '12' }), '4 dígitos', 'restablecer PIN inválido rechazado')
}
{
  // Autenticación del mostrador: usuario + PIN + estado activo
  const db = clonar(buildSeed())
  const admin = autenticarPersonal(db, { usuario: 'ADMIN', pin: '1234' })
  ok(admin.rol === 'admin', 'login staff por usuario (case-insensitive) + PIN')
  tira(() => autenticarPersonal(db, { usuario: 'admin', pin: '9999' }), 'incorrectos', 'PIN incorrecto rechazado')
  tira(() => autenticarPersonal(db, { usuario: 'nadie', pin: '1234' }), 'incorrectos', 'usuario inexistente rechazado')
  const marcos = db.personal.find((p) => p.usuario === 'vendedor')
  actualizarPersonalDb(db, marcos.id, { activo: false })
  tira(() => autenticarPersonal(db, { usuario: 'vendedor', pin: '1234' }), 'desactivado', 'usuario desactivado no puede ingresar')
}

console.log('\n═══ 8. Encargos: reserva de stock + ciclo completo ═══')
{
  const db = clonar(buildSeed())
  const clienteId = db.clientes[0].id
  const items = [{ productoId: 'p1', cantidad: 2 }, { productoId: 'p9', cantidad: 1 }]
  const stockP1 = db.productos[0].stock
  const stockP9 = db.productos.find((p) => p.id === 'p9').stock

  const e = nuevoEncargo(db, { clienteId, items })
  ok(e.estado === 'en_preparacion', 'encargo nuevo nace en en_preparacion')
  ok(e.total === 2 * db.productos[0].precio + db.productos.find((p) => p.id === 'p9').precio, 'total del encargo = Σ precio×cantidad')
  ok(e.items.length === 2 && e.items[0].nombre, 'items del encargo traen nombre y precio de catálogo')
  ok(db.productos[0].stock === stockP1 - 2 && db.productos.find((p) => p.id === 'p9').stock === stockP9 - 1, 'crear el encargo RESERVA el stock')
  ok(encargosActivosDe(db).length === 1, 'encargo activo listado')

  tira(() => nuevoEncargo(db, { clienteId: 'inexistente', items }), 'cliente registrado', 'encargo sin cliente rechazado')
  tira(() => nuevoEncargo(db, { clienteId, items: [] }), 'vacío', 'encargo vacío rechazado')
  tira(() => nuevoEncargo(db, { clienteId, items: [{ productoId: 'xx', cantidad: 3 }] }), 'válido', 'encargo con producto inexistente rechazado')
  tira(
    () => nuevoEncargo(db, { clienteId, items: [{ productoId: 'p1', cantidad: stockP1 + 999 }] }),
    'Stock insuficiente',
    'encargo que supera el stock rechazado'
  )

  // Mismo producto repetido consolida en una sola línea.
  const e2 = nuevoEncargo(db, { clienteId, items: [{ productoId: 'p1', cantidad: 1 }, { productoId: 'p1', cantidad: 2 }] })
  ok(e2.items.length === 1 && e2.items[0].cantidad === 3, 'ítems repetidos consolidan cantidad')

  // Marcar listo: registra empleado y cambia de estado.
  const listo = marcarEncargoListoDb(db, e.id, { preparadoPor: 'Marcos' })
  ok(listo.estado === 'listo_retiro', 'marcar listo cambia a listo_retiro')
  ok(listo.preparadoPor === 'Marcos' && !!listo.preparadoEn, 'queda registrado el empleado que armó')
  tira(() => marcarEncargoListoDb(db, e.id, { preparadoPor: 'Ana' }), 'preparación', 'no se puede marcar listo dos veces')

  // Entrega en mostrador al cobrar.
  const entregado = entregarEncargoDb(db, e.id)
  ok(entregado.estado === 'entregado' && !!entregado.entregadoEn, 'entregar cierra el encargo')
  ok(encargosActivosDe(db).length === 1, 'entregado sale de la bandeja activa')
  tira(() => entregarEncargoDb(db, e.id), 'cerrado', 'no se puede entregar dos veces')

  // Cancelación desde en_preparacion: la reserva vuelve a góndola.
  const stockP1AntesCancel = db.productos[0].stock
  const cancelado = cancelarEncargoDb(db, e2.id)
  ok(cancelado.estado === 'cancelado', 'cancelar cierra el encargo')
  ok(db.productos[0].stock === stockP1AntesCancel + 3, 'cancelar devuelve el stock reservado')
  tira(() => cancelarEncargoDb(db, e2.id), 'cerrado', 'no se puede cancelar dos veces')
  ok(encargosActivosDe(db).length === 0, 'sin encargos activos tras cierre total')
}

console.log('\n═══ 9. Billetera virtual: recarga, consumo y límites ═══')
{
  const db = clonar(buildSeed())
  const c = db.clientes.find((x) => x.deuda === 0 && (x.saldo || 0) === 0) || db.clientes[0]
  c.deuda = 0
  c.fiados = []
  c.saldo = 0
  c.movimientos = []

  // Recarga pendiente → aprobación → impacto real en saldo.
  const s = nuevaSolicitudTransferencia(db, { clienteId: c.id, monto: 5000, origen: 'cliente', tipoOperacion: 'recarga' })
  db.solicitudes.push(s)
  ok(c.saldo === 0, 'recarga pendiente no impacta hasta validar')
  aprobarSolicitudDb(db, s.id)
  ok(c.saldo === 5000, `aprobación de recarga impacta saldo (0 → ${c.saldo})`)
  ok(c.movimientos[0].tipo === 'recarga', 'movimiento de recarga asentado')

  // Compra pagando 100% con saldo.
  const prod = db.productos.find((p) => p.stock >= 3)
  const stockAntes = prod.stock
  const items = [{ productoId: prod.id, cantidad: 1 }]
  const { detalle, total } = validarVenta(db, { items, metodo: 'saldo', clienteId: c.id })
  const venta = { id: 'v-saldo', fecha: new Date().toISOString(), items: detalle, total, metodo: 'saldo', vendedor: 'qa', clienteId: c.id, clienteNombre: c.nombre }
  aplicarVentaDb(db, { venta, detalle, metodo: 'saldo', clienteId: c.id })
  ok(c.saldo === 5000 - total, `compra con saldo descuenta billetera (${5000} → ${c.saldo})`)
  ok(prod.stock === stockAntes - 1, 'compra con saldo descuenta stock')
  ok(c.movimientos[0].tipo === 'consumo' && c.movimientos[0].monto === -total, 'movimiento de consumo con monto negativo')

  // Saldo insuficiente: validación bloquea (cantidad dentro de stock,
  // para que el error sea específicamente de billetera).
  const caro = db.productos.reduce((a, b) => (a.precio > b.precio ? a : b))
  const cantQueSuperaSaldo = Math.min(caro.stock, Math.ceil((c.saldo + 1) / caro.precio))
  const totalGigante = [{ productoId: caro.id, cantidad: cantQueSuperaSaldo }]
  tira(
    () => validarVenta(db, { items: totalGigante, metodo: 'saldo', clienteId: c.id }),
    'Saldo insuficiente',
    'saldo insuficiente bloquea la compra'
  )
  tira(() => validarVenta(db, { items, metodo: 'saldo', clienteId: null }), 'exige seleccionar un cliente', 'billetera sin cliente rechazada')

  // Anulación de compra con saldo: repone saldo y stock.
  anularVentaDb(db, 'v-saldo')
  ok(c.saldo === 5000, 'anulación repone el saldo')
  ok(prod.stock === stockAntes, 'anulación repone el stock')
  ok(c.movimientos[0].tipo === 'anulacion', 'movimiento de anulación asentado')

  // Abono parcial y total de deuda fiada.
  c.deuda = 0
  c.fiados = []
  const fiado1 = validarVenta(db, { items: [{ productoId: prod.id, cantidad: 1 }], metodo: 'fiado', clienteId: c.id })
  aplicarVentaDb(db, {
    venta: { id: 'v-fiada-1', fecha: new Date().toISOString(), items: fiado1.detalle, total: fiado1.total, metodo: 'fiado', vendedor: 'qa', clienteId: c.id, clienteNombre: c.nombre },
    detalle: fiado1.detalle,
    metodo: 'fiado',
    clienteId: c.id,
  })
  const deuda1 = c.deuda
  aplicarPagoDb(db, c.id, Math.round(deuda1 / 2), 'Abono parcial')
  ok(c.deuda < deuda1 && c.deuda > 0, `abono parcial reduce deuda (${deuda1} → ${c.deuda})`)
  ok(c.fiados[0].pendiente === c.deuda, 'fiado parcial sigue pendiente')
  aplicarPagoDb(db, c.id, c.deuda, 'Cancelación total')
  ok(c.deuda === 0 && c.fiados.every((f) => f.pagado), 'pago total salda la deuda y marca fiados pagados')

  // Recarga con deuda vigente: cubre deuda primero.
  c.deuda = 800
  c.fiados = [{ id: 'f-x', ventaId: 'vx', fecha: new Date().toISOString(), items: [], monto: 800, pendiente: 800, pagado: false }]
  const saldoAntesRecarga = c.saldo
  aplicarRecargaDb(db, c.id, 1000, 'Transferencia')
  ok(c.deuda === 0 && c.saldo === saldoAntesRecarga + 200, 'recarga cubre deuda y excedente va a saldo')

  // Historial cronológico: movimientos ordenados del más nuevo al más viejo.
  const fechas = c.movimientos.map((m) => new Date(m.fecha).getTime())
  ok(fechas.every((f, i) => i === 0 || f <= fechas[i - 1]), 'movimientos ordenados cronológicamente (nuevo → viejo)')

  // Integridad: no eliminar cliente con deuda (ya testeado en §4) ni con saldo pendiente de uso.
  c.deuda = 500
  tira(() => eliminarClienteDb(db, c.id), 'deuda', 'cliente con deuda > 0 no se puede eliminar')
}

console.log('\n═══ 10. Encargos: faltantes, tercero y retiro seguro ═══')
{
  const db = clonar(buildSeed())
  const cliente = db.clientes[0]
  const p1 = db.productos[0]
  const p9 = db.productos.find((x) => x.id === 'p9')

  // Encargo con tercero autorizado al crearlo.
  const e = nuevoEncargo(db, {
    clienteId: cliente.id,
    items: [{ productoId: p1.id, cantidad: 3 }, { productoId: p9.id, cantidad: 2 }],
    retiroTercero: { nombre: 'Juan Autorizado', dni: '30123456' },
  })
  const totalOriginal = e.total
  ok(e.retiroTercero?.dni === '30123456', 'tercero autorizado guardado al crear')

  // Caso 999: faltante en góndola — quitar 1 unidad y luego la línea entera.
  const stockAntesAjuste = p1.stock
  ajustarItemEncargoDb(db, e.id, p1.id, 1, { ajustadoPor: 'Marcos' })
  ok(e.items.find((i) => i.productoId === p1.id).cantidad === 2, 'quita parcial reduce cantidad del ítem')
  ok(p1.stock === stockAntesAjuste + 1, 'la unidad faltante vuelve a stock')
  ok(e.itemsFaltantes[0].cantidad === 1 && e.itemsFaltantes[0].ajustadoPor === 'Marcos', 'faltante registrado con autor')
  ok(e.total === totalOriginal - p1.precio, 'total recalculado tras quita parcial')
  ajustarItemEncargoDb(db, e.id, p9.id, 2, { ajustadoPor: 'Marcos' })
  ok(!e.items.some((i) => i.productoId === p9.id), 'quitar toda la cantidad elimina la línea')
  ok(e.itemsFaltantes.length === 2, 'ambos faltantes registrados')
  tira(() => ajustarItemEncargoDb(db, e.id, 'xxx', 1, {}), 'no está en el pedido', 'ajustar producto ajeno rechazado')
  tira(() => ajustarItemEncargoDb(db, 'enc-falso', p1.id, 1, {}), 'no encontrado', 'ajustar encargo inexistente rechazado')

  // No se puede ajustar después de listo.
  marcarEncargoListoDb(db, e.id, { preparadoPor: 'Marcos' })
  tira(() => ajustarItemEncargoDb(db, e.id, p1.id, 1, {}), 'en preparación', 'ajuste bloqueado una vez listo')

  // Tercero también puede cargarse/actualizarse después.
  guardarTerceroEncargoDb(db, e.id, { nombre: 'María Autorizada', dni: '28999888' })
  ok(e.retiroTercero.dni === '28999888', 'tercero actualizado en encargo listo')
  tira(() => guardarTerceroEncargoDb(db, e.id, { nombre: '', dni: '1' }), 'nombre y DNI', 'tercero incompleto rechazado')

  // Despacho por DNI: del tercero autorizado.
  const porDni = buscarEncargoListoPorDni(db, '28999888')
  ok(porDni.encargo.id === e.id, 'búsqueda por DNI del tercero encuentra el encargo listo')
  ok(porDni.retiradoPor.includes('autorizado'), 'identifica que retira el autorizado')

  // Despacho por DNI: del titular.
  const porTitular = buscarEncargoListoPorDni(db, cliente.dni)
  ok(porTitular.encargo.id === e.id && porTitular.retiradoPor.includes('titular'), 'búsqueda por DNI del titular encuentra el encargo')
  tira(() => buscarEncargoListoPorDni(db, '00000001'), 'No hay pedidos listos', 'DNI sin pedido listo rechazado')
  tira(() => buscarEncargoListoPorDni(db, ''), 'DNI', 'DNI vacío rechazado')

  // Cobro del encargo: el stock NO se descuenta dos veces.
  const stockCobro = p1.stock
  const { detalle, total } = validarVenta(db, {
    items: e.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
    metodo: 'efectivo',
    clienteId: cliente.id,
    omitirStock: true,
  })
  aplicarVentaDb(db, {
    venta: { id: 'v-encargo', fecha: new Date().toISOString(), items: detalle, total, metodo: 'efectivo', vendedor: 'qa', clienteId: cliente.id, clienteNombre: e.clienteNombre, retiradoPor: porDni.retiradoPor },
    detalle,
    metodo: 'efectivo',
    clienteId: cliente.id,
    descontarStock: false,
  })
  ok(p1.stock === stockCobro, 'cobrar encargo no vuelve a descontar stock')
  const entregado = entregarEncargoDb(db, e.id, { retiradoPor: porDni.retiradoPor })
  ok(entregado.retiradoPor.includes('autorizado') && entregado.estado === 'entregado', 'entrega registra quién retiró')

  // Pago del encargo con billetera del titular: valida el saldo del titular
  // aunque retire un tercero.
  const clientePobre = nuevoCliente({ nombre: 'Pobre', apellido: 'Test', dni: '11122233', pin: '1234' })
  clientePobre.saldo = 10
  db.clientes.push(clientePobre)
  const e2 = nuevoEncargo(db, { clienteId: clientePobre.id, items: [{ productoId: p1.id, cantidad: 1 }] })
  marcarEncargoListoDb(db, e2.id, { preparadoPor: 'Ana' })
  tira(
    () =>
      validarVenta(db, {
        items: e2.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
        metodo: 'saldo',
        clienteId: clientePobre.id,
        omitirStock: true,
      }),
    'insuficiente',
    'billetera del titular sin saldo bloquea retiro'
  )
  // Con saldo alcanza y registra quién retiró en el movimiento.
  clientePobre.saldo = 999999
  const pago = validarVenta(db, {
    items: e2.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
    metodo: 'saldo',
    clienteId: clientePobre.id,
    omitirStock: true,
  })
  aplicarVentaDb(db, {
    venta: { id: 'v-enc-saldo', fecha: new Date().toISOString(), items: pago.detalle, total: pago.total, metodo: 'saldo', vendedor: 'qa', clienteId: clientePobre.id, clienteNombre: e2.clienteNombre, retiradoPor: 'María Autorizada (autorizado · DNI 28999888)' },
    detalle: pago.detalle,
    metodo: 'saldo',
    clienteId: clientePobre.id,
    descontarStock: false,
  })
  ok(clientePobre.movimientos[0].detalle.includes('Retiró'), 'movimiento de billetera registra quién retiró')
  ok(clientePobre.saldo === 999999 - pago.total, 'saldo del titular descontado por el retiro del tercero')
}

console.log('\n═══ 11. Auditoría operativa: switches del local ═══')
{
  const db = clonar(buildSeed())
  const a1 = registrarAuditoriaDb(db, { autor: 'Ana García', rol: 'admin', accion: 'kiosco_cerrado', detalle: 'El local pasó a Cerrado.' })
  ok(a1.autor === 'Ana García' && a1.rol === 'admin' && !!a1.fecha, 'auditoría registra autor, rol y fecha')
  const a2 = registrarAuditoriaDb(db, { autor: 'Marcos López', rol: 'vendedor', accion: 'encargos_pausados', detalle: 'Se pausó la recepción de encargos.' })
  ok(db.auditoria[0].id === a2.id && db.auditoria.length === 2, 'entradas nuevas al tope del historial')
  ok(a2.accion === 'encargos_pausados', 'cambio de "Recibiendo encargos" auditado')

  // Límite de historial: 300 entradas.
  for (let i = 0; i < 320; i++) registrarAuditoriaDb(db, { autor: 'qa', rol: 'admin', accion: 'test', detalle: `x${i}` })
  ok(db.auditoria.length === 300, 'historial de auditoría acotado a 300 entradas')
}

console.log('\n═══ 12. Cobro multi-encargo (QR combinado) ═══')
{
  const db = clonar(buildSeed())
  const cliente = db.clientes[0]
  const p1 = db.productos[0]
  const p9 = db.productos.find((x) => x.id === 'p9')

  // Dos encargos del mismo cliente, ambos listos para retirar.
  const e1 = nuevoEncargo(db, { clienteId: cliente.id, items: [{ productoId: p1.id, cantidad: 2 }] })
  const e2 = nuevoEncargo(db, { clienteId: cliente.id, items: [{ productoId: p9.id, cantidad: 1 }, { productoId: p1.id, cantidad: 1 }] })
  const e3 = nuevoEncargo(db, { clienteId: cliente.id, items: [{ productoId: p9.id, cantidad: 1 }] })
  marcarEncargoListoDb(db, e1.id, { preparadoPor: 'Marcos' })
  marcarEncargoListoDb(db, e2.id, { preparadoPor: 'Ana' })
  // e3 queda en preparación: NO debe entrar en el QR combinado.

  // Simulación del QR multi-pedido: payload con encargoIds elegidos.
  const elegidos = [e1, e2]
  const payload = {
    tipo: 'ENCARGO_RETIRO',
    encargoIds: elegidos.map((e) => e.id),
    clienteId: cliente.id,
    nombre: e1.clienteNombre,
    items: [],
  }
  ok(payload.encargoIds.length === 2, 'QR combinado lleva los IDs de los encargos elegidos')

  // El POS consolida los ítems de ambos pedidos (lo que hace cargarEncargoQR).
  const acumulado = new Map()
  for (const e of elegidos) {
    for (const i of e.items) acumulado.set(i.productoId, (acumulado.get(i.productoId) || 0) + i.cantidad)
  }
  const itemsTicket = [...acumulado].map(([productoId, cantidad]) => ({ productoId, cantidad }))
  ok(itemsTicket.find((i) => i.productoId === p1.id).cantidad === 3, 'ítems de varios encargos se consolidan (2+1)')
  const totalTicket = elegidos.reduce((s, e) => s + e.total, 0)

  // Cobro reservado: sin doble descuento de stock.
  const stockAntes = p1.stock
  const { detalle, total } = validarVenta(db, { items: itemsTicket, metodo: 'efectivo', clienteId: cliente.id, omitirStock: true })
  ok(total === totalTicket, 'total del ticket = suma de los encargos elegidos')
  aplicarVentaDb(db, {
    venta: { id: 'v-multi', fecha: new Date().toISOString(), items: detalle, total, metodo: 'efectivo', vendedor: 'qa', clienteId: cliente.id, clienteNombre: cliente.nombre, retiradoPor: `${cliente.nombre} (titular · QR)` },
    detalle, metodo: 'efectivo', clienteId: cliente.id, descontarStock: false,
  })
  ok(p1.stock === stockAntes, 'cobro multi-encargo no descuenta stock dos veces')

  // Al cobrar, SOLO los elegidos quedan entregados; el resto sigue igual.
  for (const e of elegidos) entregarEncargoDb(db, e.id, { retiradoPor: `${cliente.nombre} (titular · QR)` })
  ok(e1.estado === 'entregado' && e2.estado === 'entregado', 'ambos encargos elegidos quedan entregados')
  ok(e3.estado === 'en_preparacion', 'encargo no elegido sigue en preparación')
  ok(encargosActivosDe(db).length === 1 && encargosActivosDe(db)[0].id === e3.id, 'solo queda activo el encargo no cobrado')
}

console.log('\n═══ 13. Retiro titular vs tercero (despacho por DNI) ═══')
{
  const db = clonar(buildSeed())
  const titular = db.clientes[0]
  const p1 = db.productos[0]

  // Encargo del titular CON tercero autorizado.
  const e = nuevoEncargo(db, {
    clienteId: titular.id,
    items: [{ productoId: p1.id, cantidad: 1 }],
    retiroTercero: { nombre: 'Hermana Autorizada', dni: '41222333' },
  })
  // Aún en preparación: el DNI no encuentra nada.
  tira(() => buscarEncargoListoPorDni(db, titular.dni), 'No hay pedidos listos', 'DNI del titular sin pedido listo aún')

  marcarEncargoListoDb(db, e.id, { preparadoPor: 'Marcos' })

  // Por DNI del titular → retiradoPor identifica "titular".
  const resTitular = buscarEncargoListoPorDni(db, titular.dni)
  ok(resTitular.encargo.id === e.id && resTitular.retiradoPor.includes('titular'), 'despacho por DNI titular identifica al titular')

  // Por DNI del tercero → mismo encargo, retiradoPor "autorizado".
  const resTercero = buscarEncargoListoPorDni(db, '41222333')
  ok(resTercero.encargo.id === e.id && resTercero.retiradoPor.includes('autorizado'), 'despacho por DNI de tercero identifica al autorizado')
  ok(resTercero.retiradoPor.includes('Hermana Autorizada'), 'el nombre del autorizado viaja en retiradoPor')

  // La entrega sella quién retiró físicamente la bolsa.
  const cerrado = entregarEncargoDb(db, e.id, { retiradoPor: resTercero.retiradoPor })
  ok(cerrado.retiradoPor.includes('autorizado'), 'entrega por tercero queda registrada')

  // Encargo SIN tercero: solo retira el titular.
  const e2 = nuevoEncargo(db, { clienteId: titular.id, items: [{ productoId: p1.id, cantidad: 1 }] })
  marcarEncargoListoDb(db, e2.id, { preparadoPor: 'Ana' })
  tira(() => buscarEncargoListoPorDni(db, '41222333'), 'No hay pedidos listos', 'DNI de tercero sin autorización no despacha')
  const res2 = buscarEncargoListoPorDni(db, titular.dni)
  ok(res2.encargo.id === e2.id, 'titular retira su encargo sin tercero')
}

console.log(`\n═══ Resultado: ${pasadas} pasadas, ${fallidas} fallidas ═══\n`)
process.exit(fallidas ? 1 : 0)
