// Capa de acceso a Cloud Firestore para Yapa (proyecto kiosko-45709).
//
// Modelo de sincronización:
//   • Lectura → suscripciones onSnapshot por colección (tiempo real
//     entre dispositivos; la caché persistente del SDK da modo offline).
//   • Escritura → setDoc con merge por entidad (cada operación del
//     contexto ya conoce el documento que tocó).
//   • Semilla → semillaSiVacio() puebla la base una única vez, marcada
//     con el doc meta/semilla para no re-sembrar si el admin vacía algo.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../services/firebase'

export const COLECCIONES = {
  productos: 'productos',
  clientes: 'clientes',
  ventas: 'ventas',
  encargos: 'encargos',
  solicitudes: 'solicitudes',
  notificaciones: 'notificaciones',
  personal: 'personal',
}
export const DOC_CONFIG = ['configuracion', 'general']
const DOC_SEMILLA = ['meta', 'semilla']

// Colecciones con suscripción onSnapshot en KioscoContext.
export const COLECCIONES_SUSCRIPTAS = Object.values(COLECCIONES)

// Guarda de tamaño por documento (las fotos WebP viven dentro del doc).
import { LIMITE_DOC_BYTES, tamanoDoc } from '../utils/tamanoDoc'
export { LIMITE_DOC_BYTES, tamanoDoc }

const mergear = (col, id, data) => setDoc(doc(db, col, String(id)), data, { merge: true })
const borrar = (col, id) => deleteDoc(doc(db, col, String(id)))

/* ================= LECTURAS EN TIEMPO REAL ================= */

// Devuelve el unsubscribe de onSnapshot. `cb` recibe la lista de docs
// ({id, ...data}) ya normalizada cada vez que cambia la colección.
export function suscribir(col, cb, onError) {
  return onSnapshot(
    collection(db, col),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => {
      console.warn(`[firebase] suscripción ${col}:`, e)
      onError?.(e)
    }
  )
}

// Configuración del kiosco: un único doc configuracion/general.
export function suscribirConfig(cb, onError) {
  return onSnapshot(
    doc(db, ...DOC_CONFIG),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (e) => {
      console.warn('[firebase] suscripción configuracion:', e)
      onError?.(e)
    }
  )
}

/* ================= SEMILLA INICIAL (una sola vez) ================= */

// Si el doc meta/semilla no existe, puebla la base con el catálogo demo
// (productos, clientes, personal, ventas…) y la config por defecto.
// Es idempotente (ids fijos del seed) y respeta bases ya inicializadas.
export async function semillaSiVacio(seed) {
  const meta = await getDoc(doc(db, ...DOC_SEMILLA))
  if (meta.exists()) return false
  const batch = writeBatch(db)
  const colecciones = [
    [COLECCIONES.productos, seed.productos],
    [COLECCIONES.clientes, seed.clientes],
    [COLECCIONES.personal, seed.personal],
    [COLECCIONES.ventas, seed.ventas],
    [COLECCIONES.encargos, seed.encargos || []],
    [COLECCIONES.solicitudes, seed.solicitudes || []],
    [COLECCIONES.notificaciones, seed.notificaciones || []],
  ]
  for (const [col, items] of colecciones) {
    for (const item of items || []) batch.set(doc(db, col, String(item.id)), item)
  }
  batch.set(doc(db, ...DOC_CONFIG), seed.config)
  batch.set(doc(db, ...DOC_SEMILLA), { sembradoEn: new Date().toISOString(), version: 1 })
  await batch.commit()
  return true
}

/* ================= ESCRITURAS ================= */

// Guarda de tamaño: las fotos WebP viven dentro del documento; si el
// producto supera ~900 KB se rechaza la escritura con aviso amable.
export function upsertProducto(producto) {
  const bytes = tamanoDoc(producto)
  if (bytes > LIMITE_DOC_BYTES) {
    return Promise.reject(
      new Error(
        `"${producto.nombre}" pesa ~${Math.round(bytes / 1024)} KB (máximo ~900 KB). Quitá alguna foto del producto.`
      )
    )
  }
  return mergear(COLECCIONES.productos, producto.id, producto)
}

export const borrarProducto = (id) => borrar(COLECCIONES.productos, id)
export const updateStock = (productoId, stock) => mergear(COLECCIONES.productos, productoId, { stock })

export const registrarVenta = (venta) => mergear(COLECCIONES.ventas, venta.id, venta)

// El doc del cliente lleva saldo, deuda, fiados y movimientos juntos:
// siempre se sincroniza el documento completo (merge).
export const updateCliente = (clienteId, data) => mergear(COLECCIONES.clientes, clienteId, data)
export const borrarCliente = (id) => borrar(COLECCIONES.clientes, id)

// Solicitud del centro de notificaciones (RESET_PIN o
// TRANSFERENCIA_PENDIENTE). El mismo documento se reescribe con estado
// 'aprobada' | 'descartada' al resolverse.
export const upsertSolicitud = (solicitud) => mergear(COLECCIONES.solicitudes, solicitud.id, solicitud)

export const upsertEncargo = (encargo) => mergear(COLECCIONES.encargos, encargo.id, encargo)

export const upsertPersonal = (persona) => mergear(COLECCIONES.personal, persona.id, persona)
export const borrarPersonal = (id) => borrar(COLECCIONES.personal, id)

export const upsertNotificacion = (notif) => mergear(COLECCIONES.notificaciones, notif.id, notif)

// Parche del doc único de configuración (abierto, fiados, encargos…).
export const updateConfigDoc = (patch) => setDoc(doc(db, ...DOC_CONFIG), patch, { merge: true })
