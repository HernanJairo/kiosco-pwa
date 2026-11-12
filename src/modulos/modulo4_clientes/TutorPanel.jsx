import { useMemo, useState } from 'react'
import { FileUp, HandCoins, Hourglass, NotebookPen, ShieldCheck, Wallet } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'
import PagoTransferenciaModal from './PagoTransferenciaModal'
import BannerPinSeguridad from './BannerPinSeguridad'

export default function TutorPanel() {
  const { tutorSesion, alumnos, ventas, pagosPendientes, setLimiteDiario, updateTutor, notify } = useKiosco()
  const hijos = useMemo(
    () => (tutorSesion ? alumnos.filter((a) => tutorSesion.hijos.includes(a.id)) : []),
    [tutorSesion, alumnos]
  )
  const [sel, setSel] = useState(null)
  const [pagoOpen, setPagoOpen] = useState(false)
  const [limiteEdit, setLimiteEdit] = useState(null)

  const hijo = hijos.find((a) => a.id === (sel ?? hijos[0]?.id))
  if (!tutorSesion || !hijo) return <EmptyState title="No hay alumnos a cargo" />

  const comprasHijo = ventas.filter((v) => v.alumnoId === hijo.id && !v.anulada)
  const pendientesHijo = pagosPendientes.filter((p) => p.alumnoId === hijo.id)
  const totalPendienteHijo = pendientesHijo.reduce((s, p) => s + p.monto, 0)

  const guardarLimite = async () => {
    await setLimiteDiario(hijo.id, Number(limiteEdit))
    setLimiteEdit(null)
    notify(`Límite diario de ${hijo.nombre} actualizado.`)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Primer ingreso: sugerir personalizar el PIN si sigue siendo el de fábrica */}
      <BannerPinSeguridad
        pin={tutorSesion.pin}
        dni={tutorSesion.dni}
        onGuardar={(p) => updateTutor(tutorSesion.id, { pin: p })}
      />

      {/* Selector de alumnos a cargo */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {hijos.map((a) => (
          <button
            key={a.id}
            onClick={() => setSel(a.id)}
            className={`min-w-44 rounded-2xl border p-4 text-left transition-all ${
              a.id === hijo.id
                ? 'border-emerald-400 bg-emerald-50 shadow-sm ring-2 ring-emerald-100'
                : 'border-slate-200 bg-white hover:border-emerald-200'
            }`}
          >
            <p className="text-sm font-bold text-slate-800">{a.nombre} {a.apellido}</p>
            <p className="text-xs text-slate-400">{a.curso} · DNI {a.dni}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone="emerald">Saldo {money(a.saldo)}</Badge>
              {a.deuda > 0 && <Badge tone="rose">Debe {money(a.deuda)}</Badge>}
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Wallet} tone="emerald" label={`Saldo de ${hijo.nombre}`} value={money(hijo.saldo)} />
        <StatCard icon={NotebookPen} tone="rose" label="Deuda acumulada" value={money(hijo.deuda)} sub={`${hijo.fiados.filter((f) => !f.pagado).length} fiado(s) abierto(s)`} />
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Límite de gasto diario</p>
            {limiteEdit === null ? (
              <button onClick={() => setLimiteEdit(String(hijo.limiteDiario))} className="text-lg font-bold text-slate-800 hover:text-emerald-600">
                {hijo.limiteDiario > 0 ? money(hijo.limiteDiario) : 'Sin límite'}
                <span className="ml-1 text-[10px] font-normal text-emerald-500">editar</span>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={limiteEdit}
                  onChange={(e) => setLimiteEdit(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && guardarLimite()}
                  inputMode="numeric"
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
                <Button size="sm" onClick={guardarLimite}>OK</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {totalPendienteHijo > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          <Hourglass size={14} className="shrink-0 text-amber-500" />
          <span>
            Transferencia de <b>{money(totalPendienteHijo)}</b> pendiente de acreditación
            {pendientesHijo.length > 1 ? ` (${pendientesHijo.length} avisos)` : ''}
          </span>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="success" onClick={() => setPagoOpen(true)}>
          <FileUp size={16} /> Pagar deuda / recargar por transferencia
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Fiados pendientes" subtitle={`Compras al fiado de ${hijo.nombre}`}>
          {hijo.fiados.filter((f) => !f.pagado).length === 0 ? (
            <EmptyState icon={HandCoins} title="Sin fiados pendientes" />
          ) : (
            <ul className="flex flex-col gap-2">
              {hijo.fiados.filter((f) => !f.pagado).map((f) => (
                <li key={f.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">{fmtFechaHora(f.fecha)}</p>
                    <Badge tone="amber">Pendiente {money(f.pendiente)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {f.items.map((it) => `${it.cantidad}× ${it.nombre}`).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Historial de compras" subtitle="Auditoría de consumo en el kiosco">
          {comprasHijo.length === 0 ? (
            <EmptyState title="Sin compras registradas" />
          ) : (
            <ul className="flex flex-col">
              {comprasHijo.map((v) => (
                <li key={v.id} className="border-b border-slate-50 py-3 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-400">{fmtFechaHora(v.fecha)}</p>
                    <div className="flex items-center gap-2">
                      <Badge tone={v.metodo === 'fiado' ? 'amber' : v.metodo === 'transferencia' ? 'indigo' : 'emerald'}>
                        {v.metodo}
                      </Badge>
                      <span className="text-sm font-bold text-slate-800">{money(v.total)}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {v.items.map((it) => `${it.cantidad}× ${it.nombre}`).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <PagoTransferenciaModal
        alumno={hijo}
        origen="tutor"
        open={pagoOpen}
        onClose={() => setPagoOpen(false)}
      />
    </div>
  )
}
