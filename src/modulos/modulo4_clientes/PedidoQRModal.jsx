import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { PackageCheck, ScanLine } from 'lucide-react'
import { money } from '../../utils/format'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'

// Pedido express: { tipo:'KIOSCO_PEDIDO', clienteId|null, nombre, items:[{p,c}] }
// Retiro de encargo: { tipo:'ENCARGO_RETIRO', encargoIds:[id,...], clienteId, nombre, items }
// (`encargo`/`encargos` se normalizan a un array interno.)
export default function PedidoQRModal({ cliente, encargo = null, encargos = null, items, open, onClose }) {
  const lista = encargos || (encargo ? [encargo] : null)
  const esRetiro = !!(lista && lista.length)
  return (
    <Modal open={open} onClose={onClose} title={esRetiro ? 'QR de Retiro' : 'QR de Pedido Express'}>
      {open && <ContenidoQR cliente={cliente} encargos={lista} items={items} onClose={onClose} />}
    </Modal>
  )
}

// Se monta solo al abrir: el QR se regenera por cada apertura del modal.
function ContenidoQR({ cliente, encargos, items, onClose }) {
  const [src, setSrc] = useState('')

  // Multi-encargo: consolida los ítems de todos los pedidos elegidos.
  const lineasEncargo = useMemo(() => {
    if (!encargos?.length) return null
    const mapa = new Map()
    for (const e of encargos) {
      for (const i of e.items) {
        const prev = mapa.get(i.productoId)
        if (prev) prev.cantidad += i.cantidad
        else mapa.set(i.productoId, { ...i })
      }
    }
    return [...mapa.values()]
  }, [encargos])

  useEffect(() => {
    const payload = encargos?.length
      ? JSON.stringify({
          tipo: 'ENCARGO_RETIRO',
          encargoIds: encargos.map((e) => e.id),
          clienteId: encargos[0].clienteId,
          nombre: encargos[0].clienteNombre,
          items: lineasEncargo.map((i) => ({ p: i.productoId, c: i.cantidad })),
        })
      : JSON.stringify({
          tipo: 'KIOSCO_PEDIDO',
          clienteId: cliente?.id ?? null,
          // Invitado: el POS lo cobra como "Consumidor Final · Venta Libre".
          nombre: cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Consumidor Final',
          items: items.map((i) => ({ p: i.productoId, c: i.cantidad })),
        })
    let activo = true
    QRCode.toDataURL(payload, { width: 280, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => activo && setSrc(url))
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [cliente, encargos, items, lineasEncargo])

  const total = encargos?.length
    ? encargos.reduce((s, e) => s + e.total, 0)
    : items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const lineas = lineasEncargo || items
  const cantidad = lineas.reduce((s, i) => s + i.cantidad, 0)
  const titular = encargos?.length
    ? `${encargos[0].clienteNombre} · ${encargos.length} pedido${encargos.length > 1 ? 's' : ''} (${encargos
        .map((e) => `#${e.id.slice(0, 8).toUpperCase()}`)
        .join(', ')})`
    : cliente
      ? `${cliente.nombre} ${cliente.apellido} · DNI ${cliente.dni}`
      : 'Consumidor Final · Venta Libre'

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-800">{titular}</p>
        <p className="text-xs text-slate-400">
          {cantidad} ítem(s) · Total {money(total)}
        </p>
      </div>

      <div className="rounded-2xl bg-white shadow-soft p-3 shadow-sm">
        {src ? (
          <img src={src} alt="QR del pedido" className="h-56 w-56" />
        ) : (
          <div className="flex h-56 w-56 items-center justify-center">
            <ScanLine size={32} className="animate-pulse text-slate-300" />
          </div>
        )}
      </div>

      <ul className="flex w-full flex-col gap-1 rounded-xl bg-slate-50 px-4 py-3 text-sm">
        {lineas.map((i) => (
          <li key={i.productoId} className="flex justify-between gap-3">
            <span className="truncate text-slate-600">
              {i.cantidad}× {i.nombre}
            </span>
            <span className="font-medium text-slate-700">{money(i.precio * i.cantidad)}</span>
          </li>
        ))}
      </ul>

      {encargos?.length ? (
        <p className="flex items-start gap-2 text-center text-xs text-slate-400">
          <PackageCheck size={15} className="mt-px shrink-0 text-[#009DE0]" />
          {encargos.length > 1
            ? 'Tus bolsas ya están armadas. Mostrá este código en caja: se cobran todas juntas.'
            : 'Tu bolsa ya está armada. Mostrá este código en caja para pagar y retirar.'}
        </p>
      ) : (
        <p className="text-center text-xs text-slate-400">
          Mostrá este código en el mostrador: se carga al instante y pagás en caja.
        </p>
      )}
      <Button variant="secondary" onClick={onClose} className="w-full">
        Cerrar
      </Button>
    </div>
  )
}
