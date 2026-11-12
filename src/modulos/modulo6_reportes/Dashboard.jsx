import { useMemo, useState } from 'react'
import {
  Banknote,
  CalendarDays,
  HandCoins,
  Landmark,
  Medal,
  PackageX,
  Percent,
  Receipt,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { hoyISO, money } from '../../utils/format'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'

const METODOS = [
  { k: 'efectivo', label: 'Efectivo', icon: Banknote, bar: 'bg-emerald-500', text: 'text-brand', hex: '#10b981' },
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

  /* ==== Motor de Recomendaciones & Ciencia de Datos ====
     Se calcula sobre TODO el historial de tickets (sin el filtro de
     período, que es para KPIs) para que las señales sean estables. */
  const reco = useMemo(() => {
    const vendidas = ventas.filter((v) => !v.anulada && v.estado !== 'en_espera_transferencia')
    const porProd = {} // productoId → {cant, monto, margen}
    const pares = new Map() // 'a|b' → {a, b, veces}

    for (const v of vendidas) {
      const ids = [...new Set(v.items.map((i) => i.productoId).filter(Boolean))]
      for (const it of v.items) {
        const u = (porProd[it.productoId] ||= { cant: 0, monto: 0, margen: 0 })
        u.cant += it.cantidad
        u.monto += it.precio * it.cantidad
        u.margen += (it.precio - (it.costo || 0)) * it.cantidad
      }
      // Reglas de asociación: pares de productos del mismo ticket.
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const [a, b] = [ids[i], ids[j]].sort()
          const k = `${a}|${b}`
          const par = pares.get(k) || { a, b, veces: 0 }
          par.veces += 1
          pares.set(k, par)
        }
      }
    }

    const prodById = Object.fromEntries(productos.map((p) => [p.id, p]))

    // Combos: pares más frecuentes con precio sugerido (10% menos que
    // comprarlos por separado, redondeado a decenas).
    const combos = [...pares.values()]
      .filter((x) => x.veces >= 1 && prodById[x.a] && prodById[x.b])
      .sort((x, y) => y.veces - x.veces)
      .slice(0, 3)
      .map((x) => {
        const pa = prodById[x.a]
        const pb = prodById[x.b]
        const separados = pa.precio + pb.precio
        return {
          ...x,
          pa,
          pb,
          separados,
          precioCombo: Math.round((separados * 0.9) / 10) * 10,
        }
      })

    // Baja rotación: stock alto (≥ 2× mínimo o ≥ 6 unidades) con ventas
    // casi nulas → candidatos a liquidación / promo.
    const rotacion = productos
      .map((p) => ({
        p,
        vendidasU: porProd[p.id]?.cant || 0,
        inmovilizado: p.stock * (p.costo || p.precio),
      }))
      .filter((x) => x.p.stock >= Math.max(6, (x.p.stockMin || 0) * 2) && x.vendidasU <= 1)
      .sort((a, b) => b.inmovilizado - a.inmovilizado)
      .slice(0, 3)

    // Estrellas: líderes de margen y volumen del historial.
    const estrellas = productos
      .map((p) => ({ p, ...(porProd[p.id] || { cant: 0, monto: 0, margen: 0 }) }))
      .filter((x) => x.cant > 0)
      .sort((a, b) => b.margen - a.margen || b.cant - a.cant)
      .slice(0, 3)

    // Reposición crítica: bajo el mínimo (o casi agotado), priorizando los
    // que más rotan.
    const reposicion = productos
      .map((p) => ({ p, cant: porProd[p.id]?.cant || 0 }))
      .filter((x) => x.p.stock <= (x.p.stockMin || 0) || x.p.stock < 5)
      .sort((a, b) => b.cant - a.cant || a.p.stock - b.p.stock)
      .slice(0, 4)

    return { combos, rotacion, estrellas, reposicion, tickets: vendidas.length }
  }, [ventas, productos])

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
        <CalendarDays size={16} className="text-brand" />
        {RANGOS.map((r) => (
          <button
            key={r.k}
            onClick={() => setRango(r.k)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              rango === r.k
                ? 'bg-brand text-white shadow-sm'
                : 'bg-[#F6F6F6] text-slate-600 hover:bg-[#EBF7FD] hover:text-[#007AB8]'
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
              className="rounded-lg border border-transparent bg-[#F6F6F6] px-2.5 py-1.5 text-xs text-slate-700 focus:border-[#009DE0]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-soft"
            />
            <span className="text-xs text-slate-400">a</span>
            <input
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg border border-transparent bg-[#F6F6F6] px-2.5 py-1.5 text-xs text-slate-700 focus:border-[#009DE0]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-soft"
            />
          </span>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Receipt} tone="brand" label={`Recaudación ${periodo}`} value={money(stats.total)} sub={`${stats.vF.length} ventas`} style={{ animationDelay: '0ms' }} />
        <StatCard icon={TrendingUp} tone="brand" label="Ganancia neta estimada" value={money(stats.ganancia)} sub="Venta − costo" style={{ animationDelay: '60ms' }} />
        <StatCard icon={HandCoins} tone="amber" label="Capital en fiados" value={money(stats.capitalFiados)} sub="Deuda pendiente total" style={{ animationDelay: '120ms' }} />
        <StatCard icon={TriangleAlert} tone="rose" label="Productos bajo mínimo" value={stats.criticos} sub="Requieren reposición" style={{ animationDelay: '180ms' }} />
      </div>

      {/* ===== Motor de Recomendaciones & Ciencia de Datos ===== */}
      <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 shadow-sm">
        <header className="flex items-center gap-3 border-b border-indigo-100 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Sparkles size={19} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Motor de Recomendaciones & Ciencia de Datos</h3>
            <p className="text-xs text-slate-500">
              Calculado sobre {reco.tickets} ticket(s) del historial completo y el stock vigente
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
          {/* Reglas de asociación / market basket */}
          <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-white p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-indigo-500">
              <Percent size={13} /> Sugerencia de combos
            </p>
            {reco.combos.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">
                Aún no hay pares de productos que se repitan juntos en los tickets.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {reco.combos.map((c) => (
                  <li key={`${c.a}-${c.b}`} className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
                    <p className="text-[13px] font-semibold leading-snug text-slate-800">
                      {c.pa.nombre} <span className="font-normal text-indigo-400">+</span> {c.pb.nombre}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Se compraron juntos <b>{c.veces}</b> {c.veces === 1 ? 'vez' : 'veces'}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-indigo-700">
                      Combo sugerido: <b>{money(c.precioCombo)}</b>
                      <span className="font-normal text-slate-400"> (separados {money(c.separados)})</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-auto text-[11px] leading-snug text-slate-400">
              Market basket: pares que comparten ticket con mayor frecuencia, con precio promocional (~10% off).
            </p>
          </div>

          {/* Baja rotación: liquidación / promo */}
          <div className="flex flex-col gap-3 rounded-xl border border-amber-100 bg-white p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-amber-600">
              <PackageX size={13} /> Baja rotación · Liquidación
            </p>
            {reco.rotacion.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">
                Sin productos estancados: todo el stock rota correctamente.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {reco.rotacion.map(({ p, vendidasU, inmovilizado }) => (
                  <li key={p.id} className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2.5">
                    <p className="text-[13px] font-semibold leading-snug text-slate-800">{p.nombre}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Stock <b>{p.stock} u.</b> · {vendidasU === 0 ? 'sin ventas registradas' : `solo ${vendidasU} u. vendida(s)`}
                      {' '}· inmovilizado {money(inmovilizado)}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-amber-700">
                      Recomendación: aplicar descuento o promo 2x1.
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-auto text-[11px] leading-snug text-slate-400">
              Stock alto con ventas casi nulas: conviene liberar el capital inmovilizado.
            </p>
          </div>

          {/* Estrellas & reposición crítica */}
          <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-white p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-brand">
              <Star size={13} /> Estrellas & reposición
            </p>
            {reco.estrellas.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {reco.estrellas.map(({ p, cant, margen }, i) => (
                  <li key={p.id} className="flex items-center gap-2 text-[13px]">
                    <Star size={13} className={i === 0 ? 'fill-amber-300 text-amber-400' : 'text-slate-300'} />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{p.nombre}</span>
                    <span className="text-[11px] text-slate-400">{cant} u. · {money(margen)} margen</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">Todavía no hay ventas para destacar estrellas.</p>
            )}
            {reco.reposicion.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-rose-100 bg-rose-50/70 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-500">
                  <RefreshCw size={12} /> Reponer urgente
                </p>
                {reco.reposicion.map(({ p }) => (
                  <p key={p.id} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="min-w-0 truncate">{p.nombre}</span>
                    <span className="shrink-0 font-semibold text-rose-600">stock {p.stock}/{p.stockMin}</span>
                  </p>
                ))}
              </div>
            )}
            <p className="mt-auto text-[11px] leading-snug text-slate-400">
              Líderes de margen/volumen y faltantes por debajo del mínimo de stock.
            </p>
          </div>
        </div>
      </section>

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
                      className="h-full rounded-full bg-gradient-to-r from-brand to-blue-400 transition-all duration-500"
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
