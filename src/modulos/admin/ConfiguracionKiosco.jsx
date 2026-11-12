import { useState } from 'react'
import { CheckCircle2, Cloud, HardDrive, KeyRound, Loader2, Pencil, RefreshCcw, Save, Store, Trash2, UserPlus, UserX } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input, { Select } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import AvatarPersonal from '../../components/ui/AvatarPersonal'
import SwitchEstado from '../../components/ui/SwitchEstado'

const VACIO_PERSONAL = { nombre: '', apellido: '', usuario: '', rol: 'vendedor', pin: '', puesto: '' }

// Tarjeta "Mi clave de acceso": cualquier integrante del equipo ve su
// PIN vigente y lo cambia validando el actual.
export function PanelMiAcceso() {
  const { session, personal, cambiarPinPersonal, notify } = useKiosco()
  const yo = personal.find((s) => s.id === session?.id)
  const [form, setForm] = useState({ actual: '', nuevo: '', repite: '' })
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    if (!/^\d{4}$/.test(form.nuevo)) return notify('El PIN nuevo debe tener exactamente 4 dígitos.', 'error')
    if (form.nuevo !== form.repite) return notify('La confirmación no coincide con el PIN nuevo.', 'error')
    setBusy(true)
    try {
      await cambiarPinPersonal(yo.id, form.actual, form.nuevo)
      setForm({ actual: '', nuevo: '', repite: '' })
      setOk(true)
      setTimeout(() => setOk(false), 3500)
      notify('Tu PIN de acceso fue actualizado.')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!yo) return null
  return (
    <Card title="Mi clave de acceso" subtitle="PIN de ingreso al mostrador">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${yo.rol === 'admin' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-600'}`}>
            <KeyRound size={16} />
          </div>
          <span>
            <b>{yo.nombre} {yo.apellido}</b> · @{yo.usuario} · PIN actual: <b className="font-mono">{yo.pin}</b>
          </span>
        </div>
        <form onSubmit={guardar} className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-4">
          <Input
            label="PIN actual"
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={form.actual}
            onChange={(e) => setForm({ ...form, actual: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            placeholder="••••"
            required
          />
          <Input
            label="PIN nuevo"
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={form.nuevo}
            onChange={(e) => setForm({ ...form, nuevo: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            placeholder="4 dígitos"
            required
          />
          <Input
            label="Repetir PIN nuevo"
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={form.repite}
            onChange={(e) => setForm({ ...form, repite: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            placeholder="Confirmación"
            required
          />
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full">
              <Save size={15} /> {busy ? 'Guardando…' : 'Actualizar PIN'}
            </Button>
          </div>
        </form>
        {ok && (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={15} /> PIN actualizado correctamente: usá el nuevo en tu próximo ingreso.
          </p>
        )}
      </div>
    </Card>
  )
}

export default function ConfiguracionKiosco() {
  const { config, session, personal, updateConfig, resetDemo, updatePersonal, eliminarPersonal, notify, persistencia } = useKiosco()
  const [form, setForm] = useState({ ...config })
  const [altaOpen, setAltaOpen] = useState(false)
  const [editDe, setEditDe] = useState(null) // integrante → edición
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)

  const adminsActivos = personal.filter((p) => p.rol === 'admin' && p.activo !== false).length

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

  const toggleActivo = async (p) => {
    try {
      await updatePersonal(p.id, { activo: p.activo === false })
      notify(p.activo === false ? `Acceso de ${p.nombre} reactivado.` : `Acceso de ${p.nombre} desactivado.`, 'info')
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  const resetearPin = async (p) => {
    try {
      await updatePersonal(p.id, { pin: '1234' })
      notify(`PIN de ${p.nombre} restablecido a 1234 (temporal).`, 'info')
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  const baja = async (p) => {
    try {
      await eliminarPersonal(p.id)
      notify(`${p.nombre} ${p.apellido} fue dado de baja del equipo.`, 'info')
    } catch (err) {
      notify(err.message, 'error')
    }
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
          <Input label="Dirección / ubicación" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} required />
          <Input label="Datos de contacto" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
          <Input label="Correo del comercio (opcional)" type="email" value={form.emailKiosco ?? ''} onChange={(e) => setForm({ ...form, emailKiosco: e.target.value })} placeholder="kiosco@correo.com" />
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

      <Card
        title="Equipo y Permisos (ABM Personal)"
        subtitle="Altas, roles y accesos de administradores y vendedores"
        actions={
          <Button size="sm" onClick={() => setAltaOpen(true)}>
            <UserPlus size={14} /> Nuevo integrante
          </Button>
        }
      >
        <ul className="flex flex-col gap-2">
          {personal.map((p) => {
            const esUltimoAdmin = p.rol === 'admin' && p.activo !== false && adminsActivos === 1
            const inactivo = p.activo === false
            return (
              <li key={p.id} className={`flex flex-wrap items-center gap-3 rounded-xl bg-white shadow-soft px-4 py-3 ${inactivo ? 'opacity-60' : ''}`}>
                <AvatarPersonal persona={p} className="h-9 w-9" textoClassName="text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {p.nombre} {p.apellido}
                    {p.id === session?.id && <span className="ml-1.5 text-[10px] font-medium text-slate-400">(vos)</span>}
                  </p>
                  <p className="text-xs text-slate-400">@{p.usuario}{p.puesto ? ` · ${p.puesto}` : ''}</p>
                </div>
                <Badge tone={p.rol === 'admin' ? 'rose' : 'amber'}>{p.rol === 'admin' ? 'Admin' : 'Vendedor'}</Badge>
                {inactivo && <Badge tone="slate">Desactivado</Badge>}
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setEditDe(p)} title="Editar datos y rol" aria-label={`Editar ${p.nombre}`}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => resetearPin(p)} title="Restablecer PIN a 1234" aria-label={`Restablecer PIN de ${p.nombre}`}>
                    <KeyRound size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActivo(p)}
                    disabled={esUltimoAdmin}
                    title={
                      esUltimoAdmin
                        ? 'No se puede desactivar al último administrador activo'
                        : inactivo
                          ? 'Reactivar acceso'
                          : 'Desactivar acceso'
                    }
                    aria-label={`${inactivo ? 'Reactivar' : 'Desactivar'} a ${p.nombre}`}
                    className={inactivo ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'}
                  >
                    {inactivo ? <CheckCircle2 size={14} /> : <UserX size={14} />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => baja(p)}
                    disabled={esUltimoAdmin}
                    title={esUltimoAdmin ? 'No se puede eliminar al último administrador activo' : 'Eliminar del equipo'}
                    aria-label={`Eliminar a ${p.nombre}`}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[11px] text-slate-400">
          El usuario puede ser un DNI o un username; el acceso es con PIN de 4 dígitos. El sistema
          siempre conserva al menos un administrador activo.
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
          <SwitchEstado abierto={config.abierto} onToggle={toggleAbierto} />
        </div>
      </Card>

      <Card title="Zona de peligro" subtitle="Acciones sobre los datos de demostración">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Restablece productos, clientes, ventas, fiados y vendedores a los valores iniciales.
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

      {/* Alta de integrante del equipo */}
      <Modal open={altaOpen} onClose={() => setAltaOpen(false)} title="Nuevo integrante del equipo">
        {altaOpen && <FormAltaPersonal onClose={() => setAltaOpen(false)} />}
      </Modal>

      {/* Edición de integrante */}
      <Modal open={!!editDe} onClose={() => setEditDe(null)} title="Editar integrante">
        {editDe && <FormEditarPersonal persona={editDe} onClose={() => setEditDe(null)} />}
      </Modal>
    </div>
  )
}

// Alta de administrador o vendedor: usuario único (DNI o username) +
// PIN inicial de 4 dígitos.
function FormAltaPersonal({ onClose }) {
  const { addPersonal, notify } = useKiosco()
  const [form, setForm] = useState({ ...VACIO_PERSONAL })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const u = await addPersonal(form)
      notify(`${u.rol === 'admin' ? 'Administrador' : 'Vendedor'} "${u.nombre} ${u.apellido}" creado · ingresa con "${u.usuario}".`)
      onClose()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nombre *" placeholder="Ej.: Ana" autoFocus value={form.nombre} onChange={set('nombre')} required />
        <Input label="Apellido" placeholder="Ej.: Pérez" value={form.apellido} onChange={set('apellido')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Usuario *"
          placeholder="DNI o username único"
          value={form.usuario}
          onChange={set('usuario')}
          required
        />
        <Select label="Rol *" value={form.rol} onChange={set('rol')}>
          <option value="vendedor">Vendedor</option>
          <option value="admin">Administrador</option>
        </Select>
      </div>
      <Input
        label="Puesto (opcional)"
        placeholder='Ej.: "Mostrador", "Caja"'
        value={form.puesto}
        onChange={set('puesto')}
      />
      <Input
        label="PIN inicial (4 dígitos) *"
        inputMode="numeric"
        maxLength={4}
        placeholder="Ej.: 1234"
        value={form.pin}
        onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
        required
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="success" disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          {busy ? 'Creando…' : 'Crear integrante'}
        </Button>
      </div>
      <p className="text-[11px] text-slate-400">
        El integrante ingresa desde "Acceso Personal / Mostrador" con su usuario y este PIN.
      </p>
    </form>
  )
}

// Edición administrativa del integrante: datos, rol y acceso. La regla
// del último admin activo la valida el núcleo (operaciones.js).
function FormEditarPersonal({ persona, onClose }) {
  const { updatePersonal, notify } = useKiosco()
  const [form, setForm] = useState({
    nombre: persona.nombre,
    apellido: persona.apellido,
    usuario: persona.usuario,
    rol: persona.rol,
    activo: persona.activo !== false,
    puesto: persona.puesto || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await updatePersonal(persona.id, form)
      notify(`Datos de ${form.nombre} actualizados.`)
      onClose()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nombre *" autoFocus value={form.nombre} onChange={set('nombre')} required />
        <Input label="Apellido" value={form.apellido} onChange={set('apellido')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Usuario *" value={form.usuario} onChange={set('usuario')} required />
        <Select label="Rol *" value={form.rol} onChange={set('rol')}>
          <option value="vendedor">Vendedor</option>
          <option value="admin">Administrador</option>
        </Select>
      </div>
      <Input label="Puesto (opcional)" placeholder='Ej.: "Mostrador", "Caja"' value={form.puesto} onChange={set('puesto')} />
      <label className="flex items-center gap-2.5 rounded-xl border border-transparent bg-[#F6F6F6] px-4 py-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.activo}
          onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span>
          <b>Acceso habilitado</b>
          <span className="block text-[11px] text-slate-400">
            Si lo desactivás, no puede ingresar al mostrador hasta reactivarlo.
          </span>
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
