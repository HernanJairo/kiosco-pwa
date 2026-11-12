import { useMemo, useState } from 'react'
import { BadgeCheck, Check, Clock3, PackageCheck, QrCode, Store } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { fmtFechaHora, money } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import PedidoQRModal from './PedidoQRModal'
import './BilleteraCliente.css'

const ESTADO = {
  en_preparacion: 'En preparación',
  listo_retiro: 'Listo para retirar',
  entregado: 'Retirado',
  cancelado: 'Cancelado',
}

// Paso del stepper según el estado del encargo:
//   Recibido → Preparando → Listo para retirar
// El CSS de v0 solo trae el look "done" (verde); los pasos actual y
// pendiente se pintan inline para no tocar la hoja extraída.
function PasoOrden({ estado }) {
  // índice del paso vigente: en_preparacion=1, listo/entregado=3 (todo hecho)
  const actual = estado === 'en_preparacion' ? 1 : estado === 'cancelado' ? 0 : 3
  const labels = ['Recibido', 'Preparando', 'Listo para retirar']
  return (
    <div className="order-progress" aria-label={`Estado del encargo: ${ESTADO[estado] || estado}`}>
      {labels.map((label, i) => {
        const hecho = i < actual || actual === 3
        const enCurso = i === actual
        const circulo = hecho
          ? undefined
          : enCurso
            ? { background: '#009de0', borderColor: '#009de0', color: '#fff' }
            : { background: '#f3f4f6', borderColor: '#e5e7eb', color: '#9ca3af' }
        return (
          <div key={label} style={{ display: 'contents' }}>
            {i > 0 && (
              <i
                className="progress-line"
                style={i <= actual || actual === 3 ? undefined : { background: '#e5e7eb' }}
              />
            )}
            <div className="progress-step">
              <span style={circulo}>{hecho ? <Check size={15} /> : <Clock3 size={13} />}</span>
              <strong>{label}</strong>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// "Mis Encargos" del cliente con la estética v0 (orders-panel /
// order-detail-card): pedido activo con stepper y QR de retiro real,
// selección múltiple para UN QR combinado e historial de anteriores.
export default function MisEncargos() {
  const { clienteSesion, encargos } = useKiosco()
  const [seleccion, setSeleccion] = useState([]) // ids de encargos listos marcados
  const [qrOpen, setQrOpen] = useState(false)

  const mios = useMemo(
    () => (encargos || []).filter((e) => e.clienteId === clienteSesion?.id),
    [encargos, clienteSesion]
  )
  const activos = mios.filter((e) => e.estado === 'en_preparacion' || e.estado === 'listo_retiro')
  const anteriores = mios.filter((e) => e.estado === 'entregado' || e.estado === 'cancelado')
  const listosParaRetiro = mios.filter((e) => e.estado === 'listo_retiro')
  const elegidos = listosParaRetiro.filter((e) => seleccion.includes(e.id))
  const totalElegido = elegidos.reduce((s, e) => s + e.total, 0)

  const toggle = (id) =>
    setSeleccion((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]))

  const irTab = (key) => window.dispatchEvent(new CustomEvent('yapa:nav', { detail: key }))

  return (
    <div className="wallet-app">
      <div className="wallet-shell">
        <section className="orders-panel" role="tabpanel" aria-label="Mis Encargos">
          <div className="wallet-section-heading orders-heading">
            <div>
              <p className="wallet-eyebrow">RETIRO EN EL LOCAL</p>
              <h2>Tus encargos</h2>
              <p>Pedidos anticipados que preparamos con cariño.</p>
            </div>
            <span className="order-count-badge">
              {activos.length === 0 ? 'Sin activos' : `${activos.length} activo${activos.length > 1 ? 's' : ''}`}
            </span>
          </div>

          {mios.length === 0 ? (
            <EmptyState
              icon={PackageCheck}
              title="Todavía no tenés encargos"
              sub="Armá tu pedido desde el catálogo y elegí 'Retirar pedido en local'."
            >
              <button type="button" className="wallet-primary-button modal-submit" onClick={() => irTab('catalogo')}>
                <Store size={17} /> Ir al catálogo
              </button>
            </EmptyState>
          ) : (
            <>
              {/* Pedidos activos: tarjeta de detalle v0 con stepper */}
              {activos.map((e) => {
                const seleccionable = e.estado === 'listo_retiro'
                const marcado = seleccion.includes(e.id)
                return (
                  <article className="order-detail-card" key={e.id} style={marcado ? { outline: '2px solid #009de0' } : undefined}>
                    <div className="order-detail-top">
                      <div>
                        <span className="order-number">ENCARGO ACTIVO <strong>#{e.id.slice(0, 8).toUpperCase()}</strong></span>
                        <h3>{e.estado === 'listo_retiro' ? '¡Ya podés pasar a buscarlo!' : 'Lo estamos preparando'}</h3>
                        <p>{fmtFechaHora(e.fecha)}{e.preparadoPor ? ` · Armó ${e.preparadoPor}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {seleccionable && listosParaRetiro.length > 0 && (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={marcado}
                            aria-label={`Seleccionar pedido ${e.id.slice(0, 8).toUpperCase()} para cobrar junto`}
                            onClick={() => toggle(e.id)}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold text-white transition-all duration-150 active:scale-90 ${
                              marcado ? 'border-[#009DE0] bg-[#009DE0]' : 'border-slate-300 bg-white text-transparent'
                            }`}
                          >
                            ✓
                          </button>
                        )}
                        <span className="ready-indicator" style={e.estado === 'en_preparacion' ? { background: '#fef3c7', color: '#b45309' } : undefined}>
                          {e.estado === 'listo_retiro' ? <Check size={14} /> : <Clock3 size={14} />}
                          {ESTADO[e.estado]}
                        </span>
                      </div>
                    </div>

                    <PasoOrden estado={e.estado} />

                    <div className="order-detail-content">
                      <div className="order-detail-products">
                        <h4>Tu pedido</h4>
                        {e.items.map((i) => (
                          <div key={i.productoId}>
                            <span>{i.cantidad} × {i.nombre}</span>
                            <strong>{money(i.precio * i.cantidad)}</strong>
                          </div>
                        ))}
                        <div className="order-total-line"><span>Total</span><strong>{money(e.total)}</strong></div>
                      </div>
                      <div className="pickup-person">
                        <span className="pickup-person-icon"><BadgeCheck size={19} /></span>
                        <div>
                          <small>PERSONA AUTORIZADA</small>
                          <strong>{e.retiroTercero?.dni ? `Retira: ${e.retiroTercero.nombre}` : 'Retira: Titular'}</strong>
                          <span>{e.retiroTercero?.dni ? `DNI ${e.retiroTercero.dni}` : `${clienteSesion.nombre} ${clienteSesion.apellido} · DNI ${clienteSesion.dni}`}</span>
                        </div>
                      </div>
                    </div>

                    {(e.itemsFaltantes || []).length > 0 && (
                      <p className="mx-1 mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
                        Sin stock en góndola se descontó: {e.itemsFaltantes.map((f) => `${f.cantidad}× ${f.nombre}`).join(', ')}.
                      </p>
                    )}

                    {e.estado === 'listo_retiro' && (
                      <button
                        type="button"
                        className="wallet-primary-button show-pickup-qr"
                        onClick={() => { setSeleccion([e.id]); setQrOpen(true) }}
                      >
                        <QrCode size={18} />Mostrar QR de retiro en caja
                      </button>
                    )}
                  </article>
                )
              })}

              {/* Encargos anteriores: filas compactas del historial v0 */}
              {anteriores.length > 0 && (
                <section className="order-history">
                  <div className="wallet-section-heading">
                    <div>
                      <p className="wallet-eyebrow">PARA RECORDAR</p>
                      <h2>Encargos anteriores</h2>
                    </div>
                    <button type="button" className="link-button" onClick={() => irTab('historial')}>
                      Ver historial
                    </button>
                  </div>
                  {anteriores.map((e) => (
                    <article className="history-row" key={e.id}>
                      <span className="history-check" style={e.estado === 'cancelado' ? { background: '#fee2e2', color: '#b91c1c' } : undefined}>
                        {e.estado === 'cancelado' ? '✕' : <Check size={17} />}
                      </span>
                      <div>
                        <strong>#{e.id.slice(0, 8).toUpperCase()} · {ESTADO[e.estado]}</strong>
                        <span>
                          {fmtFechaHora(e.entregadoEn || e.fecha)} · {e.items.reduce((s, i) => s + i.cantidad, 0)} producto(s)
                          {e.retiradoPor ? ` · Retiró ${e.retiradoPor}` : ''}
                        </span>
                      </div>
                      <b>{money(e.total)}</b>
                      <Clock3 className="history-clock" size={17} />
                    </article>
                  ))}
                </section>
              )}
            </>
          )}
        </section>
      </div>

      {/* Barra de cobro: aparece cuando hay pedidos listos seleccionados */}
      {elegidos.length > 0 && !qrOpen && (
        <div className="fade-in sticky bottom-4 z-10 mx-auto w-full max-w-3xl px-4">
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
