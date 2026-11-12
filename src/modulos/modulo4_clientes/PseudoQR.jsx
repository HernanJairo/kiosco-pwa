// QR estético determinístico generado a partir del DNI del cliente.
const N = 21

const hash = (s) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return h
}

// patrón de esquina (finder) 7x7
const finderOn = (fx, fy) =>
  fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)

export default function PseudoQR({ text, size = 150 }) {
  const cell = size / N
  const cells = []

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const inTL = x < 8 && y < 8
      const inTR = x >= N - 8 && y < 8
      const inBL = x < 8 && y >= N - 8
      let on
      if (inTL) {
        on = x === 7 || y === 7 ? false : finderOn(x, y)
      } else if (inTR) {
        const lx = x - (N - 8)
        on = lx === 0 || y === 7 ? false : finderOn(lx - 1, y)
      } else if (inBL) {
        const ly = y - (N - 8)
        on = x === 7 || ly === 0 ? false : finderOn(x, ly - 1)
      } else {
        on = hash(`${text}|${x}|${y}`) % 2 === 0
      }
      if (on) cells.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell + 0.4} height={cell + 0.4} />)
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Código del cliente">
      <rect width={size} height={size} rx={size * 0.04} fill="#fff" />
      <g fill="#0f172a">{cells}</g>
    </svg>
  )
}
