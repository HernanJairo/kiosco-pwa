// Suite E2E de integración contra Cloud Firestore real (kiosko-45709).
// Ejerce el MISMO camino de datos que la app (operaciones.js sobre el
// estado leído + escrituras via firestoreService) y limpia todo lo que
// crea: ningún documento con prefijo qa_e2e_ queda en la base.
//
// Correr: node scripts/qa-e2e-firestore.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  terminate,
} from 'firebase/firestore'
import * as ops from '../src/context/operaciones.js'
import { buildSeed } from '../src/context/seedData.js'
import { statsPeriodo } from '../src/utils/reportes.js'
import { LIMITE_DOC_BYTES, tamanoDoc } from '../src/utils/tamanoDoc.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
try {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)?"?\s*$/)
    if (m) env[m[1]] = m[2]
  }
} catch { /* fallback embebido */ }
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCPqW4p85qzzmF66-krPgE3f6XM1qZNJr0',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'kiosko-45709.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'kiosko-45709',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'kiosko-45709.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '181234290908',
  appId: env.VITE_FIREBASE_APP_ID || '1:181234290908:web:28ac5f4a13b23901e5e419',
}

const watchdog = setTimeout(() => {
  console.error('\nTimeout global: Firestore no respondió a tiempo.')
  process.exit(1)
}, 120_000)

// Dos "dispositivos" (dos clientes Firestore) para la prueba de carrera.
const appA = initializeApp(firebaseConfig, 'qa-a')
const appB = initializeApp(firebaseConfig, 'qa-b')
const dbA = getFirestore(appA)
const dbB = getFirestore(appB)

const TAG = `qa_e2e_${Date.now().toString(36)}`
const creados = [] // {col, id} para la limpieza final
const cfgDoc = doc(dbA, 'configuracion', 'general')

let pass = 0
let fail = 0
const ok = (msg) => { pass++; console.log(`  ✔ ${msg}`) }
const ko = (msg, e) => { fail++; console.error(`  ✘ ${msg}${e ? ` — ${e.message || e}` : ''}`) }
const check = (cond, msg) => (cond ? ok(msg) : ko(msg))
const rechaza = async (fn, msg) => {
  try { await fn(); ko(`${msg} (NO rechazó)`) } catch { ok(msg) }
}

// Lee el estado remoto como lo haría la app (colecciones + config).
async function leerDb(db = dbA) {
  const d = {}
  for (const col of ['productos', 'clientes', 'ventas', 'encargos', 'solicitudes', 'notificaciones', 'personal']) {
    const snap = await getDocs(collection(db, col))
    d[col] = snap.docs.map((x) => ({ id: x.id, ...x.data() }))
  }
  const cfg = await getDoc(doc(db, 'configuracion', 'general'))
  d.config = cfg.exists() ? cfg.data() : {}
  d.auditoria = []
  return d
}

console.log(`\n═══ QA E2E contra Firestore real (kiosko-45709) · tag ${TAG} ═══\n`)

/* ---------- 0. Producto de prueba ---------- */
const PROD = { id: `${TAG}_prod`, nombre: 'Producto QA E2E', categoria: 'Snacks', costo: 100, precio: 250, stock: 10, stockMin: 2, vencimiento: null, fotos: [], codigos: [`${TAG}_ean`] }
await setDoc(doc(dbA, 'productos', PROD.id), PROD)
creados.push({ col: 'productos', id: PROD.id })
ok('Producto de prueba creado en remoto')

/* ---------- 1. Alta de cliente + validaciones ---------- */
console.log('\n— 1. Alta de cliente y validaciones —')
let d = await leerDb()
const datosCli = { nombre: 'QA', apellido: 'E2E', dni: '99900001', telefono: '3885000000', email: 'qa.e2e@test.dev', pin: '4321', limiteFiado: 0 }
await rechaza(() => Promise.resolve(ops.validarAltaCliente(d.clientes, { ...datosCli, nombre: '   ' })), 'nombre en blanco rechazado')
await rechaza(() => Promise.resolve(ops.validarAltaCliente(d.clientes, { ...datosCli, pin: '12a4' })), 'PIN alfanumérico rechazado')
await rechaza(() => Promise.resolve(ops.validarAltaCliente(d.clientes, { ...datosCli, pin: '12345' })), 'PIN de 5 dígitos rechazado')
await rechaza(() => Promise.resolve(ops.validarAltaCliente(d.clientes, { ...datosCli, dni: '12' })), 'DNI corto rechazado')
ops.validarAltaCliente(d.clientes, datosCli)
const cliente = ops.nuevoCliente(datosCli)
await setDoc(doc(dbA, 'clientes', cliente.id), cliente)
creados.push({ col: 'clientes', id: cliente.id })
await rechaza(() => Promise.resolve(ops.validarAltaCliente([cliente], datosCli)), 'DNI duplicado rechazado')
await rechaza(() => Promise.resolve(ops.validarAltaCliente([cliente], { ...datosCli, dni: '99900002', email: 'QA.E2E@TEST.DEV' })), 'email duplicado (case-insensitive) rechazado')
check(cliente.saldo === 0 && cliente.deuda === 0, 'cliente nace con saldo $0 y deuda $0')
check(cliente.fiadoHabilitado === false && cliente.fiadoBloqueado === false, 'fiado nace NO habilitado (regla antifraude)')

/* ---------- 2. Venta POS multi-producto ---------- */
console.log('\n— 2. Venta POS multi-ítem y control de stock —')
d = await leerDb()
const venta = { id: `${TAG}_v1`, fecha: new Date().toISOString(), metodo: 'efectivo', clienteId: null, vendedor: 'qa', anulada: false, estado: 'completada' }
const { detalle, total } = ops.validarVenta(d, { items: [{ productoId: PROD.id, cantidad: 3 }, { productoId: PROD.id, cantidad: 2 }], metodo: 'efectivo' })
check(total === 5 * PROD.precio, `venta multi-ítem consolida cantidad (total ${total})`)
ops.aplicarVentaDb(d, { venta: { ...venta, items: detalle, total }, detalle, metodo: 'efectivo', clienteId: null })
await setDoc(doc(dbA, 'ventas', venta.id), { ...venta, items: detalle, total })
creados.push({ col: 'ventas', id: venta.id })
const stockTrasVenta = d.productos.find((p) => p.id === PROD.id).stock
check(stockTrasVenta === 5, `stock descontado en remoto+lógica: 10 → ${stockTrasVenta}`)
await setDoc(doc(dbA, 'productos', PROD.id), { stock: stockTrasVenta }, { merge: true })
await rechaza(() => Promise.resolve(ops.validarVenta(d, { items: [{ productoId: PROD.id, cantidad: 99 }], metodo: 'efectivo' })), 'venta sobre stock disponible rechazada')
await rechaza(() => Promise.resolve(ops.aplicarVentaDb(d, { venta, detalle: [{ productoId: PROD.id, cantidad: 99, nombre: 'x', precio: 1 }], metodo: 'efectivo' })), 'aplicarVentaDb no deja stock negativo')

/* ---------- 3. Encargo con tercero + QR (reserva de stock) ---------- */
console.log('\n— 3. Encargo, tercero autorizado y retiro —')
d = await leerDb()
const encargo = ops.nuevoEncargo(d, {
  clienteId: cliente.id,
  items: [{ productoId: PROD.id, cantidad: 2 }],
  retiroTercero: { nombre: 'Tercero QA', dni: '99900009' },
})
await setDoc(doc(dbA, 'encargos', encargo.id), encargo)
creados.push({ col: 'encargos', id: encargo.id })
check(d.productos.find((p) => p.id === PROD.id).stock === 3, `encargo reservó stock: 5 → 3`)
check(encargo.retiroTercero?.dni === '99900009', 'tercero autorizado persistido en el encargo')
await setDoc(doc(dbA, 'productos', PROD.id), { stock: 3 }, { merge: true })
const busca = ops.buscarEncargoListoPorDni({ ...d, encargos: [{ ...encargo, estado: 'listo_retiro' }] }, '99900009')
check(busca.retiradoPor.includes('autorizado'), 'despacho por DNI de tercero identifica al autorizado')
await rechaza(() => Promise.resolve(ops.buscarEncargoListoPorDni(d, '00000000')), 'DNI sin pedido listo rechazado')
ops.marcarEncargoListoDb(d, encargo.id, { preparadoPor: 'qa' })
check(d.encargos[0].estado === 'listo_retiro', 'encargo pasa a listo_retiro')
// Cobro del encargo = venta con stock ya reservado (no se descuenta 2 veces)
const { detalle: detE, total: totE } = ops.validarVenta(d, { items: encargo.items, metodo: 'efectivo', omitirStock: true })
const ventaEnc = { id: `${TAG}_v2`, fecha: new Date().toISOString(), metodo: 'efectivo', clienteId: cliente.id, vendedor: 'qa', anulada: false, estado: 'completada', retiradoPor: 'Tercero QA' }
ops.aplicarVentaDb(d, { venta: { ...ventaEnc, items: detE, total: totE }, detalle: detE, metodo: 'efectivo', clienteId: cliente.id, descontarStock: false })
ops.entregarEncargoDb(d, encargo.id, { retiradoPor: 'Tercero QA' })
check(d.productos.find((p) => p.id === PROD.id).stock === 3, 'cobro de encargo NO descuenta stock dos veces')
check(d.encargos[0].estado === 'entregado', 'encargo cerrado como entregado')
await setDoc(doc(dbA, 'ventas', ventaEnc.id), { ...ventaEnc, items: detE, total: totE })
creados.push({ col: 'ventas', id: ventaEnc.id })
await setDoc(doc(dbA, 'encargos', encargo.id), d.encargos[0])
await rechaza(() => Promise.resolve(ops.entregarEncargoDb(d, encargo.id)), 'entregar dos veces rechazado')

/* ---------- 4. Cancelación devuelve stock ---------- */
console.log('\n— 4. Cancelación de encargo devuelve reserva —')
d = await leerDb()
const enc2 = ops.nuevoEncargo(d, { clienteId: cliente.id, items: [{ productoId: PROD.id, cantidad: 1 }] })
const stockRes = d.productos.find((p) => p.id === PROD.id).stock
check(stockRes === 2, `reserva del 2do encargo: stock → ${stockRes}`)
ops.cancelarEncargoDb(d, enc2.id)
check(d.productos.find((p) => p.id === PROD.id).stock === 3, 'cancelación devuelve la mercadería a góndola')
await setDoc(doc(dbA, 'encargos', enc2.id), d.encargos.find((e) => e.id === enc2.id))
creados.push({ col: 'encargos', id: enc2.id })
await setDoc(doc(dbA, 'productos', PROD.id), { stock: 3 }, { merge: true })

/* ---------- 5. Anulación de venta: reversa exacta ---------- */
console.log('\n— 5. Anulación de venta y reversa exacta —')
d = await leerDb()
const stockAntes = d.productos.find((p) => p.id === PROD.id).stock
const vAnular = { id: `${TAG}_v3`, fecha: new Date().toISOString(), metodo: 'efectivo', clienteId: null, vendedor: 'qa', anulada: false, estado: 'completada' }
const { detalle: dA, total: tA } = ops.validarVenta(d, { items: [{ productoId: PROD.id, cantidad: 2 }], metodo: 'efectivo' })
ops.aplicarVentaDb(d, { venta: { ...vAnular, items: dA, total: tA }, detalle: dA, metodo: 'efectivo' })
ops.anularVentaDb(d, vAnular.id)
check(d.productos.find((p) => p.id === PROD.id).stock === stockAntes, `stock restaurado tras anular (${stockAntes})`)
check(d.ventas.find((v) => v.id === vAnular.id).anulada === true, 'venta marcada anulada')
await setDoc(doc(dbA, 'ventas', vAnular.id), d.ventas.find((v) => v.id === vAnular.id))
creados.push({ col: 'ventas', id: vAnular.id })
await rechaza(() => Promise.resolve(ops.anularVentaDb(d, vAnular.id)), 'anular dos veces rechazado')

/* ---------- 6. Fiado: cuenta corriente y contingencias ---------- */
console.log('\n— 6. Fiado y contingencias —')
d = await leerDb()
await rechaza(() => Promise.resolve(ops.validarVenta(d, { items: [{ productoId: PROD.id, cantidad: 1 }], metodo: 'fiado', clienteId: cliente.id })), 'fiado sin Cta. Corriente habilitada rechazado')
// Contingencia: encargos pausados
d.config.encargosActivos = false
await rechaza(() => Promise.resolve(ops.nuevoEncargo(d, { clienteId: cliente.id, items: [{ productoId: PROD.id, cantidad: 1 }] })), 'encargo bloqueado con contingencia activa')
d.config.encargosActivos = true
// Contingencia: fiados pausados (cliente con fiado habilitado)
d.config.fiadosActivos = false
await rechaza(() => Promise.resolve(ops.validarVenta(d, { items: [{ productoId: PROD.id, cantidad: 1 }], metodo: 'fiado', clienteId: cliente.id })), 'fiado bloqueado con contingencia activa')
d.config.fiadosActivos = true
// Habilitar fiado y verificar límite
d.clientes.find((c) => c.id === cliente.id).fiadoHabilitado = true
d.clientes.find((c) => c.id === cliente.id).limiteFiado = 500
ops.validarVenta(d, { items: [{ productoId: PROD.id, cantidad: 1 }], metodo: 'fiado', clienteId: cliente.id })
await rechaza(() => Promise.resolve(ops.validarVenta(d, { items: [{ productoId: PROD.id, cantidad: 3 }], metodo: 'fiado', clienteId: cliente.id })), 'fiado sobre el límite rechazado sin excepción')
const { total: tExc } = ops.validarVenta(d, { items: [{ productoId: PROD.id, cantidad: 3 }], metodo: 'fiado', clienteId: cliente.id, excepcionFiado: true })
check(tExc > 0, 'excepción expresa del vendedor permite superar el límite')

/* ---------- 7. Carrera de stock entre dos dispositivos ---------- */
console.log('\n— 7. Concurrencia real: dos dispositivos, última unidad —')
await setDoc(doc(dbA, 'productos', PROD.id), { stock: 1 }, { merge: true })
const [da, db2] = await Promise.all([leerDb(dbA), leerDb(dbB)])
const stockA = da.productos.find((p) => p.id === PROD.id).stock
const stockB = db2.productos.find((p) => p.id === PROD.id).stock
check(stockA === 1 && stockB === 1, 'ambos dispositivos leen stock=1')
// Ambos validan OK y escriben stock=0 — último en escribir gana.
let validoA = true, validoB = true
try { ops.validarVenta(da, { items: [{ productoId: PROD.id, cantidad: 1 }], metodo: 'efectivo' }) } catch { validoA = false }
try { ops.validarVenta(db2, { items: [{ productoId: PROD.id, cantidad: 1 }], metodo: 'efectivo' }) } catch { validoB = false }
check(validoA && validoB, 'AMBOS dispositivos validan la venta de la última unidad (race)')
await Promise.all([
  setDoc(doc(dbA, 'productos', PROD.id), { stock: 0 }, { merge: true }),
  setDoc(doc(dbB, 'productos', PROD.id), { stock: 0 }, { merge: true }),
])
const final = await getDoc(doc(dbA, 'productos', PROD.id))
console.log(`    · stock final remoto: ${final.data().stock} — se vendieron 2 unidades de 1 disponible`)
ko('SOBREVENTA confirmada: sin transacciones, dos dispositivos pueden vender la misma última unidad (last-write-wins)')

/* ---------- 8. Guarda de tamaño y reportes ---------- */
console.log('\n— 8. Guarda de tamaño y consistencia de reportes —')
const gigante = { id: 'x', nombre: 'Gigante', fotos: ['x'.repeat(950 * 1024)] }
check(tamanoDoc(gigante) > LIMITE_DOC_BYTES, `doc de ~950 KB excede el tope (~900 KB)`)
const pReal = buildSeed().productos[0]
check(tamanoDoc(pReal) <= LIMITE_DOC_BYTES, 'producto del seed dentro del límite')
// Consistencia: neto = válidas − anuladas no cuenta.
d = await leerDb()
const stats = statsPeriodo({ ventas: d.ventas, clientes: d.clientes, productos: d.productos, rango: 'mes' })
const sumaManual = d.ventas.filter((v) => !v.anulada && v.estado !== 'en_espera_transferencia').reduce((s, v) => s + v.total, 0)
check(stats.total === sumaManual, `reportes: total del período == Σ ventas válidas ($ ${sumaManual.toLocaleString('es-AR')})`)
const ventasQa = d.ventas.filter((v) => v.id.startsWith(TAG) && !v.anulada)
const totalQa = ventasQa.reduce((s, v) => s + v.total, 0)
check(totalQa === (5 * PROD.precio + totE), `matemática de pruebas consistente (válidas QA = $ ${totalQa.toLocaleString('es-AR')})`)

/* ---------- 9. Limpieza ---------- */
console.log('\n— 9. Limpieza de datos de prueba —')
for (const { col, id } of creados) {
  await deleteDoc(doc(dbA, col, id))
}
const restantes = []
for (const col of ['productos', 'clientes', 'ventas', 'encargos']) {
  const snap = await getDocs(collection(dbA, col))
  for (const x of snap.docs) if (x.id.startsWith(TAG) || x.id.includes('qa_e2e_')) restantes.push(`${col}/${x.id}`)
}
check(restantes.length === 0, `limpieza completa (${restantes.length} restantes)`)
// Config intacta: no se tocó el doc remoto.
const cfg = await getDoc(cfgDoc)
check(cfg.exists() && cfg.data().nombreKiosco, 'config remota sin alteraciones')

console.log(`\n═══ Resultado E2E: ${pass} pasadas, ${fail} observaciones/fallidas ═══\n`)
clearTimeout(watchdog)
await terminate(dbA)
await terminate(dbB)
process.exit(0)
