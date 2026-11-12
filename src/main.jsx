import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PwaUpdateBanner from './components/PwaUpdateBanner.jsx'
import { KioscoProvider } from './context/KioscoContext.jsx'

const RELOAD_KEY = 'kiosco-chunk-reload'
function recargaForzada() {
  const ultima = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
  if (Date.now() - ultima < 60000) return
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  window.location.reload()
}

const esErrorDeChunk = (msg) =>
  typeof msg === 'string' &&
  (msg.includes('dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Failed to fetch'))

window.addEventListener('unhandledrejection', (e) => {
  const msg = e?.reason?.message || String(e?.reason || '')
  if (esErrorDeChunk(msg)) recargaForzada()
})

window.addEventListener(
  'error',
  (e) => {
    const el = e.target
    if (el && el !== window && (el.tagName === 'SCRIPT' || el.tagName === 'LINK')) {
      recargaForzada()
    } else if (esErrorDeChunk(e.message)) {
      recargaForzada()
    }
  },
  true
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <KioscoProvider>
      <App />
      <PwaUpdateBanner />
    </KioscoProvider>
  </StrictMode>
)
