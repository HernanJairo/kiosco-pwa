// Lógica pura de agregación para "Reportes y Analítica": KPIs del
// período, ventas por categoría, caja por método de pago, ranking de
// productos y el motor de recomendaciones (market basket, rotación,
// estrellas, reposición). Sin dependencias de React: testeable en QA.

export const enRango = (iso, rango, desde, hasta) => {
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

// Venta computable: ni anulada ni transferencia en espera de acreditar.
const computable = (v) => !v.anulada && v.estado !== 'en_espera_transferencia'

/* KPIs y agregados del período elegido. `porMetodo` contempla los cuatro
   medios del mostrador; `porCategoria` agrupa el importe por la categoría
   del producto vendido (los ítems sin producto vigente caen en "Otros"). */
export function statsPeriodo({ ventas, clientes, productos, rango, desde, hasta }) {
  const vF = (ventas || []).filter((v) => computable(v) && enRango(v.fecha, rango, desde, hasta))
  const catDe = Object.fromEntries((productos || []).map((p) => [p.id, p.categoria || 'Otros']))
  const porMetodo = { efectivo: 0, transferencia: 0, saldo: 0, fiado: 0 }
  const porCategoria = {}
  const porProducto = {}
  let ganancia = 0

  for (const v of vF) {
    if (porMetodo[v.metodo] !== undefined) porMetodo[v.metodo] += v.total
    for (const it of v.items || []) {
      ganancia += (it.precio - (it.costo || 0)) * it.cantidad
      const cat = catDe[it.productoId] || 'Otros'
      porCategoria[cat] = (porCategoria[cat] || 0) + it.precio * it.cantidad
      const key = it.productoId || it.nombre
      const u = (porProducto[key] ||= { nombre: it.nombre, categoria: cat, cant: 0, monto: 0 })
      u.cant += it.cantidad
      u.monto += it.precio * it.cantidad
    }
  }

  const total = vF.reduce((s, v) => s + v.total, 0)
  const ranking = Object.values(porProducto).sort((a, b) => b.cant - a.cant || b.monto - a.monto)
  return {
    vF,
    total,
    cantidadVentas: vF.length,
    ganancia,
    margenPct: total > 0 ? Math.round((ganancia / total) * 1000) / 10 : 0,
    porMetodo,
    porCategoria: Object.entries(porCategoria)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
    top10: ranking.slice(0, 10),
    capitalFiados: (clientes || []).reduce((s, a) => s + (a.deuda || 0), 0),
    criticos: (productos || []).filter((p) => p.stock < p.stockMin).length,
  }
}

/* Motor de Recomendaciones & Ciencia de Datos: corre sobre TODO el
   historial de tickets (independiente del filtro de período) para que
   las señales sean estables. */
export function motorRecomendaciones(ventas, productos) {
  const vendidas = (ventas || []).filter(computable)
  const porProd = {} // productoId → {cant, monto, margen}
  const pares = new Map() // 'a|b' → {a, b, veces}

  for (const v of vendidas) {
    const ids = [...new Set((v.items || []).map((i) => i.productoId).filter(Boolean))]
    for (const it of v.items || []) {
      const u = (porProd[it.productoId] ||= { cant: 0, monto: 0, margen: 0 })
      u.cant += it.cantidad
      u.monto += it.precio * it.cantidad
      u.margen += (it.precio - (it.costo || 0)) * it.cantidad
    }
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

  const prodById = Object.fromEntries((productos || []).map((p) => [p.id, p]))

  // Combos: pares más frecuentes con precio sugerido (~10% menos que
  // comprarlos por separado, redondeado a decenas).
  const combos = [...pares.values()]
    .filter((x) => x.veces >= 1 && prodById[x.a] && prodById[x.b])
    .sort((x, y) => y.veces - x.veces)
    .slice(0, 3)
    .map((x) => {
      const pa = prodById[x.a]
      const pb = prodById[x.b]
      const separados = pa.precio + pb.precio
      return { ...x, pa, pb, separados, precioCombo: Math.round((separados * 0.9) / 10) * 10 }
    })

  // Baja rotación: stock alto con ventas casi nulas → liquidación/promo.
  const rotacion = (productos || [])
    .map((p) => ({ p, vendidasU: porProd[p.id]?.cant || 0, inmovilizado: p.stock * (p.costo || p.precio) }))
    .filter((x) => x.p.stock >= Math.max(6, (x.p.stockMin || 0) * 2) && x.vendidasU <= 1)
    .sort((a, b) => b.inmovilizado - a.inmovilizado)
    .slice(0, 3)

  // Estrellas: líderes de margen y volumen del historial.
  const estrellas = (productos || [])
    .map((p) => ({ p, ...(porProd[p.id] || { cant: 0, monto: 0, margen: 0 }) }))
    .filter((x) => x.cant > 0)
    .sort((a, b) => b.margen - a.margen || b.cant - a.cant)
    .slice(0, 3)

  // Reposición crítica: bajo el mínimo o casi agotado, priorizando rotación.
  const reposicion = (productos || [])
    .map((p) => ({ p, cant: porProd[p.id]?.cant || 0 }))
    .filter((x) => x.p.stock <= (x.p.stockMin || 0) || x.p.stock < 5)
    .sort((a, b) => b.cant - a.cant || a.p.stock - b.p.stock)
    .slice(0, 4)

  return { combos, rotacion, estrellas, reposicion, tickets: vendidas.length }
}
