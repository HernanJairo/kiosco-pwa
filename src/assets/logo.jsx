// Isotipo "Yapa": letra Y geométrica en contenedor redondeado
// con degradado celeste Wolt. Sin dependencias externas.
export default function Logo({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#009DE0" />
          <stop offset="1" stopColor="#0066B2" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#logo-g)" />
      {/* Brazos de la Y + tallo: trazo grueso con extremos redondeados */}
      <path
        d="M14 14l10 11 10-11"
        stroke="#fff"
        strokeWidth="5.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24 25v11" stroke="#fff" strokeWidth="5.4" strokeLinecap="round" />
      {/* Punto de acento (la "yapa" extra) */}
      <circle cx="36" cy="12" r="3.4" fill="#FBBF24" />
    </svg>
  )
}
