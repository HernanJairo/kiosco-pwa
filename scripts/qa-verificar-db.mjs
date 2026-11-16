// Verificación read-only de Firestore: muestra encargos recientes,
// últimas ventas y el doc de configuración.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, getDoc, terminate } from 'firebase/firestore'

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
const app = initializeApp(firebaseConfig, 'qa-verificar')
const db = getFirestore(app)

const encargos = (await getDocs(collection(db, 'encargos'))).docs.map((d) => ({ id: d.id, ...d.data() }))
encargos.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
console.log(`\nENCARGOS (${encargos.length}):`)
for (const e of encargos.slice(0, 15)) {
  console.log(
    `  #${e.id.slice(0, 8)} ${e.estado.padEnd(14)} ${e.clienteNombre} · $${e.total}` +
      (e.retiroTercero?.dni ? ` · tercero: ${e.retiroTercero.nombre} DNI ${e.retiroTercero.dni}` : '') +
      (e.retiradoPor ? ` · retiró: ${e.retiradoPor}` : '') +
      ` · ${e.fecha}` +
      (e.entregadoEn ? ` → ${e.entregadoEn}` : '')
  )
  console.log(`     items: ${(e.items || []).map((i) => `${i.cantidad}x ${i.nombre || i.productoId}`).join(', ')}`)
}
const activos = encargos.filter((e) => e.estado === 'en_preparacion' || e.estado === 'listo_retiro')
console.log(`  → activos en cola: ${activos.length}`)

const ventas = (await getDocs(collection(db, 'ventas'))).docs.map((d) => ({ id: d.id, ...d.data() }))
ventas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
console.log(`\nVENTAS recientes (${ventas.length}):`)
for (const v of ventas.slice(0, 12)) {
  console.log(
    `  #${v.id.slice(0, 8)} ${v.anulada ? 'ANULADA' : v.estado || 'completada'} $${v.total} · ${v.metodo}` +
      (v.clienteNombre ? ` · ${v.clienteNombre}` : '') +
      (v.retiradoPor ? ` · retiró: ${v.retiradoPor}` : '') +
      ` · ${v.fecha}`
  )
  console.log(`     items: ${(v.items || []).map((i) => `${i.cantidad}x ${i.nombre}`).join(', ')}`)
}

const cfg = (await getDoc(doc(db, 'configuracion', 'general'))).data()
console.log('\nCONFIG:', JSON.stringify({
  abierto: cfg?.abierto,
  encargosActivos: cfg?.encargosActivos,
  recibiendoEncargos: cfg?.recibiendoEncargos,
  fiadosActivos: cfg?.fiadosActivos,
}))

await terminate(db)
process.exit(0)
