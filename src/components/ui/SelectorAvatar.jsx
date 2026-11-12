import { useRef } from 'react'
import { Camera, Check, Image, Trash2 } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { AVATARES, avatarDe, fondoAvatar } from '../../utils/avatares'
import { archivoADataURL } from '../../utils/imagen'
import Button from './Button'

// Grilla de avatares emoji + opción de foto real (comprimida a Base64).
// Guarda la elección en alumno.avatar / alumno.foto.
export default function SelectorAvatar({ alumno }) {
  const { updateAlumno, notify } = useKiosco()
  const camRef = useRef(null)
  const galRef = useRef(null)

  const elegir = async (k) => {
    await updateAlumno(alumno.id, { avatar: k, foto: null })
    notify('¡Avatar actualizado!')
  }

  const subirFoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    if (!file.type.startsWith('image/')) return notify('El archivo debe ser una imagen.', 'warn')
    try {
      const foto = await archivoADataURL(file)
      await updateAlumno(alumno.id, { foto })
      notify('Foto de perfil actualizada.')
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  const quitarFoto = async () => {
    await updateAlumno(alumno.id, { foto: null })
    notify('Foto eliminada: se usa tu avatar.', 'info')
  }

  const selAvatar = !alumno.foto ? avatarDe(alumno.avatar) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {AVATARES.map((av) => {
          const activo = selAvatar?.k === av.k
          return (
            <button
              key={av.k}
              type="button"
              onClick={() => elegir(av.k)}
              title={av.nombre}
              aria-label={`Avatar ${av.nombre}`}
              className={`relative flex aspect-square items-center justify-center rounded-2xl text-2xl transition-all hover:-translate-y-0.5 hover:shadow-md ${fondoAvatar(av.k)} ${
                activo ? 'ring-2 ring-emerald-500 ring-offset-2' : 'ring-1 ring-inset ring-slate-200'
              }`}
            >
              {av.emoji}
              {activo && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={subirFoto} />
        <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={subirFoto} />
        <Button type="button" variant="secondary" size="sm" onClick={() => camRef.current?.click()}>
          <Camera size={14} /> Tomar foto
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => galRef.current?.click()}>
          <Image size={14} /> Galería
        </Button>
        {alumno.foto && (
          <Button type="button" variant="ghost" size="sm" className="text-rose-500 hover:bg-rose-50" onClick={quitarFoto}>
            <Trash2 size={14} /> Quitar foto
          </Button>
        )}
        <p className="w-full text-[11px] text-slate-400">
          La foto se comprime y se guarda solo en este dispositivo. Si preferís no usar foto, elegí un avatar.
        </p>
      </div>
    </div>
  )
}
