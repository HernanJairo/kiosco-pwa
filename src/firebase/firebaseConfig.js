// Credenciales del proyecto Firebase.
// Copiá acá los valores de tu consola: Project settings → Your apps → SDK setup.
// Mientras estén vacías (o USE_FIREBASE = false en KioscoContext) la app
// funciona 100% en modo local con localStorage + datos semilla.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

// true cuando las credenciales mínimas están cargadas.
export const firebaseLista = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
)
