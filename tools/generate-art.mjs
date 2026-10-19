// สร้างภาพพิกเซลอาร์ตของเกมทั้งหมดด้วยสคริปต์ → public/assets/images/*.png
// รัน: node tools/generate-art.mjs
//
// วาดที่ความละเอียดต่ำ (1 พิกเซลศิลป์ = 2 พิกเซลในเกม) แล้วขยาย 2 เท่า
// ทุกไฟล์ขนาดตรงกับที่เกมใช้ ไม่ต้องย่อ/ขยายตอนรัน
// ภายหลังอยากเปลี่ยนเป็นภาพจาก PixelLab: ทำไฟล์ชื่อและขนาดเฟรมเดียวกันวางทับได้เลย (ดู GAME_PROJECT.md)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, writePng, rng, mix } from './pixel.mjs';
import { TILE_NAMES, TILESET_COLUMNS, TILESET_ROWS } from './tileset.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'images');
const save = (name, canvas) => writePng(path.join(OUT, name), canvas);
const forestArt = {}; // ภาพชุดป่าปกติ เก็บไว้ใช้สร้างชุดป่าลึก/ป่ายามค่ำ (ท้ายไฟล์)

// ───────────────────────── แมวส้ม (ยืน/วิ่งสองเท้า) ─────────────────────────
// เฟรม 24×24 (ในเกม 48×48) — ตัวสูงเท่า Hitbox 48 px, หางยื่นออกนอก Hitbox ได้
// เท้าอยู่แถวล่างสุดของเฟรมเสมอ (จุดวางเท้าคงที่ทุกท่า) · แมวหันขวา (ซ้ายใช้ flipX)
const CAT = { O1: 0xf28c28, O2: 0xffc27a, O3: 0xc4691a, OUT: 0x4a2408, SCARF: 0xd63a2f, SCARF2: 0xa3271f, PINK: 0xff8fa3, EYE: 0x1d1d1d, WHITE: 0xffffff };

function drawCat(p = {}) {
  const c = new Canvas(24, 24);
  const b = p.bob || 0; // ตัวบน (หัว ลำตัว หาง) ขยับขึ้นลง ขา/เท้าอยู่ติดพื้นเสมอ
  const leg = (x0, dx, lift) => {
    const top = 19 + b;
    const footY = lift ? 21 : 22;
    c.rect(x0 + dx, top, 3, Math.max(1, footY - top), CAT.O1);
    c.rect(x0 + dx, footY, 4, 1, CAT.O2);
  };

  // หาง (วาดก่อน อยู่หลังตัว) — ไล่ลายสลับสี โค้งขึ้น
  const tail = [[6, 17], [5, 15], [4, 13], [4, 11], [5, 9]];
  tail.forEach(([x, y], i) => c.rect(x + Math.round((p.tailSway || 0) * (i / 4)), y + b, 2, 2, i % 2 ? CAT.O3 : CAT.O1));

  // แขนหลัง (ฝั่งซ้าย สีเข้ม)
  const ab = p.armB || { dx: 0, dy: 0, h: 4 };
  c.rect(7 + ab.dx, 14 + b + ab.dy, 2, ab.h, CAT.O3);

  leg(9, (p.back || { dx: 0 }).dx, (p.back || {}).lift);

  // ลำตัว + ลายเสือ + ท้องสีอ่อน
  c.rect(8, 13 + b, 8, 6, CAT.O1);
  c.rect(12, 14 + b, 4, 4, CAT.O2);
  c.px(8, 14 + b, CAT.O3);
  c.px(8, 16 + b, CAT.O3);
  c.px(9, 15 + b, CAT.O3);
  c.px(9, 17 + b, CAT.O3);

  leg(13, (p.front || { dx: 0 }).dx, (p.front || {}).lift);

  // ผ้าพันคอ + ชายผ้าปลิว
  c.rect(7, 11 + b, 10, 2, CAT.SCARF);
  c.rect(7, 12 + b, 10, 1, CAT.SCARF2);
  const sc = p.scarf || { x: 5, y: 12, w: 3, h: 3 };
  c.rect(sc.x, sc.y + b, sc.w, sc.h, CAT.SCARF2);
  c.px(sc.x, sc.y + b, CAT.SCARF);

  // หัว: หู (ในสีชมพู) หน้า ปาก-จมูก ตา
  c.rect(7, 1 + b, 2, 3, CAT.O1);
  c.px(8, 2 + b, CAT.PINK);
  c.rect(15, 1 + b, 2, 3, CAT.O1);
  c.px(15, 2 + b, CAT.PINK);
  c.rect(7, 3 + b, 10, 8, CAT.O1);
  c.rect(11, 7 + b, 6, 3, CAT.O2);
  c.px(11, 3 + b, CAT.O3);
  c.px(12, 3 + b, CAT.O3);
  c.px(12, 4 + b, CAT.O3);
  c.px(16, 7 + b, CAT.PINK); // จมูก
  c.px(14, 9 + b, CAT.O3); // ปาก
  if (p.eyes === 'shock') {
    c.rect(11, 5 + b, 2, 3, CAT.WHITE);
    c.rect(14, 5 + b, 2, 3, CAT.WHITE);
    c.px(12, 6 + b, CAT.EYE);
    c.px(15, 6 + b, CAT.EYE);
    c.rect(13, 9 + b, 3, 2, CAT.EYE); // อ้าปากร้อง
  } else {
    c.rect(11, 5 + b, 2, 2, CAT.WHITE);
    c.rect(14, 5 + b, 2, 2, CAT.WHITE);
    c.px(12, 5 + b, CAT.EYE);
    c.px(12, 6 + b, CAT.EYE);
    c.px(15, 5 + b, CAT.EYE);
    c.px(15, 6 + b, CAT.EYE);
  }

  // แขนหน้า (ฝั่งขวา)
  const af = p.armF || { dx: 0, dy: 0, h: 4 };
  c.rect(15 + af.dx, 14 + b + af.dy, 2, af.h, CAT.O1);
  c.px(15 + af.dx, 14 + b + af.dy + af.h - 1, CAT.O2);

  // ขนพองตอนตกใจ
  if (p.puff) {
    for (const [x, y] of [[6, 4], [6, 8], [17, 4], [17, 8], [8, 0], [16, 0], [6, 14], [17, 14]]) c.px(x, y + b, CAT.O1);
  }

  c.outline(CAT.OUT);
  return c;
}

const catFrames = [];
// ยืน 4 เฟรม: หายใจ (ตัวขยับ 1 px) + หางแกว่งเบา ๆ
[0, 1, 0, -1].forEach((sway, i) => catFrames.push(drawCat({ bob: i >= 2 ? 1 : 0, tailSway: sway, armF: { dx: 0, dy: 0, h: 4 } })));
// วิ่ง 6 เฟรม: ขาหน้า-หลังสลับ แขนแกว่งสวนทางขา ผ้าพันคอปลิวยาว หางเชิด
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  const s = Math.sin(a);
  const bob = Math.abs(s) < 0.5 ? 1 : 0;
  catFrames.push(
    drawCat({
      bob,
      tailSway: i % 2 ? -2 : -1,
      front: { dx: Math.round(3 * s), lift: Math.cos(a) > 0 },
      back: { dx: -Math.round(3 * s), lift: Math.cos(a) < 0 },
      armF: { dx: -Math.round(2 * s), dy: 0, h: 4 },
      armB: { dx: Math.round(2 * s), dy: 0, h: 4 },
      scarf: { x: 2, y: 12 + (i % 2), w: 5, h: 2 },
    })
  );
}
// กระโดดขึ้น: ยกแขนสองข้าง ขาพับ ผ้าพันคอตกลง
catFrames.push(drawCat({ bob: 0, tailSway: -1, front: { dx: 2, lift: true }, back: { dx: -2, lift: true }, armF: { dx: 1, dy: -5, h: 5 }, armB: { dx: -1, dy: -5, h: 5 }, scarf: { x: 4, y: 13, w: 3, h: 4 } }));
// ตกลง: กางแขน ขาเหยียด ผ้าพันคอปลิวขึ้น
catFrames.push(drawCat({ bob: 0, tailSway: 1, front: { dx: 1 }, back: { dx: -1 }, armF: { dx: 2, dy: -1, h: 2 }, armB: { dx: -3, dy: -1, h: 2 }, scarf: { x: 3, y: 9, w: 4, h: 2 } }));
// ตกใจ/ตาย: ตาโต อ้าปาก ขนพอง
catFrames.push(drawCat({ bob: 0, tailSway: 0, front: { dx: 2, lift: true }, back: { dx: -2, lift: true }, armF: { dx: 1, dy: -5, h: 5 }, armB: { dx: -1, dy: -5, h: 5 }, eyes: 'shock', puff: true }));

// (ชุดแมวเดิม 13 เฟรมเลิกใช้แล้ว: เกมใช้ชุด 27 เฟรมจาก tools/generate-cat.mjs — ไม่เขียน cat.png ที่นี่)
void catFrames;

// ───────────────────────── ด้วงแรด ─────────────────────────
// เฟรม 16×12 (ในเกม 32×24) 2 เฟรมเดิน หันขวา
function drawBeetle(step) {
  const c = new Canvas(16, 12);
  // ขา 3 คู่ สลับจังหวะ
  for (const x of [3, 6, 9]) c.rect(x + ((x / 3 + step) % 2 ? 1 : 0), 9, 1, 2, 0x2c1640);
  c.ellipse(7, 6, 6, 4, 0x7a3fa8); // กระดอง
  c.rect(3, 3, 8, 1, 0x9a5fc8); // แสงบนกระดอง
  c.rect(7, 3, 1, 6, 0x4a2470); // รอยแบ่งปีก
  c.ellipse(12, 7, 2.5, 2.3, 0x5b2a86); // หัว
  c.triangle(12, 5, 15, 1, 14, 5, 0xe8dcb0); // เขาแรด
  c.px(13, 6, 0xffffff);
  c.px(14, 6, 0x1d1d1d);
  c.outline(0x241036);
  return c;
}
{
  const sheet = new Canvas(32, 12);
  sheet.blit(drawBeetle(0), 0, 0);
  sheet.blit(drawBeetle(1), 16, 0);
  save('beetle.png', sheet.scale(2)); // 2 เฟรม × 32×24
}

// ───────────────────────── เหรียญอุ้งเท้า ─────────────────────────
// เฟรม 16×16 (ในเกม 32×32) 6 เฟรมหมุน
{
  const widths = [12, 10, 6, 2, 6, 10];
  const sheet = new Canvas(16 * widths.length, 16);
  widths.forEach((w, i) => {
    const c = new Canvas(16, 16);
    c.ellipse(8, 8, w / 2, 6.5, 0xffd54a);
    if (w >= 6) c.ellipse(8, 8, Math.max(1, w / 2 - 2), 4.5, 0xffe88a);
    if (w >= 10) {
      // รอยอุ้งเท้า: ฝ่าเท้า + นิ้ว 4 นิ้ว
      c.ellipse(8, 10, 2.2, 1.6, 0xc99a1a);
      for (const [x, y] of [[5, 8], [7, 6], [9, 6], [11, 8]]) c.px(x, y, 0xc99a1a);
    } else if (w >= 6) {
      c.rect(8, 6, 1, 5, 0xc99a1a);
    }
    c.outline(0x8a6508);
    sheet.blit(c, i * 16, 0);
  });
  save('coin.png', sheet.scale(2)); // 6 เฟรม × 32×32
}

// ───────────────────────── พุ่มหนาม ─────────────────────────
{
  const c = new Canvas(16, 16);
  for (const [x, h] of [[2, 6], [5, 9], [8, 7], [11, 10], [13, 6]]) {
    c.triangle(x, 13, x + 2, 13 - h, x + 4, 13, 0xe53935);
    c.px(x + 2, 13 - h + 1, 0xff8a80);
  }
  c.ellipse(8, 13.5, 7.5, 2.6, 0x4a2060);
  c.rect(3, 12, 10, 1, 0x6b3380);
  c.outline(0x2a0f33);
  save('thorn.png', c.scale(2)); // 32×32 (Hitbox ในเกมเล็กกว่าภาพ)
}

// ───────────────────────── บ้านต้นไม้ (จุดจบ) ─────────────────────────
// 32×64 (ในเกม 64×128)
{
  const c = new Canvas(32, 64);
  const R = rng(7);
  // ลำต้น + รอยเปลือกไม้ + รากแผ่
  c.rect(11, 26, 10, 38, 0x6b3f1d);
  for (let y = 28; y < 62; y += 3) c.px(12 + Math.floor(R() * 7), y, 0x4e2a12);
  c.triangle(6, 63, 11, 52, 11, 63, 0x6b3f1d);
  c.triangle(26, 63, 21, 52, 21, 63, 0x6b3f1d);
  // ประตูทางเข้าที่โคนต้น
  c.rect(13, 52, 6, 12, 0x2a1508);
  c.ellipse(16, 52, 3, 3, 0x2a1508);
  // กระท่อมไม้บนต้น + ระเบียง
  c.rect(7, 26, 18, 10, 0xb07a3c);
  for (let x = 8; x < 25; x += 4) c.rect(x, 27, 1, 8, 0x8a5a28);
  c.rect(13, 29, 6, 5, 0x2a1508);
  c.px(16, 28, 0xffd54a);
  c.rect(4, 36, 24, 2, 0x8a5a28);
  c.triangle(4, 26, 16, 15, 28, 26, 0xc0392b);
  c.rect(4, 25, 24, 2, 0x992d22);
  // ร่มใบไม้ด้านบน
  c.ellipse(16, 8, 14, 7, 0x2f8f3f);
  c.ellipse(8, 11, 7, 5, 0x3fae52);
  c.ellipse(24, 11, 7, 5, 0x3fae52);
  c.ellipse(16, 5, 8, 3.5, 0x57c569);
  c.outline(0x2a1508);
  save('treehouse.png', c.scale(2));
}

// ───────────────────────── Tileset ป่า ─────────────────────────
// ช่อง 16×16 (ในเกม 32×32) เรียง 6 คอลัมน์ ตามลำดับใน tools/tileset.mjs
const T = { dirt: 0x8b5a2b, dirtDark: 0x6f4520, dirtLight: 0xa57238, grass: 0x4caf50, grassDark: 0x2f8f3f, grassLight: 0x7bd87a, wood: 0xb07a3c, woodDark: 0x8a5a28, woodLight: 0xd09a56, ring: 0xd9b36b, water: 0x3b9ae1, waterDark: 0x2f86c8, waterLight: 0x8fd0ff, waterMid: 0x5db4f0 };

function dirtBase(seed) {
  const c = new Canvas(16, 16);
  const R = rng(seed);
  c.rect(0, 0, 16, 16, T.dirt);
  for (let i = 0; i < 14; i++) c.px(Math.floor(R() * 16), Math.floor(R() * 16), R() > 0.5 ? T.dirtDark : T.dirtLight);
  return c;
}

function grassTile(seed) {
  const c = dirtBase(seed);
  c.rect(0, 0, 16, 3, T.grass);
  c.rect(0, 0, 16, 1, T.grassLight);
  for (let x = 0; x < 16; x++) {
    if (x % 4 < 2) c.px(x, 3, T.grassDark);
    if (x % 8 === 1) c.px(x, 4, T.grassDark);
    if (x % 5 === 2) c.px(x, 1, T.grassDark);
  }
  return c;
}

const tiles = {
  grass: () => grassTile(11),
  dirt: () => {
    const c = dirtBase(21);
    for (const [x, y] of [[3, 5], [4, 5], [10, 10], [11, 10], [11, 11]]) c.px(x, y, 0xb08a5a); // ก้อนหิน
    for (let y = 8; y < 14; y++) c.px(7, y, T.dirtDark); // รากไม้
    return c;
  },
  water_surface: () => {
    const c = new Canvas(16, 16);
    c.rect(0, 6, 16, 10, T.water); // 6 แถวบน (12 px ในเกม) โปร่งใส = ผิวน้ำอยู่ต่ำกว่าพื้น 12 px
    for (let x = 0; x < 16; x++) {
      c.px(x, 6, x % 4 < 2 ? T.waterLight : T.waterMid);
      if (x % 6 === 3) c.px(x, 8, T.waterDark);
    }
    return c;
  },
  water: () => {
    const c = new Canvas(16, 16);
    c.rect(0, 0, 16, 16, T.water);
    for (let x = 0; x < 16; x++) {
      if (x % 5 < 2) c.px(x, 3, T.waterDark);
      if (x % 7 < 2) c.px(x, 9, T.waterDark);
      if (x % 9 === 4) c.px(x, 12, T.waterMid);
    }
    return c;
  },
  log_left: () => logTile('left'),
  log_mid: () => logTile('mid'),
  log_right: () => logTile('right'),
  grass_left: () => {
    const c = grassTile(31);
    for (const [x, y] of [[0, 0], [1, 0], [0, 1]]) c.px(x, y, null);
    return c;
  },
  grass_right: () => {
    const c = grassTile(41);
    for (const [x, y] of [[15, 0], [14, 0], [15, 1]]) c.px(x, y, null);
    return c;
  },
  dirt_left: () => {
    const c = dirtBase(51);
    c.rect(0, 0, 1, 16, T.dirtDark);
    return c;
  },
  dirt_right: () => {
    const c = dirtBase(61);
    c.rect(15, 0, 1, 16, T.dirtDark);
    return c;
  },
  flower_red: () => flower(0xe53935, 0xffeb3b, 7),
  flower_yellow: () => flower(0xffd54a, 0xf28c28, 5),
  mushroom: () => {
    const c = new Canvas(16, 16);
    c.rect(7, 12, 3, 4, 0xf3e9d2);
    c.ellipse(8.5, 11, 4.5, 3, 0xd84343);
    c.rect(4, 12, 10, 1, 0xd84343);
    for (const [x, y] of [[6, 10], [9, 9], [11, 11]]) c.px(x, y, 0xffffff);
    c.outline(0x5a1f1f);
    return c;
  },
  fern: () => {
    const c = new Canvas(16, 16);
    for (const [dx, h, col] of [[-5, 6, T.grassDark], [-3, 9, T.grass], [0, 11, T.grassDark], [3, 9, T.grass], [5, 6, T.grassDark]]) {
      for (let i = 0; i < h; i++) c.px(8 + Math.round(dx * (i / h)), 15 - i, col);
      for (let i = 2; i < h; i += 3) c.px(8 + Math.round(dx * (i / h)) + (dx >= 0 ? 1 : -1), 15 - i, T.grassLight);
    }
    return c;
  },
  bush: () => {
    const c = new Canvas(16, 16);
    c.ellipse(5, 11.5, 4.5, 4, T.grassDark);
    c.ellipse(11, 10.5, 5, 5, T.grass);
    c.ellipse(8, 13, 7, 3, T.grassDark);
    c.ellipse(11, 8.5, 2.5, 1.5, T.grassLight);
    for (const [x, y] of [[4, 11], [9, 12], [12, 9]]) c.px(x, y, 0xe53935);
    c.outline(0x1f5a28);
    return c;
  },
  tuft: () => {
    const c = new Canvas(16, 16);
    for (const [x, h] of [[4, 4], [6, 6], [8, 5], [10, 7], [12, 4]]) for (let i = 0; i < h; i++) c.px(x, 15 - i, i > h - 2 ? T.grassLight : T.grass);
    return c;
  },
};

function flower(petal, center, x) {
  const c = new Canvas(16, 16);
  c.rect(x, 9, 1, 7, T.grassDark);
  c.px(x + 1, 12, T.grass);
  c.px(x + 2, 11, T.grass);
  c.px(x - 1, 13, T.grass);
  c.px(x - 2, 12, T.grass);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.px(x + dx, 8 + dy, petal);
  c.px(x, 8, center);
  return c;
}

// ขอนไม้: หนา 8 แถว (16 px ในเกม) อยู่ครึ่งบนของช่อง ที่เหลือโปร่งใส
function logTile(kind) {
  const c = new Canvas(16, 16);
  const R = rng(kind.length * 13);
  c.rect(0, 0, 16, 8, T.wood);
  c.rect(0, 0, 16, 1, T.woodLight);
  c.rect(0, 7, 16, 1, T.woodDark);
  for (let i = 0; i < 6; i++) c.rect(Math.floor(R() * 12), 2 + Math.floor(R() * 4), 3, 1, T.woodDark); // เสี้ยนไม้
  if (kind === 'left') {
    c.px(0, 0, null);
    c.px(0, 7, null);
    c.ellipse(2.5, 4, 2.5, 3.5, T.ring); // หน้าตัดไม้ มีวงปี
    c.px(2, 4, T.wood);
    c.px(3, 4, T.wood);
  } else if (kind === 'right') {
    c.px(15, 0, null);
    c.px(15, 7, null);
    c.ellipse(13.5, 4, 2.5, 3.5, T.ring);
    c.px(12, 4, T.wood);
    c.px(13, 4, T.wood);
  }
  return c;
}

{
  const sheet = new Canvas(16 * TILESET_COLUMNS, 16 * TILESET_ROWS);
  TILE_NAMES.forEach((name, i) => {
    if (!tiles[name]) throw new Error(`ยังไม่ได้วาดช่อง ${name}`);
    sheet.blit(tiles[name](), (i % TILESET_COLUMNS) * 16, Math.floor(i / TILESET_COLUMNS) * 16);
  });
  forestArt.tileset = sheet.scale(2); // 192×96 (ช่อง 32×32)
  save('tileset-forest.png', forestArt.tileset);
}

// ───────────────────────── พื้นหลัง Parallax ─────────────────────────
// วาด 480×272 → ขยายเป็น 960×544 (เท่าจอเกม) ชั้นที่เลื่อนต้องต่อซ้ายขวาได้เนียน (ใช้คลื่นที่ครบรอบพอดีความกว้าง)
const BW = 480;
const BH = 272;

// ฟ้า: ไล่สีแนวตั้ง + เมฆ (ไม่เลื่อน)
{
  const c = new Canvas(BW, BH);
  for (let y = 0; y < BH; y++) {
    const t = y / BH;
    const col = t < 0.65 ? mix(0x6fc3ea, 0xbfe8f7, t / 0.65) : mix(0xbfe8f7, 0xe3f6ef, (t - 0.65) / 0.35);
    c.rect(0, y, BW, 1, col);
  }
  for (const [cx, cy, s] of [[70, 40, 1], [190, 62, 0.8], [330, 34, 1.2], [440, 70, 0.7]]) {
    for (const [dx, dy, rx, ry] of [[0, 0, 18, 7], [-14, 3, 11, 5], [15, 3, 12, 5], [3, -4, 11, 5]]) c.ellipse(cx + dx * s, cy + dy * s, rx * s, ry * s, 0xffffff);
  }
  forestArt.sky = c.scale(2);
  save('bg-sky.png', forestArt.sky);
}

// ภูเขาไกล: เส้นสันเขาจากคลื่นหลายความถี่ (ครบรอบพอดี ต่อซ้ายขวาเนียน)
{
  const c = new Canvas(BW, BH);
  const ridge = (x) => 150 + 22 * Math.sin((2 * Math.PI * x * 1) / BW + 0.6) + 12 * Math.sin((2 * Math.PI * x * 3) / BW + 1.9) + 6 * Math.sin((2 * Math.PI * x * 7) / BW);
  for (let x = 0; x < BW; x++) {
    const top = Math.round(ridge(x));
    c.rect(x, top, 1, BH - top, 0x9fcab8);
    c.px(x, top, 0xc6e4d6);
    c.px(x, top + 1, 0xb4d8c6);
  }
  forestArt.far = c.scale(2);
  save('bg-far.png', forestArt.far);
}

// ต้นไม้ชั้นกลาง: พุ่มทรงกลมเรียงเป็นแนวป่า (ซ้อนกันให้ดูแน่น)
{
  const c = new Canvas(BW, BH);
  const R = rng(5);
  c.rect(0, 222, BW, BH - 222, 0x4a8f56);
  const draw = (x, r, y) => {
    for (const ox of [-BW, 0, BW]) {
      c.rect(Math.round(x + ox) - 1, y, 3, 30, 0x5a3d22); // ลำต้น
      c.ellipse(x + ox, y - r * 0.2, r, r * 0.95, 0x5fa66a);
      c.ellipse(x + ox - r * 0.3, y - r * 0.5, r * 0.55, r * 0.5, 0x7cc184);
      c.ellipse(x + ox + r * 0.4, y + r * 0.1, r * 0.6, r * 0.5, 0x4a8f56);
    }
  };
  for (let i = 0; i < 14; i++) draw(i * (BW / 14) + (R() - 0.5) * 8, 15 + R() * 9, 205 + R() * 12);
  forestArt.mid = c.scale(2);
  save('bg-mid.png', forestArt.mid);
}

// ต้นไม้ใกล้: ต้นใหญ่ลำต้นหนา ร่มใบเข้ม + เฟิร์นที่โคน
{
  const c = new Canvas(BW, BH);
  const R = rng(9);
  const tree = (x, scale) => {
    for (const ox of [-BW, 0, BW]) {
      const X = x + ox;
      c.rect(Math.round(X) - 4 * scale, 120, 8 * scale, 140, 0x5a3a20);
      c.rect(Math.round(X) - 4 * scale, 120, 2 * scale, 140, 0x6f4a2a);
      c.ellipse(X, 105, 34 * scale, 30 * scale, 0x2f7d46);
      c.ellipse(X - 18 * scale, 118, 20 * scale, 16 * scale, 0x3a8f4e);
      c.ellipse(X + 20 * scale, 116, 22 * scale, 17 * scale, 0x2a6e3e);
      c.ellipse(X - 6 * scale, 92, 18 * scale, 12 * scale, 0x4aa05c);
    }
  };
  [40, 130, 250, 340, 440].forEach((x, i) => tree(x + (R() - 0.5) * 20, 0.9 + (i % 2) * 0.25));
  for (let i = 0; i < 24; i++) {
    const x = Math.round(R() * BW);
    for (let k = -3; k <= 3; k++) c.px(x + k, 250 - Math.abs(k) * 2, 0x2a6e3e);
  }
  forestArt.near = c.scale(2);
  save('bg-near.png', forestArt.near);
}

// ───────────────────────── Checkpoint: ตอไม้ป้ายอุ้งเท้า ─────────────────────────
// 2 เฟรม 32×48 (ในเกม): 0 = ยังไม่ผ่าน (ป้ายเทา) · 1 = ผ่านแล้ว (ป้ายทองมีประกาย) จุดอ้างอิงที่ฐานกลาง
function drawCheckpoint(active) {
  const c = new Canvas(16, 24);
  c.rect(3, 17, 10, 6, 0x7a4a22); // ตอไม้
  c.px(2, 22, 0x7a4a22);
  c.px(13, 22, 0x7a4a22);
  c.ellipse(8, 17, 5, 2, 0xd9b36b); // หน้าตัดตอ
  c.ellipse(8, 17, 2.5, 1, 0xb07a3c);
  c.rect(7, 8, 2, 10, 0x6b4423); // เสาป้าย
  const board = active ? 0xffd54a : 0xb8a58a;
  const paw = active ? 0xb8860b : 0x7a6b55;
  c.rect(2, 2, 12, 7, board);
  c.rect(2, 8, 12, 1, active ? 0xd9a82a : 0x9a8a70); // ขอบล่างป้าย
  c.ellipse(8, 6.2, 2.2, 1.6, paw); // รอยอุ้งเท้า
  for (const [x, y] of [[4.5, 4], [6.5, 3], [9.5, 3], [11.5, 4]]) c.px(x, y, paw);
  c.outline(0x3a2410);
  if (active) {
    for (const [x, y] of [[0, 1], [15, 0], [1, 10], [14, 9]]) c.px(x, y, 0xfff3a0); // ประกาย
    for (let i = 0; i < 14; i++) c.blend(1 + i, 1, 0xfff3a0, 0.25); // แสงเรืองบนป้าย
  }
  return c;
}
{
  const sheet = new Canvas(32, 24);
  sheet.blit(drawCheckpoint(false), 0, 0);
  sheet.blit(drawCheckpoint(true), 16, 0);
  save('checkpoint.png', sheet.scale(2));
}

// ───────────────────────── ชุดภาพด่าน 2 (ป่าลึก) และด่าน 3 (ป่ายามค่ำ) ─────────────────────────
// ดัดแปลงจากชุดป่าปกติด้วยการเปลี่ยนสี + เพิ่มรายละเอียด (แสงลอดใบไม้ / ดาว-พระจันทร์ / เห็ดเรืองแสง)
// ชื่อไฟล์: tileset-<theme>.png และ bg-<sky|far|mid|near>-<theme>.png
const tint = (canvas, fn) => canvas.recolor(fn);
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const nightColor = (k) => (r, g, b) => {
  const l = lum(r, g, b);
  return [(l * 0.28 + r * 0.08) * k, (l * 0.42 + g * 0.12 + 6) * k, (l * 0.75 + b * 0.18 + 24) * k];
};

// --- ป่าลึก: โทนเขียวมรกตเข้ม มีลำแสงลอดใบไม้ ---
{
  const deep = (rm, gm, bm) => (r, g, b) => [r * rm, g * gm, b * bm];
  save('tileset-deep.png', tint(forestArt.tileset, deep(0.78, 0.88, 0.82)));
  save('bg-far-deep.png', tint(forestArt.far, deep(0.72, 0.9, 0.85)));
  save('bg-mid-deep.png', tint(forestArt.mid, deep(0.62, 0.82, 0.7)));
  save('bg-near-deep.png', tint(forestArt.near, deep(0.45, 0.72, 0.55)));

  const sky = new Canvas(960, 544);
  for (let y = 0; y < 544; y++) {
    const t = y / 544;
    sky.rect(0, y, 960, 1, t < 0.6 ? mix(0x2f6f66, 0x7fb89a, t / 0.6) : mix(0x7fb89a, 0xcfe8c8, (t - 0.6) / 0.4));
  }
  // ลำแสงเฉียงลอดเรือนยอดไม้
  for (const [x0, w, a] of [[130, 46, 0.16], [330, 30, 0.12], [520, 56, 0.17], [720, 34, 0.12], [900, 48, 0.15]]) {
    for (let y = 0; y < 544; y++) {
      const cx = x0 - y * 0.42;
      for (let dx = -w; dx <= w; dx++) sky.blend(cx + dx, y, 0xfff6c0, a * (1 - Math.abs(dx) / w) * (1 - (y / 544) * 0.5));
    }
  }
  save('bg-sky-deep.png', sky);
}

// --- ป่ายามค่ำ: น้ำเงินเข้ม ดาว พระจันทร์ เห็ดเรืองแสง ---
{
  const night = (canvas, k) => tint(canvas, nightColor(k));

  // เห็ดเรืองแสง: ทับช่อง mushroom ใน tileset
  const glow = new Canvas(16, 16);
  for (let y = 4; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot((x - 8.5) / 7.5, (y - 11) / 6);
      if (d < 1) glow.blend(x, y, 0x4cf0e6, 0.3 * (1 - d));
    }
  }
  glow.rect(7, 12, 3, 4, 0xe8fff8);
  glow.ellipse(8.5, 11, 4.5, 3, 0x2fd8cc);
  glow.rect(4, 12, 10, 1, 0x2fd8cc);
  for (const [x, y] of [[6, 10], [9, 9], [11, 11]]) glow.px(x, y, 0xffffff);
  const tileset = night(forestArt.tileset, 1.35); // สว่างกว่าฉากหลังเล็กน้อย ให้พื้นที่เดินเด่นชัด
  const mi = TILE_NAMES.indexOf('mushroom');
  const mx = (mi % TILESET_COLUMNS) * 32;
  const my = Math.floor(mi / TILESET_COLUMNS) * 32;
  tileset.rect(mx, my, 32, 32, null);
  tileset.blit(glow.scale(2), mx, my);
  save('tileset-night.png', tileset);

  save('bg-far-night.png', night(forestArt.far, 1));
  save('bg-mid-night.png', night(forestArt.mid, 0.8));
  save('bg-near-night.png', night(forestArt.near, 0.62));

  const sky = new Canvas(960, 544);
  for (let y = 0; y < 544; y++) {
    const t = y / 544;
    sky.rect(0, y, 960, 1, t < 0.7 ? mix(0x070b24, 0x1d2a5c, t / 0.7) : mix(0x1d2a5c, 0x3a4a86, (t - 0.7) / 0.3));
  }
  const Rn = rng(77);
  for (let i = 0; i < 170; i++) {
    const x = Math.floor(Rn() * 960);
    const y = Math.floor(Rn() * 380);
    const b = 140 + Math.floor(Rn() * 115);
    const col = (b << 16) | (b << 8) | Math.min(255, b + 30);
    sky.rect(x, y, 2, 2, col);
    if (Rn() > 0.93) { // ดาวสว่างมีแฉก
      sky.rect(x - 2, y, 6, 2, col);
      sky.rect(x, y - 2, 2, 6, col);
    }
  }
  // พระจันทร์ + รัศมี
  for (let r = 90; r > 40; r -= 2) for (let a = 0; a < 360; a += 1) sky.blend(790 + Math.cos((a * Math.PI) / 180) * r, 110 + Math.sin((a * Math.PI) / 180) * r, 0xcfd8ff, 0.018);
  sky.ellipse(790, 110, 40, 40, 0xf4f0d0);
  for (const [cx, cy, r] of [[775, 98, 7], [802, 120, 9], [782, 128, 5], [806, 92, 4]]) sky.ellipse(cx, cy, r, r, 0xd8d2b0);
  save('bg-sky-night.png', sky);
}

console.log('สร้างภาพเสร็จแล้วที่', OUT);
