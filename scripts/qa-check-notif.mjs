import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, terminate } from 'firebase/firestore'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
try {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)?"?\s*$/)
    if (m) env[m[1]] = m[2]
  }
} catch { /* fallback embebido */ }
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCPqW4p85qzzmF66-krPgE3f6XM1qZNJr0',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'kiosko-45709.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'kiosko-45709',
  appId: env.VITE_FIREBASE_APP_ID || '1:181234290908:web:28ac5f4a13b23901e5e419',
}, 'qa-check')
const db = getFirestore(app)

const ventas = (await getDocs(collection(db, 'ventas'))).docs.map((d) => d.data())
ventas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
console.log('ventas total:', ventas.length)
for (const x of ventas.slice(0, 5)) {
  console.log('VENTA', x.metodo, '$' + x.total, x.clienteNombre || '-', x.fecha, '| excepcionPausa:', x.excepcionPausa)
}
const notifs = (await getDocs(collection(db, 'notificaciones'))).docs.map((d) => d.data())
notifs.sort((a, b) => String(b.createdAt || b.fecha).localeCompare(String(a.createdAt || a.fecha)))
console.log('notifs total:', notifs.length)
for (const x of notifs.slice(0, 8)) {
  console.log('NOTIF', x.tipo, '|', x.para, '|', x.texto)
}
await terminate(db)
process.exit(0)
