/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
      colors: {
        // Marca Yapa: Celeste Wolt sobre superficies suaves (sin bordes duros).
        brand: {
          DEFAULT: '#009DE0',
          dark: '#0086C0',
          deep: '#0066B2',
          soft: '#EBF7FD',
          softtext: '#007AB8',
        },
        ink: '#202125',
        surface: '#F6F6F6',
      },
      boxShadow: {
        soft: '0 8px 28px rgba(0,0,0,0.06)',
        lift: '0 12px 32px -8px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
