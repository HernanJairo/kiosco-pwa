// Normaliza texto para busquedas insensibles a mayusculas y tildes/diacriticos.
// "Té", "te", "TÉ" -> "te" | "Días", "dias" -> "dias"
export const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

// true si texto contiene termino (ignora mayusculas, tildes y espacios extremos).
export const incluye = (texto, termino) => norm(texto).includes(norm(termino).trim())
