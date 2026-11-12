import { useState } from 'react'
import { CheckCircle2, Cloud, HardDrive, KeyRound, RefreshCcw, Save, ShieldCheck, Store, Trash2, User, UserPlus } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'

const VACIO_VENDEDOR = { nombre: '', usuario: '', clave: '' }

// Tarjeta "Mi clave de acceso": cualquier rol staff (admin/vendedor) ve su
// clave vigente y la actualiza confirmándola por duplicado.
export function PanelMiAcceso() {
  const { session, staff, updateStaffClave, notify } = useKiosco()
  const yo = staff.find((s) => s.id === session?.id)
  const [form, setForm] = useState({ clave: '', repite: '' })
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    if (form.clave.trim().length < 4) return notify('La clave debe tener al menos 4 caracteres.', 'error')
    if (form.clave !== form.repite) return notify('La confirmación no coincide con la nueva clave.', 'error')
    setBusy(true)
    try {
      await updateStaffClave(yo.id, form.clave)
      setForm({ clave: '', repite: '' })
      setOk(true)
      setTimeout(() => setOk(false), 3500)
      notify('Tu clave de acceso fue actualizada.')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!yo) return null
  return (
    <Card title="Mi clave de acceso" subtitle="Credencial de ingreso al mostrador">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${yo.rol === 'admin' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-600'}`}>
            <KeyRound size={16} />
          </div>
          <span>
            <b>{yo.nombre}</b> · @{yo.usuario} · clave actual: <b className="font-mono">{yo.clave}</b>
          </span>
        </div>
        <form onSubmit={guardar} className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Nueva clave"
            value={form.clave}
            onChange={(e) => setForm({ ...form, clave: e.target.value })}
            placeholder="Mínimo 4 caracteres"
            autoComplete="new-password"
            required
          />
          <Input
            label="Repetir nueva clave"
            value={form.repite}
            onChange={(e) => setForm({ ...form, repite: e.target.value })}
            placeholder="Confirmación"
            autoComplete="new-password"
            required
          />
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full">
              <Save size={15} /> {busy ? 'Guardando…' : 'Actualizar clave'}
            </Button>
          </div>
        </form>
        {ok && (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={15} /> Clave actualizada correctamente: usá la nueva en tu próximo ingreso.
          </p>
        )}
      </div>
    </Card>
  )
}

export default function ConfiguracionKiosco() {
  const { config, staff, updateConfig, resetDemo, addVendedor, deleteVendedor, notify, persistencia } = useKiosco()
  const [form, setForm] = useState({ ...config })
  const [nuevo, setNuevo] = useState({ ...VACIO_VENDEDOR })
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    setBusy(true)
    await updateConfig(form)
    setBusy(false)
    notify('Configuración guardada.')
  }

  const toggleAbierto = async () => {
    const nuevoEstado = !config.abierto
    setForm((f) => ({ ...f, abierto: nuevoEstado }))
    await updateConfig({ abierto: nuevoEstado })
    notify(nuevoEstado ? 'Kiosco habilitado.' : 'Kiosco cerrado temporalmente.', 'info')
  }

  const altaVendedor = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const u = await addVendedor(nuevo)
      notify(`Vendedor "${u.nombre}" creado · ya puede ingresar con "${u.usuario}".`)
      setNuevo({ ...VACIO_VENDEDOR })
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const bajaVendedor = async (u) => {
    await deleteVendedor(u.id)
    notify(`Acceso de "${u.nombre}" eliminado.`, 'info')
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Estado de persistencia */}
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-medium ${
          persistencia.remoto
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-indigo-200 bg-indigo-50 text-indigo-700'
        }`}
      >
        {persistencia.remoto ? <Cloud size={16} className="shrink-0" /> : <HardDrive size={16} className="shrink-0" />}
        <div>
          <p className="font-semibold">
            {persistencia.remoto
              ? 'Modo: Firebase (sincronizado con Firestore)'
              : 'Modo: Almacenamiento Local (Listo para Firebase)'}
          </p>
          <p className="mt-0.5 font-normal opacity-80">
            {persistencia.remoto
              ? 'Productos, clientes y ventas se espejan en la nube.'
              : persistencia.useFirebase
                ? 'Firebase habilitado pero sin respuesta: se usan datos locales.'
                : 'Persistencia en este dispositivo. Para conectar Firebase: npm i firebase, completar src/firebase/firebaseConfig.js y activar USE_FIREBASE.'}
          </p>
        </div>
      </div>

      <Card title="Configuración Raíz" subtitle="Ajustes globales del kiosco">
        <form onSubmit={guardar} className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nombre del kiosco" value={form.nombreKiosco} onChange={(e) => setForm({ ...form, nombreKiosco: e.target.value })} required />
          <Input label="Colegio / institución" value={form.colegio} onChange={(e) => setForm({ ...form, colegio: e.target.value })} required />
          <Input label="Datos de contacto" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
          <Input label="Horario de atención" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
          <Input label="WhatsApp del kiosco (avisos de pago)" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+5493881234567" required />
          <Input label="Alias para transferencias" value={form.aliasPago} onChange={(e) => setForm({ ...form, aliasPago: e.target.value })} placeholder="KIOSCO.SANMARTIN.MP" required />
          <Input label="CBU institucional" value={form.cbuPago ?? ''} onChange={(e) => setForm({ ...form, cbuPago: e.target.value.replace(/\D/g, '') })} placeholder="0000003100012345678901" />
          <Input
            label="Límite de fiado global ($)"
            type="number"
            min="0"
            value={form.limiteFiadoGlobal ?? ''}
            onChange={(e) => setForm({ ...form, limiteFiadoGlobal: Number(e.target.value) || 0 })}
            required
          />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              <Save size={15} /> {busy ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>

      <PanelMiAcceso />

      <Card title="Gestión de Personal / Vendedores" subtitle="Cuentas de acceso al mostrador">
        <ul className="mb-4 flex flex-col gap-2">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.rol === 'admin' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-600'}`}>
                {s.rol === 'admin' ? <ShieldCheck size={17} /> : <User size={17} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{s.nombre}</p>
                <p className="text-xs text-slate-400">@{s.usuario}</p>
              </div>
              <Badge tone={s.rol === 'admin' ? 'rose' : 'amber'}>{s.rol === 'admin' ? 'Admin' : 'Vendedor'}</Badge>
              {s.rol === 'vendedor' && (
                <Button variant="ghost" size="sm" onClick={() => bajaVendedor(s)} className="text-rose-500 hover:bg-rose-50" aria-label={`Eliminar ${s.nombre}`}>
                  <Trash2 size={14} />
                </Button>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={altaVendedor} className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 sm:grid-cols-4">
          <Input label="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ej: Ana Pérez" required />
          <Input label="Usuario" value={nuevo.usuario} onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })} placeholder="Ej: ana" required />
          <Input label="Contraseña" type="text" value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} placeholder="Ej: 1234" required />
          <div className="flex items-end">
            <Button type="submit" variant="success" disabled={busy} className="w-full">
              <UserPlus size={15} /> Alta vendedor
            </Button>
          </div>
        </form>
        <p className="mt-2 text-[11px] text-slate-400">
          El vendedor puede autenticarse de inmediato desde el login, pestaña "Personal".
        </p>
      </Card>

      <Card title="Estado del kiosco" subtitle="Habilitación o cierre temporal del mostrador">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${config.abierto ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
              <Store size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {config.abierto ? 'Kiosco habilitado' : 'Kiosco cerrado temporalmente'}
              </p>
              <p className="text-xs text-slate-400">
                {config.abierto ? 'El mostrador puede registrar ventas.' : 'Las ventas quedan bloqueadas hasta reabrir.'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleAbierto}
            role="switch"
            aria-checked={config.abierto}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${config.abierto ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${config.abierto ? 'left-[22px]' : 'left-0.5'}`}
            />
          </button>
        </div>
      </Card>

      <Card title="Zona de peligro" subtitle="Acciones sobre los datos de demostración">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Restablece productos, alumnos, ventas, fiados y vendedores a los valores iniciales.
          </p>
          <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
            <RefreshCcw size={14} /> Restablecer datos demo
          </Button>
        </div>
      </Card>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Restablecer datos">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Se borrarán todos los cambios realizados y se cerrará la sesión actual. ¿Continuar?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={async () => { setConfirmReset(false); await resetDemo() }}
            >
              <RefreshCcw size={14} /> Restablecer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
