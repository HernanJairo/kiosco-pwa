// Historial unificado del cliente: combina en una sola línea de tiempo
// sus ventas de mostrador, sus encargos y los movimientos de billetera
// (recargas, abonos de deuda y anulaciones). Lo consumen la pestaña
// "Historial" del cliente y el modal "Historial" del panel de clientes
// (admin/vendedor), así ambos ven exactamente lo mismo.

export const FILTROS_HISTORIAL = [
  { k: 'todos', label: 'Todos' },
  { k: 'compras', label: 'Compras' },
  { k: 'encargos', label: 'Encargos' },
  { k: 'billetera', label: 'Billetera' },
]

export const METODO_LABEL = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  saldo: 'Billetera',
  fiado: 'Cta. Corriente',
}

export const ESTADO_ENCARGO_LABEL = {
  en_preparacion: 'En preparación',
  listo_retiro: 'Listo para retirar',
  entregado: 'Retirado',
  cancelado: 'Cancelado',
}

// Movimientos de cuenta que pertenecen al grupo "Billetera". Las compras
// ('consumo'/'fiado') ya aparecen como ventas con detalle completo, así
// no se duplican en la línea de tiempo.
const MOV_BILLETERA = {
  recarga: 'Recarga de saldo',
  abono: 'Pago de deuda',
  anulacion: 'Anulación',
  seguridad: 'Seguridad de la cuenta',
}

export function historialDe({ ventas = [], encargos = [], cliente }) {
  if (!cliente) return []
  const items = []

  for (const v of ventas) {
    if (v.clienteId !== cliente.id) continue
    const nItems = (v.items || []).reduce((s, i) => s + i.cantidad, 0)
    items.push({
      id: `v-${v.id}`,
      fecha: v.fecha,
      grupo: 'compras',
      tipo: 'compra',
      titulo: v.anulada ? 'Compra anulada' : 'Compra en mostrador',
      subtitulo: `${nItems} ítem(s) · ${METODO_LABEL[v.metodo] || v.metodo}`,
      monto: -v.total,
      ref: v,
    })
  }

  for (const e of encargos) {
    if (e.clienteId !== cliente.id) continue
    const nItems = (e.items || []).reduce((s, i) => s + i.cantidad, 0)
    items.push({
      id: `e-${e.id}`,
      // La fecha relevante es la del retiro; si aún está activo, la del pedido.
      fecha: e.entregadoEn || e.preparadoEn || e.fecha,
      grupo: 'encargos',
      tipo: 'encargo',
      titulo: `Encargo #${e.id.slice(0, 8).toUpperCase()}`,
      subtitulo: `${ESTADO_ENCARGO_LABEL[e.estado] || e.estado} · ${nItems} ítem(s)`,
      monto: -e.total,
      ref: e,
    })
  }

  for (const m of cliente.movimientos || []) {
    if (!MOV_BILLETERA[m.tipo]) continue
    items.push({
      id: `m-${m.id}`,
      fecha: m.fecha,
      grupo: 'billetera',
      tipo: m.tipo,
      titulo: MOV_BILLETERA[m.tipo],
      subtitulo: m.detalle,
      monto: m.monto,
      ref: m,
    })
  }

  return items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
}
