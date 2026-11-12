import { createElement, useMemo, useState } from 'react'
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, BadgeAlert, BarChart3, Boxes,
  CalendarDays, ChartNoAxesCombined, CircleDollarSign, Clock3, CreditCard,
  Gift, Lightbulb, PackageCheck, QrCode, Sparkles, TrendingUp, Wallet,
} from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { motorRecomendaciones, statsPeriodo } from '../../utils/reportes'
import { fechaLargaHoy, hoyISO, money } from '../../utils/format'
import { iconoCategoria } from '../../utils/icons'
import './ReportesAdmin.css'

const PERIODOS = [
  { k: 'hoy', label: 'Hoy' },
  { k: 'semana', label: 'Esta Semana' },
  { k: 'mes', label: 'Este Mes' },
  { k: 'custom', label: 'Rango Personalizado' },
]
const RANGO_TXT = { hoy: 'Hoy', semana: 'Esta Semana', mes: 'Este Mes', custom: 'Rango personalizado' }

// Colores de la dona por categoría (paleta v0 + fallback para dinámicas).
const COLOR_CAT = {
  Bebidas: '#009DE0',
  Snacks: '#72BA91',
  Galletitas: '#F1B95B',
  Almuerzos: '#E77C91',
  Útiles: '#9C8AD3',
  Otros: '#B9BCC2',
}
const PALETA = ['#009DE0', '#72BA91', '#F1B95B', '#E77C91', '#9C8AD3', '#5BC6E8', '#B9BCC2']
const colorDe = (cat, i) => COLOR_CAT[cat] || PALETA[i % PALETA.length]

const METODOS = [
  { k: 'transferencia', name: 'Transferencia / QR', tone: 'blue', icon: QrCode },
  { k: 'efectivo', name: 'Efectivo', tone: 'mint', icon: CircleDollarSign },
  { k: 'saldo', name: 'Billetera Yapa', tone: 'ice', icon: Wallet },
  { k: 'fiado', name: 'Cuenta Corriente / Fiado', tone: 'amber', icon: CreditCard },
]

const descargarReporte = ({ periodo, nombre, porCategoria, metodos, top10 }) => {
  const rows = [
    [`Reporte de ventas · ${nombre}`, periodo],
    ['Categoría', 'Ventas', 'Participación'],
    ...porCategoria.map((c) => [c.name, c.amount, `${c.share}%`]),
    [],
    ['Método de pago', 'Importe', 'Participación'],
    ...metodos.map((m) => [m.name, m.amount, `${m.share}%`]),
    [],
    ['Producto', 'Categoría', 'Unidades', 'Ventas'],
    ...top10.map((t) => [t.nombre, t.categoria, t.cant, t.monto]),
  ]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  link.download = 'yapa-reporte-ventas.csv'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

export default function ReportesAdmin() {
  const { ventas, clientes, productos, config } = useKiosco()
  const [rango, setRango] = useState('hoy')
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())

  const stats = useMemo(
    () => statsPeriodo({ ventas, clientes, productos, rango, desde, hasta }),
    [ventas, clientes, productos, rango, desde, hasta]
  )
  const reco = useMemo(() => motorRecomendaciones(ventas, productos), [ventas, productos])

  // Dona de categorías: proporción del importe por categoría en el período.
  const totalCat = stats.porCategoria.reduce((s, c) => s + c.amount, 0)
  const categorias = stats.porCategoria.map((c, i) => ({
    ...c,
    share: totalCat > 0 ? Math.round((c.amount / totalCat) * 100) : 0,
    color: colorDe(c.name, i),
  }))
  const R = 69.5
  const C = 2 * Math.PI * R
  const arcos = categorias.reduce((acc, c) => {
    const frac = totalCat > 0 ? c.amount / totalCat : 0
    const offset = acc.reduce((s, x) => s + x.frac, 0)
    acc.push({ ...c, frac, offset })
    return acc
  }, [])

  // Caja por método: importe y participación sobre lo recaudado.
  const totalMetodos = METODOS.reduce((s, m) => s + stats.porMetodo[m.k], 0)
  const metodos = METODOS.map((m) => ({
    ...m,
    amount: stats.porMetodo[m.k],
    share: totalMetodos > 0 ? Math.round((stats.porMetodo[m.k] / totalMetodos) * 100) : 0,
  }))

  const periodoTxt = RANGO_TXT[rango]
  const contexto =
    rango === 'custom'
      ? null
      : `${periodoTxt} · ${fechaLargaHoy()}`

  const comboTop = reco.combos[0]
  const slowTop = reco.rotacion[0]
  const repoTop = reco.reposicion[0]
  const estrellaTop = reco.estrellas[0]
  const topMax = Math.max(1, ...stats.top10.map((t) => t.cant))

  return (
    <div className="analytics-view">
      <section className="reports-heading">
        <div>
          <span className="reports-kicker">TU NEGOCIO, EN UN VISTAZO</span>
          <h1>Reportes y Analítica</h1>
          <p>Rendimiento en tiempo real de {config.nombreKiosco}.</p>
        </div>
        <button
          className="export-button"
          onClick={() =>
            descargarReporte({
              periodo: rango === 'custom' ? `${desde} → ${hasta}` : periodoTxt,
              nombre: config.nombreKiosco,
              porCategoria: categorias,
              metodos,
              top10: stats.top10,
            })
          }
        >
          <ArrowDownToLine size={16} />
          Exportar reporte
        </button>
      </section>

      <section className="report-controls" aria-label="Período del reporte">
        <div className="period-pills" role="group" aria-label="Elegir período">
          {PERIODOS.map((p) => (
            <button
              key={p.k}
              className={rango === p.k ? 'period-pill selected' : 'period-pill'}
              aria-pressed={rango === p.k}
              onClick={() => setRango(p.k)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {rango === 'custom' ? (
          <div className="custom-date-range">
            <label>
              Desde
              <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} aria-label="Fecha inicial" />
            </label>
            <span>—</span>
            <label>
              Hasta
              <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} aria-label="Fecha final" />
            </label>
          </div>
        ) : (
          <span className="period-context">
            <CalendarDays size={14} />
            {contexto}
          </span>
        )}
      </section>

      <section className="kpi-grid" aria-label="Indicadores de negocio">
        <article className="kpi-card kpi-revenue">
          <span className="kpi-icon"><CircleDollarSign size={18} /></span>
          <span className="kpi-label">RECAUDACIÓN TOTAL</span>
          <strong className="kpi-value">{money(stats.total)}</strong>
          <span className="kpi-meta"><i><ArrowUpRight size={13} />{stats.cantidadVentas}</i>ventas en el período</span>
        </article>
        <article className="kpi-card kpi-profit">
          <span className="kpi-icon"><TrendingUp size={18} /></span>
          <span className="kpi-label">GANANCIA NETA ESTIMADA</span>
          <strong className="kpi-value">{money(stats.ganancia)}</strong>
          <span className="kpi-meta"><i>{stats.margenPct}% margen</i><b>·</b> Venta menos costo</span>
        </article>
        <article className="kpi-card kpi-credit">
          <span className="kpi-icon"><Wallet size={18} /></span>
          <span className="kpi-label">CAPITAL EN FIADOS</span>
          <strong className="kpi-value">{money(stats.capitalFiados)}</strong>
          <span className="kpi-meta">Deuda pendiente total</span>
        </article>
        <article className="kpi-card kpi-low-stock">
          <span className="kpi-icon"><Boxes size={18} /></span>
          <span className="kpi-label">PRODUCTOS BAJO MÍNIMO</span>
          <strong className="kpi-value">{stats.criticos}</strong>
          <span className="kpi-meta">Requieren reposición</span>
        </article>
      </section>

      <section className="main-report-grid">
        <article className="report-card category-sales-card">
          <div className="report-card-heading">
            <div>
              <span className="report-overline">VENTAS DEL PERÍODO</span>
              <h2>Ventas por Categoría</h2>
            </div>
            <span className="heading-icon blue-icon"><BarChart3 size={17} /></span>
          </div>
          <div className="category-chart-layout">
            <div className="donut-wrap">
              <svg className="category-donut" viewBox="0 0 200 200" role="img" aria-label="Gráfico de dona de ventas por categoría">
                <circle cx="100" cy="100" r={R} fill="none" stroke="#F1F5F9" strokeWidth="25" />
                {arcos.map((c) => (
                  <circle
                    key={c.name}
                    cx="100"
                    cy="100"
                    r={R}
                    fill="none"
                    stroke={c.color}
                    strokeWidth="25"
                    strokeDasharray={`${Math.max(0, c.frac * C - 3)} ${C}`}
                    strokeDashoffset={-c.offset * C}
                    strokeLinecap="butt"
                    transform="rotate(-90 100 100)"
                  />
                ))}
              </svg>
              <div className="donut-center">
                <strong>{money(totalCat)}</strong>
                <span>en ventas</span>
              </div>
            </div>
            <div className="category-legend" role="list" aria-label="Detalle de ventas por categoría">
              {categorias.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: '#9398a0' }}>Sin ventas en el período elegido.</p>
              ) : (
                categorias.map((c) => (
                  <div className="category-legend-row" key={c.name} role="listitem">
                    <span className="legend-name"><i style={{ backgroundColor: c.color }} />{c.name}</span>
                    <strong>{money(c.amount)}</strong>
                    <span>{c.share}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </article>

        <article className="report-card tender-card">
          <div className="report-card-heading">
            <div>
              <span className="report-overline">DISTRIBUCIÓN DE COBROS</span>
              <h2>Caja por Método de Pago</h2>
            </div>
            <span className="heading-icon ice-icon"><CreditCard size={17} /></span>
          </div>
          <div className="tender-list">
            {metodos.map((m) => (
              <div className={`tender-row tender-${m.tone}`} key={m.k}>
                <span className="tender-symbol"><m.icon size={17} /></span>
                <div className="tender-main">
                  <div className="tender-title-line">
                    <strong>{m.name}</strong>
                    <span>{m.share}%</span>
                  </div>
                  <div className="tender-track"><i style={{ width: `${m.share}%` }} /></div>
                </div>
                <strong className="tender-amount">{money(m.amount)}</strong>
              </div>
            ))}
          </div>
          <div className="tender-footnote">
            <span><Clock3 size={13} />Corte de caja actualizado</span>
            <strong><span className="live-dot" />En vivo</strong>
          </div>
        </article>
      </section>

      <section className="recommendation-section">
        <div className="section-title-row">
          <div>
            <span className="report-overline">DATOS QUE TE AYUDAN A DECIDIR</span>
            <h2>Ideas para vender mejor</h2>
          </div>
          <span className="insights-badge"><Sparkles size={14} />Yapa recomienda</span>
        </div>
        <div className="recommendation-grid">
          <article className="recommendation-card combo-card">
            <span className="recommendation-icon"><Lightbulb size={18} /></span>
            <span className="recommendation-label">COMBOS QUE CONVIERTEN</span>
            <h3>Probá un combo que ya funciona</h3>
            {comboTop ? (
              <>
                <div className="pair-products">
                  <span>{createElement(iconoCategoria(comboTop.pa.categoria), { size: 14 })}{comboTop.pa.nombre}</span>
                  <i>+</i>
                  <span>{createElement(iconoCategoria(comboTop.pb.categoria), { size: 14 })}{comboTop.pb.nombre}</span>
                </div>
                <div className="recommendation-result">
                  <span>Precio sugerido · juntos {comboTop.veces} {comboTop.veces === 1 ? 'vez' : 'veces'}</span>
                  <strong>{money(comboTop.precioCombo)} <ArrowRight size={14} /></strong>
                </div>
                {reco.combos.length > 1 && (
                  <p style={{ margin: '10px 0 0', fontSize: 9, color: '#9398a0' }}>
                    También: {reco.combos.slice(1).map((c) => `${c.pa.nombre} + ${c.pb.nombre}`).join(' · ')}
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: '8px 0 0', fontSize: 10, color: '#9398a0' }}>Todavía no hay pares repetidos en los tickets.</p>
            )}
          </article>

          <article className="recommendation-card slow-card">
            <span className="recommendation-icon"><Clock3 size={18} /></span>
            <span className="recommendation-label">BAJA ROTACIÓN</span>
            <h3>Dale movimiento a tu stock</h3>
            {slowTop ? (
              <>
                <div className="slow-product">
                  <span className="slow-product-icon">{createElement(iconoCategoria(slowTop.p.categoria), { size: 18 })}</span>
                  <span>
                    <strong>{slowTop.p.nombre}</strong>
                    <small>{slowTop.p.stock} u. en stock · {money(slowTop.inmovilizado)} inmovilizados</small>
                  </span>
                </div>
                <div className="recommendation-result">
                  <span>Idea para liquidar</span>
                  <strong className="promo-chip">Promo 2x1</strong>
                </div>
                {reco.rotacion.length > 1 && (
                  <p style={{ margin: '10px 0 0', fontSize: 9, color: '#9398a0' }}>
                    También: {reco.rotacion.slice(1).map((r) => r.p.nombre).join(' · ')}
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: '8px 0 0', fontSize: 10, color: '#9398a0' }}>Sin productos estancados: todo el stock rota bien.</p>
            )}
          </article>

          <article className="recommendation-card restock-card">
            <span className="recommendation-icon"><PackageCheck size={18} /></span>
            <span className="recommendation-label">ESTRELLAS & REPOSICIÓN</span>
            <h3>Tu próxima estrella está por agotarse</h3>
            {repoTop ? (
              <>
                <div className="restock-product">
                  <span className="restock-icon">{createElement(iconoCategoria(repoTop.p.categoria), { size: 18 })}</span>
                  <span>
                    <strong>{repoTop.p.nombre}</strong>
                    <small>{repoTop.cant > 0 ? `${repoTop.cant} u. vendidas` : 'Alta prioridad de compra'}</small>
                  </span>
                  {estrellaTop && <b>★</b>}
                </div>
                <div className="recommendation-result">
                  <span className="low-stock-note"><BadgeAlert size={14} />Quedan {repoTop.p.stock} de {repoTop.p.stockMin || 5} u.</span>
                  <strong className="restock-action">Reponer hoy</strong>
                </div>
                {reco.reposicion.length > 1 && (
                  <p style={{ margin: '10px 0 0', fontSize: 9, color: '#9398a0' }}>
                    También: {reco.reposicion.slice(1).map((r) => r.p.nombre).join(' · ')}
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: '8px 0 0', fontSize: 10, color: '#9398a0' }}>Ningún producto por debajo de su mínimo.</p>
            )}
          </article>
        </div>
      </section>

      <section className="report-card bestseller-card">
        <div className="report-card-heading bestseller-heading">
          <div>
            <span className="report-overline">LO MÁS ELEGIDO</span>
            <h2>Top 10 productos más vendidos</h2>
          </div>
          <span className="heading-icon mint-icon"><ChartNoAxesCombined size={17} /></span>
        </div>
        <div className="bestseller-table-wrap">
          <table className="bestseller-table">
            <thead>
              <tr>
                <th scope="col">PRODUCTO</th>
                <th scope="col">CATEGORÍA</th>
                <th scope="col">UNIDADES</th>
                <th scope="col">VENTAS</th>
                <th scope="col"><span className="sr-only">Progreso de ventas</span></th>
              </tr>
            </thead>
            <tbody>
              {stats.top10.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '18px 0', textAlign: 'center', color: '#9398a0', fontSize: 11 }}>No hay ventas en el período elegido.</td></tr>
              ) : (
                stats.top10.map((t, i) => (
                  <tr key={t.nombre}>
                    <td>
                      <span className={`rank-number${i < 3 ? ` rank-${i + 1}` : ''}`}>{String(i + 1).padStart(2, '0')}</span>
                      <span className="bestseller-product-name">{t.nombre}</span>
                    </td>
                    <td><span className={`table-category category-text-${i % 5}`}>{t.categoria}</span></td>
                    <td className="units-cell">{t.cant} u.</td>
                    <td className="revenue-cell">{money(t.monto)}</td>
                    <td className="progress-cell"><span className="sales-progress"><i style={{ width: `${(t.cant / topMax) * 100}%` }} /></span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Período: {rango === 'custom' ? `${desde} → ${hasta}` : periodoTxt}</span>
          <span>{stats.top10.length} productos <ArrowRight size={13} /></span>
        </div>
      </section>

      <div className="report-disclaimer">
        <Gift size={14} />
        Datos calculados en vivo sobre {reco.tickets} ticket(s) del historial de {config.nombreKiosco}.
      </div>
    </div>
  )
}
