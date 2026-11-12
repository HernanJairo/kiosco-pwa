// Inicialización única de Firebase para Yapa (proyecto kiosko-45709).
//
// Las credenciales salen de las variables VITE_FIREBASE_* (.env local o
// Environment Variables en Vercel) y caen a la configuración embebida si
// faltan en el deploy: la config web de Firebase es pública por diseño —
// la seguridad real la dan las reglas de Firestore en la consola.
//
// Solo se usa Cloud Firestore (Plan Spark): las fotos de productos se
// guardan comprimidas como DataURL WebP dentro del documento, sin
// Firebase Storage. `persistentLocalCache` da persistencia offline
// nativa: el kiosco sigue operando sin internet y sincroniza al volver.
import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const env = import.meta.env || {}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCPqW4p85qzzmF66-krPgE3f6XM1qZNJr0',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'kiosko-45709.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'kiosko-45709',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'kiosko-45709.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '181234290908',
  appId: env.VITE_FIREBASE_APP_ID || '1:181234290908:web:28ac5f4a13b23901e5e419',
}

// true cuando las credenciales mínimas están cargadas.
export const firebaseLista = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
)

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

let firestore
try {
  // Multi-pestaña: el POS y el panel admin suelen estar abiertos a la vez.
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
} catch {
  try {
    firestore = initializeFirestore(app, { localCache: persistentLocalCache() })
  } catch {
    // Ya inicializado (HMR de Vite) o sin soporte de caché persistente.
    firestore = getFirestore(app)
  }
}

export const db = firestore
