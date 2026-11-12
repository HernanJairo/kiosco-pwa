import { useState } from 'react'
import {
  BarChart3, Database, Palette, RefreshCw, ShieldCheck,
  ShoppingBag, Store, Wallet,
} from 'lucide-react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Logo from '../assets/logo'

// Versión visible de la app: incrementar en cada deploy para identificar
// qué build está corriendo cada dispositivo (PWA cachea agresivamente).
export const APP_VERSION = 'v1.6.0'
export const APP_BUILD = 'Build 2026.11'

// Capacidades vigentes del sistema (se actualiza junto con la versión).
const NOVEDADES = [
  {
    icon: Palette,
    tono: 'text-brand',
    titulo: 'Diseño unificado estilo Wolt / Yapa',
    texto: 'Tipografía Plus Jakarta Sans y modo responsivo para PC, Android e iOS.',
  },
  {
    icon: ShoppingBag,
    tono: 'text-emerald-500',
    titulo: 'Catálogo digital completo',
    texto: 'Búsqueda instantánea, ordenamiento por popularidad o precio, detalle de productos con imágenes uniformes, QR Express y Encargos con retiro propio o por persona autorizada.',
  },
  {
    icon: Wallet,
    tono: 'text-indigo-500',
    titulo: 'Billetera digital Yapa',
    texto: 'Saldo prepago, transferencias entre clientes, Carnet QR y desbloqueo progresivo antifraude de la Cuenta Corriente (Fiado).',
  },
  {
    icon: Store,
    tono: 'text-amber-500',
    titulo: 'Operación de mostrador',
    texto: 'Terminal POS táctil, inventario con control de vencimientos y Stock Rápido auditado por sesión de cada vendedor.',
  },
  {
    icon: BarChart3,
    tono: 'text-rose-500',
    titulo: 'Gestión inteligente',
    texto: 'Interruptores de contingencia en tiempo real, centro de notificaciones del administrador y reportes con Ciencia de Datos.',
  },
]

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
    <Modal open={open} onClose={onClose} title="Acerca de Yapa">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="h-14 w-14" />
        <div>
          <p className="text-base font-bold text-slate-800">
            Yapa
          </p>
          <p className="mt-0.5 font-mono text-xs font-semibold text-brand">
            {APP_VERSION} · {APP_BUILD}
          </p>
        </div>

        <ul className="flex max-h-64 w-full flex-col gap-2.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3 text-left">
          {NOVEDADES.map(({ icon: Icon, tono, titulo, texto }) => (
            <li key={titulo} className="flex items-start gap-2.5">
              <Icon size={15} className={`mt-0.5 shrink-0 ${tono}`} />
              <div>
                <p className="text-xs font-bold text-slate-700">{titulo}</p>
                <p className="text-[11px] leading-snug text-slate-500">{texto}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <ShieldCheck size={13} className="text-emerald-500" />
          <Database size={13} className="text-indigo-400" />
          Datos locales persistentes · Firebase opcional · PWA instalable
        </p>

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
