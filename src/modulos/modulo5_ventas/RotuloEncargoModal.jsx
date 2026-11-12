import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Printer, ScanLine, UserCheck } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'

// Rótulo/comanda para pegar en la bolsa: nro de orden, cliente en
// gigante, QR de retiro, ítems, faltantes, total a pagar y empleado.
// El botón "Imprimir" usa window.print() con la clase .rotulo-print.
export default function RotuloEncargoModal({ encargo, open, onClose }) {
  const { config } = useKiosco()
  const [qr, setQr] = useState('')

  useEffect(() => {
    if (!open || !encargo) return
    let activo = true
    const payload = JSON.stringify({
      tipo: 'ENCARGO_RETIRO',
      encargoId: encargo.id,
      clienteId: encargo.clienteId,
      nombre: encargo.clienteNombre,
      items: encargo.items.map((i) => ({ p: i.productoId, c: i.cantidad })),
    })
    QRCode.toDataURL(payload, { width: 200, margin: 0, errorCorrectionLevel: 'M' })
      .then((url) => activo && setQr(url))
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [open, encargo])

  if (!encargo) return null
  const e = encargo
  const ord = `ORD-${e.id.slice(0, 8).toUpperCase()}`
  const faltantes = e.itemsFaltantes || []

  return (
    <Modal open={open} onClose={onClose} title="Rótulo de Bolsa">
      {/* id="ticket-print": reutiliza el @media print del ticket térmico
          80mm (solo este bloque se imprime con window.print()). */}
      <div id="ticket-print" className="mx-auto flex w-full max-w-xs flex-col gap-3 rounded-2xl bg-white p-4 font-sans text-[#202125]">
        {/* Cabecera de orden */}
        <div className="border-b-2 border-dashed border-slate-300 pb-3 text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
            {config.nombreKiosco} · Pedido para retirar
          </p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">#{ord}</p>
          <p className="text-xs text-slate-500">
            Armado: {e.preparadoEn ? fmtFechaHora(e.preparadoEn) : fmtFechaHora(e.fecha)}
          </p>
        </div>

        {/* Cliente en gigante + tercero autorizado */}
        <div className="border-b-2 border-dashed border-slate-300 pb-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Retira</p>
          <p className="mt-0.5 text-4xl font-extrabold leading-tight tracking-tight">
            {e.clienteNombre}
          </p>
          {e.retiroTercero?.dni && (
            <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
              <UserCheck size={14} /> Retira autorizado: {e.retiroTercero.nombre} · DNI {e.retiroTercero.dni}
            </p>
          )}
        </div>

        {/* QR de orden para caja */}
        <div className="flex items-center gap-3 border-b-2 border-dashed border-slate-300 pb-3">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-white">
            {qr ? (
              <img src={qr} alt="QR de la orden" className="h-24 w-24" />
            ) : (
              <ScanLine size={28} className="animate-pulse text-slate-300" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Escaneá en caja</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
              Carga el pedido y cobrá. También despacha por DNI del titular o autorizado.
            </p>
          </div>
        </div>

        {/* Ítems preparados */}
        <ul className="flex flex-col gap-1 border-b-2 border-dashed border-slate-300 pb-3">
          {e.items.map((i) => (
            <li key={i.productoId} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">
                {i.cantidad}× {i.nombre}
              </span>
              <span className="shrink-0 font-bold">{money(i.precio * i.cantidad)}</span>
            </li>
          ))}
        </ul>

        {faltantes.length > 0 && (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-[11px] font-semibold text-amber-800">
            ATENCIÓN — Sin stock en góndola se descontó:{' '}
            {faltantes.map((f) => `${f.cantidad}× ${f.nombre}`).join(', ')}.
          </p>
        )}

        {/* Total a pagar + firma del empleado */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Total a pagar
            </p>
            <p className="text-3xl font-extrabold tracking-tight">{money(e.total)}</p>
          </div>
          <p className="pb-1 text-right text-[11px] leading-snug text-slate-500">
            Armó: <b className="text-slate-700">{e.preparadoPor || 'mostrador'}</b>
            <br />
            Firma: ________________
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => window.print()}>
          <Printer size={15} /> Imprimir rótulo
        </Button>
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>
  )
}
