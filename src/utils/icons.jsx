import { Candy, Cookie, CupSoda, NotebookPen, Package, Pencil, Popcorn, Sandwich } from 'lucide-react'

export const CATEGORIA_ICON = {
  Bebidas: CupSoda,
  Snacks: Popcorn,
  Galletitas: Cookie,
  Almuerzos: Sandwich,
  Útiles: NotebookPen,
}

// Ícono lucide por categoría: primero nombre exacto, después
// coincidencia por palabra clave (para categorías personalizadas).
export const iconoCategoria = (cat = '') => {
  if (CATEGORIA_ICON[cat]) return CATEGORIA_ICON[cat]
  const s = cat.toLowerCase()
  if (/bebida|jugo|agua|gaseosa|cerveza|vino|licor/.test(s)) return CupSoda
  if (/snack|papa|nacho|man[ií]|salad/.test(s)) return Popcorn
  if (/gallet|alfajor|cookie/.test(s)) return Cookie
  if (/almuer|s[áa]ndwich|sandwich|empanada|comida|picada/.test(s)) return Sandwich
  if (/almac|golos|caramelo|chocolate|dulce|confite/.test(s)) return Candy
  if (/[úu]til|librer|escolar|l[áa]piz|cuaderno/.test(s)) return Pencil
  return Package
}
