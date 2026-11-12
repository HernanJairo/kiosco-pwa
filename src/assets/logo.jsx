export default function Logo({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#logo-g)" />
      <path
        d="M13 20h22l-2.6 14.5A4 4 0 0 1 28.5 38h-9a4 4 0 0 1-3.9-3.5L13 20Z"
        fill="#fff"
        opacity="0.95"
      />
      <path
        d="M19 20l3.5-8M29 20l-3.5-8"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="36" cy="12" r="4" fill="#FBBF24" />
    </svg>
  )
}
