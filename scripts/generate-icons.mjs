// Genera los íconos PNG (y favicon.ico) de la PWA sin dependencias externas.
// Uso: node scripts/generate-icons.mjs
import zlib from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

/* ---------- PNG encoder mínimo ---------- */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};
const chunk = (type, data) =>
  Buffer.concat([u32(data.length), Buffer.from(type), data, u32(crc32(Buffer.concat([Buffer.from(type), data])))]);

function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filtro "none"
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.concat([u32(w), u32(h), Buffer.from([8, 6, 0, 0, 0])]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeICO(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: icono
  header.writeUInt16LE(1, 4); // 1 imagen
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuffer]);
}

/* ---------- Dibujo del ícono ---------- */
// Isotipo oficial "Yapa": cuadrado redondeado celeste #009DE0 con la Y
// geométrica blanca en negrita y el punto de acento ámbar (misma pieza
// que src/assets/logo.jsx y public/favicon.svg).
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const BLUE = [0, 157, 224]; // #009DE0
const BLUE_DARK = [0, 102, 178]; // #0066B2
const AMBER = [251, 191, 36]; // #FBBF24
const WHITE = [255, 255, 255];

// Geometría del isotipo en un lienzo lógico de 48×48.
const L = 48;
const Y_STROKES = [
  [14, 14, 24, 25], // brazo izquierdo
  [34, 14, 24, 25], // brazo derecho
  [24, 25, 24, 36], // tallo
];
const STROKE_W = 5.4;
const DOT = { x: 36, y: 12, r: 3.4 };

const distSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

function drawIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.25;
  // En maskable el contenido se encoge para quedar dentro de la zona
  // segura (~80%): el lienzo lógico 48×48 se mapea a ese recuadro.
  const pad = maskable ? size * 0.1 : 0;
  const s = (size - 2 * pad) / L; // px por unidad lógica
  const aa = 1.2 / s; // ancho de antialiasing en unidades lógicas

  const insideRound = (x, y) => {
    if (radius === 0) return true;
    let dx = 0;
    let dy = 0;
    if (x < radius) dx = radius - x;
    else if (x >= size - radius) dx = x - (size - radius) + 1;
    if (y < radius) dy = radius - y;
    else if (y >= size - radius) dy = y - (size - radius) + 1;
    return dx * dx + dy * dy <= radius * radius;
  };

  const blend = (base, over, t) => [
    lerp(base[0], over[0], t),
    lerp(base[1], over[1], t),
    lerp(base[2], over[2], t),
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!insideRound(x, y)) {
        px[i + 3] = 0;
        continue;
      }
      // Fondo: degradado celeste diagonal (#009DE0 → #0066B2).
      const t = Math.min(1, Math.max(0, (x + y) / (2 * size)));
      let rgb = blend(BLUE, BLUE_DARK, t);

      // Coordenadas lógicas del lienzo 48×48.
      const lx = (x - pad) / s;
      const ly = (y - pad) / s;

      // Punto ámbar de acento.
      const dDot = Math.hypot(lx - DOT.x, ly - DOT.y) - DOT.r;
      if (dDot < aa) rgb = blend(rgb, AMBER, Math.min(1, Math.max(0, 1 - dDot / aa)));

      // Y blanca: distancia mínima a los tres trazos.
      const d = Math.min(...Y_STROKES.map(([ax, ay, bx, by]) => distSeg(lx, ly, ax, ay, bx, by)));
      const edge = d - STROKE_W / 2;
      if (edge < aa) rgb = blend(rgb, WHITE, Math.min(1, Math.max(0, 1 - edge / aa)));

      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

/* ---------- Generación ---------- */
const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: true }, // iOS requiere fondo opaco
];

for (const t of targets) {
  const png = encodePNG(t.size, t.size, drawIcon(t.size, { maskable: t.maskable }));
  writeFileSync(join(outDir, t.name), png);
  console.log(`✓ public/icons/${t.name} (${(png.length / 1024).toFixed(1)} KB)`);
}

const faviconPng = encodePNG(64, 64, drawIcon(64));
writeFileSync(join(root, 'public', 'favicon.ico'), encodeICO(faviconPng, 64));
console.log('✓ public/favicon.ico');
