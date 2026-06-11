// PWAアイコン生成(依存パッケージなし)。デザインはfavicon.svgと同じ:
// 紙色地に「積まれた論文」のインク色バー3本 + 朱色ドット(Stacks.のドット)。
// 使い方: node scripts/gen-icons.mjs  (app/public/icons/ に出力)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const PAPER = [0xf6, 0xf1, 0xe7];
const INK = [0x1d, 0x1a, 0x17];
const ACCENT = [0xc0, 0x43, 0x2a];

// 64グリッド上のデザイン(favicon.svgと一致)
const BARS = [
  [14, 16, 32, 7],
  [11, 28, 38, 7],
  [17, 40, 26, 7],
];
const DOT = { cx: 48, cy: 43.5, r: 4.5 };

function inRoundRect(u, v, [x, y, w, h], r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = Math.max(Math.abs(u - cx) - (w / 2 - r), 0);
  const dy = Math.max(Math.abs(v - cy) - (h / 2 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

function designColor(u, v) {
  const ddx = u - DOT.cx;
  const ddy = v - DOT.cy;
  if (ddx * ddx + ddy * ddy <= DOT.r * DOT.r) return ACCENT;
  for (const bar of BARS) if (inRoundRect(u, v, bar, 3.5)) return INK;
  return PAPER;
}

/** size×size、コンテンツをcontentScale倍に縮小して中央配置。2x2スーパーサンプリングでAA */
function render(size, contentScale) {
  const rgba = Buffer.alloc(size * size * 4);
  const unit = (size * contentScale) / 64;
  const subs = [0.25, 0.75];
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const sy of subs) {
        for (const sx of subs) {
          const u = 32 + (i + sx - size / 2) / unit;
          const v = 32 + (j + sy - size / 2) / unit;
          const c = designColor(u, v);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const o = (j * size + i) * 4;
      rgba[o] = r / 4;
      rgba[o + 1] = g / 4;
      rgba[o + 2] = b / 4;
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

// ---- 最小限のPNGエンコーダ ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
const targets = [
  ['icon-192.png', 192, 0.94],
  ['icon-512.png', 512, 0.94],
  ['maskable-512.png', 512, 0.66], // セーフゾーン(中央80%)に収める
  ['apple-touch-icon.png', 180, 0.94],
];
for (const [name, size, scale] of targets) {
  writeFileSync(join(OUT, name), encodePng(size, render(size, scale)));
  console.log(`wrote icons/${name}`);
}
