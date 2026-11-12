import { useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, BadgeCheck, ChevronRight, HandCoins, Hourglass, MessageCircle, NotebookPen, PackageCheck, Pencil, QrCode, Receipt, RotateCcw, ShoppingBag, Store, Wallet } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { waLink } from '../../utils/whatsapp'
import { fmtFechaHora, money } from '../../utils/format'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import AvatarCliente from '../../components/ui/AvatarCliente'
import SelectorAvatar from '../../components/ui/SelectorAvatar'
import PagoTransferenciaModal from './PagoTransferenciaModal'
import BannerPinSeguridad from './BannerPinSeguridad'
import PseudoQR from './PseudoQR'

const MOV_META = {
  fiado: { icon: NotebookPen, bg: 'bg-amber-50 text-amber-600', label: 'Compra fiada' },
  abono: { icon: HandCoins, bg: 'bg-emerald-50 text-emerald-600', label: 'Pago de deuda' },
  recarga: { icon: Wallet, bg: 'bg-emerald-50 text-emerald-600', label: 'Recarga' },
  compra: { icon: ShoppingBag, bg: 'bg-emerald-50 text-emerald-600', label: 'Compra' },
  anulacion: { icon: RotateCcw, bg: 'bg-slate-100 text-slate-500', label: 'Anulación' },
}

export default function BilleteraCliente() {
  const { clienteSesion: a, solicitudes, updateCliente, config } = useKiosco()
  const [pagoTipo, setPagoTipo] = useState(null) // 'deuda' | 'recarga' | null
  const [perfilOpen, setPerfilOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  if (!a) return null

  const pendientes = a.fiados.filter((f) => !f.pagado && f.pendiente > 0)
  const saldoFavor = Math.max(0, a.saldo - a.deuda)
  const misPendientes = solicitudes.filter((p) => p.clienteId === a.id && p.tipo === 'TRANSFERENCIA_PENDIENTE' && p.estado === 'pendiente')
  const totalPendiente = misPendientes.reduce((s, p) => s + p.monto, 0)

  const irSeccion = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const irTab = (key) => window.dispatchEvent(new CustomEvent('yapa:nav', { detail: key }))
  const soporte = waLink(config.whatsapp, `Hola! Soy ${a.nombre} ${a.apellido} (DNI ${a.dni}), necesito ayuda con mi cuenta.`)

  const ACCESOS = [
    { icon: Store, label: 'Ver catálogo', sub: 'Productos del kiosco', onClick: () => irTab('catalogo') },
    { icon: PackageCheck, label: 'Mis encargos', sub: 'Pedidos para retirar en el local', onClick: () => irTab('encargos') },
    { icon: NotebookPen, label: 'Mis fiados', sub: 'Libreta de cuenta corriente', onClick: () => irSeccion('seccion-fiados') },
    { icon: Receipt, label: 'Movimientos', sub: 'Compras, recargas y abonos', onClick: () => irSeccion('seccion-movimientos') },
    { icon: MessageCircle, label: 'Soporte por WhatsApp', sub: 'Ayuda del kiosco', href: soporte },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Primer ingreso: sugerir personalizar el PIN si sigue siendo el de fábrica */}
      <BannerPinSeguridad pin={a.pin} dni={a.dni} onGuardar={(p) => updateCliente(a.id, { pin: p })} />

      {/* Header degradado Celeste Wolt: saludo + saldo gigante + recarga */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#009DE0] to-[#0066B2] p-5 text-white shadow-lift sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-10 h-44 w-44 rounded-full bg-white/5" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setPerfilOpen(true)}
              className="shrink-0 rounded-full ring-2 ring-white/40 transition-all duration-200 ease-out hover:ring-white/70 active:scale-95"
              title="Personalizar avatar o foto"
            >
              <AvatarCliente cliente={a} className="h-12 w-12" iconSize={24} textoClassName="text-sm" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight">Hola, {a.nombre}</h1>
              <p className="flex items-center gap-1 text-xs font-medium text-white/80">
                <BadgeCheck size={13} /> DNI {a.dni} · verificado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPerfilOpen(true)}
            className="shrink-0 rounded-full bg-white/15 p-2 transition-all duration-200 ease-out hover:bg-white/25 active:scale-95"
            title="Editar perfil"
          >
            <Pencil size={14} />
          </button>
        </div>

        <div className="relative mt-6 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Saldo a favor</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{money(saldoFavor)}</p>
          </div>
          <button
            type="button"
            onClick={() => setPagoTipo('recarga')}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#009DE0] shadow-md transition-all duration-200 ease-out hover:bg-[#EBF7FD] active:scale-95"
          >
            <ArrowDownToLine size={16} /> Recargar saldo
          </button>
        </div>
      </div>

      {/* Alerta suave de deuda fiada con acción directa */}
      {a.deuda > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3.5 ring-1 ring-inset ring-amber-200/70">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
            <Hourglass size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-800">Tenés {money(a.deuda)} en fiados pendientes</p>
            <p className="text-xs text-amber-600">Pagalos con transferencia y el mostrador los acredita.</p>
          </div>
          <button
            type="button"
            onClick={() => setPagoTipo('deuda')}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all duration-200 ease-out hover:bg-amber-600 active:scale-95"
          >
            <ArrowUpToLine size={14} /> Pagar deuda
          </button>
        </div>
      )}

      {/* Credencial QR + filas de acceso estilo iOS */}
      <div className="rounded-3xl bg-white p-5 shadow-soft">
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#009DE0] px-5 py-3.5 text-base font-bold text-white shadow-sm transition-all duration-200 ease-out hover:bg-[#0086C0] active:scale-[0.98]"
        >
          <QrCode size={19} /> Mostrar mi QR para cobrar
        </button>

        <ul className="mt-4 flex flex-col gap-2">
          {ACCESOS.map(({ icon: Icon, label, sub, onClick, href }) => {
            const inner = (
              <>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#009DE0] shadow-sm">
                  <Icon size={19} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-bold text-[#202125]">{label}</span>
                  <span className="block truncate text-xs text-slate-400">{sub}</span>
                </span>
                <ChevronRight size={17} className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#009DE0]" />
              </>
            )
            const cls =
              'group flex w-full items-center gap-3 rounded-2xl bg-[#F6F6F6] px-3.5 py-3 transition-all duration-200 ease-out hover:bg-[#EBF7FD] active:scale-[0.98]'
            return (
              <li key={label}>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className={cls}>
                    {inner}
                  </a>
                ) : (
                  <button type="button" onClick={onClick} className={cls}>
                    {inner}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {totalPendiente > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          <Hourglass size={14} className="shrink-0 text-amber-500" />
          <span>
            Transferencia de <b>{money(totalPendiente)}</b> pendiente de acreditación
            {misPendientes.length > 1 ? ` (${misPendientes.length} avisos)` : ''}
          </span>
        </div>
      )}

      <div id="seccion-fiados">
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

      <div id="seccion-movimientos">
        <Card title="Historial de movimientos" subtitle="Compras, abonos de deuda y recargas">
          {a.movimientos.length === 0 ? (
            <EmptyState title="Sin movimientos todavía" />
          ) : (
            <ul className="flex flex-col">
              {a.movimientos.map((m) => {
                const meta = MOV_META[m.tipo] || MOV_META.compra
                const Icon = meta.icon
                return (
                  <li key={m.id} className="flex items-center gap-3 border-b border-slate-50 py-3 last:border-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                      <Icon size={16} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{m.detalle}</p>
                      <p className="text-xs text-slate-400">{fmtFechaHora(m.fecha)}</p>
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        m.monto < 0 || m.tipo === 'recarga' ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {m.monto < 0 ? '− ' : '+ '}{money(Math.abs(m.monto))}
                    </span>
                  </li>
                )
              })}
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

      {/* QR a pantalla completa para escanear en mostrador */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="Tu QR de cliente">
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-3xl bg-white shadow-soft p-6 shadow-soft">
            <PseudoQR text={a.dni} size={220} />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-slate-800">{a.nombre} {a.apellido}</p>
            <p className="font-mono text-sm tracking-widest text-slate-500">DNI {a.dni}</p>
          </div>
          <p className="text-center text-xs text-slate-400">
            Mostrá este código en el mostrador para identificarte al instante.
          </p>
        </div>
      </Modal>

      <Modal open={perfilOpen} onClose={() => setPerfilOpen(false)} title="Tu avatar y foto" wide>
        <SelectorAvatar cliente={a} />
      </Modal>
    </div>
  )
}
