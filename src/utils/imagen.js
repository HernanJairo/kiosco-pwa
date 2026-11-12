// Comprime un File de imagen a un DataURL JPEG: redimensiona al lado mayor `max`
// px y aplana transparencias sobre fondo blanco. Ideal para persistir en
// localStorage / Firestore sin ocupar demasiado espacio.
export function archivoADataURL(file, { max = 480, calidad = 0.78 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * escala))
        const h = Math.max(1, Math.round(img.height * escala))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff' // fondo blanco si la imagen tiene transparencia
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', calidad))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// Lista normalizada de fotos del producto: prioriza `fotos[]` y cae al
// `foto` único de los productos antiguos (retrocompatibilidad total).
export const fotosDe = (p) => {
  if (Array.isArray(p?.fotos) && p.fotos.some(Boolean)) return p.fotos.filter(Boolean)
  return p?.foto ? [p.foto] : []
}

// Garantiza la forma nueva del registro: `fotos[]` siempre presente y
// `foto` apuntando a la principal (fotos[0]) para que el código viejo
// siga funcionando sin cambios.
export const normalizarFotos = (p) => {
  const fotos = fotosDe(p)
  return { ...p, fotos, foto: fotos[0] || null }
}
