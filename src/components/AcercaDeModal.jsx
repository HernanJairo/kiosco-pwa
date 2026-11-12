import { useState } from 'react'
import { BadgeCheck, Database, RefreshCw, School } from 'lucide-react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Logo from '../assets/logo'

// Versión visible de la app: incrementar en cada deploy para identificar
// qué build está corriendo cada dispositivo (PWA cachea agresivamente).
export const APP_VERSION = 'v1.4.0'
export const APP_BUILD = 'Build 2026.11'

// Borra el caché del service worker / Cache Storage y recarga. Los datos
// de la app (localStorage) se conservan: solo se fuerza la descarga de
// la versión más reciente del bundle.
async function limpiarCache() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.update()))
    }
  } catch {
    /* sin caches disponibles: la recarga igual trae lo último del servidor */
  }
  window.location.reload()
}

export default function AcercaDeModal({ open, onClose }) {
  const [limpiando, setLimpiando] = useState(false)

  const forzarActualizacion = async () => {
    setLimpiando(true)
    await limpiarCache()
  }

  return (
    <Modal open={open} onClose={onClose} title="Acerca de KioscoApp">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="h-14 w-14" />
        <div>
          <p className="text-base font-bold text-slate-800">
            Kiosco<span className="text-emerald-600">App</span>
          </p>
          <p className="mt-0.5 font-mono text-xs font-semibold text-emerald-600">
            {APP_VERSION} · {APP_BUILD}
          </p>
        </div>

        <ul className="flex w-full flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left">
          <li className="flex items-center gap-2 text-xs text-slate-600">
            <BadgeCheck size={14} className="shrink-0 text-emerald-500" />
            PWA lista para producción / Conexión Firebase preparada
          </li>
          <li className="flex items-center gap-2 text-xs text-slate-600">
            <Database size={14} className="shrink-0 text-indigo-500" />
            Datos locales persistentes con sincronización remota opcional
          </li>
          <li className="flex items-center gap-2 text-xs text-slate-600">
            <School size={14} className="shrink-0 text-amber-500" />
            Desarrollado para Escuela N°12 Gral. San Martín
          </li>
        </ul>

        <p className="text-[11px] leading-snug text-slate-400">
          Tecnicatura Superior en Ciencia de Datos e Inteligencia Artificial ·
          Práctica Profesionalizante III
        </p>

        <div className="flex w-full flex-col gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" size="sm" onClick={forzarActualizacion} disabled={limpiando}>
            <RefreshCw size={14} className={limpiando ? 'animate-spin' : ''} />
            {limpiando ? 'Limpiando caché…' : 'Forzar actualización de datos / Limpiar caché local'}
          </Button>
          <p className="text-[10px] text-slate-400">
            Descarga la última versión del servidor sin perder los datos guardados.
          </p>
        </div>
      </div>
    </Modal>
  )
}
