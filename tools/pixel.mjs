// เครื่องมือวาดพิกเซลอาร์ตเล็ก ๆ ไม่ต้องติดตั้งแพ็กเกจเพิ่ม (ใช้ zlib ที่มากับ Node)
// ใช้โดย tools/generate-art.mjs — วาดที่ความละเอียดต่ำ แล้วขยาย 2 เท่าแบบ nearest-neighbor
// เพื่อให้ได้พิกเซลหนา ๆ ชัด ๆ ในไฟล์ PNG ขนาดจริง
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

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
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function writePng(file, canvas) {
  const { w, h, data } = canvas;
  // แต่ละแถวขึ้นต้นด้วยไบต์ filter = 0 (None)
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(data.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
}

export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4); // โปร่งใสทั้งหมดตอนเริ่ม
  }

  // color เป็นเลขฐานสิบหก 0xRRGGBB, null = ลบเป็นโปร่งใส
  px(x, y, color, alpha = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (color === null) {
      this.data[i + 3] = 0;
      return;
    }
    this.data[i] = (color >> 16) & 255;
    this.data[i + 1] = (color >> 8) & 255;
    this.data[i + 2] = color & 255;
    this.data[i + 3] = alpha;
  }

  // อ่านสี [r, g, b, a] ที่จุด (x, y)
  get(x, y) {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  // เปลี่ยนสีทุกพิกเซลที่ไม่โปร่งใส: fn(r, g, b, x, y) คืน [r, g, b] (ค่าเกิน 0–255 จะถูกตัดให้พอดี)
  recolor(fn) {
    const out = new Canvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        const a = this.data[i + 3];
        if (a === 0) continue;
        const [r, g, b] = fn(this.data[i], this.data[i + 1], this.data[i + 2], x, y);
        out.data[i] = Math.max(0, Math.min(255, Math.round(r)));
        out.data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
        out.data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
        out.data[i + 3] = a;
      }
    }
    return out;
  }

  // ผสมสี color ทับพิกเซลเดิมด้วยความโปร่ง alpha (0–1) — ใช้วาดแสง/ควัน/หมอก
  blend(x, y, color, alpha) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const a0 = this.data[i + 3] / 255;
    const outA = alpha + a0 * (1 - alpha);
    if (outA === 0) return;
    const src = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
    for (let k = 0; k < 3; k++) {
      this.data[i + k] = Math.round((src[k] * alpha + this.data[i + k] * a0 * (1 - alpha)) / outA);
    }
    this.data[i + 3] = Math.round(outA * 255);
  }

  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  rect(x, y, w, h, color, alpha = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, color, alpha);
  }

  // วงรีเติมสี (จุดศูนย์กลาง cx, cy รัศมี rx, ry)
  ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, color);
      }
    }
  }

  // สามเหลี่ยมเติมสี (ใช้วาดหู ยอดต้นไม้ หนาม)
  triangle(x1, y1, x2, y2, x3, y3, color) {
    const minX = Math.floor(Math.min(x1, x2, x3));
    const maxX = Math.ceil(Math.max(x1, x2, x3));
    const minY = Math.floor(Math.min(y1, y2, y3));
    const maxY = Math.ceil(Math.max(y1, y2, y3));
    const area = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    const total = area(x1, y1, x2, y2, x3, y3);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const a = area(px, py, x2, y2, x3, y3) / total;
        const b = area(x1, y1, px, py, x3, y3) / total;
        const c = 1 - a - b;
        if (a >= 0 && b >= 0 && c >= 0) this.px(x, y, color);
      }
    }
  }

  // เส้นขอบ 1 พิกเซลรอบรูปทรงที่วาดไว้ (เฉพาะพิกเซลโปร่งใสที่ติดกับพิกเซลทึบ 4 ทิศ)
  outline(color) {
    const mark = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alphaAt(x, y) === 0 && (this.alphaAt(x - 1, y) || this.alphaAt(x + 1, y) || this.alphaAt(x, y - 1) || this.alphaAt(x, y + 1))) {
          mark.push([x, y]);
        }
      }
    }
    for (const [x, y] of mark) this.px(x, y, color);
  }

  // วางภาพ src ลงที่ (dx, dy)
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const si = (y * src.w + x) * 4;
        if (src.data[si + 3] === 0) continue;
        const tx = dx + x;
        const ty = dy + y;
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        const ti = (ty * this.w + tx) * 4;
        for (let k = 0; k < 4; k++) this.data[ti + k] = src.data[si + k];
      }
    }
  }

  // ขยาย n เท่าแบบ nearest-neighbor (พิกเซลคมไม่เบลอ)
  scale(n) {
    const out = new Canvas(this.w * n, this.h * n);
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        const si = (Math.floor(y / n) * this.w + Math.floor(x / n)) * 4;
        const ti = (y * out.w + x) * 4;
        for (let k = 0; k < 4; k++) out.data[ti + k] = this.data[si + k];
      }
    }
    return out;
  }
}

// เลขสุ่มแบบคงที่ (ได้ผลเหมือนเดิมทุกครั้งที่รันสคริปต์)
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ผสมสีสองสี (t = 0..1)
export function mix(c1, c2, t) {
  const r = Math.round(((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t);
  const g = Math.round(((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t);
  const b = Math.round((c1 & 255) * (1 - t) + (c2 & 255) * t);
  return (r << 16) | (g << 8) | b;
}
