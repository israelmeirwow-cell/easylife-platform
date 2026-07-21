// Generates placeholder PWA icons (charcoal background, champagne-gold circle)
// as valid PNGs with zero dependencies. Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

const BG = [0x16, 0x13, 0x0f]; // #16130F
const GOLD = [0xc9, 0xa9, 0x6a]; // #C9A96A
const IVORY = [0xf2, 0xed, 0xe4]; // #F2EDE4

function makePng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const c = size / 2;
  const rOuter = size * 0.34;
  const rInner = size * 0.21;
  const rDot = size * 0.07;
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c + 0.5, y - c + 0.5);
      // gold ring with a small ivory core dot, anti-aliased over charcoal
      const ring = Math.min(Math.max(rOuter + 0.75 - d, 0), 1) * Math.min(Math.max(d - rInner + 0.75, 0), 1);
      const dot = Math.min(Math.max(rDot + 0.75 - d, 0), 1);
      let [r, g, b] = BG;
      r = r + (GOLD[0] - r) * ring;
      g = g + (GOLD[1] - g) * ring;
      b = b + (GOLD[2] - b) * ring;
      r = r + (IVORY[0] - r) * dot * 0.9;
      g = g + (IVORY[1] - g) * dot * 0.9;
      b = b + (IVORY[2] - b) * dot * 0.9;
      const p = row + 1 + x * 4;
      raw[p] = Math.round(r);
      raw[p + 1] = Math.round(g);
      raw[p + 2] = Math.round(b);
      raw[p + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, makePng(size));
  console.log(`wrote ${file}`);
}
