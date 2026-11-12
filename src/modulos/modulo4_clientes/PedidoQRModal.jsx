import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ScanLine } from 'lucide-react'
import { money } from '../../utils/format'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'

// Codifica: { tipo, clienteId, nombre, items: [{p: productoId, c: cantidad}] }
export default function PedidoQRModal({ cliente, items, open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="QR de Pedido Express">
      {open && cliente && <ContenidoQR cliente={cliente} items={items} onClose={onClose} />}
    </Modal>
  )
}

// Se monta solo al abrir: el QR se regenera por cada apertura del modal.
function ContenidoQR({ cliente, items, onClose }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    const payload = JSON.stringify({
      tipo: 'KIOSCO_PEDIDO',
      clienteId: cliente.id,
      nombre: `${cliente.nombre} ${cliente.apellido}`,
      items: items.map((i) => ({ p: i.productoId, c: i.cantidad })),
    })
    let activo = true
    QRCode.toDataURL(payload, { width: 280, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => activo && setSrc(url))
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [cliente, items])

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-800">
          {cliente.nombre} {cliente.apellido} · DNI {cliente.dni}
        </p>
        <p className="text-xs text-slate-400">
          {items.reduce((s, i) => s + i.cantidad, 0)} ítem(s) · Total estimado {money(total)}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {src ? (
          <img src={src} alt="QR del pedido" className="h-56 w-56" />
        ) : (
          <div className="flex h-56 w-56 items-center justify-center">
            <ScanLine size={32} className="animate-pulse text-slate-300" />
          </div>
        )}
      </div>

      <ul className="flex w-full flex-col gap-1 rounded-xl bg-slate-50 px-4 py-3 text-sm">
        {items.map((i) => (
          <li key={i.productoId} className="flex justify-between gap-3">
            <span className="truncate text-slate-600">
              {i.cantidad}× {i.nombre}
            </span>
            <span className="font-medium text-slate-700">{money(i.precio * i.cantidad)}</span>
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-slate-400">
        Mostrá este código en el mostrador: la vendedora lo escanea y tu pedido se carga al instante.
      </p>
      <Button variant="secondary" onClick={onClose} className="w-full">
        Cerrar
      </Button>
    </div>
  )
}
