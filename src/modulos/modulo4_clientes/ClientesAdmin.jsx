import { useMemo, useState } from 'react'
import { CheckCircle2, HandCoins, KeyRound, Medal, MessageCircle, Search, UserPlus, Users, Wallet } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye } from '../../utils/busqueda'
import { formatearDivision, money } from '../../utils/format'
import { telefonoInternacional, textoAcceso, textoTutor, waLink } from '../../utils/whatsapp'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import PhoneInput from '../../components/ui/PhoneInput'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'
import FormNuevoTutor from './FormNuevoTutor'

const MEDAL = ['text-amber-500', 'text-slate-400', 'text-amber-700']

export default function ClientesAdmin() {
  const { alumnos, tutores, registrarPago, recargarSaldo, crearAlumno, updateAlumno, updateTutor, config, notify } = useKiosco()
  const [q, setQ] = useState('')
  const [soloDeuda, setSoloDeuda] = useState(false)
  const [pagoDe, setPagoDe] = useState(null)
  const [recargaDe, setRecargaDe] = useState(null)
  const [altaOpen, setAltaOpen] = useState(false)
  const [altaTutorOpen, setAltaTutorOpen] = useState(false)
  const [accesoDe, setAccesoDe] = useState(null) // { tipo: 'alumno'|'tutor', entidad }
  const [vista, setVista] = useState('alumnos') // 'alumnos' | 'tutores'
  const [monto, setMonto] = useState('')
  const [busy, setBusy] = useState(false)

  const ranking = useMemo(
    () => [...alumnos].sort((a, b) => b.deuda - a.deuda),
    [alumnos]
  )
  const list = ranking.filter(
    (a) =>
      (!soloDeuda || a.deuda > 0) &&
      incluye(`${a.nombre} ${a.apellido} ${a.dni} ${a.curso}`, q)
  )

  const deudaTotal = alumnos.reduce((s, a) => s + a.deuda, 0)
  const conDeuda = alumnos.filter((a) => a.deuda > 0).length
  const tutorDe = (a) => tutores.find((t) => t.id === a.tutorId)

  const abrir = (a, tipo) => {
    setMonto(tipo === 'pago' ? String(a.deuda || '') : '')
    if (tipo === 'pago') setPagoDe(a)
    else setRecargaDe(a)
  }

  const confirmar = async (e) => {
    e.preventDefault()
    const a = pagoDe || recargaDe
    setBusy(true)
    try {
      if (pagoDe) {
        await registrarPago(a.id, Number(monto), 'kiosco')
        notify(`Pago de ${money(Number(monto))} registrado a ${a.nombre}.`)
        setPagoDe(null)
      } else {
        await recargarSaldo(a.id, Number(monto))
        notify(`Saldo de ${a.nombre} recargado en ${money(Number(monto))}.`)
        setRecargaDe(null)
      }
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const target = pagoDe || recargaDe

  const hijosDe = (t) => t.hijos.map((id) => alumnos.find((a) => a.id === id)).filter(Boolean)
  const listTutores = tutores.filter((t) =>
    incluye(
      `${t.nombre} ${t.dni || ''} ${t.telefono || ''} ${hijosDe(t)
        .map((h) => `${h.nombre} ${h.apellido}`)
        .join(' ')}`,
      q
    )
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex w-fit gap-1 rounded-xl bg-slate-200/60 p-1">
        {[
          ['alumnos', 'Alumnos'],
          ['tutores', 'Tutores'],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setVista(k)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              vista === k ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === 'tutores' ? (
        <Card
          title="Tutores y familias"
          subtitle={`${tutores.length} tutor(es) · ${alumnos.filter((a) => a.tutorId).length} alumnos vinculados`}
          actions={
            <Button size="sm" onClick={() => setAltaTutorOpen(true)} className="shrink-0">
              <UserPlus size={14} /> Nuevo Tutor
            </Button>
          }
        >
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por tutor, DNI, teléfono o hijo…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {listTutores.length === 0 ? (
            <EmptyState icon={Users} title="Sin tutores" sub="Dá de alta un tutor para vincularle alumnos." />
          ) : (
            <ul className="flex flex-col gap-2">
              {listTutores.map((t) => {
                const hijos = hijosDe(t)
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{t.nombre}</p>
                      <p className="text-xs text-slate-400">
                        {t.dni ? `DNI ${t.dni}` : 'Sin DNI'}
                        {t.telefono ? ` · +${telefonoInternacional(t.telefono)}` : ' · Sin teléfono'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {hijos.length === 0 ? (
                          <span className="text-[11px] text-slate-300">Sin hijos vinculados</span>
                        ) : (
                          hijos.map((h) => (
                            <Badge key={h.id} tone="slate">
                              {h.nombre} {h.apellido} · {h.curso}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setAccesoDe({ tipo: 'tutor', entidad: t })}
                      title="Gestionar Acceso / PIN"
                    >
                      <KeyRound size={13} /> Acceso
                    </Button>
                    {t.telefono && (
                      <a
                        href={waLink(t.telefono, textoTutor({ tutor: t, hijos, config }))}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar credenciales por WhatsApp"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      ) : (
      <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => setSoloDeuda(false)} className="text-left" title="Ver todos los alumnos">
          <StatCard
            icon={HandCoins}
            tone="rose"
            label="Deuda total de fiados"
            value={money(deudaTotal)}
            sub={soloDeuda ? 'Clic para ver todos' : undefined}
            className={!soloDeuda ? 'ring-2 ring-emerald-300' : ''}
          />
        </button>
        <button type="button" onClick={() => setSoloDeuda((v) => !v)} className="text-left" title={soloDeuda ? 'Quitar filtro' : 'Filtrar solo con deuda'}>
          <StatCard
            icon={Medal}
            tone="amber"
            label="Alumnos con deuda"
            value={`${conDeuda} de ${alumnos.length}`}
            sub={soloDeuda ? 'Filtro activo · clic para ver todos' : 'Clic para filtrar'}
            className={soloDeuda ? 'ring-2 ring-amber-400' : ''}
          />
        </button>
        <button type="button" onClick={() => setSoloDeuda(false)} className="text-left" title="Ver todos los alumnos">
          <StatCard
            icon={Wallet}
            tone="emerald"
            label="Saldo total en billeteras"
            value={money(alumnos.reduce((s, a) => s + a.saldo, 0))}
            className={!soloDeuda ? 'ring-2 ring-emerald-300' : ''}
          />
        </button>
      </div>

      <Card
        title="Libreta de Clientes y Cobranza"
        subtitle={soloDeuda ? `Mostrando solo alumnos con deuda (${list.length})` : 'Ranking de deudas de fiados y amortización'}
        actions={
          soloDeuda ? (
            <Button size="sm" variant="secondary" onClick={() => setSoloDeuda(false)}>
              Ver todos
            </Button>
          ) : null
        }
      >
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, DNI o curso…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <Button size="sm" onClick={() => setAltaOpen(true)} className="shrink-0">
            <UserPlus size={14} /> Nuevo Alumno
          </Button>
        </div>

        {list.length === 0 ? (
          <EmptyState title="Sin alumnos" />
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((a, idx) => {
              const tutor = tutorDe(a)
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex w-8 justify-center">
                    {a.deuda > 0 && idx < 3 ? (
                      <Medal size={18} className={MEDAL[idx]} />
                    ) : (
                      <span className="text-xs font-bold text-slate-300">#{idx + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{a.nombre} {a.apellido}</p>
                    <p className="text-xs text-slate-400">
                      {a.curso} · DNI {a.dni} {tutor ? `· Tutor: ${tutor.nombre}` : '· Sin tutor'}
                    </p>
                  </div>
                  <Badge tone="emerald">Saldo {money(a.saldo)}</Badge>
                  <Badge tone={a.deuda > 0 ? 'rose' : 'slate'}>Deuda {money(a.deuda)}</Badge>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAccesoDe({ tipo: 'alumno', entidad: a })}
                      title="Gestionar Acceso / PIN"
                      aria-label={`Gestionar acceso de ${a.nombre}`}
                    >
                      <KeyRound size={14} />
                    </Button>
                    {tutor?.telefono && (
                      <a
                        href={waLink(tutor.telefono, textoAcceso({ alumno: a, tutor, config }))}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar acceso por WhatsApp"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                      >
                        <MessageCircle size={13} /> Enviar acceso
                      </a>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => abrir(a, 'recarga')}>
                      <Wallet size={13} /> Recargar
                    </Button>
                    <Button size="sm" variant="success" onClick={() => abrir(a, 'pago')} disabled={a.deuda <= 0}>
                      <HandCoins size={13} /> Registrar pago
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      </>
      )}

      <Modal
        open={!!target}
        onClose={() => { setPagoDe(null); setRecargaDe(null) }}
        title={pagoDe ? 'Registrar pago / cancelar deuda' : 'Recargar saldo'}
      >
        {target && (
          <form onSubmit={confirmar} className="flex flex-col gap-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
              <b>{target.nombre} {target.apellido}</b> · {target.curso}
              <br />
              Deuda: <b className="text-rose-600">{money(target.deuda)}</b> · Saldo: <b className="text-emerald-600">{money(target.saldo)}</b>
            </div>
            <Input
              label={`Monto a ${pagoDe ? 'cobrar' : 'acreditar'} ($)`}
              autoFocus
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
              required
            />
            {pagoDe && (
              <p className="text-[11px] text-slate-400">
                Se aplica primero a los fiados más antiguos; el excedente va al saldo.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => { setPagoDe(null); setRecargaDe(null) }}>
                Cancelar
              </Button>
              <Button type="submit" variant={pagoDe ? 'success' : 'primary'} disabled={busy}>
                {busy ? 'Procesando…' : 'Confirmar'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal open={altaOpen} onClose={() => setAltaOpen(false)} title="Nuevo alumno">
        {altaOpen && <FormNuevoAlumno crearAlumno={crearAlumno} alumnos={alumnos} config={config} notify={notify} onClose={() => setAltaOpen(false)} />}
      </Modal>
      <Modal open={altaTutorOpen} onClose={() => setAltaTutorOpen(false)} title="Nuevo tutor" wide>
        {altaTutorOpen && <FormNuevoTutor onClose={() => setAltaTutorOpen(false)} />}
      </Modal>
      <Modal open={!!accesoDe} onClose={() => setAccesoDe(null)} title="Gestionar Acceso / PIN">
        {accesoDe && (
          <FormAcceso
            target={accesoDe}
            tutores={tutores}
            alumnos={alumnos}
            config={config}
            updateAlumno={updateAlumno}
            updateTutor={updateTutor}
            notify={notify}
            onClose={() => setAccesoDe(null)}
          />
        )}
      </Modal>
    </div>
  )
}

// Modal "Gestionar Acceso / PIN": muestra el usuario y el PIN vigente de
// un alumno o tutor, permite asignar uno nuevo de 4 dígitos y enviar las
// credenciales normalizadas por WhatsApp (al tutor o al propio usuario).
function FormAcceso({ target, tutores, alumnos, config, updateAlumno, updateTutor, notify, onClose }) {
  const { tipo, entidad } = target
  const esAlumno = tipo === 'alumno'
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [waUrl, setWaUrl] = useState(null) // fallback si el navegador bloquea el pop-up

  const tutorDelAlumno = esAlumno ? tutores.find((t) => t.id === entidad.tutorId) : null
  const nombre = esAlumno ? `${entidad.nombre} ${entidad.apellido}` : entidad.nombre
  const usuario = esAlumno
    ? entidad.dni
    : entidad.dni || entidad.usuario || telefonoInternacional(entidad.telefono) || '—'
  const destino = esAlumno
    ? tutorDelAlumno?.telefono || entidad.telefono || ''
    : entidad.telefono || ''

  const pinValido = /^\d{4}$/.test(pin)

  const textoWa = () =>
    esAlumno
      ? textoAcceso({ alumno: { ...entidad, pin }, tutor: tutorDelAlumno, config })
      : textoTutor({
          tutor: { ...entidad, pin },
          hijos: entidad.hijos.map((id) => alumnos.find((a) => a.id === id)).filter(Boolean),
          config,
        })

  const guardar = async (enviar) => {
    if (!pinValido) return notify('El PIN debe tener exactamente 4 dígitos.', 'error')
    setBusy(true)
    try {
      if (esAlumno) await updateAlumno(entidad.id, { pin })
      else await updateTutor(entidad.id, { pin })
      notify(`PIN de ${nombre} actualizado.`)
      if (enviar) {
        const url = waLink(destino, textoWa())
        const w = window.open(url, '_blank', 'noopener,noreferrer')
        if (!w) setWaUrl(url)
      } else {
        onClose()
      }
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
        <b>{nombre}</b> · {esAlumno ? entidad.curso : 'Tutor'}
        <br />
        Usuario: <b>{usuario}</b> · PIN actual: <b className="font-mono">{entidad.pin}</b>
      </div>
      <Input
        label="Nuevo PIN (4 dígitos)"
        inputMode="numeric"
        maxLength={4}
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder={entidad.pin}
        required
      />
      {waUrl ? (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <MessageCircle size={17} /> Abrir WhatsApp con las credenciales
        </a>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => guardar(false)}>
            Guardar PIN
          </Button>
          <Button type="button" variant="success" disabled={busy || !pinValido} onClick={() => guardar(true)}>
            <MessageCircle size={15} /> {busy ? 'Actualizando…' : 'Actualizar y Enviar por WhatsApp'}
          </Button>
        </div>
      )}
      <p className="text-[11px] text-slate-400">
        {destino
          ? `El mensaje se envía a +${telefonoInternacional(destino)} con el usuario y el PIN nuevo.`
          : 'Sin teléfono cargado: WhatsApp te deja elegir el contacto al abrirse.'}
      </p>
      {waUrl && (
        <Button variant="secondary" onClick={onClose} className="w-full">
          Listo
        </Button>
      )}
    </div>
  )
}

const ALTA_INIT = {
  nombreCompleto: '',
  dni: '',
  anio: '',
  division: '',
  telefono: '',
  tutorNombre: '',
  tutorTelefono: '',
  pin: '',
  limiteFiado: '10000',
}

// Formulario de alta. Se remonta en cada apertura, así el estado queda limpio.
function FormNuevoAlumno({ crearAlumno, alumnos, config, notify, onClose }) {
  const [form, setForm] = useState(ALTA_INIT)
  const [pinManual, setPinManual] = useState(false)
  const [busy, setBusy] = useState(false)
  const [creado, setCreado] = useState(null) // {alumno, tutor}

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const pinSugerido = form.dni.length >= 4 ? form.dni.slice(-4) : '1234'
  const pin = pinManual ? form.pin : pinSugerido

  const guardar = async (e) => {
    e.preventDefault()
    const dni = form.dni.trim()
    if (alumnos.some((a) => a.dni === dni)) {
      return notify(`Ya existe un alumno registrado con DNI ${dni}.`, 'error')
    }
    if (!/^\d{4}$/.test(pin)) return notify('El PIN debe tener exactamente 4 dígitos.', 'error')

    const partes = form.nombreCompleto.trim().split(/\s+/).filter(Boolean)
    const apellido = partes.length > 1 ? partes.pop() : ''
    const curso = `${form.anio.trim()}° ${form.division.trim()}`

    setBusy(true)
    try {
      const res = await crearAlumno({
        nombre: partes.join(' '),
        apellido,
        dni,
        curso,
        pin,
        telefono: form.telefono,
        tutorNombre: form.tutorNombre,
        tutorTelefono: form.tutorTelefono,
        limiteFiado: Number(form.limiteFiado) || 0,
      })
      setCreado(res)
      notify(`Alta registrada: ${res.alumno.nombre} ${res.alumno.apellido} · ${res.alumno.curso}.`)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (creado) {
    const { alumno: a, tutor } = creado
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>
            <b>{a.nombre} {a.apellido}</b> · {a.curso}
            <br />
            DNI <b>{a.dni}</b> · PIN <b>{a.pin}</b> · Límite de fiado {money(a.limiteFiado)}
            <br />
            {tutor ? `Tutor: ${tutor.nombre}${tutor.telefono ? ` · ${tutor.telefono}` : ''}` : 'Sin tutor cargado'}
          </span>
        </div>
        <a
          href={waLink(tutor?.telefono || '', textoAcceso({ alumno: a, tutor, config }))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <MessageCircle size={17} /> Enviar acceso por WhatsApp
        </a>
        <p className="text-[11px] text-slate-400">
          {tutor?.telefono
            ? 'Se abre el chat con el tutor para enviarle el DNI, el PIN y el link de la app.'
            : 'Sin teléfono de tutor: WhatsApp te deja elegir el contacto al abrirse.'}
        </p>
        <Button variant="secondary" onClick={onClose} className="w-full">
          Listo
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <Input
        label="Nombre completo del alumno *"
        placeholder="Ej.: Ana María Pérez"
        autoFocus
        value={form.nombreCompleto}
        onChange={set('nombreCompleto')}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="DNI *"
          inputMode="numeric"
          placeholder="Solo números"
          value={form.dni}
          onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value.replace(/\D/g, '') }))}
          required
        />
        <Input
          label="PIN inicial (4 dígitos) *"
          inputMode="numeric"
          maxLength={4}
          placeholder={pinSugerido}
          value={pin}
          onChange={(e) => {
            setPinManual(true)
            setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))
          }}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Año / grado *"
          placeholder="Ej.: 4"
          value={form.anio}
          onChange={set('anio')}
          required
        />
        <Input
          label="División *"
          placeholder="Ej.: B o 2"
          value={form.division}
          onChange={(e) =>
            setForm((f) => ({ ...f, division: formatearDivision(e.target.value) }))
          }
          required
        />
      </div>
      <p className="-mt-2 text-[11px] text-slate-400">
        División: letra → mayúscula (“b” → “B”), número → ordinal (“2” → “2da”).
      </p>
      <PhoneInput
        label="Teléfono propio del alumno (opcional)"
        value={form.telefono}
        onChange={(v) => setForm((f) => ({ ...f, telefono: v }))}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Nombre del tutor"
          placeholder="Opcional"
          value={form.tutorNombre}
          onChange={set('tutorNombre')}
        />
        <PhoneInput
          label="Teléfono del Tutor / WhatsApp"
          value={form.tutorTelefono}
          onChange={(v) => setForm((f) => ({ ...f, tutorTelefono: v }))}
        />
      </div>
      <Input
        label="Límite de fiado inicial ($)"
        inputMode="numeric"
        value={form.limiteFiado}
        onChange={(e) => setForm((f) => ({ ...f, limiteFiado: e.target.value.replace(/\D/g, '') }))}
      />
      <p className="text-[11px] text-slate-400">
        Si el tutor ya existe (mismo nombre o teléfono), el alumno se vincula a esa cuenta.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Dar de alta'}
        </Button>
      </div>
    </form>
  )
}
