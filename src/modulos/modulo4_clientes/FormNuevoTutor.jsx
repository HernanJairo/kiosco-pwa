import { useMemo, useState } from 'react'
import { CheckCircle2, MessageCircle, Plus, Search, Trash2 } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye } from '../../utils/busqueda'
import { textoTutor, waLink } from '../../utils/whatsapp'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import PhoneInput from '../../components/ui/PhoneInput'

const HIJO_INIT = { nombre: '', dni: '', curso: '' }

// Se remonta en cada apertura, así el estado queda limpio.
export default function FormNuevoTutor({ onClose }) {
  const { alumnos, tutores, crearTutor, config, notify } = useKiosco()
  const [form, setForm] = useState({ nombre: '', dni: '', telefono: '', pin: '1234' })
  const [q, setQ] = useState('')
  const [selIds, setSelIds] = useState([])
  const [nuevos, setNuevos] = useState([])
  const [busy, setBusy] = useState(false)
  const [creado, setCreado] = useState(null) // { tutor, hijos: [alumno] }

  const candidatos = useMemo(
    () =>
      alumnos.filter((a) =>
        incluye(`${a.nombre} ${a.apellido} ${a.dni} ${a.curso}`, q)
      ),
    [alumnos, q]
  )
  const tutorDe = (a) => tutores.find((t) => t.id === a.tutorId)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggleHijo = (id) =>
    setSelIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const setNuevo = (i, k, v) =>
    setNuevos((arr) => arr.map((h, j) => (j === i ? { ...h, [k]: v } : h)))

  const guardar = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { tutor, alumnos: creados } = await crearTutor({
        ...form,
        hijosExistentes: selIds,
        hijosNuevos: nuevos,
      })
      const todos = [...alumnos, ...creados]
      setCreado({
        tutor,
        hijos: tutor.hijos.map((id) => todos.find((a) => a.id === id)).filter(Boolean),
      })
      notify(`Tutor "${tutor.nombre}" registrado con ${tutor.hijos.length} hijo(s) a cargo.`)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (creado) {
    const { tutor, hijos } = creado
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>
            <b>{tutor.nombre}</b>
            {tutor.dni ? ` · DNI ${tutor.dni}` : ''} · PIN <b>{tutor.pin}</b>
            {tutor.telefono ? ` · +${tutor.telefono}` : ''}
            <br />
            {hijos.length
              ? `Hijos a cargo: ${hijos.map((h) => `${h.nombre} ${h.apellido} (${h.curso})`).join(', ')}`
              : 'Sin hijos vinculados todavía.'}
          </span>
        </div>
        <a
          href={waLink(tutor.telefono, textoTutor({ tutor, hijos, config }))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <MessageCircle size={17} /> Enviar credenciales por WhatsApp
        </a>
        <p className="text-[11px] text-slate-400">
          {tutor.telefono
            ? 'Se abre el chat del tutor con su usuario (DNI), PIN y el link de la app.'
            : 'Sin teléfono cargado: WhatsApp te deja elegir el contacto al abrirse.'}
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
        label="Nombre completo del tutor *"
        placeholder="Ej.: Carlos González"
        autoFocus
        value={form.nombre}
        onChange={set('nombre')}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="DNI (usuario de ingreso) *"
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
          value={form.pin}
          onChange={(e) =>
            setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))
          }
          required
        />
      </div>
      <PhoneInput
        label="Teléfono / WhatsApp del tutor"
        value={form.telefono}
        onChange={(v) => setForm((f) => ({ ...f, telefono: v }))}
      />

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Hijos a cargo {selIds.length + nuevos.length > 0 && `· ${selIds.length + nuevos.length}`}
        </p>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar alumno ya registrado por nombre, DNI o curso…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <ul className="flex max-h-36 flex-col gap-1 overflow-y-auto">
          {candidatos.length === 0 ? (
            <li className="px-1 py-2 text-xs text-slate-400">Sin resultados para “{q}”.</li>
          ) : (
            candidatos.map((a) => {
              const otro = tutorDe(a)
              return (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white">
                    <input
                      type="checkbox"
                      checked={selIds.includes(a.id)}
                      onChange={() => toggleHijo(a.id)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-700">
                      <b className="font-medium">{a.nombre} {a.apellido}</b>
                      <span className="text-xs text-slate-400"> · {a.curso} · DNI {a.dni}</span>
                    </span>
                    {otro && <Badge tone="amber">Tutor: {otro.nombre}</Badge>}
                  </label>
                </li>
              )
            })
          )}
        </ul>

        {nuevos.map((h, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-dashed border-emerald-300 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-700">Hijo nuevo #{i + 1}</p>
              <button
                type="button"
                onClick={() => setNuevos((arr) => arr.filter((_, j) => j !== i))}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                aria-label="Quitar hijo nuevo"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <Input
              placeholder="Nombre completo *"
              value={h.nombre}
              onChange={(e) => setNuevo(i, 'nombre', e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="DNI *"
                inputMode="numeric"
                value={h.dni}
                onChange={(e) => setNuevo(i, 'dni', e.target.value.replace(/\D/g, ''))}
              />
              <Input
                placeholder="Curso (ej.: 5° 2da) *"
                value={h.curso}
                onChange={(e) => setNuevo(i, 'curso', e.target.value)}
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setNuevos((arr) => [...arr, { ...HIJO_INIT }])}
        >
          <Plus size={14} /> Agregar alumno que aún no está registrado
        </Button>
      </div>

      <p className="text-[11px] text-slate-400">
        Los hijos marcados quedan vinculados a este tutor (si tenían otro, se reasignan). Los
        alumnos nuevos se crean con PIN igual a los últimos 4 dígitos de su DNI.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar Tutor'}
        </Button>
      </div>
    </form>
  )
}
