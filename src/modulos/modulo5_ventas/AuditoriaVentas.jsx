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

const METODO_TONE = { efectivo: 'emerald', transferencia: 'indigo', saldo: 'brand', fiado: 'amber' }
const METODO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', saldo: 'Billetera', fiado: 'Cta. Corriente' }

export default function AuditoriaVentas() {
  const { ventas, session, personal, anularVenta, notify } = useKiosco()
  const [metodo, setMetodo] = useState('todas')
  const [soloHoy, setSoloHoy] = useState(true)
  const [anulando, setAnulando] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [busy, setBusy] = useState(false)

  // Vista por rol: el vendedor ve exclusivamente las ventas de su
  // sesión (matcheo por nombre completo, usuario o nombre de pila,
  // cubriendo ventas viejas registradas con otro formato); el admin
  // conserva la auditoría global de todas las sesiones.
  const esVendedor = session?.rol === 'vendedor'

  const list = useMemo(() => {
    const p = esVendedor ? (personal || []).find((x) => x.id === session?.id) : null
    const alias = esVendedor
      ? [session?.nombre, p?.usuario, p?.nombre].filter(Boolean)
      : []
    return ventas.filter(
      (v) =>
        (!esVendedor || alias.includes(v.vendedor)) &&
        (metodo === 'todas' || v.metodo === metodo) &&
        (!soloHoy || esHoy(v.fecha))
    )
  }, [ventas, metodo, soloHoy, esVendedor, session?.id, session?.nombre, personal])

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
        tone="brand"
        label={`${esVendedor ? 'Total vendido por vos' : 'Total listado'} (${list.filter((v) => !v.anulada && v.estado !== 'en_espera_transferencia').length} ventas válidas)`}
        value={money(totalListado)}
      />

      <Card
        title={esVendedor ? 'Mis Ventas' : 'Auditoría de Ventas'}
        subtitle={
          esVendedor
            ? 'Las operaciones que registraste en tu sesión · tocá una para ver el detalle'
            : 'Historial de transacciones de todas las sesiones · tocá una para ver el detalle'
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[
            { k: 'todas', label: 'Todos los métodos' },
            { k: 'efectivo', label: 'Efectivo' },
            { k: 'transferencia', label: 'Transferencia' },
            { k: 'saldo', label: 'Billetera' },
            { k: 'fiado', label: 'Fiado' },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setMetodo(f.k)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                metodo === f.k ? 'bg-[#009DE0] text-white' : 'bg-[#F6F6F6] text-slate-600 hover:bg-[#EBF7FD] hover:text-[#007AB8]'
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
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Solo de hoy
          </label>
        </div>

        {list.length === 0 ? (
          <EmptyState icon={Receipt} title="Sin ventas" sub={esVendedor ? 'Todavía no registraste ventas con estos filtros.' : 'No hay transacciones para los filtros elegidos.'} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {list.map((v) => (
              <li
                key={v.id}
                onClick={() => setDetalle(v)}
                className={`flex cursor-pointer flex-col gap-2.5 rounded-2xl px-4 py-3.5 transition-all duration-150 hover:ring-1 hover:ring-[#009DE0]/30 ${
                  v.anulada ? 'bg-[#F6F6F6] opacity-60' : 'bg-white shadow-soft'
                }`}
              >
                {/* Cabecera: orden/fecha + estado */}
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-slate-400">
                    #{v.id.slice(0, 8).toUpperCase()} · {fmtFechaHora(v.fecha)}
                  </p>
                  <span className="ml-auto flex items-center gap-1.5">
                    {v.anulada && <Badge tone="slate">Anulada</Badge>}
                    {!v.anulada && v.estado === 'en_espera_transferencia' && (
                      <Badge tone="amber">En espera</Badge>
                    )}
                    <Badge tone={METODO_TONE[v.metodo]}>{METODO_LABEL[v.metodo]}</Badge>
                  </span>
                </div>

                {/* Detalle de ítems */}
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-slate-600">
                    {v.items.map((it) => `${it.cantidad}× ${it.nombre}`).join(' · ')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Atendió {v.vendedor}
                    {v.clienteNombre ? ` · Cliente: ${v.clienteNombre}` : ''}
                  </p>
                </div>

                {/* Pie: monto grande + acción */}
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
                  <span className={`text-lg font-extrabold tracking-tight ${v.anulada ? 'text-slate-400 line-through' : 'text-[#202125]'}`}>
                    {money(v.total)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={v.anulada}
                    onClick={(e) => { e.stopPropagation(); setAnulando(v) }}
                    className="rounded-full text-rose-500 hover:bg-rose-50"
                  >
                    <Ban size={14} /> Anular
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Detalle completo de la venta al tocar la tarjeta */}
      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={detalle ? `Venta #${detalle.id.slice(0, 8).toUpperCase()}` : ''}>
        {detalle && (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-medium text-slate-400">
              {fmtFechaHora(detalle.fecha)} · Atendió {detalle.vendedor}
            </p>
            <ul className="flex flex-col divide-y divide-slate-100 rounded-2xl bg-[#F6F6F6] px-4">
              {detalle.items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{it.cantidad}× {it.nombre}</span>
                  <span className="shrink-0 font-semibold text-[#202125]">{money(it.precio * it.cantidad)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 py-2.5 text-sm font-extrabold">
                <span className="text-slate-500">Total</span>
                <span className="text-[#009DE0]">{money(detalle.total)}</span>
              </li>
            </ul>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <Badge tone={METODO_TONE[detalle.metodo]}>{METODO_LABEL[detalle.metodo]}</Badge>
              {detalle.anulada && <Badge tone="slate">Anulada</Badge>}
              {!detalle.anulada && detalle.estado === 'en_espera_transferencia' && (
                <Badge tone="amber">En espera</Badge>
              )}
            </div>
            <p className="text-sm text-slate-600">
              Cliente: <b className="text-[#202125]">{detalle.clienteNombre || 'Consumidor final'}</b>
            </p>
            {detalle.retiradoPor && (
              <p className="text-sm text-slate-600">Retiró: <b className="text-[#202125]">{detalle.retiradoPor}</b></p>
            )}
          </div>
        )}
      </Modal>

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
