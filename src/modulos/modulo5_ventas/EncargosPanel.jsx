import { useMemo, useState } from 'react'
import { ChevronDown, Hand, Loader2, Lock, Minus, PackageCheck, Printer, ShoppingCart, Trash2 } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ProductoImg from '../../components/ui/ProductoImg'
import SwitchEstado from '../../components/ui/SwitchEstado'
import RotuloEncargoModal from './RotuloEncargoModal'

// Tonos de la píldora de estado de la cabecera colapsada (mismo
// lenguaje que Badge, con padding/texto propios de la tarjeta).
const TONO_PILL = {
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  brand: 'bg-brand-soft text-brand ring-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

// Vista dedicada "Encargos" del mostrador (vendedor y admin por igual):
// cola de pedidos anticipados de clientes para armar la bolsa.
// Flujo ordenado en 3 secciones colapsables:
//   1) En espera (sin asignar) → cualquiera toma el pedido con "Tomar
//      pedido" (asignación exclusiva: la tx remota aborta si otro lo
//      agarró primero).
//   2) En preparación → solo el vendedor que lo seleccionó (o un admin)
//      ve los botones; al resto le figura "Atendiendo: <nombre>".
//   3) Listos para retirar → indica quién lo preparó; el cobro/despacho
//      se hace escaneando el QR de retiro en el POS o con "Cobrar en caja".
export default function EncargosPanel() {
  const {
    productos, encargos, config, updateConfig, session,
    tomarEncargo, marcarEncargoListo, cancelarEncargo, ajustarItemEncargo, notify,
  } = useKiosco()
  const [busy, setBusy] = useState(false)
  const [rotuloEncargo, setRotuloEncargo] = useState(null) // encargo a imprimir
  const [abiertos, setAbiertos] = useState({}) // acordeón: ids desplegados

  const esAdmin = session?.rol === 'admin'

  const cola = useMemo(
    () => (encargos || []).filter((e) => e.estado === 'en_preparacion' || e.estado === 'listo_retiro'),
    [encargos]
  )
  // Secciones del flujo: sin dueño → tomados en preparación → listos.
  const enEspera = cola.filter((e) => e.estado === 'en_preparacion' && !e.asignadoA?.nombre)
  const seleccionados = cola.filter((e) => e.estado === 'en_preparacion' && e.asignadoA?.nombre)
  const listosRetiro = cola.filter((e) => e.estado === 'listo_retiro')

  const toggle = (id) => setAbiertos((m) => ({ ...m, [id]: !m[id] }))

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

  // Tarjeta colapsable: compacta por defecto (N°, hora, cliente, ítems,
  // total, estado) y despliega el detalle + acciones al tocarla.
  const renderEncargo = (e, modo) => {
    const abierto = !!abiertos[e.id]
    const cantItems = e.items.reduce((s, i) => s + i.cantidad, 0)
    // Exclusividad: en preparación solo opera quien lo tomó (o el admin).
    const mio = esAdmin || e.asignadoA?.id === session?.id
    const puedeEditar = modo === 'seleccionado' && mio
    const etiquetaEstado =
      modo === 'espera'
        ? { tone: 'amber', text: 'En espera · sin asignar' }
        : modo === 'seleccionado'
          ? { tone: 'brand', text: `Seleccionado por ${e.asignadoA.nombre}` }
          : { tone: 'emerald', text: `Preparado por ${e.preparadoPor || e.asignadoA?.nombre || 'mostrador'} · Listo para retirar` }

    return (
      <li key={e.id} className="overflow-hidden rounded-3xl bg-white shadow-soft">
        {/* Cabecera compacta en 2 niveles (siempre visible) → toque
            despliega: arriba N° de pedido + monto, abajo fecha/cliente
            completa junto a la píldora de estado (flex-wrap, sin
            truncar ni encimar en pantallas chicas). */}
        <button
          type="button"
          onClick={() => toggle(e.id)}
          aria-expanded={abierto}
          className="block w-full bg-[#F6F6F6] p-3.5 text-left transition-colors hover:bg-[#EBF7FD]"
        >
          {/* Fila superior: flecha + punto de estado + N° y monto */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <ChevronDown
                size={15}
                className={`shrink-0 text-slate-400 transition-transform duration-200 ${abierto ? '' : '-rotate-90'}`}
              />
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${modo === 'listo' ? 'bg-emerald-400' : modo === 'espera' ? 'bg-amber-400' : 'bg-[#009DE0]'}`} />
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${modo === 'listo' ? 'bg-emerald-500' : modo === 'espera' ? 'bg-amber-500' : 'bg-[#009DE0]'}`} />
              </span>
              <p className="whitespace-nowrap text-sm font-bold leading-tight text-slate-800">
                Pedido #{e.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <span className="shrink-0 text-base font-extrabold text-sky-600">{money(e.total)}</span>
          </div>
          {/* Fila inferior: fecha/hora + cliente + ítems y píldora de
              estado envolvente, sin pegarse a los bordes. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 pl-9">
            <span className="text-xs text-slate-500">
              {fmtFechaHora(e.fecha)} · {e.clienteNombre} · {cantItems} ítem{cantItems === 1 ? '' : 's'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONO_PILL[etiquetaEstado.tone]}`}
            >
              {etiquetaEstado.text}
            </span>
          </div>
        </button>

        {/* Detalle desplegado: ítems, faltantes, tercero y acciones */}
        {abierto && (
          <>
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
                    {/* Falta físico en góndola → quitar del pedido
                        (solo quien lo está armando, o el admin) */}
                    {puedeEditar ? (
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

            {/* Acciones según la sección y la asignación exclusiva */}
            <div className="flex gap-2 px-4 pb-4 pt-3">
              {modo === 'espera' && (
                <Button
                  className="flex-1 rounded-2xl py-3 text-sm font-bold"
                  disabled={busy}
                  onClick={() =>
                    ejecutar(
                      () => tomarEncargo(e.id),
                      `Tomaste el pedido #${e.id.slice(0, 8).toUpperCase()}: quedó asignado a tu turno.`
                    )
                  }
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Hand size={16} />}
                  Tomar pedido
                </Button>
              )}
              {modo === 'seleccionado' && (
                mio ? (
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
                  <p className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#F6F6F6] py-3 text-[12px] font-bold text-slate-400">
                    <Lock size={14} /> Atendiendo: {e.asignadoA.nombre}
                  </p>
                )
              )}
              {modo === 'listo' && (
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
              {/* Cancelar: en seleccionados solo quien lo tomó (o admin) */}
              {(modo !== 'seleccionado' || mio) && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => ejecutar(() => cancelarEncargo(e.id), 'Encargo cancelado.', true)}
                  className="rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100"
                >
                  <Trash2 size={14} /> Cancelar
                </Button>
              )}
            </div>
          </>
        )}
      </li>
    )
  }

  // Encabezado de cada sección del flujo con su contador.
  const tituloSeccion = (texto, cant, dot) =>
    cant > 0 && (
      <div className="mt-2 flex items-center gap-2 first:mt-0">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {texto} · {cant}
        </p>
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Pedidos por Armar"
        subtitle={`${enEspera.length} en espera · ${seleccionados.length} en preparación · ${listosRetiro.length} listos para retirar`}
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
          <div className="flex flex-col gap-3">
            {tituloSeccion('En espera (sin asignar)', enEspera.length, 'bg-amber-500')}
            {enEspera.length > 0 && (
              <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {enEspera.map((e) => renderEncargo(e, 'espera'))}
              </ul>
            )}

            {tituloSeccion('En preparación (seleccionados)', seleccionados.length, 'bg-[#009DE0]')}
            {seleccionados.length > 0 && (
              <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {seleccionados.map((e) => renderEncargo(e, 'seleccionado'))}
              </ul>
            )}

            {tituloSeccion('Listos para retirar', listosRetiro.length, 'bg-emerald-500')}
            {listosRetiro.length > 0 && (
              <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {listosRetiro.map((e) => renderEncargo(e, 'listo'))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <RotuloEncargoModal encargo={rotuloEncargo} open={!!rotuloEncargo} onClose={() => setRotuloEncargo(null)} />
    </div>
  )
}
