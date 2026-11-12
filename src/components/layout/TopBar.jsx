import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Hourglass,
  Inbox,
  Info,
  KeyRound,
  LogOut,
  PackageOpen,
  ShoppingBag,
  Store,
  X,
  XCircle,
} from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import Logo from '../../assets/logo'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import EmptyState from '../ui/EmptyState'
import AcercaDeModal from '../AcercaDeModal'

const ROL_LABEL = { cliente: 'Cliente', vendedor: 'Vendedor', admin: 'Admin' }
const ROL_TONE = { cliente: 'indigo', vendedor: 'amber', admin: 'rose' }
const ROLES_MOSTRADOR = ['vendedor', 'admin']

const NOTIF_ICON = {
  pago: { icon: Hourglass, bg: 'bg-amber-50 text-amber-600' },
  acreditada: { icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600' },
  rechazada: { icon: XCircle, bg: 'bg-rose-50 text-rose-500' },
  consumo: { icon: ShoppingBag, bg: 'bg-indigo-50 text-indigo-600' },
  seguridad: { icon: KeyRound, bg: 'bg-violet-50 text-violet-600' },
  stock: { icon: AlertTriangle, bg: 'bg-amber-50 text-amber-600' },
  apertura: { icon: Store, bg: 'bg-emerald-50 text-emerald-600' },
  info: { icon: Bell, bg: 'bg-slate-100 text-slate-500' },
}

export default function TopBar() {
  const {
    session,
    logout,
    config,
    updateConfig,
    notify,
    solicitudesPendientes,
    aprobarSolicitud,
    descartarSolicitud,
    notificaciones,
    productos,
  } = useKiosco()
  const [solicitudesOpen, setSolicitudesOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [acercaOpen, setAcercaOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const puedeAlternar = ROLES_MOSTRADOR.includes(session?.rol)
  const pendientes = puedeAlternar ? solicitudesPendientes : []

  /* ---------- Centro de notificaciones ---------- */
  // Canal del feed: staff comparte bandeja; el cliente filtra por su id.
  const claveFeed = session
    ? session.rol === 'cliente'
      ? `cliente:${session.id}`
      : 'staff'
    : null

  const feed = useMemo(() => {
    if (!claveFeed) return []
    const items = (notificaciones || []).filter((n) => n.para === claveFeed)
    // Alertas vivas (estado actual, no eventos): stock por debajo del mínimo.
    const vivas = puedeAlternar
      ? productos
          .filter((p) => p.stock < 5)
          .map((p) => ({
            id: `stock-${p.id}`,
            fecha: null,
            texto: `Stock bajo: ${p.nombre} — quedan ${p.stock} unidad${p.stock === 1 ? '' : 'es'}.`,
            tipo: 'stock',
          }))
      : []
    return [...vivas, ...items]
  }, [notificaciones, claveFeed, puedeAlternar, productos])

  // Leídas por usuario en este dispositivo (las notificaciones viven en la
  // base compartida; el estado de lectura es personal).
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
      /* sin espacio: el badge simplemente vuelve a marcar */
    }
  }
  const noLeidas = feed.filter((n) => !leidas.includes(n.id)).length
  const marcarTodas = () => persistLeidas([...new Set([...leidas, ...feed.map((n) => n.id)])])
  /* -------------------------------------------- */

  const toggleAbierto = async () => {
    const nuevo = !config.abierto
    await updateConfig({ abierto: nuevo })
    notify(nuevo ? 'Kiosco abierto: mostrador habilitado.' : 'Kiosco cerrado temporalmente.', 'info')
  }

  const aprobar = async (s) => {
    setBusyId(s.id)
    try {
      await aprobarSolicitud(s.id)
      notify(
        s.tipo === 'RESET_PIN'
          ? `PIN de ${s.nombre} restablecido al temporal.`
          : `Transferencia de ${money(s.monto)} acreditada a ${s.nombre}.`
      )
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const descartar = async (s) => {
    setBusyId(s.id)
    try {
      await descartarSolicitud(s.id)
      notify(`Solicitud de ${s.nombre} descartada.`, 'info')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              onClick={() => setAcercaOpen(true)}
              title="Acerca de KioscoApp"
              aria-label="Ver versión y créditos de la app"
              className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-slate-50"
            >
              <Logo className="h-8 w-8 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-none text-slate-800">
                  Kiosco<span className="text-emerald-600">App</span>
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">{config.direccion}</p>
              </div>
            </button>
            <button
              onClick={() => setAcercaOpen(true)}
              title="Versión y créditos"
              aria-label="Acerca de KioscoApp"
              className="shrink-0 rounded-full p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
            >
              <Info size={14} />
            </button>
          </div>

          {session && (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Centro de solicitudes: contador de pendientes del mostrador */}
              {puedeAlternar && (
                <button
                  onClick={() => setSolicitudesOpen(true)}
                  title="Bandeja de solicitudes"
                  className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors ${
                    pendientes.length > 0
                      ? 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100'
                      : 'bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Inbox size={13} />
                  <span className="hidden sm:inline">Solicitudes</span>
                  {pendientes.length > 0 && (
                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {pendientes.length}
                    </span>
                  )}
                </button>
              )}
              {puedeAlternar && (
                <button
                  onClick={toggleAbierto}
                  title={config.abierto ? 'Cerrar el kiosco' : 'Abrir el kiosco'}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors ${
                    config.abierto
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <Store size={13} />
                  {config.abierto ? 'Abierto' : 'Cerrado'}
                </button>
              )}

              {/* Campanita: centro de notificaciones unificado por rol.
                  Para el staff el contador suma las solicitudes pendientes. */}
              <button
                onClick={() => setNotifOpen((v) => !v)}
                title="Notificaciones"
                aria-label={`Notificaciones${noLeidas ? ` (${noLeidas} sin leer)` : ''}`}
                className={`relative rounded-full p-2 transition-colors ${
                  notifOpen ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <Bell size={17} />
                {noLeidas + (puedeAlternar ? pendientes.length : 0) > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
                    {noLeidas + (puedeAlternar ? pendientes.length : 0) > 99 ? '99+' : noLeidas + (puedeAlternar ? pendientes.length : 0)}
                  </span>
                )}
              </button>

              <Badge tone={ROL_TONE[session.rol]} className="hidden sm:inline-flex">
                {ROL_LABEL[session.rol]}
              </Badge>
              <span className="hidden max-w-40 truncate text-sm font-medium text-slate-700 md:block">
                {session.nombre}
              </span>
              <Button variant="secondary" size="sm" onClick={logout}>
                <LogOut size={14} />
                <span className="hidden sm:inline">Salir</span>
              </Button>
            </div>
          )}

          {/* Panel flotante de notificaciones */}
          {notifOpen && session && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="pop-in absolute right-2 top-14 z-50 flex w-[min(92vw,22rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-slate-800">
                    Notificaciones
                    {noLeidas > 0 && (
                      <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                        {noLeidas} sin leer
                      </span>
                    )}
                  </p>
                  {feed.length > 0 && (
                    <button
                      onClick={marcarTodas}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                    >
                      <CheckCheck size={13} /> Marcar todas como leídas
                    </button>
                  )}
                </div>
                {puedeAlternar && pendientes.length > 0 && (
                  <button
                    onClick={() => { setNotifOpen(false); setSolicitudesOpen(true) }}
                    className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                  >
                    <Inbox size={14} /> {pendientes.length} solicitud(es) pendiente(s) de revisión →
                  </button>
                )}
                <div className="max-h-[24rem] overflow-y-auto">
                  {feed.length === 0 ? (
                    <EmptyState
                      icon={PackageOpen}
                      title="Sin notificaciones"
                      sub="Acá vas a ver acreditaciones, consumos y alertas."
                    />
                  ) : (
                    <ul className="flex flex-col">
                      {feed.map((n) => {
                        const meta = NOTIF_ICON[n.tipo] || NOTIF_ICON.info
                        const Icon = meta.icon
                        const leida = leidas.includes(n.id)
                        return (
                          <li
                            key={n.id}
                            className={`flex items-start gap-3 border-b border-slate-50 px-4 py-3 last:border-0 ${
                              leida ? 'opacity-60' : 'bg-emerald-50/40'
                            }`}
                          >
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                              <Icon size={15} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] leading-snug text-slate-700">{n.texto}</p>
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                {n.fecha ? fmtFechaHora(n.fecha) : 'Alerta vigente'}
                              </p>
                            </div>
                            {!leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {!config.abierto && (
        <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
          <AlertTriangle size={14} />
          El kiosco se encuentra cerrado temporalmente. Podés mirar el catálogo igual.
        </div>
      )}

      {/* Bandeja de solicitudes: recuperos de PIN y transferencias
          informadas, listos para aprobar o descartar. */}
      <Modal open={solicitudesOpen} onClose={() => setSolicitudesOpen(false)} title="Centro de Solicitudes">
        {pendientes.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Sin solicitudes pendientes" sub="Todos los pedidos fueron procesados." />
        ) : (
          <ul className="flex flex-col gap-2">
            {pendientes.map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      s.tipo === 'RESET_PIN' ? 'bg-violet-50 text-violet-600' : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {s.tipo === 'RESET_PIN' ? <KeyRound size={16} /> : <Hourglass size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{s.nombre}</p>
                    <p className="text-xs text-slate-400">
                      {fmtFechaHora(s.fechaHora)} ·{' '}
                      {s.tipo === 'RESET_PIN'
                        ? `Recupero de PIN · DNI ${s.dni}`
                        : `${s.tipoOperacion === 'recarga' ? 'Recarga de saldo' : 'Pago de deuda'} · informada por ${s.origen}`}
                    </p>
                  </div>
                  {s.tipo === 'TRANSFERENCIA_PENDIENTE' && <Badge tone="amber">{money(s.monto)}</Badge>}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="success" className="flex-1" onClick={() => aprobar(s)} disabled={busyId === s.id}>
                    <CheckCircle2 size={13} />
                    {busyId === s.id
                      ? 'Procesando…'
                      : s.tipo === 'RESET_PIN'
                        ? 'Aprobar y resetear a 1234'
                        : 'Validar e impactar saldo'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => descartar(s)} disabled={busyId === s.id} className="text-slate-400 hover:text-rose-500" aria-label="Descartar solicitud">
                    <X size={14} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          Resetear deja el PIN en 1234 (temporal). Validar una transferencia descuenta la deuda (o
          suma al saldo) y asienta el movimiento en la cuenta del cliente.
        </p>
      </Modal>

      <AcercaDeModal open={acercaOpen} onClose={() => setAcercaOpen(false)} />
    </>
  )
}
