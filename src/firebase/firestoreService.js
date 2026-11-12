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
  increment,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
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

/* ================= ESCRITURAS ATÓMICAS (anti-sobreventa) ================= */
//
// El descuento de stock es la operación más delicada del kiosco: dos
// dispositivos pueden cobrar la última unidad al mismo tiempo. Se
// protege con runTransaction (relee el stock real en el servidor antes
// de escribir) y, para las devoluciones, con increment() del lado del
// servidor — que nunca pierde un ajuste aunque dos cajas sumen a la vez.

// Venta + descuento de stock + impacto en billetera/fiado del cliente,
// todo dentro de una única transacción. Si el stock remoto ya no
// alcanza (otro dispositivo vendió primero) aborta y nada se escribe.
export function registrarVentaAtomica({ venta, detalle, descontarStock = true, clienteDoc = null }) {
  return runTransaction(db, async (tx) => {
    const prodRefs = detalle.map((d) => doc(db, COLECCIONES.productos, String(d.productoId)))
    const cliRef = clienteDoc ? doc(db, COLECCIONES.clientes, String(clienteDoc.id)) : null
    const prodSnaps = await Promise.all(prodRefs.map((r) => tx.get(r)))
    const cliSnap = cliRef ? await tx.get(cliRef) : null
    if (descontarStock) {
      prodSnaps.forEach((snap, i) => {
        const actual = snap.exists() ? Number(snap.data().stock ?? 0) : 0
        if (actual < detalle[i].cantidad) {
          throw new Error(
            `Sin stock remoto: ${detalle[i].nombre} quedó en ${actual} u. (otro dispositivo vendió antes).`
          )
        }
      })
      prodSnaps.forEach((snap, i) => {
        if (snap.exists()) {
          tx.update(prodRefs[i], { stock: Number(snap.data().stock) - detalle[i].cantidad })
        }
      })
    }
    tx.set(doc(db, COLECCIONES.ventas, String(venta.id)), venta)
    if (cliRef && cliSnap?.exists()) tx.set(cliRef, clienteDoc, { merge: true })
  })
}

// Reserva de encargo: mismo patrón — lee stock remoto, descuenta y
// escribe el encargo en una sola transacción (nadie queda a medias).
export function reservarEncargoAtomico(encargo) {
  return runTransaction(db, async (tx) => {
    const prodRefs = encargo.items.map((i) => doc(db, COLECCIONES.productos, String(i.productoId)))
    const prodSnaps = await Promise.all(prodRefs.map((r) => tx.get(r)))
    prodSnaps.forEach((snap, i) => {
      const actual = snap.exists() ? Number(snap.data().stock ?? 0) : 0
      if (actual < encargo.items[i].cantidad) {
        throw new Error(
          `Sin stock remoto para reservar: ${encargo.items[i].nombre} quedó en ${actual} u.`
        )
      }
    })
    prodSnaps.forEach((snap, i) => {
      if (snap.exists()) {
        tx.update(prodRefs[i], { stock: Number(snap.data().stock) - encargo.items[i].cantidad })
      }
    })
    tx.set(doc(db, COLECCIONES.encargos, String(encargo.id)), encargo)
  })
}

// Anulación de venta: la transacción relee la venta remota y aborta si
// otro dispositivo ya la anuló (evita devolver el stock dos veces).
export function anularVentaAtomica({ ventaId, clienteDoc = null }) {
  return runTransaction(db, async (tx) => {
    const vRef = doc(db, COLECCIONES.ventas, String(ventaId))
    const cliRef = clienteDoc ? doc(db, COLECCIONES.clientes, String(clienteDoc.id)) : null
    const vSnap = await tx.get(vRef)
    const cliSnap = cliRef ? await tx.get(cliRef) : null
    if (vSnap.exists() && vSnap.data().anulada) {
      throw new Error('La venta ya fue anulada en otro dispositivo.')
    }
    const items = vSnap.exists() ? vSnap.data().items || [] : []
    const prodRefs = items.map((i) => doc(db, COLECCIONES.productos, String(i.productoId)))
    const prodSnaps = await Promise.all(prodRefs.map((r) => tx.get(r)))
    prodSnaps.forEach((snap, i) => {
      if (snap.exists()) tx.update(prodRefs[i], { stock: increment(items[i].cantidad) })
    })
    tx.set(vRef, { anulada: true }, { merge: true })
    if (cliRef && cliSnap?.exists()) tx.set(cliRef, clienteDoc, { merge: true })
  })
}

// Cancelación de encargo: relee el encargo remoto y aborta si ya fue
// cerrado; devuelve la reserva con increment() (atómico en servidor).
export function cancelarEncargoAtomico(encargoId) {
  return runTransaction(db, async (tx) => {
    const eRef = doc(db, COLECCIONES.encargos, String(encargoId))
    const eSnap = await tx.get(eRef)
    if (!eSnap.exists()) throw new Error('Encargo no encontrado en el servidor.')
    const remoto = eSnap.data()
    if (remoto.estado === 'entregado' || remoto.estado === 'cancelado') {
      throw new Error('El encargo ya fue cerrado en otro dispositivo.')
    }
    const items = remoto.items || []
    const prodRefs = items.map((i) => doc(db, COLECCIONES.productos, String(i.productoId)))
    const prodSnaps = await Promise.all(prodRefs.map((r) => tx.get(r)))
    prodSnaps.forEach((snap, i) => {
      if (snap.exists()) tx.update(prodRefs[i], { stock: increment(items[i].cantidad) })
    })
    tx.update(eRef, { estado: 'cancelado' })
  })
}

// Devolución puntual de stock (ajuste de encargo por faltante, etc.):
// increment() se aplica en el servidor y es seguro entre dispositivos.
export const sumarStock = (productoId, cantidad) =>
  updateDoc(doc(db, COLECCIONES.productos, String(productoId)), { stock: increment(cantidad) })
