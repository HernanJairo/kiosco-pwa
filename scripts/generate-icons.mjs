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
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const INDIGO_TOP = [99, 102, 241]; // #6366F1
const INDIGO_BOT = [67, 56, 202]; // #4338CA
const EMERALD = [16, 185, 129]; // #10B981
const WHITE = [255, 255, 255];

const K_GLYPH = ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'];

function drawIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const circleR = size * (maskable ? 0.27 : 0.3);
  const cell = size * (maskable ? 0.048 : 0.055);
  const gw = 5 * cell;
  const gh = 7 * cell;
  const gx = cx - gw / 2;
  const gy = cy - gh / 2;

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

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!insideRound(x, y)) {
        px[i + 3] = 0;
        continue;
      }
      const t = y / size;
      let r = lerp(INDIGO_TOP[0], INDIGO_BOT[0], t);
      let g = lerp(INDIGO_TOP[1], INDIGO_BOT[1], t);
      let b = lerp(INDIGO_TOP[2], INDIGO_BOT[2], t);

      const dCircle = Math.hypot(x - cx, y - cy);
      if (dCircle <= circleR) {
        [r, g, b] = WHITE;
        const kx = Math.floor((x - gx) / cell);
        const ky = Math.floor((y - gy) / cell);
        if (ky >= 0 && ky < 7 && kx >= 0 && kx < 5 && K_GLYPH[ky][kx] === 'X') {
          [r, g, b] = EMERALD;
        }
      }
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
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
  { name: 'apple-touch-icon-180.png', size: 180, maskable: true }, // iOS requiere fondo opaco
];

for (const t of targets) {
  const png = encodePNG(t.size, t.size, drawIcon(t.size, { maskable: t.maskable }));
  writeFileSync(join(outDir, t.name), png);
  console.log(`✓ public/icons/${t.name} (${(png.length / 1024).toFixed(1)} KB)`);
}

const faviconPng = encodePNG(64, 64, drawIcon(64));
writeFileSync(join(root, 'public', 'favicon.ico'), encodeICO(faviconPng, 64));
console.log('✓ public/favicon.ico');
