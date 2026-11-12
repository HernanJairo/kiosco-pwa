import { useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, MessageCircle, SearchX, ShieldCheck, User, UserPlus } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { clientePorIdentificador } from '../../utils/acceso'
import { textoResetPin, waLink } from '../../utils/whatsapp'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import PhoneInput from '../../components/ui/PhoneInput'
import Modal from '../../components/ui/Modal'
import Logo from '../../assets/logo'

const TABS = [
  { k: 'cliente', label: 'Cliente', icon: User, hint: 'Demo · DNI 45111222 / PIN 1234' },
  { k: 'registro', label: 'Crear Cuenta', icon: UserPlus, hint: null },
  { k: 'staff', label: 'Personal', icon: ShieldCheck, hint: null },
]

export default function LoginPanel() {
  const { loginCliente, loginStaff, clientes, config, notify } = useKiosco()
  const [tab, setTab] = useState('cliente')
  const [dni, setDni] = useState('')
  const [pin, setPin] = useState('')
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [recOpen, setRecOpen] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const s = tab === 'staff' ? await loginStaff(usuario, clave) : await loginCliente(dni, pin)
      notify(`Bienvenido/a, ${s.nombre}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <div className="mb-5 flex items-center gap-3">
        <Logo className="h-10 w-10" />
        <div>
          <p className="text-base font-bold text-slate-800">Iniciar sesión</p>
          <p className="text-xs text-slate-400">Ingresá según tu rol para continuar</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => { setTab(k); setError('') }}
            className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors sm:flex-row sm:justify-center sm:text-xs ${
              tab === k ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'registro' ? (
        <FormRegistro onCreada={() => setTab('cliente')} />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {tab === 'staff' ? (
            <>
              <Input
                label="Usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="usuario"
                autoComplete="username"
                required
              />
              <Input
                label="Contraseña"
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="••••"
                autoComplete="current-password"
                required
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => { setUsuario('admin'); setClave('1234'); setError('') }}>
                  Demo · admin
                </Button>
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => { setUsuario('vendedor'); setClave('1234'); setError('') }}>
                  Demo · vendedor
                </Button>
              </div>
            </>
          ) : (
            <>
              <Input
                label="DNI"
                inputMode="numeric"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej: 45111222"
                required
              />
              <Input
                label="PIN (4 dígitos)"
                inputMode="numeric"
                maxLength={4}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                required
              />
              <p className="text-[11px] text-slate-400">{TABS.find((t) => t.k === tab).hint}</p>
            </>
          )}

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 ring-1 ring-inset ring-rose-200">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy} className="mt-1 w-full">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? 'Ingresando…' : 'Ingresar'}
          </Button>

          {tab !== 'staff' && (
            <button
              type="button"
              onClick={() => setRecOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-emerald-600"
            >
              <KeyRound size={13} /> ¿Olvidaste tu PIN?
            </button>
          )}
        </form>
      )}

      <Modal open={recOpen} onClose={() => setRecOpen(false)} title="Recuperar acceso">
        {recOpen && <FormRecupero clientes={clientes} config={config} />}
      </Modal>
    </div>
  )
}

// Auto-registro público: el cliente crea su cuenta con DNI único y su
// propio PIN de 4 dígitos. Si el DNI ya está registrado, se bloquea.
function FormRegistro({ onCreada }) {
  const { crearCliente, notify } = useKiosco()
  const [form, setForm] = useState({ dni: '', nombre: '', apellido: '', telefono: '', pin: '', pin2: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.pin !== form.pin2) return setError('La confirmación del PIN no coincide.')
    setBusy(true)
    try {
      await crearCliente({
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        telefono: form.telefono,
        pin: form.pin,
      })
      notify(`Cuenta creada para ${form.nombre}: ya podés ingresar con tu DNI y PIN.`)
      onCreada()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        label="DNI *"
        inputMode="numeric"
        placeholder="Solo números · será tu usuario"
        value={form.dni}
        onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nombre *" placeholder="Ej.: Ana" value={form.nombre} onChange={set('nombre')} required />
        <Input label="Apellido *" placeholder="Ej.: Pérez" value={form.apellido} onChange={set('apellido')} required />
      </div>
      <PhoneInput
        label="Teléfono / WhatsApp"
        value={form.telefono}
        onChange={(v) => setForm((f) => ({ ...f, telefono: v }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="PIN (4 dígitos) *"
          inputMode="numeric"
          maxLength={4}
          type="password"
          value={form.pin}
          onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
          placeholder="••••"
          required
        />
        <Input
          label="Repetir PIN *"
          inputMode="numeric"
          maxLength={4}
          type="password"
          value={form.pin2}
          onChange={(e) => setForm((f) => ({ ...f, pin2: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
          placeholder="••••"
          required
        />
      </div>
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 ring-1 ring-inset ring-rose-200">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="mt-1 w-full">
        {busy && <Loader2 size={16} className="animate-spin" />}
        {busy ? 'Creando cuenta…' : 'Crear mi cuenta'}
      </Button>
      <p className="text-[11px] text-slate-400">
        Si tu DNI ya está registrado, el sistema no te va a dejar duplicar la cuenta: usá
        "¿Olvidaste tu PIN?" en la pestaña Cliente.
      </p>
    </form>
  )
}

// Recuperación asistida: el usuario ingresa su DNI; si coincide con una
// cuenta se registra una solicitud RESET_PIN para el mostrador y se arma
// el mensaje de auxilio por WhatsApp al número del kiosco.
function FormRecupero({ clientes, config }) {
  const { solicitarResetPin } = useKiosco()
  const [dni, setDni] = useState('')
  const [resultado, setResultado] = useState(undefined) // undefined | null | cliente
  const [busy, setBusy] = useState(false)

  const buscar = async (e) => {
    e.preventDefault()
    const encontrado = clientePorIdentificador(clientes, dni)
    setResultado(encontrado || null)
    if (!encontrado) return
    setBusy(true)
    try {
      await solicitarResetPin(encontrado.dni)
    } catch {
      /* la solicitud ya estaba registrada o falló: el flujo WhatsApp sigue */
    } finally {
      setBusy(false)
    }
  }

  const nombre = resultado ? `${resultado.nombre} ${resultado.apellido}` : ''
  const url =
    resultado && waLink(config.whatsapp, textoResetPin({ nombre, identificador: resultado.dni }))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600">
        Ingresá tu <b>DNI</b>. Si coincide con una cuenta registrada, dejamos un pedido de
        restablecimiento en la bandeja del kiosco y te derivamos al WhatsApp oficial.
      </p>
      <form onSubmit={buscar} className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Input
            value={dni}
            onChange={(e) => { setDni(e.target.value.replace(/\D/g, '')); setResultado(undefined) }}
            placeholder="Ej: 45111222"
            inputMode="numeric"
            autoFocus
            required
          />
        </div>
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? 'Buscando…' : 'Buscar'}
        </Button>
      </form>

      {resultado === null && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
          <SearchX size={15} className="mt-0.5 shrink-0" />
          No encontramos ninguna cuenta con ese DNI. Revisá el dato, creá tu cuenta en
          "Crear Cuenta" o consultá en el mostrador.
        </p>
      )}

      {resultado && (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>
              Cuenta encontrada: <b>{nombre}</b> · DNI <b>{resultado.dni}</b>
              <br />
              <span className="text-xs">Tu pedido de restablecimiento ya quedó registrado en el kiosco.</span>
            </span>
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <MessageCircle size={17} /> Enviar pedido de auxilio por WhatsApp
          </a>
          <p className="text-[11px] text-slate-400">
            Se abre WhatsApp ({config.whatsapp}) con el pedido ya redactado. El kiosco verifica tu
            identidad antes de asignar un PIN nuevo.
          </p>
        </div>
      )}
    </div>
  )
}
