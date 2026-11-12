// Avatares predefinidos para personalizar el perfil del cliente sin usar
// fotos reales (privacidad). `cliente.avatar` guarda la clave `k`.
// Los íconos son vectoriales (lucide-react), nunca emojis.
import {
  Cat,
  Gamepad2,
  Glasses,
  HardHat,
  Headphones,
  Pizza,
  Rocket,
  Sparkles,
  Star,
  Turtle,
  Volleyball,
  Zap,
} from 'lucide-react'

export const AVATARES = [
  { k: 'gorra', icon: HardHat, nombre: 'Gorra' },
  { k: 'lentes', icon: Glasses, nombre: 'Lentes' },
  { k: 'cohete', icon: Rocket, nombre: 'Cohete' },
  { k: 'pelota', icon: Volleyball, nombre: 'Pelota' },
  { k: 'gamer', icon: Gamepad2, nombre: 'Gamer' },
  { k: 'gato', icon: Cat, nombre: 'Michi' },
  { k: 'unicornio', icon: Sparkles, nombre: 'Unicornio' },
  { k: 'pizza', icon: Pizza, nombre: 'Pizza' },
  { k: 'musica', icon: Headphones, nombre: 'Música' },
  { k: 'rayo', icon: Zap, nombre: 'Rayo' },
  { k: 'estrella', icon: Star, nombre: 'Estrella' },
  { k: 'rana', icon: Turtle, nombre: 'Rana' },
]

const FONDOS = [
  'bg-brand-soft text-brand',
  'bg-sky-100 text-sky-700',
  'bg-indigo-100 text-indigo-700',
  'bg-lime-100 text-lime-700',
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-orange-100 text-orange-700',
  'bg-cyan-100 text-cyan-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
]

export const avatarDe = (k) => AVATARES.find((a) => a.k === k) || null

export const fondoAvatar = (k) => {
  const i = AVATARES.findIndex((a) => a.k === k)
  return FONDOS[i >= 0 ? i % FONDOS.length : 0]
}
