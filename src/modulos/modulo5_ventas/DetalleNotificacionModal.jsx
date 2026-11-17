import { PackageCheck, ReceiptText, UserRound } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

const METODO_TONE = { efectivo: 'emerald', transferencia: 'indigo', saldo: 'brand', fiado: 'amber' }
const METODO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', saldo: 'Billetera', fiado: 'Cta. Corriente' }

const ESTADO_ENCARGO = {
  en_preparacion: 'En preparación',
  listo_retiro: 'Listo para retirar',
  entregado: 'Retirado',
  cancelado: 'Cancelado',
}

// Detalle al tocar una notificación: si apunta a una venta muestra el
// ticket completo (ítems, cantidades, precio unitario, total, método,
// cliente y vendedor); si apunta a un encargo muestra el pedido; el
// resto de los eventos muestra texto, fecha y autor.
export default function DetalleNotificacionModal({ notif, open, onClose }) {
  const { ventas, encargos } = useKiosco()
  const venta = notif?.ventaId ? (ventas || []).find((v) => v.id === notif.ventaId) : null
  const encargo =
    !venta && notif?.encargoId ? (encargos || []).find((e) => e.id === notif.encargoId) : null
  const items = venta?.items || encargo?.items || []
  const total = venta?.total ?? encargo?.total ?? null

  return (
    <Modal open={open} onClose={onClose} title={venta ? 'Detalle de la venta' : encargo ? 'Detalle del encargo' : 'Detalle del evento'}>
      {notif && (
        <div className="flex flex-col gap-3">
          {/* Texto original del evento + firma temporal */}
          <div className="flex items-start gap-2.5 rounded-xl bg-[#F6F6F6] px-4 py-3">
            <ReceiptText size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="text-[13px] leading-snug text-slate-700">{notif.texto}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {notif.fecha ? fmtFechaHora(notif.fecha) : 'Alerta vigente'}
                {notif.autor && <> · por <b className="font-semibold">{notif.autor}</b></>}
              </p>
            </div>
          </div>

          {(venta || encargo) && (
            <>
              {/* Ticket: ítems con cantidad, precio unitario y subtotal */}
              <ul className="flex flex-col divide-y divide-slate-100 rounded-xl ring-1 ring-inset ring-slate-100">
                {items.map((i) => (
                  <li key={i.productoId || i.nombre} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{i.nombre}</p>
                      <p className="text-[11px] text-slate-400">
                        {i.cantidad}× {money(i.precio)} c/u
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-700">
                      {money(i.precio * i.cantidad)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
                <span className="text-sm font-bold text-slate-800">Total</span>
                <span className="text-lg font-extrabold text-brand">{money(total)}</span>
              </div>

              {/* Ficha de la operación: método, cliente, vendedor, retiro */}
              <div className="flex flex-wrap items-center gap-2">
                {venta && (
                  <Badge tone={METODO_TONE[venta.metodo] || 'slate'}>
                    {METODO_LABEL[venta.metodo] || venta.metodo}
                  </Badge>
                )}
                {venta?.anulada && <Badge tone="rose">Anulada</Badge>}
                {venta?.estado === 'en_espera_transferencia' && <Badge tone="amber">En espera de pago</Badge>}
                {venta?.localCerrado && <Badge tone="slate">Local cerrado</Badge>}
                {encargo && <Badge tone={encargo.estado === 'entregado' ? 'emerald' : encargo.estado === 'cancelado' ? 'rose' : 'brand'}>{ESTADO_ENCARGO[encargo.estado] || encargo.estado}</Badge>}
              </div>

              <div className="flex flex-col gap-1.5 text-[12px] text-slate-500">
                {venta?.clienteNombre && (
                  <p className="flex items-center gap-1.5">
                    <UserRound size={13} className="shrink-0 text-slate-400" />
                    Cliente: <b className="font-semibold text-slate-700">{venta.clienteNombre}</b>
                  </p>
                )}
                {venta?.vendedor && (
                  <p className="flex items-center gap-1.5">
                    <PackageCheck size={13} className="shrink-0 text-slate-400" />
                    Cobró: <b className="font-semibold text-slate-700">{venta.vendedor}</b>
                  </p>
                )}
                {venta?.retiradoPor && (
                  <p className="flex items-center gap-1.5">
                    <PackageCheck size={13} className="shrink-0 text-slate-400" />
                    Retiró la bolsa: <b className="font-semibold text-slate-700">{venta.retiradoPor}</b>
                  </p>
                )}
                {encargo && (
                  <p className="flex items-center gap-1.5">
                    <UserRound size={13} className="shrink-0 text-slate-400" />
                    Cliente: <b className="font-semibold text-slate-700">{encargo.clienteNombre}</b>
                    {encargo.preparadoPor && <> · Armó <b className="font-semibold text-slate-700">{encargo.preparadoPor}</b></>}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
