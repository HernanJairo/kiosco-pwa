import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Eye, EyeOff, IdCard, Info, KeyRound, Loader2, LockKeyhole, MapPin, MessageCircle, Phone, QrCode, SearchX, ShieldCheck, Smartphone, Sparkles, Store, User, UserPlus, X } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { clientePorIdentificador } from '../../utils/acceso'
import { textoResetPin, waLink } from '../../utils/whatsapp'
import './LoginPanel.css'

// Pantalla de acceso full-bleed (diseño v0): el shell es un overlay fijo
// que cubre el header redundante del landing. Panel de bienvenida con
// mosaico fotográfico + formulario unico con selector Cliente/Personal.
// Estilos encapsulados en LoginPanel.css (.login-shell).
export default function LoginPanel() {
  const { loginCliente, loginStaff, config, notify } = useKiosco()
  const [modo, setModo] = useState('cliente') // 'cliente' | 'staff'
  const [ident, setIdent] = useState('')
  const [pin, setPin] = useState('')
  const [verPin, setVerPin] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [recOpen, setRecOpen] = useState(false)
  const [regOpen, setRegOpen] = useState(false)
  const [contactoOpen, setContactoOpen] = useState(false)
  const [imgOk, setImgOk] = useState(true)

  const esStaff = modo === 'staff'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const s = esStaff ? await loginStaff(ident.trim(), pin) : await loginCliente(ident.trim(), pin)
      notify(`Bienvenido/a, ${s.nombre}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const demo = async (kind) => {
    setError('')
    setBusy(true)
    try {
      const s =
        kind === 'cliente'
          ? await loginCliente('45111222', '1234')
          : await loginStaff(kind === 'admin' ? 'admin' : 'vendedor', '1234')
      notify(`Bienvenido/a, ${s.nombre}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // "Ver Catálogo": el LandingHeader (oculto tras el overlay) ya expone
  // esa acción; disparamos su botón real para no duplicar navegación.
  const irCatalogo = () => {
    const btn = [...document.querySelectorAll('header button')].find((b) =>
      b.textContent.includes('Catálogo')
    )
    btn?.click()
  }

  const cambiarModo = (m) => {
    setModo(m)
    setError('')
    setPin('')
  }

  return (
    <div className="login-shell">
      {/* Panel de bienvenida (desktop) / cabecera con mosaico (mobile) */}
      <div className="welcome-panel">
        <div className="mosaic">
          <div className="mosaic-glow" />
          {imgOk ? (
            <img
              src="/yapa-snacks.png"
              alt="Productos del kiosco"
              className="snack-art"
              onError={() => setImgOk(false)}
            />
          ) : (
            <div className="snack-art grid place-items-center text-[#009DE0]">
              <Store size={72} strokeWidth={1.2} />
            </div>
          )}
          <p className="mosaic-topline">
            <span>Tu kiosco de siempre,</span>
            <span>ahora más rápido.</span>
          </p>
          <span className="floating-tag tag-a">
            <i className="tag-dot" /> Retiro express en caja
          </span>
          <span className="floating-tag tag-b">
            <QrCode size={14} /> Pedidos por QR
          </span>
        </div>

        <div className="store-card">
          <span className="store-icon">
            <Store size={20} />
          </span>
          <div className="store-details">
            <span className="eyebrow">TU KIOSCO</span>
            <strong>{config.nombreKiosco}</strong>
            <span className="store-caption">{config.direccion || config.horario}</span>
          </div>
          <span className={`status-pill${config.abierto ? '' : ' closed'}`}>
            <i />
            {config.abierto ? 'Abierto' : 'Cerrado'}
          </span>
        </div>

        <div className="welcome-note">
          <span className="note-star">
            <Sparkles size={18} />
          </span>
          <p>
            <strong>Bienvenido a Yapa:</strong> tu billetera del kiosco para comprar,
            fiar y retirar pedidos sin vueltas.
          </p>
        </div>

        <span className="panel-footnote">YAPA · TU KIOSCO INTELIGENTE</span>
      </div>

      {/* Panel de formulario */}
      <div className="form-panel">
        <div className="form-content">
          <div className="form-header">
            <div className="brand">
              <span className="brand-mark">
                <span>Y</span>
              </span>
              Yapa
            </div>
            <div className="top-actions">
              <button type="button" className="top-info" onClick={() => setContactoOpen(true)}>
                <Info size={14} /> Contacto / Info
              </button>
              <button type="button" className="top-catalog" onClick={irCatalogo}>
                <Store size={14} /> Ver Catálogo
              </button>
            </div>
          </div>

          <div className="mobile-store">
            <Store size={14} />
            {config.nombreKiosco}
            <span className={`mobile-status${config.abierto ? '' : ' closed'}`}>
              <i />
              {config.abierto ? 'Abierto' : 'Cerrado'}
            </span>
          </div>

          <BannerInstalacion />

          <div className="heading-block">
            <p className="eyebrow">{esStaff ? 'ACCESO INTERNO' : 'BILLETERA VIRTUAL'}</p>
            <h1>
              ¡Hola!<br className="desktop-break" /> Ingresá a tu cuenta
            </h1>
            <p className="subtitle">
              {esStaff
                ? 'Acceso de vendedores y administración al mostrador.'
                : 'Tu saldo, tus fiados y tus compras, en un solo lugar.'}
            </p>
          </div>

          <div className="seg-control" role="tablist" aria-label="Tipo de acceso">
            <span className={`seg-thumb${esStaff ? ' right' : ''}`} />
            <button
              type="button"
              role="tab"
              aria-selected={!esStaff}
              className={`seg-option${esStaff ? '' : ' active'}`}
              onClick={() => cambiarModo('cliente')}
            >
              <User size={14} /> Soy Cliente
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={esStaff}
              className={`seg-option${esStaff ? ' active' : ''}`}
              onClick={() => cambiarModo('staff')}
            >
              <ShieldCheck size={14} /> Mostrador / Personal
            </button>
          </div>

          <form className="login-form" onSubmit={submit}>
            <label className="field-label" htmlFor="login-ident">
              {esStaff ? 'Usuario o DNI del personal' : 'DNI o correo'}
            </label>
            <div className="input-wrap">
              {esStaff ? <ShieldCheck size={17} /> : <IdCard size={17} />}
              <input
                id="login-ident"
                value={ident}
                onChange={(e) => setIdent(e.target.value)}
                placeholder={esStaff ? 'usuario' : 'Ej: 45111222 o tu@correo.com'}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div className="pin-label">
              <label className="field-label" htmlFor="login-pin">
                PIN
              </label>
              <span>4 dígitos</span>
            </div>
            <div className="input-wrap">
              <LockKeyhole size={17} />
              <input
                id="login-pin"
                type={verPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="reveal-button"
                onClick={() => setVerPin((v) => !v)}
                aria-label={verPin ? 'Ocultar PIN' : 'Mostrar PIN'}
              >
                {verPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {!esStaff ? (
              <button type="button" className="forgot-link" onClick={() => setRecOpen(true)}>
                ¿Olvidaste tu PIN?
              </button>
            ) : (
              <div className="forgot-link" aria-hidden="true" style={{ pointerEvents: 'none' }} />
            )}

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="primary-button login-button" disabled={busy}>
              {busy ? 'Ingresando…' : 'Ingresar'}
              {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            </button>
          </form>

          {!esStaff && (
            <>
              <div className="divider">o</div>
              <button type="button" className="secondary-button" onClick={() => setRegOpen(true)}>
                <UserPlus size={17} /> Crear cuenta nueva
              </button>
            </>
          )}

          <div className="demo-section">
            <p className="demo-label">Acceso rápido de demostración</p>
            <div className="demo-grid">
              <button type="button" className="demo-btn" onClick={() => demo('cliente')} disabled={busy}>
                <User size={15} />
                Demo Cliente
                <small>DNI 45111222</small>
              </button>
              <button type="button" className="demo-btn" onClick={() => demo('vendedor')} disabled={busy}>
                <Store size={15} />
                Demo Vendedor
                <small>vendedor</small>
              </button>
              <button type="button" className="demo-btn" onClick={() => demo('admin')} disabled={busy}>
                <ShieldCheck size={15} />
                Demo Admin
                <small>admin</small>
              </button>
            </div>
          </div>

          <p className="legal-note">
            Al ingresar aceptás las condiciones de uso de Yapa.
            <br />
            Tu cuenta y tu saldo están protegidos por tu PIN de 4 dígitos.
          </p>
        </div>
      </div>

      {regOpen && <DialogRegistro onClose={() => setRegOpen(false)} onCreada={(dni) => setIdent(dni)} />}
      {recOpen && <DialogRecupero onClose={() => setRecOpen(false)} />}
      {contactoOpen && <DialogContacto onClose={() => setContactoOpen(false)} />}
    </div>
  )
}

// Banner PWA compacto y SIEMPRE visible (incl. localhost e iOS/Safari):
// si el navegador capturó beforeinstallprompt dispara el instalador
// nativo en 1 clic; si no, abre el modal con los pasos por plataforma.
function BannerInstalacion() {
  const [promptEvt, setPromptEvt] = useState(null)
  const [instOpen, setInstOpen] = useState(false)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setPromptEvt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const instalar = async () => {
    if (promptEvt) {
      promptEvt.prompt()
      await promptEvt.userChoice.catch(() => null)
    } else {
      setInstOpen(true)
    }
  }

  return (
    <>
      <div className="pwa-banner">
        <span className="pwa-icon">
          <Smartphone size={16} />
        </span>
        <p className="pwa-copy">
          <strong>Tenela como app, sin descargar nada.</strong>
          Agregala a tu inicio y entrá con un toque.
        </p>
        <button type="button" className="pwa-install" onClick={instalar}>
          Instalar app
        </button>
      </div>
      {instOpen && <DialogInstalacion onClose={() => setInstOpen(false)} />}
    </>
  )
}

// Capa de diálogo compartida (backdrop + cierre por Escape / click fuera).
function Dialog({ onClose, icon: Icon, eyebrow, title, copy, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Cerrar">
          <X size={16} />
        </button>
        <div className="dialog-icon">
          <Icon size={20} />
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {copy && <p className="dialog-copy">{copy}</p>}
        {children}
      </div>
    </div>
  )
}

// Modal de contacto: info de Yapa + datos reales del kiosco.
function DialogContacto({ onClose }) {
  const { config } = useKiosco()
  return (
    <Dialog
      onClose={onClose}
      icon={Info}
      eyebrow="YAPA · CONTACTO"
      title={config.nombreKiosco}
      copy="La billetera de tu kiosco: saldo, fiados y encargos en un solo lugar."
    >
      <div className="form-stack">
        <span className="contact-row">
          <MapPin size={16} /> {config.direccion}
        </span>
        <span className="contact-row">
          <Clock3 size={16} /> {config.horario}
        </span>
        <span className="contact-row">
          <Phone size={16} /> {config.contacto}
        </span>
        <a
          className="contact-row"
          href={waLink(config.whatsapp, `Hola! Consulta para ${config.nombreKiosco}.`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={16} /> Escribinos por WhatsApp
        </a>
      </div>
      <p className="legal-note" style={{ marginTop: 18 }}>
        Desarrollado por estudiantes de la Tecnicatura Superior en Ciencia de
        Datos e Inteligencia Artificial · IES N° 6
      </p>
      <button type="button" className="back-link" onClick={onClose}>
        <ArrowLeft size={14} /> Volver al ingreso
      </button>
    </Dialog>
  )
}

// Instrucciones de instalación por plataforma (iOS / Android / PC).
function DialogInstalacion({ onClose }) {
  return (
    <Dialog
      onClose={onClose}
      icon={Smartphone}
      eyebrow="INSTALAR YAPA"
      title="Agregala a tu pantalla de inicio"
      copy="Ocupa poquísimo espacio y funciona como una app nativa."
    >
      <ul className="install-steps">
        <li>
          <span>
            <b>iPhone / iPad</b>
            En Safari tocá <b>Compartir</b> (ícono de compartir) →{' '}
            <b>“Agregar a pantalla de inicio”</b> → Agregar.
          </span>
        </li>
        <li>
          <span>
            <b>Android</b>
            En Chrome tocá el menú <b>⋮</b> → <b>“Instalar app”</b> o{' '}
            <b>“Agregar a pantalla principal”</b>.
          </span>
        </li>
        <li>
          <span>
            <b>PC / Escritorio</b>
            Tocá el ícono de instalación en la barra de direcciones del
            navegador → <b>Instalar</b>.
          </span>
        </li>
      </ul>
      <button type="button" className="back-link" onClick={onClose}>
        <ArrowLeft size={14} /> Entendido
      </button>
    </Dialog>
  )
}

// Auto-registro público: crea la cuenta con DNI único y PIN propio.
function DialogRegistro({ onClose, onCreada }) {
  const { crearCliente, notify } = useKiosco()
  const [form, setForm] = useState({ dni: '', telefono: '', nombre: '', apellido: '', email: '', pin: '', pin2: '' })
  const [verPin, setVerPin] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setNum = (k, max) => (e) => setForm((f) => ({ ...f, [k]: e.target.value.replace(/\D/g, '').slice(0, max) }))

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
      onCreada(form.dni)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      onClose={onClose}
      icon={UserPlus}
      eyebrow="NUEVA CUENTA"
      title="Crear cuenta nueva"
      copy="Registrate con tu DNI y un PIN de 4 dígitos para usar la billetera, fiar y hacer encargos."
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="form-grid">
          <label className="full-field">
            DNI
            <input
              inputMode="numeric"
              placeholder="Solo números · será tu usuario"
              value={form.dni}
              onChange={setNum('dni', 10)}
              autoFocus
              required
            />
          </label>
          <label className="full-field">
            Teléfono / WhatsApp
            <input
              inputMode="tel"
              placeholder="Ej: 11 5555-5555"
              value={form.telefono}
              onChange={set('telefono')}
            />
          </label>
          <label>
            Nombre
            <input placeholder="Ej.: Ana" value={form.nombre} onChange={set('nombre')} required />
          </label>
          <label>
            Apellido
            <input placeholder="Ej.: Pérez" value={form.apellido} onChange={set('apellido')} required />
          </label>
          <label className="full-field">
            Correo electrónico <span className="optional">(opcional)</span>
            <input
              type="email"
              placeholder="tu@correo.com · podés usarlo para ingresar"
              value={form.email}
              onChange={set('email')}
            />
          </label>
          <label>
            PIN
            <input
              type={verPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={form.pin}
              onChange={setNum('pin', 4)}
              required
            />
          </label>
          <label>
            Repetir PIN
            <input
              type={verPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={form.pin2}
              onChange={setNum('pin2', 4)}
              required
            />
          </label>
        </div>

        <button type="button" className="show-pin" onClick={() => setVerPin((v) => !v)}>
          {verPin ? <EyeOff size={14} /> : <Eye size={14} />} {verPin ? 'Ocultar' : 'Mostrar'} PIN
        </button>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? 'Creando cuenta…' : 'Crear mi cuenta'}
          {busy && <Loader2 className="animate-spin" />}
        </button>

        <p className="legal-note">
          Si tu DNI ya está registrado no vas a poder duplicar la cuenta: usá
          “¿Olvidaste tu PIN?” en la pantalla de ingreso.
        </p>
      </form>
      <button type="button" className="back-link" onClick={onClose}>
        <ArrowLeft size={14} /> Volver al ingreso
      </button>
    </Dialog>
  )
}

// Recupero de PIN: busca la cuenta por DNI o correo, registra la
// solicitud RESET_PIN en el mostrador y ofrece el WhatsApp oficial.
function DialogRecupero({ onClose }) {
  const { solicitarResetPin, clientes, config } = useKiosco()
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
  const url = resultado && waLink(config.whatsapp, textoResetPin({ nombre, identificador: resultado.dni }))

  return (
    <Dialog
      onClose={onClose}
      icon={KeyRound}
      eyebrow="RECUPERO DE ACCESO"
      title="¿Olvidaste tu PIN?"
      copy="Ingresá tu DNI o correo. Si coincide con una cuenta, dejamos el pedido de restablecimiento en la bandeja del kiosco."
    >
      <form className="form-stack" onSubmit={buscar}>
        <label>
          DNI o correo
          <input
            value={ident}
            onChange={(e) => {
              setIdent(e.target.value)
              setResultado(undefined)
            }}
            placeholder="Ej: 45111222 o tu@correo.com"
            autoFocus
            required
          />
        </label>
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? 'Buscando…' : 'Buscar mi cuenta'}
          {busy && <Loader2 className="animate-spin" />}
        </button>
      </form>

      {resultado === null && (
        <p className="form-error" role="alert">
          <SearchX size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          No encontramos ninguna cuenta con ese dato. Revisalo o consultá en el mostrador.
        </p>
      )}

      {resultado && (
        <>
          <p className="form-notice">
            <CheckCircle2 size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Cuenta encontrada: <b>{nombre}</b> · DNI <b>{resultado.dni}</b>. Tu pedido de
            restablecimiento ya quedó registrado en el kiosco.
          </p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="primary-button whatsapp-link">
            <MessageCircle size={16} /> Enviar pedido por WhatsApp
          </a>
        </>
      )}

      <button type="button" className="back-link" onClick={onClose}>
        <ArrowLeft size={14} /> Volver al ingreso
      </button>
    </Dialog>
  )
}
