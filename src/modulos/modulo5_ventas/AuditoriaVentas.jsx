import { useMemo, useState } from 'react'
import { Ban, Receipt } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { esHoy, fmtFechaHora, money } from '../../utils/format'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import StatCard from '../../components/ui/StatCard'

const METODO_TONE = { efectivo: 'emerald', transferencia: 'indigo', fiado: 'amber' }
const METODO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', fiado: 'Cta. Corriente' }

export default function AuditoriaVentas() {
  const { ventas, anularVenta, notify } = useKiosco()
  const [metodo, setMetodo] = useState('todas')
  const [soloHoy, setSoloHoy] = useState(true)
  const [anulando, setAnulando] = useState(null)
  const [busy, setBusy] = useState(false)

  const list = useMemo(
    () =>
      ventas.filter(
        (v) => (metodo === 'todas' || v.metodo === metodo) && (!soloHoy || esHoy(v.fecha))
      ),
    [ventas, metodo, soloHoy]
  )

  const totalListado = list
    .filter((v) => !v.anulada && v.estado !== 'en_espera_transferencia')
    .reduce((s, v) => s + v.total, 0)

  const confirmarAnulacion = async () => {
    setBusy(true)
    try {
      await anularVenta(anulando.id)
      notify('Venta anulada: stock y deuda revertidos.', 'info')
      setAnulando(null)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <StatCard
        icon={Receipt}
        tone="emerald"
        label={`Total listado (${list.filter((v) => !v.anulada && v.estado !== 'en_espera_transferencia').length} ventas válidas)`}
        value={money(totalListado)}
      />

      <Card title="Auditoría de Ventas" subtitle="Historial de transacciones con opción de anulación">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[
            { k: 'todas', label: 'Todos los métodos' },
            { k: 'efectivo', label: 'Efectivo' },
            { k: 'transferencia', label: 'Transferencia' },
            { k: 'fiado', label: 'Fiado' },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setMetodo(f.k)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                metodo === f.k ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
              }`}
            >
              {f.label}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={soloHoy}
              onChange={(e) => setSoloHoy(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Solo de hoy
          </label>
        </div>

        {list.length === 0 ? (
          <EmptyState icon={Receipt} title="Sin ventas" sub="No hay transacciones para los filtros elegidos." />
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((v) => (
              <li
                key={v.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
                  v.anulada ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-slate-400">
                      #{v.id.slice(0, 8).toUpperCase()} · {fmtFechaHora(v.fecha)}
                    </p>
                    {v.anulada && <Badge tone="slate">Anulada</Badge>}
                    {!v.anulada && v.estado === 'en_espera_transferencia' && (
                      <Badge tone="amber">En espera de transferencia</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-600">
                    {v.items.map((it) => `${it.cantidad}× ${it.nombre}`).join(' · ')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Atendió {v.vendedor}
                    {v.clienteNombre ? ` · Cliente: ${v.clienteNombre}` : ''}
                  </p>
                </div>
                <Badge tone={METODO_TONE[v.metodo]}>{METODO_LABEL[v.metodo]}</Badge>
                <span className={`w-20 text-right text-sm font-bold ${v.anulada ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                  {money(v.total)}
                </span>
                <Button variant="ghost" size="sm" disabled={v.anulada} onClick={() => setAnulando(v)} className="text-rose-500 hover:bg-rose-50">
                  <Ban size={14} /> Anular
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!anulando} onClose={() => setAnulando(null)} title="Anular venta">
        {anulando && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              ¿Anular la venta <b>#{anulando.id.slice(0, 8).toUpperCase()}</b> por{' '}
              <b className="text-slate-800">{money(anulando.total)}</b>? Se restaurará el stock
              {anulando.metodo === 'fiado' ? ' y se revertirá la deuda del cliente' : ''}.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAnulando(null)}>Cancelar</Button>
              <Button variant="danger" onClick={confirmarAnulacion} disabled={busy}>
                <Ban size={14} /> {busy ? 'Anulando…' : 'Anular venta'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
