// Batería de pruebas del Módulo 1: ejerce la lógica de negocio pura
// (src/context/operaciones.js) contra copias del seed, sin levantar la app.
// Correr: node scripts/qa-flujos.mjs
import { buildSeed } from '../src/context/seedData.js'
import {
  aplicarVentaDb,
  aprobarSolicitudDb,
  descartarSolicitudDb,
  eliminarClienteDb,
  limiteFiadoVigente,
  nuevaSolicitudResetPin,
  nuevaSolicitudTransferencia,
  nuevoCliente,
  solicitudesPendientesDe,
  validarAltaCliente,
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

  // Cliente sin saldo ni límite habilitado
  db.config.limiteFiadoGlobal = 0
  const sinCredito = nuevoCliente({ nombre: 'Sin', apellido: 'Credito', dni: '55555555', pin: '9999', limiteFiado: 0 })
  db.clientes.push(sinCredito)
  tira(() => validarVenta(db, { items, metodo: 'fiado', clienteId: sinCredito.id }), 'saldo a favor ni límite', 'cliente sin límite ni saldo rechazado')
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

console.log(`\n═══ Resultado: ${pasadas} pasadas, ${fallidas} fallidas ═══\n`)
process.exit(fallidas ? 1 : 0)
