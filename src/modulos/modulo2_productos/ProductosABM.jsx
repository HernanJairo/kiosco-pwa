import { useMemo, useRef, useState } from 'react'
import { Barcode, Camera, Grid2X2, ImagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye } from '../../utils/busqueda'
import { fotosDe } from '../../utils/imagen'
import { compressProductImage } from '../../utils/imageCompressor'
import { LIMITE_DOC_BYTES, tamanoDoc } from '../../utils/tamanoDoc'
import { diasHasta, diasTxt, fmtFecha, money } from '../../utils/format'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'
import ProductoDetalleModal from '../../components/ui/ProductoDetalleModal'
import FotosPill from '../../components/ui/FotosPill'
import IconoCat from '../../components/ui/IconoCat'
import '../modulo1_catalogo_auth/CatalogoPublico.css'

const VACIO = { nombre: '', categoria: 'Bebidas', costo: '', precio: '', stock: '', stockMin: '', vencimiento: '', fotos: [], codigos: [] }
const NUEVA_CAT = '__nueva__'

// Emojis típicos de kiosco/almacén para identificar categorías nuevas.
const EMOJIS_CAT = ['🥤', '🧃', '🍪', '🍫', '🍬', '🍭', '🥪', '🍕', '🥐', '🥟', '🍿', '🥜', '🍦', '☕', '🧉', '🥛', '🍎', '🍌', '🥖', '🧀', '🧼', '📓', '✏️', '📦']

// Toma el primer grafema del texto (un emoji completo, con ZWJ/VS16).
const primerGrafema = (s) => {
  const t = String(s || '').trim()
  if (!t) return ''
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter('es', { granularity: 'grapheme' })
    return [...seg.segment(t)][0]?.segment || ''
  }
  return [...t][0]
}

// Tonos pastel por categoría (misma paleta del catálogo v0).
const TONOS_CAT = [
  { cat: 'blue', pill: 'bg-sky-100 text-sky-700', art: 'bg-sky-100', ink: 'text-sky-700' },
  { cat: 'yellow', pill: 'bg-amber-100 text-amber-700', art: 'bg-amber-100', ink: 'text-amber-700' },
  { cat: 'pink', pill: 'bg-pink-100 text-pink-700', art: 'bg-pink-100', ink: 'text-pink-700' },
  { cat: 'mint', pill: 'bg-emerald-100 text-emerald-700', art: 'bg-emerald-100', ink: 'text-emerald-700' },
  { cat: 'aqua', pill: 'bg-cyan-100 text-cyan-700', art: 'bg-cyan-100', ink: 'text-cyan-700' },
  { cat: 'lilac', pill: 'bg-violet-100 text-violet-700', art: 'bg-violet-100', ink: 'text-violet-700' },
]

export default function ProductosABM() {
  const { productos, categorias, config, updateConfig, addProducto, updateProducto, deleteProducto, notify } = useKiosco()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Todas')
  const [form, setForm] = useState(null) // null | VACIO | producto
  const [nuevaCat, setNuevaCat] = useState('')
  const [emojiCat, setEmojiCat] = useState('📦')
  const [emojiLibre, setEmojiLibre] = useState('')
  const [codigoInput, setCodigoInput] = useState('')
  const [urlFoto, setUrlFoto] = useState('')
  const [conflicto, setConflicto] = useState(null) // {codigo, duenio}
  const [borrando, setBorrando] = useState(null)
  const [detalle, setDetalle] = useState(null) // modal de detalle estilo Wolt
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

  const tonoCat = (c) => TONOS_CAT[Math.max(0, categorias.indexOf(c)) % TONOS_CAT.length]

  const abrirEdicion = (p) =>
    setForm({ ...p, costo: String(p.costo), precio: String(p.precio), stock: String(p.stock), stockMin: String(p.stockMin), vencimiento: p.vencimiento || '', fotos: fotosDe(p), codigos: p.codigos || [] })

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

  // Lee uno o varios archivos de imagen (galería o cámara), los
  // comprime a WebP ligero (~20–45 KB) y los agrega a `fotos[]` como
  // DataURL para persistirlos en el registro del producto.
  const cargarArchivo = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = '' // permite volver a elegir los mismos archivos
    if (!files.length) return
    if (files.some((f) => !f.type.startsWith('image/'))) return notify('Todos los archivos deben ser imágenes.', 'warn')
    try {
      const nuevas = []
      for (const file of files) nuevas.push(await compressProductImage(file))
      setForm((f) => ({ ...f, fotos: [...f.fotos, ...nuevas] }))
      notify(nuevas.length > 1 ? `${nuevas.length} imágenes cargadas.` : 'Imagen cargada.')
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  const agregarUrlFoto = () => {
    const url = urlFoto.trim()
    if (!url) return
    setForm((f) => ({ ...f, fotos: [...f.fotos, url] }))
    setUrlFoto('')
  }

  const quitarFoto = (i) => setForm((f) => ({ ...f, fotos: f.fotos.filter((_, x) => x !== i) }))

  const hacerPrincipal = (i) =>
    setForm((f) => ({ ...f, fotos: [f.fotos[i], ...f.fotos.filter((_, x) => x !== i)] }))

  const guardar = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const categoria = form.categoria === NUEVA_CAT ? nuevaCat.trim() : form.categoria
      // `foto` queda sincronizada con la principal para retrocompat.
      const fotos = (form.fotos || []).map((f) => String(f).trim()).filter(Boolean)
      const stockNum = Number(form.stock)
      const stockMinNum = Number(form.stockMin)
      const data = {
        nombre: form.nombre.trim(),
        categoria,
        costo: Number(form.costo) || 0,
        precio: Number(form.precio) || 0,
        stock: stockNum,
        stockMin: stockMinNum,
        vencimiento: form.vencimiento || null,
        fotos,
        foto: fotos[0] || null,
        codigos: [...new Set(form.codigos.map((c) => String(c).trim()).filter(Boolean))],
      }
      if (!data.nombre) throw new Error('El nombre es obligatorio.')
      if (data.nombre.length > 60) throw new Error('El nombre es demasiado largo (máx. 60 caracteres).')
      if (!data.categoria) throw new Error('Ingresá el nombre de la nueva categoría.')
      if (data.precio <= 0) throw new Error('El precio de venta debe ser mayor a 0.')
      if (data.costo < 0) throw new Error('El costo no puede ser negativo.')
      // El stock se valida explícito: un typo (-5) no se silencia a 0,
      // se avisa para que el operador lo corrija.
      if (Number.isNaN(stockNum)) throw new Error('El stock debe ser un número.')
      if (stockNum < 0) throw new Error('El stock no puede ser negativo.')
      if (Number.isNaN(stockMinNum)) throw new Error('El stock mínimo debe ser un número.')
      if (stockMinNum < 0) throw new Error('El stock mínimo no puede ser negativo.')
      // Las fotos WebP viven dentro del documento de Firestore (tope
      // ~900 KB): se valida antes de guardar con un aviso amable.
      const bytes = tamanoDoc(data)
      if (bytes > LIMITE_DOC_BYTES) {
        throw new Error(
          `"${data.nombre}" pesa ~${Math.round(bytes / 1024)} KB (máximo ~900 KB). Quitá alguna foto del producto.`
        )
      }
      // Si se creó una categoría nueva, su emoji queda guardado en la
      // config del kiosco y se sincroniza a todos los dispositivos.
      if (form.categoria === NUEVA_CAT) {
        const elegido = primerGrafema(emojiLibre) || emojiCat
        if (elegido) {
          await updateConfig({
            iconosCategorias: { ...(config.iconosCategorias || {}), [data.categoria]: elegido },
          })
        }
      }
      if (form.id) {
        await updateProducto(form.id, data)
        notify('Producto actualizado.')
      } else {
        await addProducto(data)
        notify('Producto creado.')
      }
      setNuevaCat('')
      setEmojiLibre('')
      setEmojiCat('📦')
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
        <Button size="sm" onClick={() => { setNuevaCat(''); setEmojiLibre(''); setEmojiCat('📦'); setForm({ ...VACIO }) }}>
          <Plus size={14} /> Nuevo producto
        </Button>
      }
    >
      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar gaseosas, alfajores, snacks…"
            className="h-12 w-full rounded-2xl border border-transparent bg-[#F6F6F6] pl-11 pr-4 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#009DE0]/30"
          />
        </div>
        {/* Carrusel de tarjetas pastel por categoría (mismo kit del
            catálogo v0, reutilizado vía .catalog-app .cat-embed). */}
        <div className="catalog-app cat-embed">
          <div className="category-scroller">
            <button
              type="button"
              className={`category-card category-all${cat === 'Todas' ? ' category-active' : ''}`}
              aria-pressed={cat === 'Todas'}
              onClick={() => setCat('Todas')}
            >
              <span className="category-art" aria-hidden="true">
                <Grid2X2 size={23} strokeWidth={1.9} />
              </span>
              <span>Todas</span>
            </button>
            {categorias.map((c, i) => (
              <button
                key={c}
                type="button"
                className={`category-card category-${TONOS_CAT[i % TONOS_CAT.length].cat}${cat === c ? ' category-active' : ''}`}
                aria-pressed={cat === c}
                onClick={() => setCat(cat === c ? 'Todas' : c)}
              >
                <span className="category-art" aria-hidden="true">
                  <IconoCat categoria={c} size={23} strokeWidth={1.9} />
                </span>
                <span>{c}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Sin productos" sub="Ajustá la búsqueda o creá uno nuevo." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => {
            const dias = p.vencimiento ? diasHasta(p.vencimiento) : null
            const tono = tonoCat(p.categoria)
            const fotos = fotosDe(p)
            return (
              <article
                key={p.id}
                onClick={() => setDetalle(p)}
                title="Ver detalle del producto"
                className="flex cursor-pointer flex-col rounded-2xl bg-white p-3 shadow-soft transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex gap-3">
                  {/* Arte pastel por categoría: foto real o ícono en tile del tono */}
                  <div className={`relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl ${fotos.length ? 'bg-[#F6F6F6]' : tono.art}`}>
                    {fotos.length ? (
                      <img src={fotos[0]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <IconoCat categoria={p.categoria} size={24} strokeWidth={1.9} className={tono.ink} />
                    )}
                    <FotosPill cantidad={fotos.length} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold tracking-tight text-[#202125]">{p.nombre}</p>
                    <span className={`mt-1 inline-block rounded-lg px-2 py-0.5 text-[10px] font-bold ${tono.pill}`}>
                      {p.categoria}
                    </span>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-sm font-extrabold tracking-tight text-[#202125]">{money(p.precio)}</span>
                      <span className="text-[10px] font-medium text-slate-400">costo {money(p.costo)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); abrirEdicion(p) }}
                      aria-label={`Editar ${p.nombre}`}
                      className="rounded-xl bg-[#EBF7FD] p-2 text-[#007AB8] transition-all duration-150 hover:bg-[#009DE0] hover:text-white active:scale-90"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setBorrando(p) }}
                      aria-label={`Eliminar ${p.nombre}`}
                      className="rounded-xl bg-rose-50 p-2 text-rose-500 transition-all duration-150 hover:bg-rose-100 active:scale-90"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-50 pt-2.5">
                  {p.stock <= 0 ? (
                    <Badge tone="rose">Sin stock</Badge>
                  ) : p.stock <= 5 ? (
                    <Badge tone="amber">Últimas {p.stock}</Badge>
                  ) : (
                    <Badge tone="emerald">{p.stock} u.</Badge>
                  )}
                  {p.vencimiento && (
                    <Badge tone={dias < 0 ? 'rose' : dias <= 7 ? 'amber' : 'slate'}>
                      {dias < 0 ? 'Vencido' : `${fmtFecha(p.vencimiento)} · ${diasTxt(dias)}`}
                    </Badge>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal open={!!form} onClose={() => { setNuevaCat(''); setEmojiLibre(''); setEmojiCat('📦'); setForm(null) }} title={form?.id ? 'Editar producto' : 'Nuevo producto'} wide>
        {form && (
          <form onSubmit={guardar} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div>
              <Select label="Categoría" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {categorias.map((c) => (
                  <option key={c}>{`${config.iconosCategorias?.[c] ? `${config.iconosCategorias[c]} ` : ''}${c}`}</option>
                ))}
                <option value={NUEVA_CAT}>+ Nueva categoría…</option>
              </Select>
              {form.categoria === NUEVA_CAT && (
                <>
                  <Input
                    className="mt-2"
                    autoFocus
                    value={nuevaCat}
                    onChange={(e) => setNuevaCat(e.target.value)}
                    placeholder="Nombre de la nueva categoría"
                    required
                  />
                  <div className="mt-2.5">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Ícono de la categoría</span>
                    <div className="grid grid-cols-6 gap-1.5">
                      {EMOJIS_CAT.map((e) => (
                        <button
                          key={e}
                          type="button"
                          aria-pressed={!emojiLibre && emojiCat === e}
                          onClick={() => { setEmojiCat(e); setEmojiLibre('') }}
                          className={`flex h-10 items-center justify-center rounded-xl text-xl transition-all active:scale-90 ${
                            !emojiLibre && emojiCat === e
                              ? 'bg-[#EBF7FD] ring-2 ring-[#009DE0]'
                              : 'bg-[#F6F6F6] hover:bg-slate-200/70'
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={emojiLibre}
                        onChange={(e) => setEmojiLibre(primerGrafema(e.target.value))}
                        placeholder="O pegá otro emoji"
                        maxLength={8}
                        className="h-10 w-36 rounded-xl border border-transparent bg-[#F6F6F6] px-3 text-center text-xl transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#009DE0]/30"
                      />
                      <span className="text-xs text-slate-400">Se muestra en catálogo, POS y reportes</span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <Input label="Fecha de vencimiento (opcional)" type="date" value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} />
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Fotos del producto (podés cargar varias)</span>
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
                multiple
                className="hidden"
                onChange={cargarArchivo}
              />
              {form.fotos.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {form.fotos.map((f, i) => (
                    <div key={i} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC]">
                      <img src={f} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                      {i === 0 ? (
                        <span className="absolute left-1 top-1 rounded-md bg-[#009DE0] px-1.5 py-0.5 text-[9px] font-bold text-white">
                          Principal
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => hacerPrincipal(i)}
                          title="Usar como foto principal"
                          aria-label={`Usar foto ${i + 1} como principal`}
                          className="absolute bottom-1 left-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shadow-sm transition hover:text-[#007AB8]"
                        >
                          #1
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => quitarFoto(i)}
                        aria-label={`Quitar foto ${i + 1}`}
                        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-slate-900/70 text-white transition hover:bg-rose-500"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => camRef.current?.click()}>
                  <Camera size={14} /> Tomar foto
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => galRef.current?.click()}>
                  <ImagePlus size={14} /> Galería
                </Button>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="url"
                  value={urlFoto}
                  onChange={(e) => setUrlFoto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarUrlFoto() } }}
                  placeholder="…o pegá una URL de imagen · https://…"
                  className="w-full flex-1 rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft"
                />
                <Button type="button" variant="secondary" onClick={agregarUrlFoto} disabled={!urlFoto.trim()}>
                  <Plus size={14} /> Agregar
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                La primera foto es la principal (se muestra en las tarjetas). Las fotos subidas se comprimen y se guardan junto al producto.
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

      {/* Detalle estilo Wolt: clic en la tarjeta (staff ve costo y vencimiento) */}
      <ProductoDetalleModal producto={detalle} onClose={() => setDetalle(null)} esStaff />

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
