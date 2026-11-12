import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BadgeCheck, Candy, Check, ChevronDown, Cookie, CupSoda, Grid2X2, Loader2, Minus, Package, Pencil, Plus, Popcorn, Sandwich, Search, ShoppingCart, Store, X, Zap } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { incluye } from '../../utils/busqueda'
import { fotosDe } from '../../utils/imagen'
import { diasHasta, diasTxt, fmtFecha, money } from '../../utils/format'
import GaleriaProducto from '../../components/ui/GaleriaProducto'
import FotosPill from '../../components/ui/FotosPill'
import PedidoQRModal from '../modulo4_clientes/PedidoQRModal'
import './CatalogoPublico.css'

// Catálogo público estilo Wolt (diseño v0): header con marca + identidad
// del local, buscador, tarjetas de categoría pastel, grilla de productos
// con arte por tono y botón "+", sheets de detalle/carrito/encargo.
// Conectado 100% a useKiosco() — estilos en CatalogoPublico.css.

const TONOS = ['blue', 'yellow', 'pink', 'mint', 'aqua', 'lilac']
const ILIMITADO = 999 // stock 999 = venta libre sin tope

// Ícono lucide por categoría (coincidencia por palabra clave).
function IconoCategoria({ cat = '', ...props }) {
  const s = cat.toLowerCase()
  if (/bebida|jugo|agua|gaseosa|cerveza|vino|licor/.test(s)) return <CupSoda {...props} />
  if (/snack|papa|nacho|man[ií]|salad/.test(s)) return <Popcorn {...props} />
  if (/gallet|alfajor|cookie/.test(s)) return <Cookie {...props} />
  if (/almuer|s[áa]ndwich|sandwich|empanada|comida|picada/.test(s)) return <Sandwich {...props} />
  if (/almac|golos|caramelo|chocolate|dulce|confite/.test(s)) return <Candy {...props} />
  if (/[úu]til|librer|escolar|l[áa]piz|cuaderno/.test(s)) return <Pencil {...props} />
  return <Package {...props} />
}

const stockTope = (p) => (p.stock >= ILIMITADO ? 99 : p.stock)
const sinStock = (p) => p.stock <= 0

function Brand() {
  return (
    <div className="catalog-brand">
      <span className="catalog-brand-mark">Y</span>
      <span>Yapa</span>
    </div>
  )
}

// Arte pastel del producto: foto real si existe, sino la tarjeta
// ícono+órbita+brillo del diseño v0 con el tono de su categoría.
function ProductArt({ producto, tone }) {
  const fotos = fotosDe(producto)
  return (
    <div className={`product-art art-${tone}`} aria-hidden="true">
      {fotos.length ? (
        <img src={fotos[0]} alt="" className="art-photo" loading="lazy" />
      ) : (
        <>
          <span className="art-orbit" />
          <span className="art-icon">
            <IconoCategoria cat={producto.categoria} />
          </span>
          <span className="art-shine" />
        </>
      )}
      <FotosPill cantidad={fotos.length} />
    </div>
  )
}

function StockPill({ producto }) {
  if (producto.stock <= 0) return <span className="stock-pill stock-empty">Sin stock</span>
  if (producto.stock <= 5) return <span className="stock-pill stock-low">Últimas {producto.stock}</span>
  return (
    <span className="stock-pill stock-plenty">
      <BadgeCheck size={13} /> Disponible
    </span>
  )
}

function Quantity({ value, onChange, max = 99 }) {
  return (
    <div className="quantity-stepper">
      <button type="button" aria-label="Quitar una unidad" disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))}>
        <Minus size={15} />
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" aria-label="Agregar una unidad" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={15} />
      </button>
    </div>
  )
}

export default function CatalogoPublico() {
  const { productos, categorias, ventas, session, clienteSesion, config, enviarEncargo, notify } = useKiosco()
  const [cat, setCat] = useState('Todas')
  const [q, setQ] = useState('')
  const [orden, setOrden] = useState('populares') // populares | recientes | precio-asc | precio-desc
  const [pedido, setPedido] = useState([]) // {productoId, cantidad} — clientes e invitados
  const [detalle, setDetalle] = useState(null)
  const [cantDetalle, setCantDetalle] = useState(1)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkout, setCheckout] = useState('none') // 'none' | 'pickup' | 'confirmed'
  const [quienRetira, setQuienRetira] = useState(null) // 'titular' | 'tercero'
  const [terceroNombre, setTerceroNombre] = useState('')
  const [terceroDni, setTerceroDni] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const searchRef = useRef(null)

  const esCliente = session?.rol === 'cliente' && !!clienteSesion
  const esStaff = session?.rol === 'vendedor' || session?.rol === 'admin'

  // Tono pastel fijo por categoría (rotación sobre las dinámicas).
  const tonoPorCategoria = useMemo(
    () => Object.fromEntries(categorias.map((c, i) => [c, TONOS[i % TONOS.length]])),
    [categorias]
  )
  const tonoDe = (p) => tonoPorCategoria[p.categoria] || 'blue'

  const list = useMemo(() => {
    const base = productos.filter(
      (p) => (cat === 'Todas' || p.categoria === cat) && incluye(p.nombre, q)
    )
    // Unidades vendidas por producto en todo el historial (sin anuladas).
    const vendidos = new Map()
    for (const v of ventas || []) {
      if (v.anulada) continue
      for (const it of v.items || []) {
        vendidos.set(it.productoId, (vendidos.get(it.productoId) || 0) + it.cantidad)
      }
    }
    // Posición original: el array crece por alta, así el final = más reciente.
    const pos = new Map(productos.map((p, i) => [p.id, i]))
    const arr = [...base]
    if (orden === 'populares') arr.sort((a, b) => (vendidos.get(b.id) || 0) - (vendidos.get(a.id) || 0))
    else if (orden === 'recientes') arr.sort((a, b) => (pos.get(b.id) || 0) - (pos.get(a.id) || 0))
    else if (orden === 'precio-asc') arr.sort((a, b) => a.precio - b.precio)
    else if (orden === 'precio-desc') arr.sort((a, b) => b.precio - a.precio)
    return arr
  }, [productos, ventas, q, cat, orden])

  const enPedido = (id) => pedido.find((i) => i.productoId === id)?.cantidad || 0

  const updateCart = (p, next) =>
    setPedido((c) => {
      const tope = stockTope(p)
      if (next <= 0) return c.filter((i) => i.productoId !== p.id)
      const cantidad = Math.min(next, tope)
      return enPedido(p.id)
        ? c.map((i) => (i.productoId === p.id ? { ...i, cantidad } : i))
        : [...c, { productoId: p.id, cantidad }]
    })

  const agregarUno = (p) => updateCart(p, enPedido(p.id) + 1)

  const itemsDetalle = pedido
    .map((i) => {
      const p = productos.find((x) => x.id === i.productoId)
      return p ? { ...i, nombre: p.nombre, precio: p.precio, foto: p.foto, fotos: p.fotos, categoria: p.categoria, stock: p.stock } : null
    })
    .filter(Boolean)
  const totalPedido = itemsDetalle.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const cantPedido = itemsDetalle.reduce((s, i) => s + i.cantidad, 0)

  // "Ingresá a tu cuenta" (visitante): vuelve a la vista de login del landing.
  const irLogin = () => window.dispatchEvent(new CustomEvent('yapa:login'))

  // Atajo Ctrl/⌘+K → enfoca el buscador (hint visible en la caja).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const abrirDetalle = (p) => {
    // El detalle abre siempre (incluso sin stock: el aviso reemplaza la compra).
    setDetalle(p)
    setCantDetalle(1)
  }

  const closeOverlays = () => {
    setDetalle(null)
    setCartOpen(false)
    setCheckout('none')
    setQuienRetira(null)
  }

  const mandarEncargo = async () => {
    setEnviando(true)
    try {
      const tercero =
        quienRetira === 'tercero' && terceroNombre.trim() && terceroDni.trim()
          ? { nombre: terceroNombre.trim(), dni: terceroDni.trim() }
          : null
      await enviarEncargo(pedido, tercero)
      setPedido([])
      setTerceroNombre('')
      setTerceroDni('')
      setCheckout('confirmed')
      notify('Pedido enviado al mostrador. Te avisamos cuando esté listo para retirar.', 'success')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setEnviando(false)
    }
  }

  const hayOverlay = detalle || cartOpen || checkout !== 'none'

  return (
    <main className="catalog-app">
      <div className="catalog-content">
        <section className="intro-row">
          <div>
            <p className="section-kicker">EL MOSTRADOR DE SIEMPRE</p>
            <h1>¿Qué se te antoja?</h1>
            <p className="section-subtitle">Un gustito rico está a un toque de distancia.</p>
          </div>
        </section>

        {/* Buscador expandido (la identidad del local vive en el header
            principal de la app, sin duplicarse acá). */}
        <div className="search-row">
          <label className="search-box">
            <Search size={20} />
            <input
              ref={searchRef}
              aria-label="Buscar productos"
              placeholder="Buscar gaseosas, alfajores, snacks..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>

        <section className="category-section" aria-label="Categorías">
          <div className="section-label-row">
            <h2>Explorá por categoría</h2>
            <span>
              Deslizá para ver más <ArrowRight size={14} />
            </span>
          </div>
          <div className="category-scroller">
            <button
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
                className={`category-card category-${TONOS[i % TONOS.length]}${cat === c ? ' category-active' : ''}`}
                aria-pressed={cat === c}
                onClick={() => setCat(cat === c ? 'Todas' : c)}
              >
                <span className="category-art" aria-hidden="true">
                  <IconoCategoria cat={c} size={23} strokeWidth={1.9} />
                </span>
                <span>{c}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="products-section">
          <div className="section-label-row product-heading">
            <div>
              <h2>{q ? 'Resultados' : cat === 'Todas' ? 'Lo que más sale' : cat}</h2>
              <p>{list.length} productos para elegir</p>
            </div>
            <label className="sort-button sort-select-wrap">
              <select
                className="sort-select"
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                aria-label="Ordenar productos"
              >
                <option value="populares">Populares</option>
                <option value="recientes">Más recientes</option>
                <option value="precio-asc">Menor precio</option>
                <option value="precio-desc">Mayor precio</option>
              </select>
              <ChevronDown size={15} />
            </label>
          </div>
          {list.length ? (
            <div className="product-grid">
              {list.map((p) => (
                <article className="product-card" key={p.id}>
                  <button
                    className="product-card-main"
                    onClick={() => abrirDetalle(p)}
                    aria-label={`${p.nombre}, ${money(p.precio)}. Ver detalles`}
                  >
                    <ProductArt producto={p} tone={tonoDe(p)} />
                    <span className="product-category">
                      {p.categoria} <span>·</span> unidad
                    </span>
                    <strong className="product-name">{p.nombre}</strong>
                    <span className="product-price">{money(p.precio)}</span>
                    <StockPill producto={p} />
                  </button>
                  {!sinStock(p) &&
                    (enPedido(p.id) ? (
                      /* En el pedido: pill táctil [ − | n | + ] (stopPropagation
                         para no abrir el detalle del producto). */
                      <div className="quick-stepper" role="group" aria-label={`Unidades de ${p.nombre} en tu pedido`}>
                        <button
                          type="button"
                          className="qs-minus"
                          aria-label={`Quitar una unidad de ${p.nombre}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            updateCart(p, enPedido(p.id) - 1)
                          }}
                        >
                          <Minus size={15} />
                        </button>
                        <span className="qs-count" aria-live="polite">
                          {enPedido(p.id)}
                        </span>
                        <button
                          type="button"
                          className="qs-plus"
                          aria-label={`Agregar ${p.nombre} al pedido`}
                          onClick={(e) => {
                            e.stopPropagation()
                            agregarUno(p)
                          }}
                          disabled={enPedido(p.id) >= stockTope(p)}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="add-button"
                        aria-label={`Agregar ${p.nombre} al pedido`}
                        onClick={() => agregarUno(p)}
                      >
                        <Plus size={19} />
                      </button>
                    ))}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-search">
              <span>
                <Search size={23} />
              </span>
              <h3>No encontramos ese gustito</h3>
              <p>Probá con otra palabra o mirá todas las categorías.</p>
              <button
                onClick={() => {
                  setQ('')
                  setCat('Todas')
                }}
              >
                Ver todos los productos
              </button>
            </div>
          )}
        </section>

        <footer className="catalog-footer">
          <Brand />
          <p>Lo de siempre, con una Yapa más.</p>
          <span>Hecho para el barrio</span>
        </footer>
      </div>

      {cantPedido > 0 && (
        <button
          className="cart-floating"
          onClick={() => setCartOpen(true)}
          aria-label={`Ver pedido, ${cantPedido} productos, total ${money(totalPedido)}`}
        >
          <span className="cart-badge" key={cantPedido}>{cantPedido}</span>
          <ShoppingCart size={19} />
          <strong>Ver mi pedido</strong>
          <span className="cart-total">{money(totalPedido)}</span>
          <ArrowRight size={17} />
        </button>
      )}

      {hayOverlay && (
        <div
          className="catalog-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeOverlays()
          }}
        >
          {/* Sheet de detalle de producto */}
          {detalle && (
            <section className="sheet product-sheet" role="dialog" aria-modal="true" aria-labelledby="product-title">
              <button className="overlay-close" aria-label="Cerrar" onClick={() => setDetalle(null)}>
                <X size={20} />
              </button>
              <div className="sheet-handle" />
              {/* Galería completa: carrusel `1 / N` sin recortes + clic
                  para abrir el lightbox con zoom. mt-10 deja libre la
                  esquina donde vive el botón de cerrar del sheet. */}
              <div className="mt-10">
                <GaleriaProducto
                  fotos={fotosDe(detalle)}
                  nombre={detalle.nombre}
                  categoria={detalle.categoria}
                  altura="h-44 sm:h-52"
                />
              </div>
              <p className="product-category">
                {detalle.categoria} <span>·</span> unidad
              </p>
              <h2 id="product-title">{detalle.nombre}</h2>
              <p className="detail-description">{detalle.descripcion || 'Producto disponible en el kiosco.'}</p>
              <div className="detail-stock">
                <StockPill producto={detalle} />
                <small className="detail-units">
                  {detalle.stock >= 999 ? 'Stock libre' : detalle.stock > 0 ? `${detalle.stock} u. disponibles` : '0 u. en stock'}
                </small>
                <span>
                  {money(detalle.precio)} <small>/ unidad</small>
                </span>
              </div>
              {/* Datos internos solo para el mostrador (vencimiento + costo) */}
              {esStaff && (
                <div className="staff-product-meta">
                  <p>
                    Vencimiento:{' '}
                    <b>
                      {detalle.vencimiento
                        ? `${fmtFecha(detalle.vencimiento)}${
                            diasHasta(detalle.vencimiento) < 0
                              ? ' · vencido'
                              : ` · ${diasTxt(diasHasta(detalle.vencimiento))}`
                          }`
                        : 'sin fecha cargada'}
                    </b>
                  </p>
                  <p>
                    Costo de compra: <b>{money(detalle.costo)}</b>
                  </p>
                </div>
              )}
              {sinStock(detalle) ? (
                <p className="en-pedido-nota">Sin stock por ahora — se repone en el próximo pedido.</p>
              ) : (
                <div className="sheet-actions">
                  <Quantity value={cantDetalle} onChange={setCantDetalle} max={stockTope(detalle) - enPedido(detalle.id) || 1} />
                  <button
                    className="primary-action"
                    onClick={() => {
                      updateCart(detalle, enPedido(detalle.id) + cantDetalle)
                      setDetalle(null)
                    }}
                  >
                    Agregar al pedido <span>{money(detalle.precio * cantDetalle)}</span>
                  </button>
                </div>
              )}
              {enPedido(detalle.id) > 0 && !sinStock(detalle) && (
                <p className="en-pedido-nota">Ya llevás {enPedido(detalle.id)} en tu pedido</p>
              )}
            </section>
          )}

          {/* Sheet del carrito "Tu pedido" */}
          {cartOpen && (
            <section className="sheet cart-sheet" role="dialog" aria-modal="true" aria-labelledby="cart-title">
              <div className="sheet-handle" />
              <div className="cart-sheet-head">
                <div>
                  <p className="section-kicker">{config.nombreKiosco.toUpperCase()}</p>
                  <h2 id="cart-title">
                    Tu pedido <span>{cantPedido}</span>
                  </h2>
                </div>
                <button className="overlay-close" aria-label="Cerrar" onClick={() => setCartOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="cart-items">
                {itemsDetalle.length ? (
                  itemsDetalle.map((i) => (
                    <div className="cart-item" key={i.productoId}>
                      <ProductArt producto={i} tone={tonoDe(i)} />
                      <div className="cart-item-info">
                        <strong>{i.nombre}</strong>
                        <span>
                          {money(i.precio)} · unidad
                        </span>
                        <Quantity
                          value={i.cantidad}
                          onChange={(next) => {
                            const p = productos.find((x) => x.id === i.productoId)
                            if (p) updateCart(p, next)
                          }}
                          max={stockTope(i)}
                        />
                      </div>
                      <b>{money(i.precio * i.cantidad)}</b>
                    </div>
                  ))
                ) : (
                  <div className="cart-empty">
                    <ShoppingCart size={26} />
                    <strong>Tu pedido está vacío</strong>
                    <span>Agregá algo rico del catálogo.</span>
                  </div>
                )}
              </div>
              {cantPedido > 0 && (
                <>
                  <div className="cart-total-row">
                    <span>Total del pedido</span>
                    <strong>{money(totalPedido)}</strong>
                  </div>
                  <div className="checkout-actions">
                    <button
                      className="express-button"
                      onClick={() => {
                        setCartOpen(false)
                        setQrOpen(true)
                      }}
                    >
                      <span className="express-icon">
                        <Zap size={18} />
                      </span>
                      <span>
                        <strong>Generar QR Express</strong>
                        <small>Pagá en caja, sin registrarte</small>
                      </span>
                      <ArrowRight size={18} />
                    </button>
                    {config.recibiendoEncargos && config.encargosActivos !== false ? (
                      !esStaff && (
                        <button
                          className="pickup-button"
                          onClick={() => {
                            setCartOpen(false)
                            setCheckout('pickup')
                          }}
                        >
                          <span className="pickup-icon">
                            <Store size={18} />
                          </span>
                          <span>
                            <strong>Retirar pedido en local</strong>
                            <small>Encargo para armar en el kiosco</small>
                          </span>
                          <ArrowRight size={18} />
                        </button>
                      )
                    ) : (
                      <p className="pickup-off">
                        {config.encargosActivos === false
                          ? 'Encargos pausados temporalmente.'
                          : 'El kiosco no está recibiendo encargos en este momento.'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {/* Sheet "¿Quién retira el pedido?" */}
          {checkout === 'pickup' && (
            <section className="sheet checkout-sheet pickup-sheet" role="dialog" aria-modal="true" aria-labelledby="pickup-title">
              <button className="overlay-close" aria-label="Cerrar" onClick={() => setCheckout('none')}>
                <X size={20} />
              </button>
              <div className="sheet-handle" />
              <span className="checkout-icon pickup-modal-icon">
                <Store size={21} />
              </span>
              <p className="section-kicker">ENCARGO PARA RETIRAR</p>
              <h2 id="pickup-title">¿Quién retira el pedido?</h2>
              <p className="checkout-copy">Dejamos todo preparado para que lo pases a buscar.</p>
              <div className="pickup-choices">
                <button
                  className={`pickup-choice${quienRetira === 'titular' ? ' selected' : ''}`}
                  onClick={() => setQuienRetira('titular')}
                >
                  <span className="choice-radio" />
                  <span>
                    <strong>Retiro yo</strong>
                    <small>Titular de la cuenta</small>
                  </span>
                  <Check size={17} />
                </button>
                <button
                  className={`pickup-choice${quienRetira === 'tercero' ? ' selected' : ''}`}
                  onClick={() => setQuienRetira('tercero')}
                >
                  <span className="choice-radio" />
                  <span>
                    <strong>Retira otra persona</strong>
                    <small>Autorizá a alguien de confianza</small>
                  </span>
                  <Check size={17} />
                </button>
              </div>
              {quienRetira === 'tercero' && (
                <div className="authorized-fields">
                  <label>
                    Nombre y apellido
                    <input
                      value={terceroNombre}
                      onChange={(e) => setTerceroNombre(e.target.value)}
                      placeholder="Nombre de quien retira"
                    />
                  </label>
                  <label>
                    DNI
                    <input
                      inputMode="numeric"
                      value={terceroDni}
                      onChange={(e) => setTerceroDni(e.target.value.replace(/\D/g, ''))}
                      placeholder="DNI de quien retira"
                    />
                  </label>
                </div>
              )}
              <div className="pickup-summary">
                <span>{cantPedido} productos</span>
                <strong>{money(totalPedido)}</strong>
              </div>
              <button
                className="primary-action full-action"
                disabled={
                  enviando ||
                  !esCliente ||
                  !quienRetira ||
                  (quienRetira === 'tercero' && (!terceroNombre.trim() || !terceroDni.trim()))
                }
                onClick={mandarEncargo}
              >
                {enviando ? 'Enviando…' : 'Confirmar encargo'}
                {enviando ? <Loader2 className="animate-spin" /> : <ArrowRight size={17} />}
              </button>
              {!esCliente && (
                <button className="login-prompt" onClick={irLogin}>
                  Ingresá a tu cuenta para confirmar el encargo
                </button>
              )}
              <button className="back-text" onClick={() => { setCheckout('none'); setCartOpen(true) }}>
                <ArrowLeft size={15} /> Volver a mi pedido
              </button>
            </section>
          )}

          {/* Sheet de confirmación */}
          {checkout === 'confirmed' && (
            <section className="sheet checkout-sheet success-sheet" role="dialog" aria-modal="true" aria-labelledby="success-title">
              <span className="success-check">
                <Check size={32} />
              </span>
              <p className="section-kicker">{config.nombreKiosco.toUpperCase()}</p>
              <h2 id="success-title">¡Pedido listo!</h2>
              <p className="checkout-copy">Tu encargo quedó preparado. Te esperamos en el kiosco.</p>
              <button className="primary-action full-action" onClick={closeOverlays}>
                Volver al catálogo <ArrowRight size={17} />
              </button>
            </section>
          )}
        </div>
      )}

      <PedidoQRModal cliente={clienteSesion} items={itemsDetalle} open={qrOpen} onClose={() => setQrOpen(false)} />
    </main>
  )
}
