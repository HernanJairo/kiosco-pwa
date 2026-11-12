import { useMemo, useRef, useState } from 'react'
import { Barcode, Camera, ImagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye } from '../../utils/busqueda'
import { archivoADataURL } from '../../utils/imagen'
import { diasHasta, diasTxt, fmtFecha, money } from '../../utils/format'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'
import ProductoImg from '../../components/ui/ProductoImg'

const VACIO = { nombre: '', categoria: 'Bebidas', costo: '', precio: '', stock: '', stockMin: '', vencimiento: '', foto: '', codigos: [] }
const NUEVA_CAT = '__nueva__'

export default function ProductosABM() {
  const { productos, categorias, addProducto, updateProducto, deleteProducto, notify } = useKiosco()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Todas')
  const [form, setForm] = useState(null) // null | VACIO | producto
  const [nuevaCat, setNuevaCat] = useState('')
  const [codigoInput, setCodigoInput] = useState('')
  const [conflicto, setConflicto] = useState(null) // {codigo, duenio}
  const [borrando, setBorrando] = useState(null)
  const [busy, setBusy] = useState(false)
  const camRef = useRef(null)
  const galRef = useRef(null)

  const list = useMemo(
    () =>
      productos.filter(
        (p) =>
          (cat === 'Todas' || p.categoria === cat) &&
          incluye(p.nombre, q)
      ),
    [productos, q, cat]
  )

  const abrirEdicion = (p) =>
    setForm({ ...p, costo: String(p.costo), precio: String(p.precio), stock: String(p.stock), stockMin: String(p.stockMin), vencimiento: p.vencimiento || '', foto: p.foto || '', codigos: p.codigos || [] })

  const agregarCodigo = () => {
    const codigo = codigoInput.trim()
    if (!codigo) return
    if (form.codigos.includes(codigo)) {
      notify('Ese código ya está en este producto.', 'warn')
      return
    }
    const duenio = productos.find((p) => p.id !== form.id && p.codigos?.includes(codigo))
    if (duenio) {
      setConflicto({ codigo, duenio })
      return
    }
    setForm({ ...form, codigos: [...form.codigos, codigo] })
    setCodigoInput('')
  }

  const transferirCodigo = async () => {
    const { codigo, duenio } = conflicto
    setBusy(true)
    try {
      await updateProducto(duenio.id, { codigos: duenio.codigos.filter((c) => c !== codigo) })
      setForm({ ...form, codigos: [...form.codigos, codigo] })
      setCodigoInput('')
      notify(`Código transferido desde "${duenio.nombre}".`)
      setConflicto(null)
    } finally {
      setBusy(false)
    }
  }

  const quitarCodigo = (codigo) =>
    setForm({ ...form, codigos: form.codigos.filter((c) => c !== codigo) })

  // Lee un archivo de imagen (galería o cámara), la redimensiona y la guarda
  // como DataURL JPEG comprimida para persistirla en el registro del producto.
  const cargarArchivo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    if (!file.type.startsWith('image/')) return notify('El archivo debe ser una imagen.', 'warn')
    try {
      const foto = await archivoADataURL(file)
      setForm((f) => ({ ...f, foto }))
      notify('Imagen cargada.')
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  const guardar = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const categoria = form.categoria === NUEVA_CAT ? nuevaCat.trim() : form.categoria
      const data = {
        nombre: form.nombre.trim(),
        categoria,
        costo: Number(form.costo) || 0,
        precio: Number(form.precio) || 0,
        stock: Math.max(0, Number(form.stock) || 0),
        stockMin: Math.max(0, Number(form.stockMin) || 0),
        vencimiento: form.vencimiento || null,
        foto: form.foto?.trim() || null,
        codigos: [...new Set(form.codigos.map((c) => String(c).trim()).filter(Boolean))],
      }
      if (!data.nombre) throw new Error('El nombre es obligatorio.')
      if (!data.categoria) throw new Error('Ingresá el nombre de la nueva categoría.')
      if (data.precio <= 0) throw new Error('El precio de venta debe ser mayor a 0.')
      if (form.id) {
        await updateProducto(form.id, data)
        notify('Producto actualizado.')
      } else {
        await addProducto(data)
        notify('Producto creado.')
      }
      setForm(null)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const eliminar = async () => {
    setBusy(true)
    await deleteProducto(borrando.id)
    notify('Producto eliminado.', 'info')
    setBorrando(null)
    setBusy(false)
  }

  return (
    <Card
      title="Gestión de Productos"
      subtitle="Alta, baja y modificación del inventario"
      actions={
        <Button size="sm" onClick={() => { setNuevaCat(''); setForm({ ...VACIO }) }}>
          <Plus size={14} /> Nuevo producto
        </Button>
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full rounded-lg border border-transparent bg-[#F6F6F6] py-2 pl-9 pr-3 text-sm focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-soft"
          />
        </div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-48">
          <option value="Todas">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Sin productos" sub="Ajustá la búsqueda o creá uno nuevo." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-medium">Producto</th>
                <th className="py-2 pr-4 font-medium">Categoría</th>
                <th className="py-2 pr-4 font-medium">Costo</th>
                <th className="py-2 pr-4 font-medium">Precio</th>
                <th className="py-2 pr-4 font-medium">Stock</th>
                <th className="py-2 pr-4 font-medium">Vencimiento</th>
                <th className="py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="py-3 pr-4 font-medium text-slate-800">
                    <span className="flex items-center gap-2.5">
                      <ProductoImg producto={p} className="h-9 w-9 rounded-lg" iconSize={16} />
                      {p.nombre}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-500">{p.categoria}</td>
                  <td className="py-3 pr-4 text-slate-500">{money(p.costo)}</td>
                  <td className="py-3 pr-4 font-semibold text-brand">{money(p.precio)}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={p.stock <= 0 ? 'rose' : p.stock < p.stockMin ? 'amber' : 'emerald'}>
                      {p.stock} u.
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">
                    {p.vencimiento ? `${fmtFecha(p.vencimiento)} · ${diasTxt(diasHasta(p.vencimiento))}` : '—'}
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicion(p)} aria-label="Editar">
                        <Pencil size={15} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setBorrando(p)} aria-label="Eliminar" className="text-rose-500 hover:bg-rose-50">
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!form} onClose={() => { setNuevaCat(''); setForm(null) }} title={form?.id ? 'Editar producto' : 'Nuevo producto'} wide>
        {form && (
          <form onSubmit={guardar} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div>
              <Select label="Categoría" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {categorias.map((c) => (
                  <option key={c}>{c}</option>
                ))}
                <option value={NUEVA_CAT}>+ Nueva categoría…</option>
              </Select>
              {form.categoria === NUEVA_CAT && (
                <Input
                  className="mt-2"
                  autoFocus
                  value={nuevaCat}
                  onChange={(e) => setNuevaCat(e.target.value)}
                  placeholder="Nombre de la nueva categoría"
                  required
                />
              )}
            </div>
            <Input label="Fecha de vencimiento (opcional)" type="date" value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} />
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Foto del producto (opcional)</span>
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={cargarArchivo}
              />
              <input
                ref={galRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={cargarArchivo}
              />
              <div className="flex items-center gap-3">
                <ProductoImg producto={form} className="h-20 w-20 rounded-xl border border-slate-200" iconSize={26} />
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => camRef.current?.click()}>
                      <Camera size={14} /> Tomar foto
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => galRef.current?.click()}>
                      <ImagePlus size={14} /> Galería
                    </Button>
                  </div>
                  {form.foto && (
                    <Button type="button" variant="ghost" size="sm" className="text-rose-500 hover:bg-rose-50" onClick={() => setForm({ ...form, foto: '' })}>
                      <Trash2 size={14} /> Quitar imagen
                    </Button>
                  )}
                </div>
              </div>
              <Input
                className="mt-3"
                label="…o pegá una URL de imagen"
                type="url"
                value={form.foto?.startsWith('data:') ? '' : form.foto}
                onChange={(e) => setForm({ ...form, foto: e.target.value })}
                placeholder="https://…"
              />
              <p className="mt-1.5 text-[11px] text-slate-400">
                Vista previa. Si no se ingresa imagen, se usa el ícono de la categoría. Las fotos subidas se comprimen y se guardan junto al producto.
              </p>
            </div>
            <Input label="Costo ($)" type="number" min="0" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} required />
            <Input label="Precio de venta ($)" type="number" min="0" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} required />
            <Input label="Stock actual" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
            <Input label="Stock mínimo" type="number" min="0" value={form.stockMin} onChange={(e) => setForm({ ...form, stockMin: e.target.value })} required />
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Códigos de barra (podés cargar varios)</span>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={codigoInput}
                    onChange={(e) => setCodigoInput(e.target.value.trim())}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarCodigo() } }}
                    placeholder="Ej: 7790895000997"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft"
                  />
                </div>
                <Button type="button" variant="secondary" onClick={agregarCodigo}>
                  <Plus size={14} /> Agregar
                </Button>
              </div>
              {form.codigos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.codigos.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 font-mono text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                      {c}
                      <button type="button" onClick={() => quitarCodigo(c)} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-rose-500" aria-label={`Quitar ${c}`}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancelar</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Conflicto de código de barras duplicado */}
      <Modal open={!!conflicto} onClose={() => setConflicto(null)} title="Código ya asignado">
        {conflicto && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Barcode size={18} className="mt-0.5 shrink-0" />
              <span>
                El código <b className="font-mono">{conflicto.codigo}</b> ya está asociado a{' '}
                <b>{conflicto.duenio.nombre}</b>. ¿Deseas transferirlo a este producto o cancelar?
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConflicto(null)}>Cancelar</Button>
              <Button variant="warn" onClick={transferirCodigo} disabled={busy}>
                {busy ? 'Transfiriendo…' : 'Transferir a este producto'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!borrando} onClose={() => setBorrando(null)} title="Eliminar producto">
        {borrando && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              ¿Eliminar <b className="text-slate-800">{borrando.nombre}</b> del inventario? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setBorrando(null)}>Cancelar</Button>
              <Button variant="danger" onClick={eliminar} disabled={busy}>
                <Trash2 size={14} /> Eliminar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
