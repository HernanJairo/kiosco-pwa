import { Cookie, CupSoda, NotebookPen, Package, Popcorn, Sandwich } from 'lucide-react'

export const CATEGORIA_ICON = {
  Bebidas: CupSoda,
  Snacks: Popcorn,
  Galletitas: Cookie,
  Almuerzos: Sandwich,
  Útiles: NotebookPen,
}

export const iconoCategoria = (cat) => CATEGORIA_ICON[cat] || Package
