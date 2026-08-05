/**
 * Generator ikon PWA — menggambar HealthRing (signature element, ui-ux-spec §2.1)
 * dengan gradient hero di atas latar gelap. PNG ditulis manual via zlib agar
 * tidak menambah dependensi build.
 *
 * Jalankan bila token warna/bentuk ikon berubah:
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// Token: ui-ux-spec §1
const BG = [0x0a, 0x0e, 0x1a];
const STOPS = [
  [0x3b, 0x82, 0xf6], // blue
  [0x22, 0xd3, 0xee], // cyan
  [0x8b, 0x5c, 0xf6], // purple
];
const TRACK = [0x1a, 0x21, 0x38]; // surface-2

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Gradient mengikuti sweep cincin (bukan diagonal): pada bentuk anulus, gradient
 * linear membuat stop ungu nyaris tak terlihat. Warna mengalir blue → cyan → purple
 * sepanjang busur, sesuai urutan gradient hero.
 */
function gradientAt(t01) {
  const t = clamp01(t01);
  const seg = t < 0.5 ? 0 : 1;
  const local = seg === 0 ? t / 0.5 : (t - 0.5) / 0.5;
  const from = STOPS[seg];
  const to = STOPS[seg + 1];
  return [
    Math.round(lerp(from[0], to[0], local)),
    Math.round(lerp(from[1], to[1], local)),
    Math.round(lerp(from[2], to[2], local)),
  ];
}

/** Coverage anti-alias untuk anulus [rInner, rOuter]. */
function ringCoverage(dist, rInner, rOuter) {
  const aa = 1.2;
  const outer = clamp01((rOuter - dist) / aa + 0.5);
  const inner = clamp01((dist - rInner) / aa + 0.5);
  return Math.min(outer, inner);
}

function renderIcon(size, { maskable }) {
  const cx = size / 2;
  const cy = size / 2;
  // maskable: konten harus muat di safe zone 80% (ikon bisa dipangkas jadi bentuk apa pun)
  const contentScale = maskable ? 0.62 : 0.78;
  const rOuter = (size * contentScale) / 2;
  const stroke = Math.max(2, size * (maskable ? 0.075 : 0.095));
  const rInner = rOuter - stroke;
  // sweep 78% lingkaran — ring "hampir penuh", bukan lingkaran mati
  const SWEEP = 0.78;

  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let [r, g, b] = BG;

      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.hypot(dx, dy);
      const cov = ringCoverage(dist, rInner, rOuter);

      if (cov > 0) {
        // sudut mulai dari atas (-90°), searah jarum jam → progress ring
        let ang = Math.atan2(dy, dx) + Math.PI / 2;
        if (ang < 0) ang += Math.PI * 2;
        const progress = ang / (Math.PI * 2);

        const [gr, gg, gb] = progress <= SWEEP ? gradientAt(progress / SWEEP) : TRACK;
        r = Math.round(lerp(r, gr, cov));
        g = Math.round(lerp(g, gg, cov));
        b = Math.round(lerp(b, gb, cov));
      }

      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return encodePng(size, size, px);
}

// ===== PNG encoder minimal (RGBA, filter 0) =====

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  // 10..12 = compression/filter/interlace = 0

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ["icon-192.png", 192, { maskable: false }],
  ["icon-512.png", 512, { maskable: false }],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, { maskable: false }],
];
for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT_DIR, name), renderIcon(size, opts));
  console.log(`✓ ${name} (${size}×${size})`);
}
