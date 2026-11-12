import { useState } from 'react'
import { CheckCircle2, GraduationCap, KeyRound, Loader2, MessageCircle, SearchX, ShieldCheck, Users } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { alumnoPorIdentificador, tutorPorIdentificador } from '../../utils/acceso'
import { textoResetPin, waLink } from '../../utils/whatsapp'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Logo from '../../assets/logo'

const TABS = [
  { k: 'alumno', label: 'Alumno', icon: GraduationCap, hint: 'Demo · DNI 45111222 / PIN 1234' },
  { k: 'tutor', label: 'Tutor / Apoderado', icon: Users, hint: 'Demo · DNI 30123456 / PIN 1234' },
  { k: 'staff', label: 'Personal', icon: ShieldCheck, hint: null },
]

export default function LoginPanel() {
  const { loginAlumno, loginTutor, loginStaff, alumnos, tutores, config, notify } = useKiosco()
  const [tab, setTab] = useState('alumno')
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
      let s
      if (tab === 'alumno') s = await loginAlumno(dni, pin)
      else if (tab === 'tutor') s = await loginTutor(dni, pin)
      else s = await loginStaff(usuario, clave)
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
              label={tab === 'tutor' ? 'Usuario (DNI o teléfono)' : 'DNI'}
              inputMode="numeric"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
              placeholder={tab === 'tutor' ? 'Ej: 30123456 o 11 5555-1001' : 'Ej: 45111222'}
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

      <Modal open={recOpen} onClose={() => setRecOpen(false)} title="Recuperar acceso">
        {recOpen && <FormRecupero rol={tab} alumnos={alumnos} tutores={tutores} config={config} />}
      </Modal>
    </div>
  )
}

// Recuperación asistida: el usuario ingresa su DNI o teléfono; si hay
// coincidencia se arma el pedido de restablecimiento por WhatsApp al
// kiosco (el mostrador verifica identidad y actualiza el PIN).
function FormRecupero({ rol, alumnos, tutores, config }) {
  const [ident, setIdent] = useState('')
  const [resultado, setResultado] = useState(undefined) // undefined | null | entidad

  const buscar = (e) => {
    e.preventDefault()
    const encontrado =
      rol === 'tutor'
        ? tutorPorIdentificador(tutores, ident)
        : alumnoPorIdentificador(alumnos, ident)
    setResultado(encontrado || null)
  }

  const nombre = resultado ? (rol === 'tutor' ? resultado.nombre : `${resultado.nombre} ${resultado.apellido}`) : ''
  const url =
    resultado &&
    waLink(config.whatsapp, textoResetPin({ nombre, identificador: ident.trim() }))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600">
        Ingresá tu <b>DNI o teléfono</b>. Si coincide con una cuenta{' '}
        {rol === 'tutor' ? 'de tutor' : 'de alumno'}, te derivamos al chat oficial del kiosco para
        restablecer tu PIN.
      </p>
      <form onSubmit={buscar} className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Input
            value={ident}
            onChange={(e) => { setIdent(e.target.value); setResultado(undefined) }}
            placeholder="Ej: 45111222 o 11 5555-1001"
            inputMode="tel"
            autoFocus
            required
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {resultado === null && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
          <SearchX size={15} className="mt-0.5 shrink-0" />
          No encontramos ninguna cuenta {rol === 'tutor' ? 'de tutor' : 'de alumno'} con ese DNI o
          teléfono. Revisá el dato o consultá en el mostrador.
        </p>
      )}

      {resultado && (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>
              Cuenta encontrada: <b>{nombre}</b>
              {resultado.curso ? ` · ${resultado.curso}` : ''}
            </span>
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <MessageCircle size={17} /> Solicitar restablecimiento al Kiosco por WhatsApp
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
