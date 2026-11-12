// Prueba real de conectividad contra Cloud Firestore (kiosko-45709).
// Replica el flujo de la app (misma config, seed y guarda de tamaño que
// src/services/firebase.js + src/firebase/firestoreService.js) para
// poder correr con Node puro, sin el bundler de Vite.
//
// Pasos:
//   1. Escritura + lectura + borrado de un doc de prueba en meta/.
//   2. Semilla inicial (una sola vez, marcada con meta/semilla).
//   3. Lectura de las colecciones suscriptas por la app + config.
//   4. Guarda de tamaño: un producto ficticio >900 KB es rechazado.
//
// Correr: node scripts/test-firestore.mjs
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
  writeBatch,
  terminate,
} from 'firebase/firestore'
import { buildSeed } from '../src/context/seedData.js'
import { LIMITE_DOC_BYTES, tamanoDoc } from '../src/utils/tamanoDoc.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Misma resolución que services/firebase.js: .env → fallback embebido.
const env = {}
try {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
    if (m) env[m[1]] = m[2]
  }
} catch {
  /* sin .env: se usa el fallback embebido */
}
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCPqW4p85qzzmF66-krPgE3f6XM1qZNJr0',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'kiosko-45709.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'kiosko-45709',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'kiosko-45709.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '181234290908',
  appId: env.VITE_FIREBASE_APP_ID || '1:181234290908:web:28ac5f4a13b23901e5e419',
}

const COLECCIONES = ['productos', 'clientes', 'ventas', 'encargos', 'solicitudes', 'notificaciones', 'personal']
const DOC_CONFIG = ['configuracion', 'general']
const DOC_SEMILLA = ['meta', 'semilla']
const DOC_TEST = ['meta', 'ping_test']

// Watchdog: si gRPC queda colgado (consola Windows), cortar el proceso.
const watchdog = setTimeout(() => {
  console.error('\nTimeout global: la conexión no respondió a tiempo.')
  process.exit(1)
}, 60_000)

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

let fallos = 0
const ok = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg, e) => {
  fallos++
  console.error(`  ✗ ${msg}:`, e?.message || e)
}

console.log('== Test de conectividad Firestore (kiosko-45709) ==\n')
ok(`Configuración cargada (projectId=${firebaseConfig.projectId})`)

// 1) Escritura → lectura → borrado
try {
  const valor = `ping-${Date.now()}`
  await setDoc(doc(db, ...DOC_TEST), { valor, at: new Date().toISOString() })
  const snap = await getDoc(doc(db, ...DOC_TEST))
  if (!snap.exists() || snap.data().valor !== valor) throw new Error('read-back no coincide')
  ok(`Escritura + lectura verificadas en ${DOC_TEST.join('/')}`)
  await deleteDoc(doc(db, ...DOC_TEST))
  if ((await getDoc(doc(db, ...DOC_TEST))).exists()) throw new Error('el doc sigue existiendo tras delete')
  ok('Borrado verificado')
} catch (e) {
  fail('Escritura/lectura/borrado (¿reglas de Firestore o red?)', e)
}

// 2) Semilla inicial (misma lógica que firestoreService.semillaSiVacio)
try {
  const meta = await getDoc(doc(db, ...DOC_SEMILLA))
  if (meta.exists()) {
    ok('Base ya inicializada (meta/semilla presente): no se re-siembra')
  } else {
    const seed = buildSeed()
    const batch = writeBatch(db)
    const grupos = [
      ['productos', seed.productos],
      ['clientes', seed.clientes],
      ['personal', seed.personal],
      ['ventas', seed.ventas],
      ['encargos', seed.encargos || []],
      ['solicitudes', seed.solicitudes || []],
      ['notificaciones', seed.notificaciones || []],
    ]
    let ops = 0
    for (const [col, items] of grupos) for (const item of items || []) {
      batch.set(doc(db, col, String(item.id)), item)
      ops++
    }
    batch.set(doc(db, ...DOC_CONFIG), seed.config)
    batch.set(doc(db, ...DOC_SEMILLA), { sembradoEn: new Date().toISOString(), version: 1 })
    await batch.commit()
    ok(`Base sembrada con el catálogo demo (${ops} documentos + config)`)
  }
} catch (e) {
  fail('Semilla inicial', e)
}

// 3) Lectura de las colecciones suscriptas + config
try {
  for (const col of COLECCIONES) {
    const snap = await getDocs(collection(db, col))
    console.log(`    · ${col}: ${snap.size} doc(s)`)
  }
  const cfg = await getDoc(doc(db, ...DOC_CONFIG))
  if (!cfg.exists()) throw new Error('configuracion/general ausente')
  ok(`configuracion/general presente (nombreKiosco="${cfg.data().nombreKiosco}")`)
} catch (e) {
  fail('Lectura de colecciones', e)
}

// 4) Guarda de tamaño (misma regla que upsertProducto)
try {
  const grande = { id: 'test_grande', nombre: 'Test Grande', fotos: ['x'.repeat(950 * 1024)] }
  const bytes = tamanoDoc(grande)
  if (bytes <= LIMITE_DOC_BYTES) throw new Error(`debería superar ${LIMITE_DOC_BYTES} bytes`)
  ok(`Doc de ~${Math.round(bytes / 1024)} KB supera el tope (~900 KB) y sería rechazado`)
  const chico = buildSeed().productos[0]
  if (tamanoDoc(chico) > LIMITE_DOC_BYTES) throw new Error('un producto del seed supera el tope')
  ok(`Producto real del seed: ~${Math.round(tamanoDoc(chico) / 1024)} KB, dentro del límite`)
} catch (e) {
  fail('Guarda de tamaño', e)
}

console.log(fallos ? `\n${fallos} paso(s) con error.` : '\nTodo OK: Firestore operativo (lectura, escritura, semilla y guarda de tamaño).')
clearTimeout(watchdog)
await terminate(db)
process.exit(fallos ? 1 : 0)
