import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  HandCoins,
  Hourglass,
  KeyRound,
  PackageCheck,
  PackageOpen,
  ShoppingBag,
  Store,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora } from '../../utils/format'
import Card from '../../components/ui/Card'
import EstadoServicio from '../../components/ui/EstadoServicio'
import EmptyState from '../../components/ui/EmptyState'

// Ícono + tono por tipo de evento (mismo lenguaje que la campanita).
const ICONO = {
  venta: { Icon: ShoppingBag, cls: 'bg-sky-50 text-sky-600' },
  encargo: { Icon: PackageCheck, cls: 'bg-emerald-50 text-emerald-600' },
  pago: { Icon: Hourglass, cls: 'bg-amber-50 text-amber-600' },
  acreditada: { Icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' },
  rechazada: { Icon: XCircle, cls: 'bg-rose-50 text-rose-500' },
  consumo: { Icon: ShoppingBag, cls: 'bg-indigo-50 text-indigo-600' },
  seguridad: { Icon: KeyRound, cls: 'bg-violet-50 text-violet-600' },
  stock: { Icon: AlertTriangle, cls: 'bg-amber-50 text-amber-600' },
  apertura: { Icon: Store, cls: 'bg-emerald-50 text-emerald-600' },
  auditoria: { Icon: ClipboardList, cls: 'bg-slate-100 text-slate-500' },
  cliente: { Icon: UserPlus, cls: 'bg-sky-50 text-sky-600' },
  caja: { Icon: HandCoins, cls: 'bg-amber-50 text-amber-600' },
  info: { Icon: Bell, cls: 'bg-slate-100 text-slate-500' },
}

// Filtros de la bandeja: cada píldora agrupa una o más categorías.
const FILTROS = [
  { key: 'todas', label: 'Todas', cats: null },
  { key: 'ventas', label: 'Ventas', cats: ['ventas'] },
  { key: 'pedidos', label: 'Pedidos / Encargos', cats: ['pedidos'] },
  { key: 'stock', label: 'Stock Rápido', cats: ['stock'] },
  { key: 'clientes', label: 'Clientes / Caja', cats: ['clientes', 'caja'] },
]

// Las notificaciones viejas (sin `cat`) se clasifican por su `tipo`.
const CAT_POR_TIPO = {
  venta: 'ventas',
  consumo: 'ventas',
  encargo: 'pedidos',
  stock: 'stock',
  pago: 'clientes',
  acreditada: 'clientes',
  rechazada: 'clientes',
  auditoria: 'caja',
  apertura: 'caja',
  seguridad: 'caja',
}

const catDe = (n) => n.cat || CAT_POR_TIPO[n.tipo] || 'caja'

// Timestamp de la notificación (createdAt nuevo / fecha histórico).
const tsDe = (n) => new Date(n.createdAt || n.fecha).getTime() || 0

// Día local en formato input[type=date].
const isoDia = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Atajos del filtro de fechas de la bandeja.
const ATAJOS_FECHA = [
  { key: 'hoy', label: 'Hoy', dias: 0 },
  { key: 'semana', label: '7 días', dias: 6 },
  { key: 'todas', label: 'Todas', dias: null },
]

// Centro de notificaciones del administrador y "Mi Actividad" del
// vendedor: mismo feed, pero el vendedor solo ve los eventos que él
// firmó durante su turno (autor === su nombre de sesión).
export default function NotificacionesPanel() {
  const { session, notificaciones } = useKiosco()
  const esAdmin = session?.rol === 'admin'
  const [filtro, setFiltro] = useState('todas')
  const [desde, setDesde] = useState('') // rango de fechas, formato input date
  const [hasta, setHasta] = useState('')
  const [atajo, setAtajo] = useState('todas')
  // El rango manual se esconde tras la píldora "Elegir por fecha":
  // la barra queda limpia y los inputs no se cortan en 390px.
  const [fechaOpen, setFechaOpen] = useState(false)

  const aplicarAtajo = (key) => {
    setAtajo(key)
    const a = ATAJOS_FECHA.find((x) => x.key === key)
    if (!a || a.dias === null) {
      setDesde('')
      setHasta('')
      return
    }
    const hoy = new Date()
    const ini = new Date()
    ini.setDate(hoy.getDate() - a.dias)
    setDesde(isoDia(ini))
    setHasta(isoDia(hoy))
  }

  const cambiarFecha = (setter, v) => {
    setter(v)
    setAtajo('custom') // rango manual: ningún atajo marcado
  }

  const feed = useMemo(
    () =>
      (notificaciones || []).filter(
        (n) =>
          (n.para === 'staff' || n.para === 'admin') &&
          (esAdmin || n.autor === session?.nombre)
      ),
    [notificaciones, esAdmin, session?.nombre]
  )

  // Leídas por usuario en este dispositivo (misma clave que la
  // campanita del TopBar: marcar acá también limpia el contador).
  const readKey = session ? `kiosco_notifs_leidas:${session.rol}:${session.id}` : null
  const [leidas, setLeidas] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(readKey)) || []
    } catch {
      return []
    }
  })
  const persistLeidas = (ids) => {
    setLeidas(ids)
    try {
      localStorage.setItem(readKey, JSON.stringify(ids.slice(-300)))
    } catch {
      /* sin espacio: el badge vuelve a marcar */
    }
  }

  const filtradas = useMemo(() => {
    const f = FILTROS.find((x) => x.key === filtro)
    const base = f?.cats ? feed.filter((n) => f.cats.includes(catDe(n))) : feed
    const d0 = desde ? new Date(`${desde}T00:00:00`) : null
    const d1 = hasta ? new Date(`${hasta}T23:59:59.999`) : null
    // Orden estricto: siempre lo más reciente primero (createdAt DESC).
    return base
      .filter((n) => (!d0 || tsDe(n) >= d0) && (!d1 || tsDe(n) <= d1))
      .sort((a, b) => tsDe(b) - tsDe(a))
  }, [feed, filtro, desde, hasta])

  const noLeidas = feed.filter((n) => !leidas.includes(n.id)).length
  const marcarTodas = () => persistLeidas([...new Set([...leidas, ...feed.map((n) => n.id)])])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {/* Contingencia operativa: el vendedor puede pausar/reactivar
          fiados y encargos desde su menú (queda auditado en su turno). */}
      {!esAdmin && (
        <Card title="Estado del Servicio" subtitle="Pausá o reactivá servicios sin cerrar el local">
          <EstadoServicio />
        </Card>
      )}
      <Card
        title={esAdmin ? 'Notificaciones del kiosco' : 'Mi Actividad'}
        subtitle={
          esAdmin
            ? 'Eventos en tiempo real: ventas, pedidos, stock, clientes y caja'
            : 'Todo lo que moviste durante tu turno'
        }
        actions={
          feed.length > 0 ? (
            <button
              type="button"
              onClick={marcarTodas}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand transition-colors hover:text-brand-dark"
            >
              <CheckCheck size={14} /> Marcar todas como leídas
            </button>
          ) : null
        }
      >
        {noLeidas > 0 && (
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-600">
            {noLeidas} sin leer
          </p>
        )}
        {/* Píldoras de filtro */}
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const activo = filtro === f.key
            const cant = f.cats ? feed.filter((n) => f.cats.includes(catDe(n))).length : feed.length
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltro(f.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95 ${
                  activo
                    ? 'bg-[#009DE0] text-white shadow-[0_2px_10px_rgba(0,157,224,0.25)]'
                    : 'bg-[#F6F6F6] text-[#555963] hover:bg-[#EBF7FD] hover:text-[#007AB8]'
                }`}
              >
                {f.label}{cant > 0 ? ` · ${cant}` : ''}
              </button>
            )
          })}
        </div>

        {/* Filtro por fechas: píldoras limpias (Hoy / 7 días / Todas)
            y el rango manual escondido tras "Elegir por fecha" para
            que la barra no se corte en pantallas chicas. */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {ATAJOS_FECHA.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => aplicarAtajo(a.key)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-all duration-150 active:scale-95 ${
                  atajo === a.key
                    ? 'bg-[#009DE0] text-white shadow-[0_2px_10px_rgba(0,157,224,0.25)]'
                    : 'bg-[#F6F6F6] text-[#555963] hover:bg-[#EBF7FD] hover:text-[#007AB8]'
                }`}
              >
                {a.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFechaOpen((v) => !v)}
              aria-expanded={fechaOpen}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-all duration-150 active:scale-95 ${
                fechaOpen || atajo === 'custom'
                  ? 'bg-[#009DE0] text-white shadow-[0_2px_10px_rgba(0,157,224,0.25)]'
                  : 'bg-[#F6F6F6] text-[#555963] hover:bg-[#EBF7FD] hover:text-[#007AB8]'
              }`}
            >
              <CalendarDays size={14} /> Elegir por fecha
            </button>
          </div>
          {fechaOpen && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex h-[38px] items-center gap-1.5 rounded-full bg-[#F6F6F6] px-3.5 transition-shadow focus-within:ring-2 focus-within:ring-[#009DE0]/30">
                <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">Desde</span>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => cambiarFecha(setDesde, e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-slate-700 outline-none"
                />
              </label>
              <label className="flex h-[38px] items-center gap-1.5 rounded-full bg-[#F6F6F6] px-3.5 transition-shadow focus-within:ring-2 focus-within:ring-[#009DE0]/30">
                <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">Hasta</span>
                <input
                  type="date"
                  value={hasta}
                  min={desde || undefined}
                  onChange={(e) => cambiarFecha(setHasta, e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-slate-700 outline-none"
                />
              </label>
            </div>
          )}
        </div>

        {filtradas.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title={filtro === 'todas' ? 'Sin eventos todavía' : 'Sin eventos en este filtro'}
            sub={
              esAdmin
                ? 'Las ventas, pedidos, movimientos de stock y de caja van a aparecer acá.'
                : 'Tu actividad del turno (stock, encargos, clientes, recargas) va a aparecer acá.'
            }
          />
        ) : (
          <ul className="flex flex-col">
            {filtradas.map((n) => {
              const meta = ICONO[n.tipo] || ICONO.info
              const leida = leidas.includes(n.id)
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 border-b border-slate-50 py-3 last:border-0 ${
                    leida ? 'opacity-60' : ''
                  }`}
                >
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.cls}`}>
                    <meta.Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-slate-700">{n.texto}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {fmtFechaHora(n.fecha)}
                      {n.autor && <> · por <b className="font-semibold">{n.autor}</b></>}
                    </p>
                  </div>
                  {!leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
