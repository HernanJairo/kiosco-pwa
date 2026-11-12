import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Hourglass,
  Inbox,
  KeyRound,
  Loader2,
  LogOut,
  Menu,
  PackageOpen,
  Save,
  ShoppingBag,
  Store,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import { archivoADataURL } from '../../utils/imagen'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import EmptyState from '../ui/EmptyState'
import Input from '../ui/Input'
import AvatarPersonal from '../ui/AvatarPersonal'
import SwitchEstado from '../ui/SwitchEstado'
import AcercaDeModal from '../AcercaDeModal'

const ROL_LABEL = { cliente: 'Cliente', vendedor: 'Vendedor', admin: 'Admin' }
const ROLES_MOSTRADOR = ['vendedor', 'admin']

// Isotipo oficial de Yapa (el mismo del login v0): cuadrado celeste
// inclinado -4° con la "Y" blanca en negrita.
function YapaMark({ className = 'h-9 w-9', texto = 'text-xl' }) {
  return (
    <span className={`grid shrink-0 -rotate-[4deg] place-items-center rounded-xl bg-[#009DE0] shadow-[0_5px_12px_rgba(0,157,224,0.18)] ${className}`}>
      <span className={`rotate-[4deg] font-black leading-none text-white ${texto}`}>Y</span>
    </span>
  )
}

const NOTIF_ICON = {
  venta: { icon: ShoppingBag, bg: 'bg-sky-50 text-sky-600' },
  encargo: { icon: PackageOpen, bg: 'bg-emerald-50 text-emerald-600' },
  pago: { icon: Hourglass, bg: 'bg-amber-50 text-amber-600' },
  acreditada: { icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600' },
  rechazada: { icon: XCircle, bg: 'bg-rose-50 text-rose-500' },
  consumo: { icon: ShoppingBag, bg: 'bg-indigo-50 text-indigo-600' },
  seguridad: { icon: KeyRound, bg: 'bg-violet-50 text-violet-600' },
  stock: { icon: AlertTriangle, bg: 'bg-amber-50 text-amber-600' },
  apertura: { icon: Store, bg: 'bg-emerald-50 text-emerald-600' },
  info: { icon: Bell, bg: 'bg-slate-100 text-slate-500' },
}

export default function TopBar({ onMenu }) {
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
    personal,
  } = useKiosco()
  const [solicitudesOpen, setSolicitudesOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [acercaOpen, setAcercaOpen] = useState(false)
  const [perfilOpen, setPerfilOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const puedeAlternar = ROLES_MOSTRADOR.includes(session?.rol)
  // Integrante del equipo logueado (el cliente no tiene ficha en personal).
  const yo = puedeAlternar ? (personal || []).find((p) => p.id === session?.id) : null
  const pendientes = puedeAlternar ? solicitudesPendientes : []

  /* ---------- Centro de notificaciones ---------- */
  // Canal del feed: staff comparte bandeja; el cliente filtra por su id.
  const claveFeed = session
    ? session.rol === 'cliente'
      ? `cliente:${session.id}`
      : 'staff'
    : null

  const esAdmin = session?.rol === 'admin'
  const feed = useMemo(() => {
    if (!claveFeed) return []
    // El admin escucha además el canal 'admin' (auditoría de estado).
    const items = (notificaciones || []).filter(
      (n) => n.para === claveFeed || (esAdmin && n.para === 'admin')
    )
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
  }, [notificaciones, claveFeed, esAdmin, puedeAlternar, productos])

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

  // Accesos que viven en el cajón lateral (drawer móvil): "Mi Perfil"
  // del equipo y "Acerca de Yapa" para cualquier rol.
  useEffect(() => {
    const onPerfil = () => setPerfilOpen(true)
    const onAcerca = () => setAcercaOpen(true)
    window.addEventListener('yapa:perfil', onPerfil)
    window.addEventListener('yapa:acerca', onAcerca)
    return () => {
      window.removeEventListener('yapa:perfil', onPerfil)
      window.removeEventListener('yapa:acerca', onAcerca)
    }
  }, [])

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
      <header className="sticky top-0 z-40 border-b border-[#F3F3F3] bg-white/95 shadow-[0_4px_20px_rgba(32,33,37,0.05)] backdrop-blur">
        <div className="relative mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Hamburguesa: abre el cajón lateral del menú en <lg */}
            {onMenu && (
              <button
                onClick={onMenu}
                aria-label="Abrir menú"
                className="-ml-1 rounded-xl bg-[#F6F6F6] p-2 text-[#555963] transition-colors hover:bg-[#EBF7FD] hover:text-[#007AB8] md:hidden"
              >
                <Menu size={20} />
              </button>
            )}
            {/* Marca: isotipo oficial "Y" + wordmark. "Acerca de" vive en el drawer. */}
            <div className="flex min-w-0 items-center gap-2.5 px-1 py-0.5">
              <YapaMark className="h-9 w-9" texto="text-xl" />
              <div className="min-w-0">
                <p className="text-base font-extrabold leading-none tracking-tight text-[#202125]">
                  Yapa
                </p>
                <p className="mt-1 truncate text-[11px] font-medium text-[#90929A]">{config.nombreKiosco}</p>
              </div>
            </div>
          </div>

          {session && (
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Cliente: sin accesos rápidos (viven en el menú lateral):
                  solo pill de estado informativo + campanita + rol + Salir. */}
              {/* Centro de solicitudes: contador de pendientes del mostrador */}
              {puedeAlternar && (
                <button
                  onClick={() => setSolicitudesOpen(true)}
                  title="Bandeja de solicitudes"
                  className={`relative hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors md:inline-flex ${
                    pendientes.length > 0
                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'bg-[#F6F6F6] text-[#555963] hover:bg-[#EBF7FD] hover:text-[#007AB8]'
                  }`}
                >
                  <Inbox size={14} />
                  <span className="hidden sm:inline">Solicitudes</span>
                  {pendientes.length > 0 && (
                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {pendientes.length}
                    </span>
                  )}
                </button>
              )}
              {/* Estado del kiosco: switch interactivo SOLO para el personal
                  (vendedor/admin); el cliente ve un pill informativo. */}
              {puedeAlternar ? (
                <SwitchEstado abierto={config.abierto} onToggle={toggleAbierto} />
              ) : (
                <span
                  role="status"
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    config.abierto ? 'bg-[#EAF8EF] text-[#45875F]' : 'bg-[#FDF0EA] text-[#A25A3C]'
                  }`}
                >
                  <i className={`h-1.5 w-1.5 rounded-full ${config.abierto ? 'bg-[#43BD72]' : 'bg-[#E49B77]'}`} />
                  {config.abierto ? 'Abierto' : 'Cerrado'}
                </span>
              )}

              {/* Campanita: centro de notificaciones unificado por rol.
                  Para el staff el contador suma las solicitudes pendientes. */}
              <button
                onClick={() => setNotifOpen((v) => !v)}
                title="Notificaciones"
                aria-label={`Notificaciones${noLeidas ? ` (${noLeidas} sin leer)` : ''}`}
                className={`relative rounded-xl p-2 transition-colors ${
                  notifOpen ? 'bg-[#EBF7FD] text-[#007AB8]' : 'bg-[#F6F6F6] text-[#555963] hover:bg-[#EBF7FD] hover:text-[#007AB8]'
                }`}
              >
                <Bell size={17} />
                {noLeidas + (puedeAlternar ? pendientes.length : 0) > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
                    {noLeidas + (puedeAlternar ? pendientes.length : 0) > 99 ? '99+' : noLeidas + (puedeAlternar ? pendientes.length : 0)}
                  </span>
                )}
              </button>

              {/* Pill elegante "Rol · Nombre": para el equipo abre "Mi Perfil" */}
              {yo ? (
                <button
                  type="button"
                  onClick={() => setPerfilOpen(true)}
                  title="Mi Perfil"
                  className="hidden items-center gap-2 rounded-full bg-[#F6F6F6] py-1 pl-1 pr-3 shadow-[0_2px_10px_rgba(32,33,37,0.05)] transition-colors hover:bg-[#EBF7FD] md:flex"
                >
                  <AvatarPersonal persona={yo} className="h-7 w-7" textoClassName="text-[10px]" />
                  <span className="max-w-44 truncate text-xs font-bold text-[#555963]">
                    {ROL_LABEL[session.rol]} · {session.nombre}
                  </span>
                </button>
              ) : (
                <span className="hidden max-w-48 items-center truncate rounded-full bg-[#F6F6F6] px-3 py-2 text-xs font-bold text-[#555963] shadow-[0_2px_10px_rgba(32,33,37,0.05)] md:inline-flex">
                  {ROL_LABEL[session.rol]} · {session.nombre}
                </span>
              )}
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
              <div className="pop-in absolute right-2 top-14 z-50 flex w-[min(92vw,22rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-soft shadow-xl">
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
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand transition-colors hover:text-brand-dark"
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
                    <Inbox size={14} /> {pendientes.length} solicitud(es) pendiente(s) de revisión
                    <ChevronRight size={14} className="ml-auto" />
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
                              leida ? 'opacity-60' : 'bg-brand-soft/50'
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
              <li key={s.id} className="rounded-xl bg-white shadow-soft px-4 py-3">
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

      {/* Perfil editable del integrante logueado */}
      <Modal open={perfilOpen} onClose={() => setPerfilOpen(false)} title="Mi Perfil">
        {perfilOpen && yo && <FormMiPerfil persona={yo} />}
      </Modal>
    </>
  )
}

// "Mi Perfil": el integrante edita sus datos visibles, sube/cambia su
// foto (optimizada a DataURL) y cambia su propio PIN validando el actual.
function FormMiPerfil({ persona }) {
  const { updatePersonal, cambiarPinPersonal, notify } = useKiosco()
  const [form, setForm] = useState({ nombre: persona.nombre, apellido: persona.apellido, usuario: persona.usuario })
  const [pins, setPins] = useState({ actual: '', nuevo: '', repite: '' })
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const subirFoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await archivoADataURL(file, { max: 192, calidad: 0.8 })
      await updatePersonal(persona.id, { avatarUrl: dataUrl })
      notify('Foto de perfil actualizada.')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const quitarFoto = async () => {
    try {
      await updatePersonal(persona.id, { avatarUrl: '' })
      notify('Foto quitada: se muestran tus iniciales.', 'info')
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  const guardarDatos = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await updatePersonal(persona.id, form)
      notify('Perfil actualizado.')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const guardarPin = async (e) => {
    e.preventDefault()
    if (!/^\d{4}$/.test(pins.nuevo)) return notify('El PIN nuevo debe tener exactamente 4 dígitos.', 'error')
    if (pins.nuevo !== pins.repite) return notify('La confirmación no coincide con el PIN nuevo.', 'error')
    setBusy(true)
    try {
      await cambiarPinPersonal(persona.id, pins.actual, pins.nuevo)
      setPins({ actual: '', nuevo: '', repite: '' })
      notify('PIN actualizado: usá el nuevo en tu próximo ingreso.')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Foto de perfil */}
      <div className="flex items-center gap-4">
        <AvatarPersonal persona={persona} className="h-16 w-16" textoClassName="text-xl" />
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={subirFoto} />
          <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Camera size={14} /> {persona.avatarUrl ? 'Cambiar foto' : 'Subir foto'}
          </Button>
          {persona.avatarUrl && (
            <button type="button" onClick={quitarFoto} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-rose-500">
              <Trash2 size={11} /> Quitar foto
            </button>
          )}
        </div>
      </div>

      {/* Datos visibles */}
      <form onSubmit={guardarDatos} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre *" value={form.nombre} onChange={set('nombre')} required />
          <Input label="Apellido" value={form.apellido} onChange={set('apellido')} />
        </div>
        <Input label="Usuario *" value={form.usuario} onChange={set('usuario')} required />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar datos
          </Button>
        </div>
      </form>

      <hr className="border-slate-100" />

      {/* Cambio de PIN propio */}
      <form onSubmit={guardarPin} className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <KeyRound size={13} /> Cambiar mi PIN
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="PIN actual"
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={pins.actual}
            onChange={(e) => setPins((f) => ({ ...f, actual: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            placeholder="••••"
            required
          />
          <Input
            label="PIN nuevo"
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={pins.nuevo}
            onChange={(e) => setPins((f) => ({ ...f, nuevo: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            placeholder="4 dígitos"
            required
          />
          <Input
            label="Repetir"
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={pins.repite}
            onChange={(e) => setPins((f) => ({ ...f, repite: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            placeholder="Confirmar"
            required
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="secondary" disabled={busy}>
            <KeyRound size={14} /> Actualizar PIN
          </Button>
        </div>
      </form>
    </div>
  )
}
