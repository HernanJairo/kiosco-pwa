import { useMemo, useState } from 'react'
import {
  ArrowDownLeft, ArrowRight, Clock3, History, PackageCheck,
  RotateCcw, ShieldCheck, Store, UserCheck, Wallet,
} from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import {
  ESTADO_ENCARGO_LABEL, FILTROS_HISTORIAL, METODO_LABEL, historialDe,
} from '../../utils/historial'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import './BilleteraCliente.css'

// Ícono + tono de cada fila según el tipo de operación (mismas clases
// pastel del diseño v0: purchase/topup/transfer).
const ICONO_TIPO = {
  compra: { cls: 'transaction-purchase', Icon: Store },
  encargo: { cls: 'transaction-transfer', Icon: PackageCheck },
  recarga: { cls: 'transaction-topup', Icon: ArrowDownLeft },
  abono: { cls: 'transaction-topup', Icon: Wallet },
  anulacion: { cls: 'transaction-purchase', Icon: RotateCcw },
  seguridad: { cls: 'transaction-transfer', Icon: ShieldCheck },
}

// Contenido compartido: chips de filtro + lista + modal de detalle.
// Lo usa la pestaña Historial del cliente y el modal "Historial" del
// panel de clientes del staff (admin y vendedor solo lectura).
export function HistorialContenido({ cliente }) {
  const { ventas, encargos } = useKiosco()
  const [filtro, setFiltro] = useState('todos')
  const [detalle, setDetalle] = useState(null)

  const items = useMemo(
    () => historialDe({ ventas, encargos, cliente }),
    [ventas, encargos, cliente]
  )
  const list = filtro === 'todos' ? items : items.filter((i) => i.grupo === filtro)

  return (
    <>
      {/* Chips de filtro: Todos · Compras · Encargos · Billetera */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS_HISTORIAL.map((f) => (
          <button
            key={f.k}
            type="button"
            onClick={() => setFiltro(f.k)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95 ${
              filtro === f.k
                ? 'bg-[#009DE0] text-white shadow-sm'
                : 'bg-[#F6F6F6] text-[#555963] hover:bg-[#EBF7FD] hover:text-[#007AB8]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={History} title="Sin operaciones" sub="Todavía no hay movimientos para este filtro." />
      ) : (
        <div className="transaction-list">
          {list.map((item) => {
            const { cls, Icon } = ICONO_TIPO[item.tipo] || ICONO_TIPO.compra
            return (
              <button
                type="button"
                key={item.id}
                className="transaction-row w-full text-left"
                onClick={() => setDetalle(item)}
              >
                <span className={`transaction-icon ${cls}`}><Icon size={18} /></span>
                <div className="transaction-info">
                  <strong>{item.titulo}</strong>
                  <span>{fmtFechaHora(item.fecha)} · {item.subtitulo}</span>
                </div>
                <strong className={`transaction-amount${item.monto > 0 ? ' positive' : ''}`}>
                  {item.monto > 0 ? '+' : '−'}{money(Math.abs(item.monto))}
                </strong>
                <ArrowRight size={15} className="shrink-0 self-center text-slate-300" />
              </button>
            )
          })}
        </div>
      )}

      <DetalleOperacion item={detalle} onClose={() => setDetalle(null)} />
    </>
  )
}

// Detalle completo de la operación: fecha/hora, productos, método de
// pago y quién retiró (titular o tercero autorizado).
function DetalleOperacion({ item, onClose }) {
  if (!item) return null
  const r = item.ref
  const esVenta = item.tipo === 'compra'
  const esEncargo = item.tipo === 'encargo'

  return (
    <Modal open onClose={onClose} title={item.titulo}>
      <div className="flex flex-col gap-4">
        <p className="text-xs font-medium text-slate-400">
          {fmtFechaHora(item.fecha)}
          {esVenta && r.vendedor ? ` · Atendió ${r.vendedor}` : ''}
        </p>

        {(esVenta || esEncargo) && (
          <ul className="flex flex-col divide-y divide-slate-100 rounded-2xl bg-[#F6F6F6] px-4">
            {(r.items || []).map((it, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate text-slate-700">{it.cantidad}× {it.nombre}</span>
                <span className="shrink-0 font-semibold text-[#202125]">{money(it.precio * it.cantidad)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 py-2.5 text-sm font-extrabold">
              <span className="text-slate-500">Total</span>
              <span className="text-[#009DE0]">{money(esVenta ? r.total : r.total)}</span>
            </li>
          </ul>
        )}

        {esEncargo && (r.itemsFaltantes || []).length > 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
            Sin stock se descontó: {r.itemsFaltantes.map((f) => `${f.cantidad}× ${f.nombre}`).join(', ')}.
          </p>
        )}

        <div className="flex flex-col gap-1.5 text-sm text-slate-600">
          {esVenta && (
            <p>Método de pago: <b className="text-[#202125]">{METODO_LABEL[r.metodo] || r.metodo}</b></p>
          )}
          {esVenta && r.clienteNombre && <p>Cliente: <b className="text-[#202125]">{r.clienteNombre}</b></p>}
          {esVenta && r.estado === 'en_espera_transferencia' && (
            <p className="font-semibold text-amber-600">Transferencia en espera de acreditación</p>
          )}
          {esEncargo && <p>Estado: <b className="text-[#202125]">{ESTADO_ENCARGO_LABEL[r.estado] || r.estado}</b></p>}
          {esEncargo && r.preparadoPor && <p>Armó el pedido: <b className="text-[#202125]">{r.preparadoPor}</b></p>}
          {(r.retiradoPor || (esEncargo && r.retiroTercero?.dni)) && (
            <p className="flex items-center gap-1.5">
              <UserCheck size={14} className="text-[#009DE0]" />
              {r.retiradoPor
                ? <>Retiró: <b className="text-[#202125]">{r.retiradoPor}</b></>
                : <>Puede retirar: <b className="text-[#202125]">{r.retiroTercero.nombre} · DNI {r.retiroTercero.dni}</b></>}
            </p>
          )}
          {!esVenta && !esEncargo && <p>{r.detalle}</p>}
        </div>
      </div>
    </Modal>
  )
}

// Pestaña "Historial" exclusiva del rol Cliente: todo su recorrido en
// el kiosco (compras, encargos retirados, cargas y pagos de deuda) con
// la estética de la billetera v0.
export default function HistorialCliente() {
  const { clienteSesion } = useKiosco()
  if (!clienteSesion) return null

  return (
    <div className="wallet-app">
      <div className="wallet-shell">
        <div className="wallet-section-heading orders-heading">
          <div>
            <p className="wallet-eyebrow">TU RECORRIDO</p>
            <h2>Tu historial</h2>
            <p>Todo lo que pasó por tu cuenta en el kiosco.</p>
          </div>
          <span className="order-count-badge"><Clock3 size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Completo</span>
        </div>
        <HistorialContenido cliente={clienteSesion} />
      </div>
    </div>
  )
}

