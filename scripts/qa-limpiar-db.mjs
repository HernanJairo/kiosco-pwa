// Limpieza de Firestore tras las corridas de QA:
//   1. Re-escribe los documentos del seed (productos, clientes,
//      personal, ventas v1..v4, configuración) para restaurar stock,
//      saldos y estados mutados por los tests.
//   2. Elimina TODO documento con id no-seed en ventas, encargos,
//      solicitudes, notificaciones, clientes, productos y personal.
// Uso: node scripts/qa-limpiar-db.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import {
  getFirestore, collection, getDocs, doc, setDoc, deleteDoc, terminate,
} from 'firebase/firestore'
import { buildSeed } from '../src/context/seedData.js'

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
  appId: env.VITE_FIREBASE_APP_ID || '1:181234290908:web:28ac5f4a13b23901e5e419',
}
const app = initializeApp(firebaseConfig, 'qa-limpiar')
const db = getFirestore(app)
const seed = buildSeed()

// 1) Restaurar documentos seed (idempotente, ids fijos).
const restaurables = [
  ['productos', seed.productos],
  ['clientes', seed.clientes],
  ['personal', seed.personal],
  ['ventas', seed.ventas],
]
for (const [col, items] of restaurables) {
  for (const item of items) await setDoc(doc(db, col, String(item.id)), item)
  console.log(`  restaurados ${items.length} docs en ${col}`)
}
await setDoc(doc(db, 'configuracion', 'general'), seed.config)
console.log('  restaurada configuracion/general')

// 2) Borrar todo doc cuyo id no pertenece al seed.
const seedIds = {
  productos: new Set(seed.productos.map((x) => x.id)),
  clientes: new Set(seed.clientes.map((x) => x.id)),
  personal: new Set(seed.personal.map((x) => x.id)),
  ventas: new Set(seed.ventas.map((x) => x.id)),
  encargos: new Set(), // el seed no trae encargos
  solicitudes: new Set(),
  notificaciones: new Set(),
}
let borrados = 0
for (const [col, validos] of Object.entries(seedIds)) {
  const snap = await getDocs(collection(db, col))
  for (const d of snap.docs) {
    if (!validos.has(d.id)) {
      await deleteDoc(doc(db, col, d.id))
      borrados++
      console.log(`  ✂ ${col}/${d.id.slice(0, 8)}`)
    }
  }
}
console.log(`\nTotal eliminados: ${borrados}`)

await terminate(db)
process.exit(0)
