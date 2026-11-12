// Tamaño serializado de un documento Firestore (JSON UTF-8).
// Firestore limita cada documento a 1 MiB: dejamos ~120 KB de margen
// para campos de sistema y mostramos un aviso amable antes del techo.
export const LIMITE_DOC_BYTES = 900 * 1024
export const tamanoDoc = (obj) => new TextEncoder().encode(JSON.stringify(obj)).length
