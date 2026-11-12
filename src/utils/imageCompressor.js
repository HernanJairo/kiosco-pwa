// Comprime un File de imagen a un DataURL WebP ligero: redimensiona
// proporcionalmente a máximo `max` px en su lado mayor (sin recortar ni
// deformar) y aplana transparencias sobre fondo blanco. Objetivo:
// ~20–45 KB por foto, ideal para guardar varias imágenes por producto
// en Firestore gratuito sin superar 1 MB por documento.
// Fallback: si el navegador no exporta WebP (Safari viejo), usa JPEG.
export function compressProductImage(file, { max = 640, calidad = 0.78 } = {}) {
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
        const webp = canvas.toDataURL('image/webp', calidad)
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', calidad))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
