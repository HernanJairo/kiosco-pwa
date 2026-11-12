import { CalendarClock, PackageSearch } from 'lucide-react'
import Modal from './Modal'
import Badge from './Badge'
import GaleriaProducto from './GaleriaProducto'
import { fotosDe } from '../../utils/imagen'
import { diasHasta, diasTxt, fmtFecha, money } from '../../utils/format'

const TONOS = {
  Bebidas: 'bg-[#E8F6FC] text-[#1684B2]',
  Snacks: 'bg-[#EBF7EE] text-[#5C986F]',
  Galletitas: 'bg-[#FFF5DF] text-[#AC7924]',
  Almuerzos: 'bg-[#FFF0F2] text-[#BC7482]',
  Útiles: 'bg-[#F2EFFB] text-[#8574AC]',
}
const tonoDe = (cat) => TONOS[cat] || 'bg-[#EBF7FD] text-[#007AB8]'

/* Modal de detalle de producto estilo Wolt: galería de fotos completa
   (object-contain sin recortes, carrusel `i / N` y lightbox con zoom) o
   ícono pastel de categoría, nombre, categoría, precio y stock.
   Vencimiento y costo solo se muestran al staff (esStaff) — nunca a
   los clientes. */
export default function ProductoDetalleModal({ producto: p, onClose, esStaff = false }) {
  if (!p) return null
  const tono = tonoDe(p.categoria)
  const dias = p.vencimiento ? diasHasta(p.vencimiento) : null
  const stockTxt =
    p.stock >= 999 ? 'Stock libre' : p.stock > 5 ? `${p.stock} u.` : p.stock > 0 ? `Últimas ${p.stock}` : 'Sin stock'
  return (
    <Modal open={!!p} onClose={onClose} title={p.nombre}>
      <div className="flex flex-col gap-4">
        <GaleriaProducto
          fotos={fotosDe(p)}
          nombre={p.nombre}
          categoria={p.categoria}
          altura="h-48 sm:h-56"
          tonoIcono={tono.split(' ')[1]}
          fondoFallback={tono.split(' ')[0]}
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${tono}`}>{p.categoria}</span>
          <Badge tone={p.stock <= 0 ? 'rose' : p.stock <= 5 ? 'amber' : 'emerald'}>{stockTxt}</Badge>
        </div>

        <p className="text-sm text-slate-500">{p.descripcion || 'Producto disponible en el kiosco.'}</p>

        <div className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold tracking-tight text-[#009DE0]">{money(p.precio)}</span>
          <span className="text-xs text-slate-400">/ unidad</span>
        </div>

        {esStaff && (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-[#F7F9FA] px-4 py-3 text-xs text-slate-600">
            <p className="flex items-center gap-2">
              <PackageSearch size={14} className="text-slate-400" />
              Costo de compra: <b className="text-slate-800">{money(p.costo)}</b>
            </p>
            <p className="flex items-center gap-2">
              <CalendarClock size={14} className="text-slate-400" />
              Vencimiento:{' '}
              {p.vencimiento ? (
                <b className={dias < 0 ? 'text-rose-600' : dias <= 7 ? 'text-amber-600' : 'text-slate-800'}>
                  {fmtFecha(p.vencimiento)} · {dias < 0 ? 'vencido' : diasTxt(dias)}
                </b>
              ) : (
                <b className="text-slate-800">sin fecha cargada</b>
              )}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
