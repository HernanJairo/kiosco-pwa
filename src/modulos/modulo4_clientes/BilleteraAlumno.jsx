import { useState } from 'react'
import { HandCoins, Hourglass, Landmark, NotebookPen, Pencil, RotateCcw, ShoppingBag, Wallet } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import SelectorAvatar from '../../components/ui/SelectorAvatar'
import PagoTransferenciaModal from './PagoTransferenciaModal'
import BannerPinSeguridad from './BannerPinSeguridad'

const MOV_META = {
  fiado: { icon: NotebookPen, bg: 'bg-amber-50 text-amber-600', label: 'Compra fiada' },
  abono: { icon: HandCoins, bg: 'bg-emerald-50 text-emerald-600', label: 'Pago de deuda' },
  recarga: { icon: Wallet, bg: 'bg-emerald-50 text-emerald-600', label: 'Recarga' },
  compra: { icon: ShoppingBag, bg: 'bg-emerald-50 text-emerald-600', label: 'Compra' },
  anulacion: { icon: RotateCcw, bg: 'bg-slate-100 text-slate-500', label: 'Anulación' },
}

export default function BilleteraAlumno() {
  const { alumnoSesion: a, pagosPendientes, updateAlumno } = useKiosco()
  const [pagoOpen, setPagoOpen] = useState(false)
  const [perfilOpen, setPerfilOpen] = useState(false)
  if (!a) return null

  const pendientes = a.fiados.filter((f) => !f.pagado && f.pendiente > 0)
  const saldoFavor = Math.max(0, a.saldo - a.deuda)
  const misPendientes = pagosPendientes.filter((p) => p.alumnoId === a.id)
  const totalPendiente = misPendientes.reduce((s, p) => s + p.monto, 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Primer ingreso: sugerir personalizar el PIN si sigue siendo el de fábrica */}
      <BannerPinSeguridad pin={a.pin} dni={a.dni} onGuardar={(p) => updateAlumno(a.id, { pin: p })} />

      {/* Saludo con perfil personalizable */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setPerfilOpen(true)}
          className="rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          title="Personalizar avatar o foto"
        >
          <AvatarAlumno alumno={a} className="h-14 w-14" emojiClassName="text-3xl" textoClassName="text-base" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-800">Hola, {a.nombre}</p>
          <p className="text-xs text-slate-400">{a.curso} · Tu billetera del kiosco</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setPerfilOpen(true)}>
          <Pencil size={13} /> <span className="hidden sm:inline">Personalizar</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Wallet} tone="emerald" label="Saldo a favor" value={money(saldoFavor)} sub={a.deuda > 0 ? `Neto de ${money(a.deuda)} de deuda` : 'Billetera digital'} />
        <StatCard icon={NotebookPen} tone="rose" label="Deuda fiados" value={money(a.deuda)} sub={`${pendientes.length} compra(s) pendiente(s)`} />
        <StatCard icon={ShoppingBag} tone="emerald" label="Límite diario" value={a.limiteDiario > 0 ? money(a.limiteDiario) : 'Sin límite'} sub="Configurado por tu tutor" />
      </div>

      {totalPendiente > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          <Hourglass size={14} className="shrink-0 text-amber-500" />
          <span>
            Transferencia de <b>{money(totalPendiente)}</b> pendiente de acreditación
            {misPendientes.length > 1 ? ` (${misPendientes.length} avisos)` : ''}
          </span>
        </div>
      )}

      <Card
        title="Libreta de fiados"
        subtitle="Detalle de compras al fiado con saldo pendiente"
        actions={
          <Button variant="success" size="sm" onClick={() => setPagoOpen(true)}>
            <Landmark size={14} /> Pagar / recargar
          </Button>
        }
      >
        {pendientes.length === 0 ? (
          <EmptyState icon={HandCoins} title="No tenés fiados pendientes" sub="Tu libreta está al día." />
        ) : (
          <ul className="flex flex-col gap-2">
            {pendientes.map((f) => (
              <li key={f.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-slate-400">{fmtFechaHora(f.fecha)}</p>
                  <Badge tone="amber">Pendiente {money(f.pendiente)}</Badge>
                </div>
                <ul className="mt-2 flex flex-col gap-0.5">
                  {f.items.map((it, i) => (
                    <li key={i} className="flex justify-between text-sm text-slate-600">
                      <span>{it.cantidad}× {it.nombre}</span>
                      <span className="font-medium">{money(it.precio * it.cantidad)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex justify-between border-t border-dashed border-slate-200 pt-2 text-sm font-bold">
                  <span>Total fiado</span>
                  <span className="text-amber-600">{money(f.monto)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Historial de movimientos" subtitle="Compras, abonos de deuda y recargas">
        {a.movimientos.length === 0 ? (
          <EmptyState title="Sin movimientos todavía" />
        ) : (
          <ul className="flex flex-col">
            {a.movimientos.map((m) => {
              const meta = MOV_META[m.tipo] || MOV_META.compra
              const Icon = meta.icon
              return (
                <li key={m.id} className="flex items-center gap-3 border-b border-slate-50 py-3 last:border-0">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{m.detalle}</p>
                    <p className="text-xs text-slate-400">{fmtFechaHora(m.fecha)}</p>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      m.monto < 0 ? 'text-emerald-600' : m.tipo === 'recarga' ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {m.monto < 0 ? '− ' : '+ '}{money(Math.abs(m.monto))}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <PagoTransferenciaModal
        alumno={a}
        origen="alumno"
        open={pagoOpen}
        onClose={() => setPagoOpen(false)}
      />

      <Modal open={perfilOpen} onClose={() => setPerfilOpen(false)} title="Tu avatar y foto" wide>
        <SelectorAvatar alumno={a} />
      </Modal>
    </div>
  )
}
