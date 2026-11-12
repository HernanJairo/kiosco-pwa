import { useState } from 'react'
import {
  Candy,
  Coffee,
  Cookie,
  CupSoda,
  Gift,
  Hamburger,
  Package,
  Pencil,
  Popcorn,
  Sandwich,
  ShoppingBag,
  Store,
} from 'lucide-react'

// Ilustraciones 3D (Microsoft Fluent Emoji 3D vía jsDelivr, URLs verificadas).
const CDN = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets'
const IMG = {
  cup: `${CDN}/Cup%20with%20straw/3D/cup_with_straw_3d.png`,
  beverage: `${CDN}/Beverage%20box/3D/beverage_box_3d.png`,
  milk: `${CDN}/Glass%20of%20milk/3D/glass_of_milk_3d.png`,
  fries: `${CDN}/French%20fries/3D/french_fries_3d.png`,
  popcorn: `${CDN}/Popcorn/3D/popcorn_3d.png`,
  pretzel: `${CDN}/Pretzel/3D/pretzel_3d.png`,
  doughnut: `${CDN}/Doughnut/3D/doughnut_3d.png`,
  candy: `${CDN}/Candy/3D/candy_3d.png`,
  chocolate: `${CDN}/Chocolate%20bar/3D/chocolate_bar_3d.png`,
  sandwich: `${CDN}/Sandwich/3D/sandwich_3d.png`,
  hamburger: `${CDN}/Hamburger/3D/hamburger_3d.png`,
  canned: `${CDN}/Canned%20food/3D/canned_food_3d.png`,
  gift: `${CDN}/Wrapped%20gift/3D/wrapped_gift_3d.png`,
  pencil: `${CDN}/Pencil/3D/pencil_3d.png`,
  backpack: `${CDN}/Backpack/3D/backpack_3d.png`,
  bags: `${CDN}/Shopping%20bags/3D/shopping_bags_3d.png`,
  cart: `${CDN}/Shopping%20cart/3D/shopping_cart_3d.png`,
  store: `${CDN}/Convenience%20store/3D/convenience_store_3d.png`,
}

// Catálogo de categorías: fondo pastel + ilustración 3D + ícono lucide de
// respaldo por si la imagen falla (fallback colorido garantizado).
const CATS = [
  { match: ['toda', 'todo'], pastel: '#EBF7FD', img: IMG.bags, icon: Store },
  { match: ['bebida', 'gaseosa', 'jugo', 'agua'], pastel: '#E0F2FE', img: IMG.cup, icon: CupSoda },
  { match: ['snack', 'papa', 'frit'], pastel: '#FEF3C7', img: IMG.fries, icon: Popcorn },
  { match: ['gallet', 'crack', 'surtid'], pastel: '#FFEDD5', img: IMG.pretzel, icon: Cookie },
  { match: ['golosin', 'caram', 'chupet'], pastel: '#FCE7F3', img: IMG.candy, icon: Candy },
  { match: ['alfajor', 'chocol'], pastel: '#F3E8FF', img: IMG.chocolate, icon: Candy },
  { match: ['almue', 'sándw', 'sandw', 'comida', 'vianda'], pastel: '#DCFCE7', img: IMG.sandwich, icon: Sandwich },
  { match: ['almac', 'despens'], pastel: '#FEF3C7', img: IMG.canned, icon: Package },
  { match: ['combo', 'promo', 'pack'], pastel: '#FCE7F3', img: IMG.gift, icon: Gift },
  { match: ['útil', 'util', 'escolar', 'librer'], pastel: '#E0F2FE', img: IMG.pencil, icon: Pencil },
  { match: ['café', 'cafe', 'desayun', 'lácte', 'lacte'], pastel: '#FFEDD5', img: IMG.milk, icon: Coffee },
  { match: ['hamburg', 'pizza', 'fast'], pastel: '#FEF3C7', img: IMG.hamburger, icon: Hamburger },
]

const DEFAULT_CAT = { pastel: '#F6F6F6', img: IMG.cart, icon: ShoppingBag }

function datosCategoria(nombre = '') {
  const n = nombre.toLowerCase()
  return CATS.find((c) => c.match.some((m) => n.includes(m))) || DEFAULT_CAT
}

// Tarjeta de categoría estilo Wolt: cuadrada, pastel, ilustración 3D.
//  - size "sm" (fila horizontal del catálogo) y "md"/"lg" (mosaicos).
export default function CategoriaTile3D({ nombre, activo = false, onClick, size = 'sm', decorativo = false, conEtiqueta = true, className = '' }) {
  const [error, setError] = useState(false)
  const cat = datosCategoria(nombre)
  const Icon = cat.icon

  const dims = {
    sm: 'h-20 w-20 rounded-2xl',
    md: 'h-24 w-24 rounded-3xl',
    lg: 'h-28 w-28 rounded-3xl',
  }[size]
  const imgCls = { sm: 'h-12 w-12', md: 'h-16 w-16', lg: 'h-20 w-20' }[size]

  const contenido = (
    <>
      <span
        className={`flex items-center justify-center ${dims} transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-lift ${
          activo ? 'shadow-lift ring-2 ring-[#009DE0] ring-offset-2' : ''
        }`}
        style={{ backgroundColor: cat.pastel }}
      >
        {error ? (
          <span className="flex items-center justify-center rounded-full bg-white/70 p-2.5 text-[#009DE0]">
            <Icon size={imgCls === 'h-12 w-12' ? 22 : 30} strokeWidth={1.8} />
          </span>
        ) : (
          <img
            src={cat.img}
            alt=""
            loading="lazy"
            draggable="false"
            onError={() => setError(true)}
            className={`${imgCls} select-none object-contain drop-shadow-sm`}
          />
        )}
      </span>
      {conEtiqueta && (
        <span
          className={`max-w-20 truncate text-center text-[11px] leading-tight ${
            activo ? 'font-bold text-[#009DE0]' : 'font-semibold text-slate-600'
          }`}
        >
          {nombre}
        </span>
      )}
    </>
  )

  if (decorativo) {
    return (
      <span className={`flex shrink-0 flex-col items-center gap-1.5 ${className}`}>
        {contenido}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`group flex shrink-0 flex-col items-center gap-1.5 outline-none transition-all duration-200 ease-out active:scale-95 ${className}`}
    >
      {contenido}
    </button>
  )
}
