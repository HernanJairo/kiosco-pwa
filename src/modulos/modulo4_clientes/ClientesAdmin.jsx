import { useMemo, useState } from 'react'
import { CheckCircle2, CreditCard, HandCoins, History, KeyRound, Loader2, Medal, MessageCircle, Search, ShieldCheck, Trash2, UserPlus, Users, Wallet } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye } from '../../utils/busqueda'
import { limiteFiadoVigente } from '../../context/operaciones'
import { money } from '../../utils/format'
import { telefonoInternacional, textoAccesoCliente, waLink } from '../../utils/whatsapp'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import PhoneInput from '../../components/ui/PhoneInput'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'
import { HistorialContenido } from './HistorialCliente'

const MEDAL = ['text-amber-500', 'text-slate-400', 'text-amber-700']

export default function ClientesAdmin() {
  const { clientes, session, registrarPago, recargarSaldo, crearCliente, eliminarCliente, resetearPinCliente, updateCliente, config, notify } = useKiosco()
  const [q, setQ] = useState('')
  const [soloDeuda, setSoloDeuda] = useState(false)
  const [pagoDe, setPagoDe] = useState(null)      // cliente → pago parcial
  const [totalDe, setTotalDe] = useState(null)    // cliente → saldar deuda completa
  const [recargaDe, setRecargaDe] = useState(null)
  const [pinDe, setPinDe] = useState(null)        // cliente → restablecer PIN
  const [altaOpen, setAltaOpen] = useState(false)
  const [bajaDe, setBajaDe] = useState(null)      // cliente → confirmación de baja
  const [histDe, setHistDe] = useState(null)      // cliente → historial de operaciones
  const [fiadoDe, setFiadoDe] = useState(null)    // cliente → control de Cta. Corriente
  const [monto, setMonto] = useState('')
  const [busy, setBusy] = useState(false)

  // El vendedor usa la libreta en modo OPERATIVO: puede dar de alta un
  // cliente, cargarle saldo prepago y consultar su Historial — pero jamás
  // editar datos personales, restablecer PINs, tocar el fiado ni borrar.
  const esVendedor = session?.rol === 'vendedor'

  const ranking = useMemo(
    () => [...clientes].sort((a, b) => b.deuda - a.deuda),
    [clientes]
  )
  const list = ranking.filter(
    (c) =>
      (!soloDeuda || c.deuda > 0) &&
      incluye(`${c.nombre} ${c.apellido} ${c.dni} ${c.telefono || ''} ${c.email || ''}`, q)
  )

  const deudaTotal = clientes.reduce((s, c) => s + c.deuda, 0)
  const conDeuda = clientes.filter((c) => c.deuda > 0).length
  const saldoTotal = clientes.reduce((s, c) => s + c.saldo, 0)

  const abrir = (c, tipo) => {
    setMonto(tipo === 'pago' ? String(c.deuda || '') : '')
    if (tipo === 'pago') setPagoDe(c)
    else setRecargaDe(c)
  }

  const confirmar = async (e) => {
    e.preventDefault()
    const c = pagoDe || recargaDe
    setBusy(true)
    try {
      if (pagoDe) {
        await registrarPago(c.id, Number(monto), 'kiosco')
        notify(`Pago de ${money(Number(monto))} registrado a ${c.nombre}.`)
        setPagoDe(null)
      } else {
        await recargarSaldo(c.id, Number(monto))
        notify(`Saldo de ${c.nombre} recargado en ${money(Number(monto))}.`)
        setRecargaDe(null)
      }
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const saldarTotal = async () => {
    setBusy(true)
    try {
      await registrarPago(totalDe.id, totalDe.deuda, 'kiosco')
      notify(`Deuda de ${totalDe.nombre} ${totalDe.apellido} saldada por completo.`)
      setTotalDe(null)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmarBaja = async () => {
    setBusy(true)
    try {
      await eliminarCliente(bajaDe.id)
      notify(`Cliente ${bajaDe.nombre} ${bajaDe.apellido} eliminado.`, 'info')
      setBajaDe(null)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const target = pagoDe || recargaDe

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => setSoloDeuda(false)} className="text-left" title="Ver todos los clientes">
          <StatCard
            icon={HandCoins}
            tone="rose"
            label="Deuda total de fiados"
            value={money(deudaTotal)}
            sub={soloDeuda ? 'Clic para ver todos' : undefined}
            className={!soloDeuda ? 'ring-2 ring-brand/40' : ''}
          />
        </button>
        <button type="button" onClick={() => setSoloDeuda((v) => !v)} className="text-left" title={soloDeuda ? 'Quitar filtro' : 'Filtrar solo con deuda'}>
          <StatCard
            icon={Medal}
            tone="amber"
            label="Clientes con deuda"
            value={`${conDeuda} de ${clientes.length}`}
            sub={soloDeuda ? 'Filtro activo · clic para ver todos' : 'Clic para filtrar'}
            className={soloDeuda ? 'ring-2 ring-amber-400' : ''}
          />
        </button>
        <button type="button" onClick={() => setSoloDeuda(false)} className="text-left" title="Ver todos los clientes">
          <StatCard
            icon={Wallet}
            tone="emerald"
            label="Saldo total en billeteras"
            value={money(saldoTotal)}
            className={!soloDeuda ? 'ring-2 ring-brand/40' : ''}
          />
        </button>
      </div>

      <Card
        title={esVendedor ? 'Libreta de Clientes' : 'Libreta de Clientes y Cobranza'}
        subtitle={
          esVendedor
            ? 'Alta de clientes, recargas de saldo e historial de compras'
            : soloDeuda ? `Mostrando solo clientes con deuda (${list.length})` : 'Cuentas corrientes, fiados y accesos'
        }
        actions={
          esVendedor ? (
            <Badge tone="brand" className="gap-1"><ShieldCheck size={12} /> Operativo</Badge>
          ) : soloDeuda ? (
            <Button size="sm" variant="secondary" onClick={() => setSoloDeuda(false)}>
              Ver todos
            </Button>
          ) : null
        }
      >
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, DNI o teléfono…"
              className="w-full rounded-lg border border-transparent bg-[#F6F6F6] py-2 pl-9 pr-3 text-sm focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-soft"
            />
          </div>
          <Button size="sm" onClick={() => setAltaOpen(true)} className="shrink-0">
            <UserPlus size={14} /> Nuevo Cliente
          </Button>
        </div>

        {list.length === 0 ? (
          <EmptyState icon={Users} title="Sin clientes" sub="Dá de alta un cliente para habilitar su cuenta corriente." />
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((c, idx) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white shadow-soft px-4 py-3">
                <div className="flex w-8 justify-center">
                  {c.deuda > 0 && idx < 3 ? (
                    <Medal size={18} className={MEDAL[idx]} />
                  ) : (
                    <span className="text-xs font-bold text-slate-300">#{idx + 1}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{c.nombre} {c.apellido}</p>
                  <p className="truncate text-xs text-slate-400">
                    DNI {c.dni}
                    {c.telefono ? ` · +${telefonoInternacional(c.telefono)}` : ' · Sin teléfono'}
                    {c.email ? ` · ${c.email}` : ''}
                  </p>
                </div>
                <Badge tone="emerald">Saldo {money(c.saldo)}</Badge>
                <Badge tone={c.deuda > 0 ? 'rose' : 'slate'}>Deuda {money(c.deuda)}</Badge>
                <div className="flex flex-wrap gap-1.5">
                  {/* Historial: visible para admin y vendedor */}
                  <button
                    type="button"
                    onClick={() => setHistDe(c)}
                    title={`Ver historial de ${c.nombre}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF7FD] px-3.5 py-1.5 text-xs font-bold text-[#007AB8] transition-all duration-150 hover:bg-[#009DE0] hover:text-white active:scale-95"
                  >
                    <History size={13} /> Historial
                  </button>
                  {/* Recarga de saldo prepago: operación habilitada también
                      para el vendedor */}
                  <Button size="sm" variant="secondary" onClick={() => abrir(c, 'recarga')}>
                    <Wallet size={13} /> Recargar
                  </Button>
                  {!esVendedor && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setFiadoDe(c)}
                        title="Cuenta corriente: habilitar, ajustar límite o bloquear"
                      >
                        <CreditCard size={13} /> Cta. Corriente
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPinDe(c)}
                        title="Restablecer PIN de acceso"
                        aria-label={`Restablecer PIN de ${c.nombre}`}
                      >
                        <KeyRound size={14} />
                      </Button>
                      <a
                        href={waLink(c.telefono || '', textoAccesoCliente({ cliente: c }))}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Compartir acceso por WhatsApp"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand/20 bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-blue-100"
                      >
                        <MessageCircle size={13} /> <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                      <Button size="sm" variant="secondary" onClick={() => abrir(c, 'pago')} disabled={c.deuda <= 0}>
                        <HandCoins size={13} /> Pago parcial
                      </Button>
                      <Button size="sm" variant="success" onClick={() => setTotalDe(c)} disabled={c.deuda <= 0}>
                        <CheckCircle2 size={13} /> Pago total
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setBajaDe(c)}
                        disabled={c.deuda > 0}
                        title={c.deuda > 0 ? 'No se puede eliminar: tiene deuda pendiente' : 'Eliminar cliente'}
                        aria-label={`Eliminar ${c.nombre}`}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Pago parcial / recarga de saldo */}
      <Modal
        open={!!target}
        onClose={() => { setPagoDe(null); setRecargaDe(null) }}
        title={pagoDe ? 'Pago parcial de deuda' : 'Recargar saldo'}
      >
        {target && (
          <form onSubmit={confirmar} className="flex flex-col gap-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
              <b>{target.nombre} {target.apellido}</b> · DNI {target.dni}
              <br />
              Deuda: <b className="text-rose-600">{money(target.deuda)}</b> · Saldo: <b className="text-emerald-600">{money(target.saldo)}</b>
            </div>
            <Input
              label={`Monto a ${pagoDe ? 'cobrar' : 'acreditar'} ($)`}
              autoFocus
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
              required
            />
            {pagoDe && (
              <p className="text-[11px] text-slate-400">
                Se aplica primero a los fiados más antiguos; el excedente va al saldo.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => { setPagoDe(null); setRecargaDe(null) }}>
                Cancelar
              </Button>
              <Button type="submit" variant={pagoDe ? 'success' : 'primary'} disabled={busy}>
                {busy ? 'Procesando…' : 'Confirmar'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Pago total: salda la deuda completa de una vez */}
      <Modal open={!!totalDe} onClose={() => setTotalDe(null)} title="Pago total de la deuda">
        {totalDe && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
              <b>{totalDe.nombre} {totalDe.apellido}</b> · DNI {totalDe.dni}
              <br />
              Va a saldar <b className="text-rose-600">{money(totalDe.deuda)}</b> de deuda en un solo
              cobro. El excedente, si lo hubiera, queda como saldo a favor.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTotalDe(null)}>Cancelar</Button>
              <Button variant="success" onClick={saldarTotal} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {busy ? 'Procesando…' : `Saldar ${money(totalDe.deuda)}`}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Alta comercial */}
      <Modal open={altaOpen} onClose={() => setAltaOpen(false)} title="Nuevo cliente">
        {altaOpen && <FormNuevoCliente crearCliente={crearCliente} config={config} notify={notify} esVendedor={esVendedor} onClose={() => setAltaOpen(false)} />}
      </Modal>

      {/* Control maestro de Cuenta Corriente (solo admin): habilitar
          desde el día 1, ajustar el límite o bloquear al instante. */}
      <Modal
        open={!!fiadoDe}
        onClose={() => setFiadoDe(null)}
        title={fiadoDe ? `Cuenta corriente · ${fiadoDe.nombre} ${fiadoDe.apellido}` : ''}
      >
        {fiadoDe && (
          <FormFiado
            cliente={fiadoDe}
            config={config}
            updateCliente={updateCliente}
            notify={notify}
            onClose={() => setFiadoDe(null)}
          />
        )}
      </Modal>

      {/* Restablecer PIN */}
      <Modal open={!!pinDe} onClose={() => setPinDe(null)} title="Restablecer PIN">
        {pinDe && <FormResetPin cliente={pinDe} resetearPinCliente={resetearPinCliente} notify={notify} onClose={() => setPinDe(null)} />}
      </Modal>

      {/* Historial del cliente: mismo detalle que ve el propio cliente
          en su pestaña Historial (compras, encargos y billetera). */}
      <Modal
        open={!!histDe}
        onClose={() => setHistDe(null)}
        title={histDe ? `Historial · ${histDe.nombre} ${histDe.apellido}` : ''}
        wide
      >
        {histDe && (
          <div className="wallet-app">
            <HistorialContenido cliente={histDe} />
          </div>
        )}
      </Modal>

      {/* Confirmación de baja */}
      <Modal open={!!bajaDe} onClose={() => setBajaDe(null)} title="Eliminar cliente">
        {bajaDe && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              ¿Eliminar a <b>{bajaDe.nombre} {bajaDe.apellido}</b> (DNI {bajaDe.dni})? Se borran su
              cuenta y su historial. No se puede deshacer.
            </p>
            {bajaDe.deuda > 0 && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                Este cliente tiene una deuda de {money(bajaDe.deuda)}: el sistema bloquea la baja
                hasta saldarla.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setBajaDe(null)}>Cancelar</Button>
              <Button variant="danger" onClick={confirmarBaja} disabled={busy || bajaDe.deuda > 0}>
                <Trash2 size={14} /> {busy ? 'Eliminando…' : 'Eliminar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// Restablecimiento directo del PIN: asigna 1234 por defecto o un
// temporal de 4 dígitos a elección del mostrador.
function FormResetPin({ cliente, resetearPinCliente, notify, onClose }) {
  const [pin, setPin] = useState('1234')
  const [busy, setBusy] = useState(false)
  const pinValido = /^\d{4}$/.test(pin)

  const aplicar = async () => {
    if (!pinValido) return notify('El PIN debe tener exactamente 4 dígitos.', 'error')
    setBusy(true)
    try {
      await resetearPinCliente(cliente.id, pin)
      notify(`PIN de ${cliente.nombre} restablecido a ${pin}.`)
      onClose()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
        <b>{cliente.nombre} {cliente.apellido}</b> · DNI {cliente.dni}
        <br />
        PIN actual: <b className="font-mono">{cliente.pin}</b>
      </div>
      <Input
        label="PIN temporal (4 dígitos)"
        inputMode="numeric"
        maxLength={4}
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        required
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" variant="warn" disabled={busy || !pinValido} onClick={aplicar}>
          <KeyRound size={15} /> {busy ? 'Actualizando…' : `Restablecer a ${pin}`}
        </Button>
      </div>
      <p className="text-[11px] text-slate-400">
        El cliente ingresa con su DNI y este PIN temporal; puede personalizarlo desde su billetera.
      </p>
    </div>
  )
}

// Panel maestro de cuenta corriente (exclusivo del admin): habilitar
// desde el día 1 a clientes de confianza, ajustar el límite máximo o
// bloquear el fiado al instante.
function FormFiado({ cliente, config, updateCliente, notify, onClose }) {
  const vigente = limiteFiadoVigente(cliente, config)
  const estado = cliente.fiadoBloqueado ? 'bloqueado' : vigente > 0 ? 'habilitado' : 'sin_habilitar'
  const [limite, setLimite] = useState(String(vigente > 0 ? vigente : config?.limiteFiadoInicialDesbloqueado || 10000))
  const [busy, setBusy] = useState(false)

  const aplicar = async (patch, texto) => {
    setBusy(true)
    try {
      await updateCliente(cliente.id, patch)
      notify(texto)
      onClose()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const limiteNum = Math.max(0, Number(limite) || 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
        <b>{cliente.nombre} {cliente.apellido}</b> · DNI {cliente.dni}
        <br />
        {estado === 'bloqueado' && <>Estado: <b className="text-rose-600">Fiado bloqueado</b> · deuda {money(cliente.deuda)}</>}
        {estado === 'habilitado' && <>Estado: <b className="text-emerald-600">Fiado habilitado</b> · límite vigente {money(vigente)} · deuda {money(cliente.deuda)}</>}
        {estado === 'sin_habilitar' && <>Estado: <b className="text-slate-500">Sin cuenta corriente</b> · desbloqueo automático a las {config?.comprasMinimasParaFiado ?? 10} compras + {money(config?.montoMinimoParaFiado ?? 20000)} acumulados</>}
      </div>
      <Input
        label="Límite máximo de fiado ($)"
        inputMode="numeric"
        value={limite}
        onChange={(e) => setLimite(e.target.value.replace(/\D/g, ''))}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {estado === 'bloqueado' ? (
          <Button type="button" variant="success" disabled={busy} onClick={() => aplicar({ fiadoBloqueado: false }, `Fiado desbloqueado para ${cliente.nombre}.`)}>
            <ShieldCheck size={15} /> {busy ? 'Aplicando…' : 'Desbloquear fiado'}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="primary"
              disabled={busy || limiteNum <= 0}
              onClick={() => aplicar({ fiadoHabilitado: true, fiadoBloqueado: false, limiteFiado: limiteNum }, `Cta. Corriente de ${cliente.nombre} ${estado === 'habilitado' ? 'actualizada' : 'habilitada'} con límite ${money(limiteNum)}.`)}
            >
              <CreditCard size={15} /> {busy ? 'Aplicando…' : estado === 'habilitado' ? 'Guardar límite' : 'Habilitar ahora'}
            </Button>
            {estado === 'habilitado' && (
              <Button type="button" variant="danger" disabled={busy} onClick={() => aplicar({ fiadoBloqueado: true }, `Fiado bloqueado para ${cliente.nombre}.`)}>
                <Trash2 size={14} /> Bloquear fiado
              </Button>
            )}
          </>
        )}
      </div>
      <p className="text-[11px] text-slate-400">
        Habilitar deja al cliente operar en cuenta corriente desde ya; bloquear corta el fiado al
        instante (puede seguir pagando con saldo prepago).
      </p>
    </div>
  )
}

const ALTA_INIT = { nombre: '', apellido: '', dni: '', telefono: '', email: '', pin: '', limiteFiado: '0' }

// Formulario de alta comercial. Se remonta en cada apertura, así el
// estado queda limpio. Tras crear ofrece compartir el acceso por WhatsApp.
// Para el vendedor el límite de fiado queda oculto: siempre nace en 0.
function FormNuevoCliente({ crearCliente, config, notify, esVendedor = false, onClose }) {
  const [form, setForm] = useState(ALTA_INIT)
  const [busy, setBusy] = useState(false)
  const [creado, setCreado] = useState(null) // cliente

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await crearCliente({
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        telefono: form.telefono,
        email: form.email,
        pin: form.pin,
        // El vendedor nunca habilita fiado: alta siempre en 0 (prepago).
        limiteFiado: esVendedor ? 0 : Number(form.limiteFiado) || 0,
      })
      setCreado(res.cliente)
      notify(`Alta registrada: ${res.cliente.nombre} ${res.cliente.apellido} · DNI ${res.cliente.dni}.`)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (creado) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>
            <b>{creado.nombre} {creado.apellido}</b>
            <br />
            DNI <b>{creado.dni}</b> · PIN <b>{creado.pin}</b>
            {creado.limiteFiado > 0 && <> · Límite de fiado {money(creado.limiteFiado)}</>}
          </span>
        </div>
        <a
          href={waLink(creado.telefono || '', textoAccesoCliente({ cliente: creado }))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark"
        >
          <MessageCircle size={17} /> Compartir Acceso por WhatsApp
        </a>
        <p className="text-[11px] text-slate-400">
          {creado.telefono
            ? 'Se abre el chat del cliente con su DNI y su clave inicial ya redactados.'
            : 'Sin teléfono cargado: WhatsApp te deja elegir el contacto al abrirse.'}
        </p>
        <Button variant="secondary" onClick={onClose} className="w-full">
          Listo
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nombre *" placeholder="Ej.: Ana" autoFocus value={form.nombre} onChange={set('nombre')} required />
        <Input label="Apellido *" placeholder="Ej.: Pérez" value={form.apellido} onChange={set('apellido')} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="DNI *"
          inputMode="numeric"
          placeholder="Solo números"
          value={form.dni}
          onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
          required
        />
        <Input
          label="PIN inicial (4 dígitos) *"
          inputMode="numeric"
          maxLength={4}
          placeholder="Ej.: 1234"
          value={form.pin}
          onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
          required
        />
      </div>
      <PhoneInput
        label="Teléfono / WhatsApp del cliente"
        value={form.telefono}
        onChange={(v) => setForm((f) => ({ ...f, telefono: v }))}
      />
      <Input
        label="Correo electrónico (opcional)"
        type="email"
        placeholder="cliente@correo.com · también sirve para ingresar"
        value={form.email}
        onChange={set('email')}
      />
      {!esVendedor && (
        <>
          <Input
            label="Límite de cuenta corriente propio ($ · opcional)"
            inputMode="numeric"
            value={form.limiteFiado}
            onChange={(e) => setForm((f) => ({ ...f, limiteFiado: e.target.value.replace(/\D/g, '') }))}
          />
          <p className="-mt-1 text-[11px] text-slate-400">
            En 0 el cliente arranca solo con saldo prepago (desbloqueo automático a las{' '}
            {config?.comprasMinimasParaFiado ?? 10} compras + {money(config?.montoMinimoParaFiado ?? 20000)}{' '}
            acumulados); un límite cargado habilita el fiado desde el día 1.
          </p>
        </>
      )}
      {esVendedor && (
        <p className="-mt-1 text-[11px] text-slate-400">
          El cliente arranca con billetera prepaga; la Cuenta Corriente la gestiona la administración.
          El DNI es único: no se permiten duplicados.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Dar de alta'}
        </Button>
      </div>
    </form>
  )
}
