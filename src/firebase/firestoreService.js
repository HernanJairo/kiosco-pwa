// Capa de acceso a Firestore, lista para enchufar.
//
// Para activarla:
//   1) npm i firebase
//   2) Completar las credenciales en firebaseConfig.js
//   3) USE_FIREBASE = true en src/context/KioscoContext.jsx
//
// El SDK se importa de forma dinámica con @vite-ignore: si el paquete no está
// instalado, la app sigue funcionando en modo local sin romper el build.
// Todas las funciones devuelven null si no hay conexión disponible, así el
// caller puede caer al fallback local de manera segura.
import { firebaseConfig, firebaseLista } from './firebaseConfig'

const COLECCIONES = {
  productos: 'productos',
  clientes: 'clientes',
  ventas: 'ventas',
  solicitudes: 'solicitudes',
}

let _db = null
let _fs = null // módulo firebase/firestore cacheado

async function getDb() {
  if (!firebaseLista) return null
  if (_db) return _db
  try {
    const { initializeApp } = await import(/* @vite-ignore */ 'firebase/app')
    _fs = await import(/* @vite-ignore */ 'firebase/firestore')
    _db = _fs.getFirestore(initializeApp(firebaseConfig))
    return _db
  } catch (e) {
    console.warn('[firebase] SDK no disponible, se usa persistencia local.', e)
    return null
  }
}

const listar = async (col) => {
  const db = await getDb()
  if (!db) return null
  const snap = await _fs.getDocs(_fs.collection(db, col))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

const mergear = async (col, id, patch) => {
  const db = await getDb()
  if (!db) return null
  await _fs.setDoc(_fs.doc(db, col, String(id)), patch, { merge: true })
  return true
}

/* ================= LECTURAS ================= */

export async function getProductos() {
  return listar(COLECCIONES.productos)
}

export async function getClientes() {
  return listar(COLECCIONES.clientes)
}

/* ================= ESCRITURAS ================= */

export async function upsertProducto(producto) {
  return mergear(COLECCIONES.productos, producto.id, producto)
}

export async function updateStock(productoId, stock) {
  return mergear(COLECCIONES.productos, productoId, { stock })
}

export async function registrarVenta(venta) {
  return mergear(COLECCIONES.ventas, venta.id, venta)
}

export async function updateSaldo(clienteId, { saldo, deuda }) {
  return mergear(COLECCIONES.clientes, clienteId, { saldo, deuda })
}

export async function updateCliente(clienteId, patch) {
  return mergear(COLECCIONES.clientes, clienteId, patch)
}

// Solicitud del centro de notificaciones (RESET_PIN o
// TRANSFERENCIA_PENDIENTE). El mismo documento se reescribe con estado
// 'aprobada' | 'descartada' al resolverse.
export async function upsertSolicitud(solicitud) {
  return mergear(COLECCIONES.solicitudes, solicitud.id, solicitud)
}
