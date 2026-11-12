import { useMemo, useState } from 'react'
import { Loader2, Minus, PackageCheck, Printer, ShoppingCart, Trash2 } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ProductoImg from '../../components/ui/ProductoImg'
import SwitchEstado from '../../components/ui/SwitchEstado'
import RotuloEncargoModal from './RotuloEncargoModal'

// Vista dedicada "Encargos" del mostrador (vendedor y admin por igual):
// cola de pedidos anticipados de clientes para armar la bolsa.
// El cobro/despacho se hace escaneando el QR de retiro en el POS o
// tocando "Cobrar en caja", que navega al POS con el pedido cargado.
export default function EncargosPanel() {
  const {
    productos, encargos, config, updateConfig,
    marcarEncargoListo, cancelarEncargo, ajustarItemEncargo, notify,
  } = useKiosco()
  const [busy, setBusy] = useState(false)
  const [rotuloEncargo, setRotuloEncargo] = useState(null) // encargo a imprimir

  const cola = useMemo(
    () => (encargos || []).filter((e) => e.estado === 'en_preparacion' || e.estado === 'listo_retiro'),
    [encargos]
  )
  const enPreparacion = cola.filter((e) => e.estado === 'en_preparacion').length
  const listos = cola.filter((e) => e.estado === 'listo_retiro').length

  const ejecutar = async (fn, okMsg, info = false) => {
    setBusy(true)
    try {
      await fn()
      if (okMsg) notify(okMsg, info ? 'info' : 'success')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  // "Caso 999": falta físico en góndola → quita del pedido, devuelve
  // stock y queda asentado quién ajustó.
  const ajustar = (e, productoId, cantidad) =>
    ejecutar(() => ajustarItemEncargo(e.id, productoId, cantidad))

  // Despacho directo: lleva el pedido listo al ticket del POS para cobrar.
  // El POS está desmontado en esta pestaña: el id viaja por sessionStorage
  // (lo levanta TerminalPOS al montar) y el evento queda como atajo por si
  // ya estuviera visible en pantallas divididas.
  const cobrarEnCaja = (e) => {
    try {
      sessionStorage.setItem('yapa_cobrar_encargo', e.id)
    } catch { /* storage bloqueado: queda solo el evento */ }
    window.dispatchEvent(new CustomEvent('yapa:nav', { detail: 'pos' }))
    window.dispatchEvent(new CustomEvent('yapa:cobrar-encargo', { detail: { encargoId: e.id } }))
    notify(`Pedido #${e.id.slice(0, 8).toUpperCase()} enviado a caja para cobrar.`, 'info')
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Pedidos por Armar"
        subtitle={`${enPreparacion} en preparación · ${listos} listos para retirar`}
      >
        {/* Switch de recepción: habilita/cierra la llegada de encargos nuevos */}
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-[#F6F6F6] px-4 py-3">
          <div>
            <p className="text-sm font-bold text-[#202125]">Recibiendo encargos</p>
            <p className="text-[11px] text-slate-400">
              {config.recibiendoEncargos
                ? 'Activado: los clientes pueden enviar pedidos para armar.'
                : 'Desactivado: recepción pausada, no entran encargos nuevos.'}
            </p>
          </div>
          <SwitchEstado
            abierto={!!config.recibiendoEncargos}
            onToggle={() => updateConfig({ recibiendoEncargos: !config.recibiendoEncargos })}
          />
        </div>

        {cola.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="No hay pedidos para armar"
            sub="Cuando un cliente envíe un encargo va a aparecer acá."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {cola.map((e) => (
              <li key={e.id} className="overflow-hidden rounded-3xl bg-white shadow-soft">
                {/* Encabezado: orden, cliente y total */}
                <div className="flex items-center justify-between gap-3 bg-[#F6F6F6] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${e.estado === 'listo_retiro' ? 'bg-emerald-400' : 'bg-[#009DE0]'}`} />
                      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${e.estado === 'listo_retiro' ? 'bg-emerald-500' : 'bg-[#009DE0]'}`} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight text-slate-800">
                        Pedido #{e.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {fmtFechaHora(e.fecha)} · {e.clienteNombre}
                        {e.preparadoPor ? ` · Armó ${e.preparadoPor}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-lg font-bold text-brand">{money(e.total)}</span>
                    <Badge tone={e.estado === 'listo_retiro' ? 'emerald' : 'brand'}>
                      {e.estado === 'listo_retiro' ? 'Listo para retirar' : 'En preparación'}
                    </Badge>
                  </div>
                </div>

                {/* Ítems con foto y cantidad (editables mientras se arma) */}
                <ul className="flex flex-col divide-y divide-slate-50 px-4">
                  {e.items.map((it) => {
                    const p = productos.find((x) => x.id === it.productoId)
                    return (
                      <li key={`${e.id}-${it.productoId}`} className="flex items-center gap-3 py-2.5">
                        {p ? (
                          <ProductoImg producto={p} className="h-10 w-10 rounded-lg" iconSize={16} />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                            <ShoppingCart size={16} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-700">{it.nombre}</span>
                          <span className="text-[11px] text-slate-400">{money(it.precio)} c/u</span>
                        </span>
                        {/* Falta físico en góndola → quitar del pedido */}
                        {e.estado === 'en_preparacion' ? (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#F6F6F6] p-1">
                            <button
                              type="button"
                              onClick={() => ajustar(e, it.productoId, 1)}
                              aria-label={`Quitar uno de ${it.nombre}`}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition-all duration-150 active:scale-90"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="min-w-6 text-center text-sm font-bold text-slate-800">{it.cantidad}</span>
                            <button
                              type="button"
                              onClick={() => ajustar(e, it.productoId, it.cantidad)}
                              aria-label={`Quitar todo ${it.nombre}`}
                              title="Sin stock en góndola"
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-rose-400 shadow-sm transition-all duration-150 hover:bg-rose-50 active:scale-90"
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        ) : (
                          <Badge tone="brand" className="shrink-0 rounded-full">{it.cantidad}×</Badge>
                        )}
                        <span className="w-16 shrink-0 text-right text-sm font-semibold text-slate-700">
                          {money(it.precio * it.cantidad)}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {/* Aviso de faltantes descontados en góndola */}
                {(e.itemsFaltantes || []).length > 0 && (
                  <div className="mx-4 mb-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
                    Sin stock en góndola se descontó: {e.itemsFaltantes.map((f) => `${f.cantidad}× ${f.nombre}`).join(', ')}.
                  </div>
                )}

                {e.retiroTercero?.dni && (
                  <p className="mx-4 mb-2 rounded-xl bg-[#EBF7FD] px-3 py-2 text-[11px] font-semibold text-[#007AB8]">
                    Retira autorizado: {e.retiroTercero.nombre} · DNI {e.retiroTercero.dni}
                  </p>
                )}

                {/* Acciones */}
                <div className="flex gap-2 px-4 pb-4 pt-3">
                  {e.estado === 'en_preparacion' ? (
                    <Button
                      className="flex-1 rounded-2xl py-3 text-sm font-bold"
                      disabled={busy}
                      onClick={() =>
                        ejecutar(
                          () => marcarEncargoListo(e.id),
                          `Pedido #${e.id.slice(0, 8).toUpperCase()} listo para retirar.`
                        )
                      }
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                      Marcar listo para retirar
                    </Button>
                  ) : (
                    <div className="flex flex-1 gap-2">
                      <Button
                        className="flex-1 rounded-2xl py-3 text-sm font-bold"
                        onClick={() => cobrarEnCaja(e)}
                        title="Llevar el pedido al ticket del POS para cobrar"
                      >
                        <ShoppingCart size={15} /> Cobrar en caja
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setRotuloEncargo(e)}
                        className="shrink-0 rounded-2xl"
                        title="Imprimir rótulo para la bolsa"
                      >
                        <Printer size={15} /> Rótulo
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => ejecutar(() => cancelarEncargo(e.id), 'Encargo cancelado.', true)}
                    className="rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100"
                  >
                    <Trash2 size={14} /> Cancelar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RotuloEncargoModal encargo={rotuloEncargo} open={!!rotuloEncargo} onClose={() => setRotuloEncargo(null)} />
    </div>
  )
}
