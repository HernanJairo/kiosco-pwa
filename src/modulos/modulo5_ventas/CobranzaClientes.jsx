import { useMemo, useState } from 'react'
import { HandCoins, Lock, NotebookPen, Search, User, Wallet } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye } from '../../utils/busqueda'
import { fmtFechaHora, money } from '../../utils/format'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'

export default function CobranzaClientes() {
  const { clientes, registrarPago, recargarSaldo, notify } = useKiosco()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [accion, setAccion] = useState(null) // 'cobro' | 'recarga'
  const [monto, setMonto] = useState('')
  const [busy, setBusy] = useState(false)

  const list = useMemo(
    () =>
      clientes
        .filter((a) =>
          incluye(`${a.nombre} ${a.apellido} ${a.dni} ${a.dni}`, q)
        )
        .sort((x, y) => y.deuda - x.deuda),
    [clientes, q]
  )

  const a = clientes.find((x) => x.id === sel)

  const abrir = (tipo) => {
    setMonto(tipo === 'cobro' ? String(a.deuda || '') : '')
    setAccion(tipo)
  }

  const confirmar = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (accion === 'cobro') {
        await registrarPago(a.id, Number(monto), 'kiosco')
        notify(`Cobro de ${money(Number(monto))} aplicado a ${a.nombre}.`)
      } else {
        await recargarSaldo(a.id, Number(monto))
        notify(`Se cargaron ${money(Number(monto))} de saldo a ${a.nombre}.`)
      }
      setAccion(null)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_1fr]">
      {/* Buscador + listado */}
      <Card title="Buscar cliente" subtitle="Por DNI, nombre o apellido" className="h-fit">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej: 45111222, María o 5° A…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
          {list.map((al) => (
            <li key={al.id}>
              <button
                onClick={() => setSel(al.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  sel === al.id
                    ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200'
                    : 'border-slate-200 bg-white hover:border-emerald-200'
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <User size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {al.nombre} {al.apellido}
                  </p>
                  <p className="text-[11px] text-slate-400">{al.dni} · DNI {al.dni}</p>
                </div>
                {al.deuda > 0 && <Badge tone="rose">{money(al.deuda)}</Badge>}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-4 text-center text-xs text-slate-400">Sin coincidencias</li>}
        </ul>
      </Card>

      {/* Detalle operativo del cliente */}
      <div className="flex min-w-0 flex-col gap-5">
        {!a ? (
          <EmptyState icon={Search} title="Seleccioná un cliente" sub="Buscá por DNI o nombre para ver su cuenta y cobrar." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard icon={Wallet} tone="emerald" label="Saldo disponible" value={money(a.saldo)} sub={`${a.nombre} ${a.apellido} · ${a.dni}`} />
              <StatCard icon={NotebookPen} tone="rose" label="Deuda de fiados" value={money(a.deuda)} sub={`${a.fiados.filter((f) => !f.pagado).length} fiado(s) abierto(s)`} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => abrir('recarga')}>
                <Wallet size={15} /> Cargar saldo (efectivo)
              </Button>
              <Button variant="success" onClick={() => abrir('cobro')} disabled={a.deuda <= 0}>
                <HandCoins size={15} /> Cobro / abono de deuda
              </Button>
            </div>

            <Card title="Fiados pendientes" subtitle="Se amortizan de más antiguo a más reciente">
              {a.fiados.filter((f) => !f.pagado).length === 0 ? (
                <EmptyState icon={HandCoins} title="Sin fiados pendientes" sub="La libreta está al día." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {a.fiados.filter((f) => !f.pagado).map((f) => (
                    <li key={f.id} className="rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">{fmtFechaHora(f.fecha)}</p>
                        <Badge tone="amber">Pendiente {money(f.pendiente)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {f.items.map((it) => `${it.cantidad}× ${it.nombre}`).join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <Lock size={14} className="mt-0.5 shrink-0 text-slate-400" />
              Vista operativa de mostrador: solo se muestran datos de cuenta del cliente. Los datos
              personales del cliente (teléfono, correo, dirección) no están disponibles para este rol.
            </div>
          </>
        )}
      </div>

      <Modal
        open={!!accion}
        onClose={() => setAccion(null)}
        title={accion === 'cobro' ? 'Cobro / abono de deuda' : 'Cargar saldo'}
      >
        {a && accion && (
          <form onSubmit={confirmar} className="flex flex-col gap-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
              <b>{a.nombre} {a.apellido}</b> · {a.dni} · DNI {a.dni}
              <br />
              Deuda: <b className="text-rose-600">{money(a.deuda)}</b> · Saldo:{' '}
              <b className="text-emerald-600">{money(a.saldo)}</b>
            </div>
            <Input
              label={accion === 'cobro' ? 'Monto a cobrar ($)' : 'Monto a acreditar ($)'}
              autoFocus
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
              required
            />
            {accion === 'cobro' && (
              <p className="text-[11px] text-slate-400">
                Se aplica primero a los fiados más antiguos; el excedente va al saldo.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAccion(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant={accion === 'cobro' ? 'success' : 'primary'} disabled={busy}>
                {busy ? 'Procesando…' : 'Confirmar'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
