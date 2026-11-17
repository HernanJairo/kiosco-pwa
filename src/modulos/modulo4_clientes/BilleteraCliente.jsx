import { useState } from 'react'
import {
  ArrowDownLeft, ArrowRight, Check,
  Clock3, HandCoins, Hourglass, KeyRound, NotebookPen, PackageCheck, PauseCircle, Plus, QrCode,
  Receipt, RotateCcw, ShieldCheck, ShoppingBag, Sparkles, Store, Wallet,
} from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { limiteFiadoVigente, progresoFiado } from '../../context/operaciones'
import { fmtFechaHora, money } from '../../utils/format'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import SelectorAvatar from '../../components/ui/SelectorAvatar'
import PagoTransferenciaModal from './PagoTransferenciaModal'
import PedidoQRModal from './PedidoQRModal'
import BannerPinSeguridad from './BannerPinSeguridad'
import './BilleteraCliente.css'

const ESTADO_ORDEN = {
  en_preparacion: 'En preparación',
  listo_retiro: 'Listo para retirar',
}

// Ícono + clase de color por tipo de movimiento de la libreta.
const MOV_ICON = {
  consumo: { cls: 'transaction-purchase', Icon: Store },
  compra: { cls: 'transaction-purchase', Icon: ShoppingBag },
  fiado: { cls: 'transaction-purchase', Icon: NotebookPen },
  recarga: { cls: 'transaction-topup', Icon: ArrowDownLeft },
  abono: { cls: 'transaction-topup', Icon: HandCoins },
  anulacion: { cls: 'transaction-purchase', Icon: RotateCcw },
  seguridad: { cls: 'transaction-transfer', Icon: ShieldCheck },
}

// "Mi Billetera" del cliente con la interfaz v0 (rama
// v0/yapa-client-wallet): tarjeta de saldo azul con la llama PNG sobre
// el degradado limpio, acciones rápidas, últimos movimientos y encargo
// activo — todo conectado a useKiosco() y a los modales reales.
export default function BilleteraCliente() {
  const { clienteSesion: a, solicitudes, ventas, encargos, updateCliente, config, notify } = useKiosco()
  const [pagoTipo, setPagoTipo] = useState(null) // 'deuda' | 'recarga' | null
  const [perfilOpen, setPerfilOpen] = useState(false)
  const [qrPedido, setQrPedido] = useState(null) // encargo listo → QR de retiro
  const [llamaOk, setLlamaOk] = useState(true)
  const [pinOpen, setPinOpen] = useState(false)
  const [pins, setPins] = useState({ actual: '', nuevo: '', repite: '' })
  const [pinBusy, setPinBusy] = useState(false)

  if (!a) return null

  // "Cambiar mi PIN": valida el PIN vigente, exige 4 dígitos nuevos y
  // persiste el cliente completo en KioscoContext / Firestore.
  const guardarPin = async (e) => {
    e.preventDefault()
    if (!/^\d{4}$/.test(pins.actual)) return notify('Ingresá tu PIN actual de 4 dígitos.', 'error')
    if (pins.actual !== String(a.pin)) return notify('El PIN actual no coincide.', 'error')
    if (!/^\d{4}$/.test(pins.nuevo)) return notify('El PIN nuevo debe tener exactamente 4 dígitos.', 'error')
    if (pins.nuevo === pins.actual) return notify('El PIN nuevo debe ser distinto al actual.', 'error')
    if (pins.nuevo !== pins.repite) return notify('La confirmación no coincide con el PIN nuevo.', 'error')
    setPinBusy(true)
    try {
      await updateCliente(a.id, {
        pin: pins.nuevo,
        movimientos: [
          {
            id: `pin-${Date.now()}`,
            fecha: new Date().toISOString(),
            tipo: 'seguridad',
            detalle: 'Cambiaste tu PIN de acceso.',
            monto: 0,
          },
          ...(a.movimientos || []),
        ],
      })
      notify('PIN actualizado. Usalo en tu próximo ingreso.')
      setPins({ actual: '', nuevo: '', repite: '' })
      setPinOpen(false)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setPinBusy(false)
    }
  }

  const pendientes = a.fiados.filter((f) => !f.pagado && f.pendiente > 0)
  const saldoFavor = Math.max(0, a.saldo - a.deuda)
  const misPendientes = solicitudes.filter(
    (p) => p.clienteId === a.id && p.tipo === 'TRANSFERENCIA_PENDIENTE' && p.estado === 'pendiente'
  )
  const totalPendiente = misPendientes.reduce((s, p) => s + p.monto, 0)

  // Cuenta corriente: crédito disponible sobre el límite vigente.
  const limite = limiteFiadoVigente(a, config)
  const creditoDisponible = limite > 0 ? Math.max(0, limite - a.deuda) : 0
  const creditoPct = limite > 0 ? Math.max(3, Math.round((creditoDisponible / limite) * 100)) : 0

  // Desbloqueo automático del fiado: progreso mixto (compras + monto).
  const prog = progresoFiado({ ventas, config }, a)
  const pctDesbloqueo = Math.min(
    100,
    Math.min((prog.compras / Math.max(1, prog.minCompras)) * 100, (prog.acumulado / Math.max(1, prog.minMonto)) * 100)
  )

  // Encargo activo (el más reciente en preparación o listo para retirar).
  const activo = (encargos || []).find(
    (e) => e.clienteId === a.id && (e.estado === 'en_preparacion' || e.estado === 'listo_retiro')
  )

  const irTab = (key) => window.dispatchEvent(new CustomEvent('yapa:nav', { detail: key }))

  return (
    <div className="wallet-app">
      <div className="wallet-shell">
        <section className="wallet-welcome">
          <div>
            <p className="wallet-eyebrow">TU CUENTA, A MANO</p>
            <h1>Hola, {a.nombre} <span>!</span></h1>
            <p>Lo de siempre, con una Yapa más.</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              className="welcome-badge"
              onClick={() => setPerfilOpen(true)}
              title="Personalizar avatar o foto"
            >
              <Sparkles size={16} /><span>Cliente del barrio</span>
            </button>
            {/* Acceso discreto a la seguridad de la cuenta */}
            <button
              type="button"
              className="link-button"
              onClick={() => setPinOpen(true)}
              title="Cambiar tu PIN de acceso"
              aria-label="Cambiar mi PIN"
            >
              <KeyRound size={13} /><span>Cambiar mi PIN</span>
            </button>
          </div>
        </section>

        <section className="wallet-panel wallet-panel-single" role="tabpanel" aria-label="Mi Billetera">
          <div className="wallet-main-column">
            {/* Contingencia operativa: fiados pausados por el kiosco */}
            {config.fiadosActivos === false && (
              <div className="flex items-center gap-2.5 rounded-xl bg-[#EBF7FD] px-4 py-2.5 text-xs font-medium text-[#007AB8]">
                <PauseCircle size={15} className="shrink-0" />
                <span>Los fiados están pausados temporalmente: podés seguir pagando con tu saldo prepago.</span>
              </div>
            )}
            {/* Tarjeta azul de saldo + medallón de la llama */}
            <article className="balance-card">
              <div className="balance-card-copy">
                <span className="balance-label"><Wallet size={15} /> Saldo disponible</span>
                <strong className="balance-amount">{money(saldoFavor)}</strong>
                <span className="balance-caption">Listo para usar en el kiosco</span>
                <div className="balance-divider" />
                <div className="credit-heading">
                  <span><span className="credit-status-dot" /> Cuenta corriente</span>
                  {a.deuda > 0
                    ? <strong className="debt-pill" style={{ background: '#ffffff2e' }}><Clock3 size={13} /> Debe {money(a.deuda)}</strong>
                    : <strong className="debt-pill"><Check size={13} /> Al día</strong>}
                </div>
                {limite > 0 ? (
                  <>
                    <div className="credit-summary">
                      <span>Disponible para fiar</span>
                      <strong>{money(creditoDisponible)} <i>de {money(limite)}</i></strong>
                    </div>
                    <div className="credit-track" role="progressbar" aria-label="Crédito disponible para fiar" aria-valuenow={creditoPct} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${creditoPct}%` }} />
                    </div>
                  </>
                ) : a.fiadoBloqueado ? (
                  <div className="credit-summary"><span>Cuenta corriente deshabilitada · consultá en caja</span></div>
                ) : (
                  <>
                    {/* Regla antifraude: progreso mixto hacia el desbloqueo
                        automático (compras mínimas Y monto acumulado). */}
                    <div className="credit-summary">
                      <span>Para desbloquear Cta. Corriente</span>
                      <strong>{prog.compras} / {prog.minCompras} compras <i>· {money(prog.acumulado)} / {money(prog.minMonto)}</i></strong>
                    </div>
                    <div className="credit-track" role="progressbar" aria-label="Progreso para desbloquear cuenta corriente" aria-valuenow={Math.round(pctDesbloqueo)} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${Math.max(3, pctDesbloqueo)}%` }} />
                    </div>
                  </>
                )}
              </div>
              {llamaOk && (
                <div className="balance-illustration">
                  <img
                    src="/llama-yapa.png?v=2"
                    alt="Yapa"
                    className="balance-llama"
                    onError={() => setLlamaOk(false)}
                  />
                </div>
              )}
              <span className="balance-glint" aria-hidden="true"><Sparkles size={15} /></span>
            </article>

            {/* Acciones rápidas reales: recarga, pago de deuda y carnet */}
            <section className="quick-actions" aria-label="Acciones rápidas">
              <button type="button" onClick={() => setPagoTipo('recarga')}>
                <span className="quick-icon quick-blue"><Plus size={19} /></span>
                <strong>Cargar saldo</strong>
              </button>
              <button type="button" onClick={() => setPagoTipo('deuda')}>
                <span className="quick-icon quick-lilac"><HandCoins size={19} /></span>
                <strong>Pagar fiado</strong>
              </button>
              <button type="button" onClick={() => irTab('carnet')}>
                <span className="quick-icon quick-green"><QrCode size={18} /></span>
                <strong>Pagar en caja</strong>
              </button>
            </section>

            {/* Encargo activo con QR de retiro real */}
            {activo && (
              <article className="active-order-card">
                <div className="order-card-head">
                  <span className="order-icon"><PackageCheck size={16} /></span>
                  <span><small>ENCARGO ACTIVO</small><strong>#{activo.id.slice(0, 8).toUpperCase()}</strong></span>
                  <span className="order-ready" style={activo.estado === 'en_preparacion' ? { color: '#b45309' } : undefined}>
                    <span style={activo.estado === 'en_preparacion' ? { background: '#f59e0b' } : undefined} />
                    {ESTADO_ORDEN[activo.estado]}
                  </span>
                </div>
                <div className="order-product-lines">
                  {activo.items.slice(0, 3).map((i) => (
                    <span key={i.productoId}>{i.nombre} <i>× {i.cantidad}</i></span>
                  ))}
                  {activo.items.length > 3 && <span><i>y {activo.items.length - 3} más…</i></span>}
                </div>
                <div className="order-card-bottom">
                  <span>Total del encargo</span>
                  <strong>{money(activo.total)}</strong>
                </div>
                {activo.estado === 'listo_retiro' ? (
                  <button type="button" className="pickup-qr-button" onClick={() => setQrPedido(activo)}>
                    <QrCode size={17} />Mostrar QR de retiro en caja<ArrowRight size={16} />
                  </button>
                ) : (
                  <button type="button" className="pickup-qr-button" onClick={() => irTab('encargos')}>
                    <Clock3 size={17} />Ver el estado de tu pedido<ArrowRight size={16} />
                  </button>
                )}
              </article>
            )}

            {totalPendiente > 0 && (
              <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
                <Hourglass size={14} className="shrink-0 text-amber-500" />
                <span>
                  Transferencia de <b>{money(totalPendiente)}</b> pendiente de acreditación
                  {misPendientes.length > 1 ? ` (${misPendientes.length} avisos)` : ''}
                </span>
              </div>
            )}

            {/* Últimos movimientos de la billetera */}
            <section className="transactions-section">
              <div className="wallet-section-heading">
                <div>
                  <p className="wallet-eyebrow">TU ACTIVIDAD</p>
                  <h2>Últimos movimientos</h2>
                </div>
                <button type="button" className="link-button" onClick={() => irTab('historial')}>
                  Ver todos <ArrowRight size={15} />
                </button>
              </div>
              {a.movimientos.length === 0 ? (
                <EmptyState icon={Receipt} title="Sin movimientos todavía" sub="Tus compras y recargas van a aparecer acá." />
              ) : (
                <div className="transaction-list">
                  {a.movimientos.slice(0, 6).map((m) => {
                    const meta = MOV_ICON[m.tipo] || MOV_ICON.compra
                    return (
                      <article className="transaction-row" key={m.id}>
                        <span className={`transaction-icon ${meta.cls}`}><meta.Icon size={18} /></span>
                        <div className="transaction-info">
                          <strong>{m.detalle}</strong>
                          <span>{fmtFechaHora(m.fecha)}</span>
                        </div>
                        <strong className={`transaction-amount${m.monto > 0 ? ' positive' : ''}`}>
                          {m.monto > 0 ? '+' : '−'}{money(Math.abs(m.monto))}
                        </strong>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Aviso de PIN de fábrica: debajo de los movimientos para no
                empujar la tarjeta de saldo hacia abajo. */}
            <BannerPinSeguridad pin={a.pin} dni={a.dni} onGuardar={(p) => updateCliente(a.id, { pin: p })} />
          </div>
        </section>

        {/* Libreta de fiados: la lógica de cuenta corriente se mantiene */}
        <Card
          title="Libreta de fiados"
          subtitle="Detalle de compras al fiado con saldo pendiente"
        >
          {pendientes.length === 0 ? (
            <EmptyState icon={HandCoins} title="No tenés fiados pendientes" sub="Tu libreta está al día." />
          ) : (
            <ul className="flex flex-col gap-2">
              {pendientes.map((f) => (
                <li key={f.id} className="rounded-xl bg-white shadow-soft px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-400">{fmtFechaHora(f.fecha)}</p>
                    <Badge tone="amber">Pendiente {money(f.pendiente)}</Badge>
                  </div>
                  <ul className="mt-2 flex flex-col gap-0.5">
                    {f.items.map((it, i) => (
                      <li key={i} className="flex justify-between text-sm text-slate-600">
                        <span>{it.cantidad}× {it.nombre}</span>
                        <span className="font-medium">{money(it.precio * it.cantidad)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex justify-between border-t border-dashed border-slate-200 pt-2 text-sm font-bold">
                    <span>Total fiado</span>
                    <span className="text-amber-600">{money(f.monto)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <PagoTransferenciaModal
        cliente={a}
        origen="cliente"
        tipoInicial={pagoTipo || undefined}
        open={!!pagoTipo}
        onClose={() => setPagoTipo(null)}
      />

      {/* QR real del encargo listo para retirar */}
      {qrPedido && (
        <PedidoQRModal
          cliente={a}
          encargos={[qrPedido]}
          open
          onClose={() => setQrPedido(null)}
        />
      )}

      <Modal open={perfilOpen} onClose={() => setPerfilOpen(false)} title="Tu avatar y foto" wide>
        <SelectorAvatar cliente={a} />
      </Modal>

      {/* Cambio de PIN propio del cliente: exige el PIN vigente. */}
      <Modal open={pinOpen} onClose={() => setPinOpen(false)} title="Cambiar mi PIN">
        <form onSubmit={guardarPin} className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            Ingresá tu PIN actual y elegí uno nuevo de <b>4 dígitos</b> que solo vos conozcas.
          </p>
          <Input
            label="PIN actual"
            inputMode="numeric"
            maxLength={4}
            type="password"
            autoFocus
            value={pins.actual}
            onChange={(e) => setPins((f) => ({ ...f, actual: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nuevo PIN"
              inputMode="numeric"
              maxLength={4}
              type="password"
              value={pins.nuevo}
              onChange={(e) => setPins((f) => ({ ...f, nuevo: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="4 dígitos"
              required
            />
            <Input
              label="Confirmar nuevo PIN"
              inputMode="numeric"
              maxLength={4}
              type="password"
              value={pins.repite}
              onChange={(e) => setPins((f) => ({ ...f, repite: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="Repetir"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPinOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pinBusy}>
              <KeyRound size={14} /> {pinBusy ? 'Guardando…' : 'Actualizar PIN'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
