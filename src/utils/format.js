export const money = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR')

export const fmtFecha = (iso) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const fmtFechaHora = (iso) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export const fmtHora = (iso) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

export const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export const esHoy = (iso) => new Date(iso).toDateString() === new Date().toDateString()

// Días restantes hasta una fecha ISO (yyyy-mm-dd). null si no hay fecha.
export const diasHasta = (iso) => {
  if (!iso) return null
  const diff = new Date(iso + 'T00:00:00') - new Date(hoyISO() + 'T00:00:00')
  return Math.round(diff / 86400000)
}

export const diasTxt = (dias) => {
  if (dias === null) return 'Sin vencimiento'
  if (dias < 0) return `Venció hace ${-dias} día${-dias === 1 ? '' : 's'}`
  if (dias === 0) return 'Vence hoy'
  return `Vence en ${dias} día${dias === 1 ? '' : 's'}`
}
