// Avatares predefinidos para personalizar el perfil del alumno sin usar
// fotos reales (privacidad). `alumno.avatar` guarda la clave `k`.
export const AVATARES = [
  { k: 'gorra', emoji: '🧢', nombre: 'Gorra' },
  { k: 'lentes', emoji: '🤓', nombre: 'Lentes' },
  { k: 'cohete', emoji: '🚀', nombre: 'Cohete' },
  { k: 'pelota', emoji: '⚽', nombre: 'Pelota' },
  { k: 'gamer', emoji: '🎮', nombre: 'Gamer' },
  { k: 'gato', emoji: '🐱', nombre: 'Michi' },
  { k: 'unicornio', emoji: '🦄', nombre: 'Unicornio' },
  { k: 'pizza', emoji: '🍕', nombre: 'Pizza' },
  { k: 'musica', emoji: '🎧', nombre: 'Música' },
  { k: 'rayo', emoji: '⚡', nombre: 'Rayo' },
  { k: 'estrella', emoji: '🌟', nombre: 'Estrella' },
  { k: 'rana', emoji: '🐸', nombre: 'Rana' },
]

const FONDOS = [
  'bg-emerald-100 text-emerald-700',
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

export const avatarDe = (k) => {
  const av = AVATARES.find((a) => a.k === k)
  if (av) return av
  // Admite un emoji guardado directamente (avatar inicial de altas nuevas).
  if (k && /^\p{Emoji}+$/u.test(k)) return { k, emoji: k, nombre: 'Avatar' }
  return null
}

export const fondoAvatar = (k) => {
  const i = AVATARES.findIndex((a) => a.k === k)
  return FONDOS[i >= 0 ? i % FONDOS.length : 0]
}
