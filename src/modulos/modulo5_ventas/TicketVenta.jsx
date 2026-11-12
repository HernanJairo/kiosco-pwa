import { Printer } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Logo from '../../assets/logo'

const METODO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', saldo: 'Billetera', fiado: 'Cta. Corriente' }

export default function TicketVenta({ venta, onClose }) {
  const { config, notify } = useKiosco()

  return (
    <Modal open={!!venta} onClose={onClose} title="Comprobante de venta">
      {venta && (
        <div className="flex flex-col gap-4">
          <div id="ticket-print" className="rounded-xl border border-dashed border-slate-300 bg-white p-5 font-mono text-xs text-slate-800">
            <div className="mb-3 flex flex-col items-center gap-1 text-center">
              <Logo className="h-10 w-10" />
              <p className="text-sm font-bold">{config.nombreKiosco}</p>
              <p className="text-[10px] text-slate-500">{config.direccion}</p>
              <p className="text-[10px] text-slate-500">{config.contacto}</p>
            </div>
            <div className="border-y border-dashed border-slate-300 py-2 text-[11px]">
              <div className="flex justify-between">
                <span>Ticket #{venta.id.slice(0, 8).toUpperCase()}</span>
                <span>{fmtFechaHora(venta.fecha)}</span>
              </div>
              <div className="flex justify-between">
                <span>Atendió: {venta.vendedor}</span>
                <span>Pago: {METODO_LABEL[venta.metodo]}</span>
              </div>
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span>{venta.clienteNombre || 'Consumidor final · mostrador'}</span>
              </div>
            </div>
            <ul className="flex flex-col gap-1.5 border-b border-dashed border-slate-300 py-2">
              {venta.items.map((it, i) => (
                <li key={i}>
                  <p className="font-semibold">{it.nombre}</p>
                  <div className="flex justify-between gap-2">
                    <span className="pl-2 text-slate-500">
                      {it.cantidad} × {money(it.precio)}
                    </span>
                    <span className="font-semibold">{money(it.precio * it.cantidad)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex justify-between py-2 text-sm font-bold">
              <span>TOTAL</span>
              <span>{money(venta.total)}</span>
            </div>
            <p className="pt-1 text-center text-[10px] text-slate-400">— ¡Gracias por tu compra! —</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
            <Button onClick={() => { notify('Ticket enviado a la impresora térmica.', 'info'); setTimeout(() => window.print(), 300) }}>
              <Printer size={15} /> Imprimir
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
