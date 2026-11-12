import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, MessageCircle, SearchX, ShieldCheck, ShoppingBag, Smartphone, Store, UserPlus, Wallet, X } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { clientePorIdentificador } from '../../utils/acceso'
import { textoResetPin, waLink } from '../../utils/whatsapp'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import PhoneInput from '../../components/ui/PhoneInput'
import Modal from '../../components/ui/Modal'
import CategoriaTile3D from '../../components/ui/CategoriaTile3D'
import SwitchEstado from '../../components/ui/SwitchEstado'
import Logo from '../../assets/logo'

// Portada de acceso estilo Wolt Onboarding: luminosa, sin bordes duros
// y con un mosaico de categorías 3D pastel junto a la marca.
// En md+ se divide en dos columnas — izquierda: mosaico visual + estado
// del comercio con switch animado; derecha: acceso directo.
export default function LoginPanel() {
  const { loginCliente, loginStaff, clientes, config, notify, productos } = useKiosco()
  const [modo, setModo] = useState('cliente') // 'cliente' | 'staff'
  const [ident, setIdent] = useState('')
  const [pin, setPin] = useState('')
  const [usuario, setUsuario] = useState('')
  const [pinStaff, setPinStaff] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [recOpen, setRecOpen] = useState(false)
  const [regOpen, setRegOpen] = useState(false)

  const categorias = [...new Set((productos || []).map((p) => p.categoria))].slice(0, 8)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const s = modo === 'staff' ? await loginStaff(usuario, pinStaff) : await loginCliente(ident, pin)
      notify(`Bienvenido/a, ${s.nombre}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <BannerInstalacion />

      <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-soft md:grid-cols-[1.05fr_1fr]">
        {/* Columna identidad: mosaico 3D + marca + switch animado (md+) */}
        <div className="relative hidden flex-col justify-between gap-8 overflow-hidden bg-[#F6F6F6] p-9 md:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#009DE0]/10 blur-3xl"
          />
          <div className="relative">
            <div className="flex items-center gap-3">
              <Logo className="h-12 w-12 drop-shadow" />
              <div>
                <p className="text-2xl font-extrabold tracking-tight text-[#202125]">Yapa</p>
                <p className="text-xs font-medium text-slate-500">La billetera de tu kiosco</p>
              </div>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight text-[#202125]">
              {config.nombreKiosco}
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <SwitchEstado abierto={config.abierto} />
              <span className="text-sm font-medium text-slate-500">{config.horario}</span>
            </div>
          </div>

          {/* Mosaico dinámico de categorías 3D (contenido: padding absorbe
              los offsets de los tiles y nunca desborda su caja) */}
          <div className="relative -mx-1 overflow-hidden px-1 pb-4 pt-1">
            <div className="grid grid-cols-4 gap-3">
              {(categorias.length ? categorias : ['Bebidas', 'Snacks', 'Almuerzos', 'Golosinas']).slice(0, 4).map((c, i) => (
                <CategoriaTile3D
                  key={c}
                  nombre={c}
                  decorativo
                  conEtiqueta={false}
                  size="md"
                  className={`items-center ${i % 2 ? 'translate-y-3' : ''}`}
                />
              ))}
            </div>
          </div>

          <ul className="relative flex flex-col gap-3.5 text-sm">
            {[
              { icon: Wallet, t: 'Tu plata, siempre a mano', s: 'Recargá saldo, mirá tus fiados y pagá sin efectivo.' },
              { icon: ShoppingBag, t: 'Comprás más rápido', s: 'Catálogo en vivo, pedidos por QR y cuenta corriente.' },
              { icon: Store, t: 'El comercio vende mejor', s: 'Cobranzas ordenadas, stock al día y clientes fieles.' },
            ].map(({ icon: Icon, t, s }) => (
              <li key={t} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#009DE0] shadow-soft">
                  <Icon size={17} strokeWidth={2} />
                </span>
                <span>
                  <b className="block text-[#202125]">{t}</b>
                  <span className="text-slate-500">{s}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Columna acceso: tarjeta única y directa */}
        <div className="flex flex-col justify-center p-6 sm:p-8">
          {/* Header compacto de marca para pantallas chicas */}
          <div className="mb-5 md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Logo className="h-10 w-10 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate font-extrabold tracking-tight text-[#202125]">
                    Yapa · <span className="text-[#009DE0]">{config.nombreKiosco}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">{config.horario}</p>
                </div>
              </div>
              <SwitchEstado abierto={config.abierto} conEtiqueta={false} />
            </div>
            {/* Tira de categorías 3D tipo onboarding */}
            <div className="-mx-6 mt-4 flex gap-2.5 overflow-x-auto px-6 pb-1">
              {(categorias.length ? categorias : ['Bebidas', 'Snacks', 'Almuerzos', 'Golosinas']).map((c) => (
                <CategoriaTile3D key={c} nombre={c} decorativo size="sm" />
              ))}
            </div>
          </div>

          <h1 className="text-xl font-extrabold tracking-tight text-[#202125] sm:text-2xl">
            ¡Hola! Ingresá a tu cuenta
          </h1>
          <p className="mb-5 mt-1 text-sm text-slate-500">
            {modo === 'staff' ? 'Acceso para vendedores y administración.' : 'Tu saldo, tus fiados y tus compras, en un solo lugar.'}
          </p>

          {modo === 'staff' ? (
            <form onSubmit={submit} className="fade-in flex flex-col gap-3">
              <Input
                label="Usuario o DNI"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="usuario"
                autoComplete="username"
                autoFocus
                required
              />
              <Input
                label="PIN (4 dígitos)"
                inputMode="numeric"
                maxLength={4}
                type="password"
                value={pinStaff}
                onChange={(e) => setPinStaff(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                autoComplete="current-password"
                required
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => { setUsuario('admin'); setPinStaff('1234'); setError('') }}>
                  Demo · admin
                </Button>
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => { setUsuario('vendedor'); setPinStaff('1234'); setError('') }}>
                  Demo · vendedor
                </Button>
              </div>
              {error && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 ring-1 ring-inset ring-rose-200">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
                {busy && <Loader2 size={17} className="animate-spin" />}
                {busy ? 'Ingresando…' : 'Ingresar al mostrador'}
              </Button>
              <button
                type="button"
                onClick={() => { setModo('cliente'); setError('') }}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-brand"
              >
                <ArrowLeft size={13} /> Volver al ingreso de clientes
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="fade-in flex flex-col gap-3">
              <Input
                label="DNI o Correo"
                value={ident}
                onChange={(e) => setIdent(e.target.value)}
                placeholder="Ej: 45111222 o tu@correo.com"
                autoComplete="username"
                autoFocus
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
                autoComplete="current-password"
                required
              />

              {error && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 ring-1 ring-inset ring-rose-200">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
                {busy && <Loader2 size={17} className="animate-spin" />}
                {busy ? 'Ingresando…' : 'Ingresar'}
              </Button>

              <button
                type="button"
                onClick={() => setRecOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-brand"
              >
                <KeyRound size={13} /> ¿Olvidaste tu PIN?
              </button>

              <div className="flex items-center gap-3 py-1" role="separator">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-300">o</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <Button
                type="button"
                size="lg"
                variant="secondary"
                onClick={() => setRegOpen(true)}
                className="w-full"
              >
                <UserPlus size={17} /> Crear cuenta nueva
              </Button>
            </form>
          )}

          {/* Acceso discreto del personal */}
          {modo === 'cliente' && (
            <button
              type="button"
              onClick={() => { setModo('staff'); setError('') }}
              className="mt-6 inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-600"
            >
              <ShieldCheck size={12} /> ¿Sos vendedor o administrador? Ingresá al panel de personal
            </button>
          )}
        </div>
      </div>

      <Modal open={regOpen} onClose={() => setRegOpen(false)} title="Crear cuenta nueva">
        {regOpen && <FormRegistro onCreada={() => setRegOpen(false)} />}
      </Modal>

      <Modal open={recOpen} onClose={() => setRecOpen(false)} title="Recuperar acceso">
        {recOpen && <FormRecupero clientes={clientes} config={config} />}
      </Modal>
    </div>
  )
}

// Tarjeta discreta de instalación PWA: invita a fijar la app en el
// inicio del celular. Si el navegador expone beforeinstallprompt, el
// botón dispara el flujo nativo; si no, queda solo el aviso con cierre.
function BannerInstalacion() {
  const [visible, setVisible] = useState(() => {
    try {
      if (localStorage.getItem('yapa_install_hide')) return false
      if (window.matchMedia?.('(display-mode: standalone)').matches) return false
    } catch { /* sin storage: igual se muestra */ }
    return true
  })
  const [prompt, setPrompt] = useState(null)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!visible) return null

  const instalar = async () => {
    if (prompt) {
      prompt.prompt()
      await prompt.userChoice.catch(() => null)
    }
    setVisible(false)
    try { localStorage.setItem('yapa_install_hide', '1') } catch { /* noop */ }
  }

  const cerrar = () => {
    setVisible(false)
    try { localStorage.setItem('yapa_install_hide', '1') } catch { /* noop */ }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-blue-200/70 bg-brand-soft px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm ring-1 ring-inset ring-blue-100">
        <Smartphone size={17} strokeWidth={2} />
      </span>
      <p className="min-w-0 flex-1 text-xs font-medium text-brand sm:text-sm">
        <b className="block sm:inline">Tenela como app, sin descargar nada.</b>{' '}
        <span className="text-brand/70">Agregala a tu inicio y entrá con un toque.</span>
      </p>
      {prompt && (
        <button
          onClick={instalar}
          className="shrink-0 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark"
        >
          Instalar
        </button>
      )}
      <button
        onClick={cerrar}
        aria-label="Cerrar aviso de instalación"
        className="shrink-0 rounded-lg p-1.5 text-brand/50 transition-colors hover:bg-white/70 hover:text-brand"
      >
        <X size={15} />
      </button>
    </div>
  )
}

// Auto-registro público: el cliente crea su cuenta con DNI único y su
// propio PIN de 4 dígitos. Si el DNI ya está registrado, se bloquea.
function FormRegistro({ onCreada }) {
  const { crearCliente, notify } = useKiosco()
  const [form, setForm] = useState({ dni: '', nombre: '', apellido: '', telefono: '', email: '', pin: '', pin2: '' })
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
        email: form.email,
        pin: form.pin,
      })
      notify(`Cuenta creada para ${form.nombre}: ya podés ingresar con tu DNI o correo y PIN.`)
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
      <Input
        label="Correo electrónico (opcional)"
        type="email"
        placeholder="tu@correo.com · podés usarlo para ingresar"
        value={form.email}
        onChange={set('email')}
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
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 ring-1 ring-inset ring-rose-200">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="mt-1 w-full">
        {busy && <Loader2 size={16} className="animate-spin" />}
        {busy ? 'Creando cuenta…' : 'Crear mi cuenta'}
      </Button>
      <p className="text-[11px] text-slate-400">
        Si tu DNI ya está registrado, el sistema no te va a dejar duplicar la cuenta: usá
        "¿Olvidaste tu PIN?" en la pantalla de ingreso.
      </p>
    </form>
  )
}

// Recuperación asistida: el usuario ingresa su DNI o correo; si coincide
// con una cuenta se registra una solicitud RESET_PIN para el mostrador y
// se arma el mensaje de auxilio por WhatsApp al número del kiosco.
function FormRecupero({ clientes, config }) {
  const { solicitarResetPin } = useKiosco()
  const [ident, setIdent] = useState('')
  const [resultado, setResultado] = useState(undefined) // undefined | null | cliente
  const [busy, setBusy] = useState(false)

  const buscar = async (e) => {
    e.preventDefault()
    const encontrado = clientePorIdentificador(clientes, ident)
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
        Ingresá tu <b>DNI o correo</b>. Si coincide con una cuenta registrada, dejamos un pedido de
        restablecimiento en la bandeja del kiosco y te derivamos al WhatsApp oficial.
      </p>
      <form onSubmit={buscar} className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Input
            value={ident}
            onChange={(e) => { setIdent(e.target.value); setResultado(undefined) }}
            placeholder="Ej: 45111222 o tu@correo.com"
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
          No encontramos ninguna cuenta con ese dato. Revisalo, creá tu cuenta con
          "Crear mi cuenta" o consultá en el mostrador.
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark"
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
