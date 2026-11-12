import { useMemo, useState } from 'react'
import { PackageCheck, QrCode, Store, UserCheck } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PedidoQRModal from './PedidoQRModal'

const ESTADO = {
  en_preparacion: { tone: 'amber', label: 'En preparación' },
  listo_retiro: { tone: 'emerald', label: 'Listo para retirar' },
  entregado: { tone: 'slate', label: 'Entregado' },
  cancelado: { tone: 'rose', label: 'Cancelado' },
}

// "Mis Encargos" del cliente: historial de pedidos anticipados con su
// estado, ítems, faltantes descontados y —para los que están listos—
// selección múltiple para generar UN QR de retiro que cobra varios
// pedidos juntos en caja.
export default function MisEncargos() {
  const { clienteSesion, encargos } = useKiosco()
  const [seleccion, setSeleccion] = useState([]) // ids de encargos listos marcados
  const [qrOpen, setQrOpen] = useState(false)

  const mios = useMemo(
    () => (encargos || []).filter((e) => e.clienteId === clienteSesion?.id),
    [encargos, clienteSesion]
  )
  const listosParaRetiro = mios.filter((e) => e.estado === 'listo_retiro')
  const elegidos = listosParaRetiro.filter((e) => seleccion.includes(e.id))
  const totalElegido = elegidos.reduce((s, e) => s + e.total, 0)

  const toggle = (id) =>
    setSeleccion((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]))

  const irCatalogo = () => window.dispatchEvent(new CustomEvent('yapa:nav', { detail: 'catalogo' }))

  return (
    <div className="flex flex-col gap-4">
      <Card title="Mis Encargos" subtitle="Pedidos anticipados para retirar en el local">
        {mios.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="Todavía no tenés encargos"
            sub="Armá tu pedido desde el catálogo y elegí 'Retirar pedido en local'."
          >
            <Button onClick={irCatalogo} className="mt-2">
              <Store size={15} /> Ir al catálogo
            </Button>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {mios.map((e) => {
              const est = ESTADO[e.estado] || ESTADO.en_preparacion
              const seleccionable = e.estado === 'listo_retiro'
              const marcado = seleccion.includes(e.id)
              return (
                <li
                  key={e.id}
                  className={`overflow-hidden rounded-3xl bg-white shadow-soft transition-all duration-200 ${marcado ? 'ring-2 ring-[#009DE0]' : ''}`}
                >
                  <div className="flex items-center gap-3 bg-[#F6F6F6] px-4 py-3">
                    {/* Checkbox de selección para el QR combinado */}
                    {seleccionable ? (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={marcado}
                        aria-label={`Seleccionar pedido ${e.id.slice(0, 8).toUpperCase()} para cobrar`}
                        onClick={() => toggle(e.id)}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold text-white transition-all duration-150 active:scale-90 ${
                          marcado ? 'border-[#009DE0] bg-[#009DE0]' : 'border-slate-300 bg-white text-transparent'
                        }`}
                      >
                        ✓
                      </button>
                    ) : (
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${e.estado === 'en_preparacion' ? 'animate-pulse bg-amber-400' : e.estado === 'entregado' ? 'bg-slate-300' : 'bg-rose-300'}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-tight text-slate-800">
                        Pedido #{e.id.slice(0, 8).toUpperCase()} · {money(e.total)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {fmtFechaHora(e.fecha)}
                        {e.preparadoPor ? ` · Armó ${e.preparadoPor}` : ''}
                      </p>
                    </div>
                    <Badge tone={est.tone} className="shrink-0">{est.label}</Badge>
                  </div>

                  <ul className="flex flex-col gap-1 px-4 py-3">
                    {e.items.map((i) => (
                      <li key={i.productoId} className="flex justify-between gap-3 text-sm">
                        <span className="truncate text-slate-600">{i.cantidad}× {i.nombre}</span>
                        <span className="shrink-0 font-medium text-slate-700">{money(i.precio * i.cantidad)}</span>
                      </li>
                    ))}
                  </ul>

                  {(e.itemsFaltantes || []).length > 0 && (
                    <p className="mx-4 mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
                      Sin stock en góndola se descontó: {e.itemsFaltantes.map((f) => `${f.cantidad}× ${f.nombre}`).join(', ')}.
                    </p>
                  )}

                  {e.retiroTercero?.dni && e.estado !== 'entregado' && e.estado !== 'cancelado' && (
                    <p className="mx-4 mb-3 flex items-center gap-1.5 rounded-xl bg-[#EBF7FD] px-3 py-2 text-[11px] font-semibold text-[#007AB8]">
                      <UserCheck size={13} /> Puede retirar: {e.retiroTercero.nombre} · DNI {e.retiroTercero.dni}
                    </p>
                  )}

                  {e.estado === 'entregado' && e.retiradoPor && (
                    <p className="px-4 pb-3 text-[11px] text-slate-400">Retiró: {e.retiradoPor}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* Barra de cobro: aparece cuando hay pedidos listos seleccionados */}
      {elegidos.length > 0 && (
        <div className="fade-in sticky bottom-4 z-10">
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-full bg-[#009DE0] px-5 py-3.5 text-white shadow-lift transition-all duration-200 ease-out hover:bg-[#0086C0] active:scale-[0.98]"
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <QrCode size={17} />
              QR de retiro · {elegidos.length} pedido{elegidos.length > 1 ? 's' : ''}
            </span>
            <span className="text-sm font-extrabold">{money(totalElegido)}</span>
          </button>
        </div>
      )}

      {/* QR combinado: el POS carga y cierra todos los encargos elegidos */}
      <PedidoQRModal
        cliente={clienteSesion}
        encargos={elegidos}
        open={qrOpen}
        onClose={() => setQrOpen(false)}
      />
    </div>
  )
}
