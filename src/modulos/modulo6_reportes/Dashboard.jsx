import { useMemo, useState } from 'react'
import {
  Banknote,
  CalendarDays,
  HandCoins,
  Landmark,
  Medal,
  Receipt,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { hoyISO, money } from '../../utils/format'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'

const METODOS = [
  { k: 'efectivo', label: 'Efectivo', icon: Banknote, bar: 'bg-emerald-500', text: 'text-emerald-600', hex: '#10b981' },
  { k: 'transferencia', label: 'Transferencia', icon: Landmark, bar: 'bg-indigo-500', text: 'text-indigo-600', hex: '#6366f1' },
  { k: 'fiado', label: 'Fiado', icon: HandCoins, bar: 'bg-amber-500', text: 'text-amber-600', hex: '#f59e0b' },
]

const RANGOS = [
  { k: 'hoy', label: 'Hoy' },
  { k: 'semana', label: 'Esta Semana' },
  { k: 'mes', label: 'Este Mes' },
  { k: 'custom', label: 'Rango Personalizado' },
]

const RANGO_TXT = { hoy: 'de hoy', semana: 'de esta semana', mes: 'de este mes', custom: 'del período' }
const MEDAL = ['text-amber-500', 'text-slate-400', 'text-amber-700']

const enRango = (iso, rango, desde, hasta) => {
  const f = new Date(iso)
  const now = new Date()
  if (rango === 'hoy') return f.toDateString() === now.toDateString()
  if (rango === 'semana') {
    const lunes = new Date(now)
    lunes.setHours(0, 0, 0, 0)
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7))
    return f >= lunes
  }
  if (rango === 'mes') return f.getMonth() === now.getMonth() && f.getFullYear() === now.getFullYear()
  return f >= new Date(desde + 'T00:00:00') && f <= new Date(hasta + 'T23:59:59.999')
}

export default function Dashboard() {
  const { ventas, clientes, productos } = useKiosco()
  const [rango, setRango] = useState('hoy')
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())

  const stats = useMemo(() => {
    // Las transferencias "en espera" no cuentan como recaudación hasta
    // que el mostrador aprueba el cobro.
    const vF = ventas.filter(
      (v) => !v.anulada && v.estado !== 'en_espera_transferencia' && enRango(v.fecha, rango, desde, hasta)
    )
    const porMetodo = { efectivo: 0, transferencia: 0, fiado: 0 }
    let ganancia = 0
    const porProducto = {}

    for (const v of vF) {
      porMetodo[v.metodo] += v.total
      for (const it of v.items) {
        ganancia += (it.precio - (it.costo || 0)) * it.cantidad
        const key = it.productoId || it.nombre
        porProducto[key] = porProducto[key] || { nombre: it.nombre, cant: 0, monto: 0 }
        porProducto[key].cant += it.cantidad
        porProducto[key].monto += it.precio * it.cantidad
      }
    }

    const ranking = Object.values(porProducto).sort((a, b) => b.cant - a.cant || b.monto - a.monto)
    return {
      vF,
      porMetodo,
      total: vF.reduce((s, v) => s + v.total, 0),
      ganancia,
      top3: ranking.slice(0, 3),
      top10: ranking.slice(0, 10),
      capitalFiados: clientes.reduce((s, a) => s + a.deuda, 0),
      criticos: productos.filter((p) => p.stock < p.stockMin).length,
    }
  }, [ventas, clientes, productos, rango, desde, hasta])

  const maxTop = Math.max(1, ...stats.top10.map((t) => t.cant))
  const periodo = RANGO_TXT[rango]

  // Distribución proporcional por método de pago para el anillo SVG
  const totalMetodos = METODOS.reduce((s, m) => s + stats.porMetodo[m.k], 0)
  const DONUT_R = 45
  const DONUT_C = 2 * Math.PI * DONUT_R
  const segmentos = METODOS.reduce((acc, m) => {
    const val = stats.porMetodo[m.k]
    const frac = totalMetodos > 0 ? val / totalMetodos : 0
    const offset = acc.reduce((s, x) => s + x.frac, 0)
    acc.push({ ...m, val, frac, offset })
    return acc
  }, [])

  return (
    <div className="flex flex-col gap-5">
      {/* Filtros temporales */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays size={16} className="text-emerald-600" />
        {RANGOS.map((r) => (
          <button
            key={r.k}
            onClick={() => setRango(r.k)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              rango === r.k
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
            }`}
          >
            {r.label}
          </button>
        ))}
        {rango === 'custom' && (
          <span className="fade-in flex items-center gap-2">
            <input
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <span className="text-xs text-slate-400">a</span>
            <input
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </span>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Receipt} tone="emerald" label={`Recaudación ${periodo}`} value={money(stats.total)} sub={`${stats.vF.length} ventas`} style={{ animationDelay: '0ms' }} />
        <StatCard icon={TrendingUp} tone="emerald" label="Ganancia neta estimada" value={money(stats.ganancia)} sub="Venta − costo" style={{ animationDelay: '60ms' }} />
        <StatCard icon={HandCoins} tone="amber" label="Capital en fiados" value={money(stats.capitalFiados)} sub="Deuda pendiente total" style={{ animationDelay: '120ms' }} />
        <StatCard icon={TriangleAlert} tone="rose" label="Productos bajo mínimo" value={stats.criticos} sub="Requieren reposición" style={{ animationDelay: '180ms' }} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Top 3 */}
        <Card title={`Top 3 productos más vendidos ${periodo}`} subtitle="Por unidades vendidas">
          {stats.top3.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No hay ventas en el período elegido.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {stats.top3.map((t, i) => (
                <li key={t.nombre}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <Medal size={15} className={MEDAL[i]} />
                      {t.nombre}
                    </span>
                    <span className="text-slate-500">{t.cant} u. · <b className="text-slate-700">{money(t.monto)}</b></span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                      style={{ width: `${(t.cant / maxTop) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Top 10 */}
        <Card title={`Top 10 ranking ${periodo}`} subtitle="Productos ordenados por unidades">
          {stats.top10.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No hay ventas en el período elegido.</p>
          ) : (
            <ul className="flex flex-col">
              {stats.top10.map((t, i) => (
                <li key={t.nombre} className="flex items-center gap-3 border-b border-slate-50 py-2 last:border-0">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : i < 3 ? 'bg-slate-100 text-slate-600' : 'text-slate-400'
                  }`}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{t.nombre}</span>
                  <span className="text-xs text-slate-400">{t.cant} u.</span>
                  <span className="w-20 text-right text-sm font-semibold text-slate-700">{money(t.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Caja por método de pago */}
      <Card title={`Caja ${periodo} por método de pago`} subtitle="Distribución proporcional de la recaudación">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Anillo de distribución */}
          <div className="relative shrink-0">
            <svg viewBox="0 0 120 120" className="h-44 w-44" role="img" aria-label="Distribución por método de pago">
              <circle cx="60" cy="60" r={DONUT_R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
              {segmentos
                .filter((s) => s.frac > 0)
                .map((s) => (
                  <circle
                    key={s.k}
                    cx="60"
                    cy="60"
                    r={DONUT_R}
                    fill="none"
                    stroke={s.hex}
                    strokeWidth="14"
                    strokeDasharray={`${Math.max(0, s.frac * DONUT_C - 1)} ${DONUT_C}`}
                    strokeDashoffset={-s.offset * DONUT_C}
                    transform="rotate(-90 60 60)"
                  />
                ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-slate-800">{money(totalMetodos)}</span>
              <span className="text-[10px] text-slate-400">Total</span>
            </div>
          </div>

          {/* Detalle con porcentajes */}
          <ul className="flex w-full flex-1 flex-col gap-4">
            {segmentos.map(({ k, label, icon: Icon, bar, text, hex, val, frac }) => (
              <li key={k}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hex }} />
                    <Icon size={15} className={text} /> {label}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                      {totalMetodos > 0 ? `${Math.round(frac * 100)}%` : '0%'}
                    </span>
                    <span className={`font-bold ${text}`}>{money(val)}</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${bar} transition-all duration-500`}
                    style={{ width: `${frac * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {stats.capitalFiados > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <TriangleAlert size={20} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Hay {money(stats.capitalFiados)} inmovilizados en fiados pendientes
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Revisá el módulo "Clientes" para gestionar la cobranza de la libreta.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
