// ชุดแอนิเมชันแมว 27 เฟรม 8 ท่า (วาดด้วยโค้ด ไม่ใช้ PixelLab) — ใช้ในเกมจริง
// รัน: node tools/generate-cat.mjs
// ผลลัพธ์: public/assets/images/cat.png (ที่เกมโหลด) + preview/cat-animation/ (ไฟล์ดูตัวอย่าง: sheet, json, contact sheet)
// หน้าดูแอนิเมชัน: http://localhost:5173/preview/cat-animation/index.html (ตอนรัน npm run dev)
//
// เฟรม 24×24 พิกเซลศิลป์ ขยาย ×2 => 48×48 · แมวหันขวา · ยืน/วิ่งสองเท้า
// เท้าเหยียบแถวล่างสุดของเฟรมเสมอ (แถว 22 + เส้นขอบแถว 23)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, writePng, mix } from './pixel.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'preview', 'cat-animation');

// สีเดียวกับ generate-art.mjs (+ สีเข้มขึ้นสำหรับแขนขาข้างไกล)
const CAT = { O1: 0xf28c28, O2: 0xffc27a, O3: 0xc4691a, OUT: 0x4a2408, SCARF: 0xd63a2f, SCARF2: 0xa3271f, PINK: 0xff8fa3, EYE: 0x1d1d1d, WHITE: 0xffffff };
CAT.FAR = mix(CAT.O1, CAT.O3, 0.55);
CAT.FARARM = mix(CAT.O1, CAT.O3, 0.3);
CAT.INNER = mix(CAT.OUT, CAT.O3, 0.4);
CAT.FARFOOT = mix(CAT.O2, CAT.O3, 0.6);

// วาดแขน/ขาเป็นเส้นหนา w พิกเซล ผ่านจุด pts [[x,y],...]
function limb(c, pts, w, col) {
  const off = (w - 1) >> 1;
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, y0] = pts[s];
    const [x1, y1] = pts[s + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (dx * i) / n);
      const y = Math.round(y0 + (dy * i) / n);
      if (Math.abs(dy) >= Math.abs(dx)) c.rect(x - off, y, w, 1, col);
      else c.rect(x, y - off, 1, w, col);
    }
  }
}

// หางโค้ง: เส้นโค้ง Bezier กำลังสอง หนา 2 พิกเซล สลับสีลาย
function drawTail(c, ox, b, t) {
  const P0 = [6, 16 + b];
  const C = [t.cx ?? 0, (t.cy ?? 13) + b];
  const P2 = [t.tx ?? 4, (t.ty ?? 8) + b];
  const N = t.n ?? 12;
  let prev = P0;
  for (let i = 1; i <= N; i++) {
    const u = i / N;
    const cur = [Math.round((1 - u) ** 2 * P0[0] + 2 * (1 - u) * u * C[0] + u * u * P2[0]), Math.round((1 - u) ** 2 * P0[1] + 2 * (1 - u) * u * C[1] + u * u * P2[1])];
    const col = Math.floor((i - 1) / 2) % 2 ? CAT.O3 : CAT.O1;
    limb(c, [[prev[0] + ox, prev[1]], [cur[0] + ox, cur[1]]], t.puff ? 3 : 2, col);
    prev = cur;
  }
}

// ผ้าพันคอ: ชายผ้าพลิ้วเป็นลูกคลื่น ออกจากคอไปทางทิศ (vx, vy)
function drawScarfTail(c, ox, b, s) {
  const len = s.len ?? 4;
  for (let i = 1; i <= len; i++) {
    const x = 6 + (s.vx ?? -1) * (i - 1) * 1;
    const wave = (s.amp ?? 0) * Math.sin((s.phase ?? 0) + i * 0.95) * (i / len);
    const y = 12 + b + (s.vy ?? 0) * i * 0.7 + wave;
    const X = Math.round(x) + ox;
    const Y = Math.round(y);
    const thick = i <= len - 2 ? 2 : 1;
    c.rect(X, Y - 1 + (thick === 1 ? 1 : 0), 2, 1, CAT.SCARF);
    if (thick === 2) c.rect(X, Y, 2, 1, CAT.SCARF2);
  }
}

// ขาหนึ่งข้าง: leg = { k: [[dx,y],...] เข่า, f: [dx,y] จุดเท้า }, hx = ศูนย์กลางสะโพก
function drawLeg(c, hx, b, leg, far) {
  const hy = 18 + b;
  const pts = [[hx, hy]];
  for (const [dx, y] of leg.k || []) pts.push([hx + dx, y]);
  const [fdx, fy] = leg.f;
  pts.push([hx + fdx, fy - (fy > hy ? 1 : 0)]);
  limb(c, pts, leg.w ?? 3, far ? CAT.FAR : CAT.O1);
  c.rect(hx + fdx - 1, fy, 4, 1, far ? CAT.FARFOOT : CAT.O2);
}

// แขน: shoulder ถึงมือผ่านข้อศอก
function drawArm(c, sx, sy, arm, far) {
  const pts = [[sx, sy], [sx + arm.e[0], sy + arm.e[1]], [sx + arm.h[0], sy + arm.h[1]]];
  limb(c, pts, 2, far ? CAT.FARARM : CAT.O1);
  const end = pts[2];
  c.px(end[0], end[1], far ? CAT.FARFOOT : CAT.O2);
}

const STAND_LEG_N = { k: [], f: [0, 22] };
const STAND_LEG_F = { k: [], f: [0, 22] };
// ท่าแขนห้อยปกติ
const ARM_HANG = { e: [0, 2], h: [0, 3] };

function drawCat(p = {}) {
  const c = new Canvas(24, 24);
  const b = p.b || 0; // ตัวบนเตี้ยลงกี่พิกเซล (ขา/เท้าติดพื้น)
  const hb = b + (p.hy || 0); // หัวขยับแยกได้
  const ox = p.lean || 0; // เอียงตัวบนไปข้างหน้า(+)/หลัง(-)
  const sq = p.squash || 0;
  const U = (x, y, w, h, col) => c.rect(x + ox, y, w, h, col);
  const UP = (x, y, col) => c.px(x + ox, y, col);

  // ชิ้นส่วนที่ซ้อนกันมีเส้นขอบของตัวเอง (วาดบนเลเยอร์แยก แล้ววางทับ) เพื่อให้แยกจากลำตัวชัด
  const layer = (fn, clipY = -99, skip = null) => {
    const l = new Canvas(24, 24);
    fn(l);
    // เส้นขอบด้านใน: วาดเฉพาะจุดที่ทับกับสิ่งที่วาดไปแล้ว (เส้นขอบด้านนอกให้ c.outline ตอนท้ายทำ)
    const inner = [];
    for (let y = Math.max(0, clipY); y < 24; y++)
      for (let x = 0; x < 24; x++)
        if (!(skip && skip(x, y)) && !l.alphaAt(x, y) && c.alphaAt(x, y) && (l.alphaAt(x - 1, y) || l.alphaAt(x + 1, y) || l.alphaAt(x, y - 1) || l.alphaAt(x, y + 1))) inner.push([x, y]);
    c.blit(l, 0, 0);
    for (const [x, y] of inner) c.px(x, y, CAT.INNER);
  };

  // หาง (อยู่หลังสุด)
  layer((l) => drawTail(l, ox, b, p.tail || {}));

  // แขนไกล (สีเข้ม) + ขาไกล
  layer((l) => {
    drawArm(l, 8 + ox, 14 + b, p.armF2 || ARM_HANG, true);
    drawLeg(l, 10, b, p.legFar || STAND_LEG_F, true);
  });

  // ลำตัว: ลายเสือ ท้องสีอ่อน
  layer((l) => {
    l.rect(8 - sq + ox, 13 + b, 8 + sq * 2, 5, CAT.O1);
    l.rect(12 + ox, 14 + b, 4 + sq, 3, CAT.O2);
    for (const [x, y] of [[8 - sq, 14], [8 - sq, 16], [9 - sq, 15], [9 - sq, 17]]) l.px(x + ox, y + b, CAT.O3);
  }, 13 + b);

  // ขาใกล้
  layer((l) => drawLeg(l, 14, b, p.legNear || STAND_LEG_N, false), 18 + b);

  // ผ้าพันคอ (ปมที่คอ + ชายผ้า)
  layer((l) => {
    l.rect(7 - sq + ox, 11 + b, 10 + sq * 2, 2, CAT.SCARF);
    l.rect(7 - sq + ox, 12 + b, 10 + sq * 2, 1, CAT.SCARF2);
    drawScarfTail(l, ox, b, p.scarf || { len: 3, vx: -1, vy: 1, amp: 0.4 });
  }, -99, (x, y) => y === 13 + b && x >= 8 + ox);

  // หัว: หู หน้า ลายหน้าผาก ปากจมูก
  const hw = sq ? 12 : 10;
  const hx0 = 7 - sq;
  U(hx0, 1 + hb, 2, 3, CAT.O1);
  UP(hx0 + 1, 2 + hb, CAT.PINK);
  U(hx0 + hw - 2, 1 + hb, 2, 3, CAT.O1);
  UP(hx0 + hw - 2, 2 + hb, CAT.PINK);
  U(hx0, 3 + hb, hw, 8, CAT.O1);
  U(11, 7 + hb, 6 + sq, 3, CAT.O2);
  UP(11, 3 + hb, CAT.O3);
  UP(12, 3 + hb, CAT.O3);
  UP(12, 4 + hb, CAT.O3);
  UP(16 + sq, 7 + hb, CAT.PINK); // จมูก
  const eyes = p.eyes || 'open';
  const mouth = p.mouth || 'smile';
  if (mouth === 'smile') UP(14, 9 + hb, CAT.O3);
  if (mouth === 'open') U(13, 9 + hb, 3, 2, CAT.EYE);
  if (mouth === 'grin') {
    U(13, 9 + hb, 3, 1, CAT.EYE);
    UP(14, 10 + hb, CAT.PINK);
  }
  if (mouth === 'flat') U(13, 9 + hb, 2, 1, CAT.O3);
  if (eyes === 'open') {
    U(11, 5 + hb, 2, 2, CAT.WHITE);
    U(14, 5 + hb, 2, 2, CAT.WHITE);
    for (const x of [12, 15]) {
      UP(x, 5 + hb, CAT.EYE);
      UP(x, 6 + hb, CAT.EYE);
    }
  } else if (eyes === 'blink') {
    U(11, 6 + hb, 2, 1, CAT.EYE);
    U(14, 6 + hb, 2, 1, CAT.EYE);
  } else if (eyes === 'happy') {
    // ตายิ้มโค้งขึ้น ^ ^
    for (const [x, y] of [[10, 6], [11, 5], [12, 6], [14, 6], [15, 5], [16, 6]]) UP(x, y + hb, CAT.EYE);
  } else if (eyes === 'shock') {
    U(11, 5 + hb, 2, 3, CAT.WHITE);
    U(14, 5 + hb, 2, 3, CAT.WHITE);
    UP(12, 6 + hb, CAT.EYE);
    UP(15, 6 + hb, CAT.EYE);
  } else if (eyes === 'up') {
    // มองขึ้น (ตอนกระโดด)
    U(11, 5 + hb, 2, 2, CAT.WHITE);
    U(14, 5 + hb, 2, 2, CAT.WHITE);
    UP(12, 5 + hb, CAT.EYE);
    UP(15, 5 + hb, CAT.EYE);
    UP(12, 6 + hb, CAT.WHITE);
    UP(15, 6 + hb, CAT.WHITE);
  } else if (eyes === 'squint') {
    // หรี่ตาแน่น > <
    for (const [x, y] of [[11, 5], [12, 6], [11, 7], [16, 5], [15, 6], [16, 7]]) UP(x, y + hb, CAT.EYE);
  }

  // แขนใกล้ (ทับลำตัว)
  layer((l) => drawArm(l, 15 + ox, 14 + b, p.armN || ARM_HANG, false), 14 + b);

  // ขนพอง (ตกใจ)
  if (p.puff) {
    const set = p.puff === 2
      ? [[6, 3], [6, 7], [17, 3], [17, 7], [9, 2], [14, 2], [6, 13], [17, 14], [5, 11], [18, 10]]
      : [[6, 4], [6, 8], [17, 4], [17, 8], [10, 2], [13, 2], [6, 14], [17, 15], [5, 12], [18, 11]];
    for (const [x, y] of set) UP(x, y + hb, CAT.O1);
  }

  c.outline(CAT.OUT);
  return c;
}

// ───────────────────────── ตารางท่า ─────────────────────────
const arm = (e, h) => ({ e, h });
// ท่าแกว่งแขน: 2 = ไปข้างหน้าสุด … -2 = ไปข้างหลังสุด
const SWING = {
  2: arm([2, 1], [3, -1]),
  1: arm([2, 2], [3, 1]),
  0: arm([1, 2], [1, 4]),
  '-1': arm([0, 2], [-1, 4]),
  '-2': arm([-1, 2], [-2, 3]),
};
const SWING_FAR = { ...SWING, '-2': arm([-2, 1], [-3, 2]), '-1': arm([-1, 2], [-2, 3]) };

const frames = []; // { anim, canvas }
const anims = [];
function addAnim(name, fps, loop, poses) {
  anims.push({ name, start: frames.length, count: poses.length, fps, loop });
  for (const pose of poses) frames.push({ anim: name, canvas: drawCat(pose) });
}

// ── idle: 6 เฟรม — หายใจ + หางแกว่ง + กะพริบตา 1 เฟรม ──
{
  const bs = [0, 0, 1, 1, 1, 0];
  const sway = [0, 1, 2, 2, 1, 0];
  addAnim('idle', 5, true, bs.map((b, i) => ({
    b,
    tail: { tx: 3 + sway[i], ty: 7 + b, cx: 0 + sway[i] * 0.5, cy: 14 },
    eyes: i === 4 ? 'blink' : 'open',
    scarf: { len: 3, vx: -1, vy: 1.2, amp: 0.6, phase: i * 0.8 },
    armN: { e: [0, 2], h: [0, 3] },
    armF2: { e: [0, 2], h: [0, 3] },
  })));
}

// ── run: 8 เฟรม — ท่าขาเป็น 2 จังหวะ ๆ ละ 4 เฟรม (สัมผัสพื้น กดตัว ผ่านใต้ตัว ลอย) ──
{
  // ขาหน้า (lead): เท้าแตะพื้นด้านหน้าแล้วถีบไปด้านหลัง · ขาตาม (trail): ยกส้นเหวี่ยงมาข้างหน้า
  const LEAD = [
    { k: [[1, 20]], f: [3, 22] },
    { k: [[1, 20]], f: [1, 22] },
    { k: [[0, 20]], f: [-1, 22] },
    { k: [[-1, 20]], f: [-4, 21] },
  ];
  const TRAIL = [
    { k: [[-1, 21]], f: [-4, 20] },
    { k: [[-1, 20]], f: [-4, 18] },
    { k: [[2, 20]], f: [0, 21] },
    { k: [[2, 20]], f: [4, 22] },
  ];
  const bobs = [1, 1, 0, 0];
  const swingNear = [-2, -1, 0, 1, 2, 1, 0, -1];
  const poses = [];
  for (let i = 0; i < 8; i++) {
    const step = i % 4;
    const nearIsLead = i < 4;
    const legNear = nearIsLead ? LEAD[step] : TRAIL[step];
    const legFar = nearIsLead ? TRAIL[step] : LEAD[step];
    const s = swingNear[i];
    poses.push({
      b: bobs[step],
      legNear,
      legFar,
      armN: SWING[s],
      armF2: SWING_FAR[-s],
      tail: { tx: 3 + Math.round(1.5 * Math.sin((i / 8) * Math.PI * 2)), ty: 7, cx: -1, cy: 16 },
      scarf: { len: 5, vx: -1, vy: 0, amp: 1.6, phase: (i / 8) * Math.PI * 2 * -1 },
      mouth: 'smile',
    });
  }
  addAnim('run', 12, true, poses);
}

// ── jump_up: 2 เฟรม — ย่อตัวออกแรง → ยืดตัวพุ่งขึ้น ──
addAnim('jump_up', 10, false, [
  {
    b: 2,
    hy: 0,
    legNear: { k: [[2, 21]], f: [3, 22] },
    legFar: { k: [[-2, 21]], f: [-3, 22] },
    armN: arm([-1, 2], [-2, 4]),
    armF2: arm([-2, 1], [-4, 2]),
    tail: { tx: 3, ty: 9, cx: 0, cy: 15 },
    scarf: { len: 5, vx: -1, vy: 0.5, amp: 0.8, phase: 0.5 },
    mouth: 'flat',
  },
  {
    b: 0,
    legNear: { k: [], f: [-1, 22] },
    legFar: { k: [[-1, 21]], f: [0, 22] },
    armN: arm([3, -1], [4, -4]),
    armF2: arm([-4, -1], [-5, -4]),
    tail: { tx: 2, ty: 12, cx: -1, cy: 17 },
    scarf: { len: 5, vx: -0.6, vy: 1.2, amp: 0.6, phase: 1.2 },
    eyes: 'up',
    mouth: 'smile',
  },
]);

// ── jump_apex: 1 เฟรม — จุดสูงสุด แขนกาง เข่าตวัด ผ้าพันคอลอย ──
addAnim('jump_apex', 6, false, [
  {
    b: 0,
    legNear: { k: [[3, 20]], f: [4, 21] },
    legFar: { k: [[-2, 21]], f: [-3, 22] },
    armN: arm([3, -1], [5, -3]),
    armF2: arm([-3, -1], [-5, -3]),
    tail: { tx: 1, ty: 12, cx: -1, cy: 16 },
    scarf: { len: 6, vx: -1, vy: -0.3, amp: 1.0, phase: 0.3 },
    mouth: 'grin',
  },
]);

// ── fall: 2 เฟรม — ตกลง แขนยกสะบัด ผ้าพันคอปลิวขึ้น ──
addAnim('fall', 8, true, [
  {
    b: 0,
    legNear: { k: [], f: [0, 22] },
    legFar: { k: [[-1, 21]], f: [-1, 22] },
    armN: arm([3, -1], [4, -4]),
    armF2: arm([-4, -1], [-5, -4]),
    tail: { tx: 2, ty: 11, cx: -1, cy: 16 },
    scarf: { len: 5, vx: -0.6, vy: -1.2, amp: 0.9, phase: 0 },
    eyes: 'shock',
    mouth: 'open',
  },
  {
    b: 0,
    legNear: { k: [[1, 21]], f: [1, 22] },
    legFar: { k: [], f: [-1, 22] },
    armN: arm([4, -2], [4, -8]),
    armF2: arm([-4, -2], [-4, -8]),
    tail: { tx: 3, ty: 11, cx: -1, cy: 16 },
    scarf: { len: 5, vx: -0.6, vy: -1.2, amp: 0.9, phase: 2.2 },
    eyes: 'shock',
    mouth: 'open',
  },
]);

// ── land: 2 เฟรม — กระแทกพื้นตัวแบน → ลุกขึ้น ──
addAnim('land', 10, false, [
  {
    b: 3,
    squash: 1,
    legNear: { k: [[3, 21]], f: [5, 22] },
    legFar: { k: [[-3, 21]], f: [-5, 22] },
    armN: arm([3, 1], [5, 2]),
    armF2: arm([-3, 1], [-5, 2]),
    tail: { tx: 2, ty: 11, cx: 0, cy: 17 },
    scarf: { len: 5, vx: -1, vy: -0.5, amp: 0.8, phase: 1 },
    eyes: 'squint',
    mouth: 'flat',
  },
  {
    b: 1,
    legNear: { k: [[1, 21]], f: [1, 22] },
    legFar: { k: [[-1, 21]], f: [-1, 22] },
    armN: arm([1, 2], [2, 3]),
    armF2: arm([-1, 2], [-2, 3]),
    tail: { tx: 3, ty: 8, cx: 0, cy: 14 },
    scarf: { len: 4, vx: -1, vy: 0.8, amp: 0.8, phase: 2 },
  },
]);

// ── hurt: 2 เฟรม — ตาโต ขนพอง กางแขนเสียหลัก ──
addAnim('hurt', 8, true, [
  {
    b: 0,
    lean: -1,
    legNear: { k: [[2, 21]], f: [2, 22] },
    legFar: { k: [[-2, 21]], f: [-2, 22] },
    armN: arm([3, -1], [4, -4]),
    armF2: arm([-4, -1], [-5, -4]),
    tail: { tx: 5, ty: 7, cx: 2, cy: 13, puff: true },
    scarf: { len: 5, vx: -0.7, vy: -1, amp: 1.0, phase: 0.5 },
    eyes: 'shock',
    mouth: 'open',
    puff: 1,
  },
  {
    b: 1,
    lean: -1,
    legNear: { k: [[1, 21]], f: [1, 22] },
    legFar: { k: [[-2, 21]], f: [-2, 22] },
    armN: arm([3, -1], [4, -4]),
    armF2: arm([-4, -1], [-5, -4]),
    tail: { tx: 5, ty: 8, cx: 2, cy: 14, puff: true },
    scarf: { len: 5, vx: -0.7, vy: -1, amp: 1.0, phase: 2.5 },
    eyes: 'shock',
    mouth: 'open',
    puff: 2,
  },
]);

// ── celebrate: 4 เฟรม — กระโดดดีใจ ชูแขน ──
addAnim('celebrate', 8, true, [
  {
    b: 2,
    legNear: { k: [[2, 21]], f: [2, 22] },
    legFar: { k: [[-2, 21]], f: [-2, 22] },
    armN: arm([2, 0], [3, -2]),
    armF2: arm([-3, 0], [-4, -2]),
    tail: { tx: 2, ty: 12, cx: -1, cy: 17 },
    scarf: { len: 4, vx: -1, vy: 0.6, amp: 0.8, phase: 0 },
    eyes: 'happy',
    mouth: 'grin',
  },
  {
    b: 0,
    legNear: { k: [], f: [-1, 22] },
    legFar: { k: [[-1, 21]], f: [0, 22] },
    armN: arm([4, -2], [4, -8]),
    armF2: arm([-4, -2], [-4, -8]),
    tail: { tx: 2, ty: 11, cx: -1, cy: 16 },
    scarf: { len: 5, vx: -0.8, vy: 0.2, amp: 1.2, phase: 1 },
    eyes: 'happy',
    mouth: 'grin',
  },
  {
    b: 0,
    legNear: { k: [[3, 20]], f: [4, 21] },
    legFar: { k: [[-2, 21]], f: [-3, 22] },
    armN: arm([4, -2], [4, -8]),
    armF2: arm([-4, -2], [-4, -8]),
    tail: { tx: 1, ty: 12, cx: -1, cy: 17 },
    scarf: { len: 6, vx: -1, vy: -0.4, amp: 1.2, phase: 2 },
    eyes: 'happy',
    mouth: 'grin',
  },
  {
    b: 1,
    legNear: { k: [[1, 21]], f: [1, 22] },
    legFar: { k: [[-1, 21]], f: [-1, 22] },
    armN: arm([4, -2], [4, -8]),
    armF2: arm([-4, -2], [-4, -8]),
    tail: { tx: 2, ty: 11, cx: -1, cy: 16 },
    scarf: { len: 5, vx: -1, vy: 0.5, amp: 1.0, phase: 3 },
    eyes: 'happy',
    mouth: 'grin',
  },
]);

// ───────────────────────── ส่งออก ─────────────────────────
const FW = 24;
const sheet = new Canvas(FW * frames.length, 24);
frames.forEach((f, i) => sheet.blit(f.canvas, i * FW, 0));
const sheet2 = sheet.scale(2);
writePng(path.join(OUT, 'cat-sheet.png'), sheet2);
writePng(path.join(ROOT, 'public', 'assets', 'images', 'cat.png'), sheet2); // ไฟล์ที่เกมใช้จริง
writePng(path.join(OUT, 'frames-contact-sheet.png'), sheet2.scale(4));
fs.writeFileSync(
  path.join(OUT, 'cat-sheet.json'),
  JSON.stringify({ frameWidth: 48, frameHeight: 48, totalFrames: frames.length, animations: anims }, null, 2) + '\n'
);

// ───────────────────────── ตรวจคุณภาพอัตโนมัติ ─────────────────────────
let problems = 0;
frames.forEach((f, i) => {
  const c = f.canvas;
  const bottomOpaque = [...Array(24).keys()].some((x) => c.alphaAt(x, 23));
  const edge = (x, y) => c.alphaAt(x, y) && !(c.data[(y * 24 + x) * 4] === 0x4a && c.data[(y * 24 + x) * 4 + 1] === 0x24);
  const clipped = [...Array(24).keys()].some((k) => edge(0, k) || edge(23, k) || edge(k, 0) || edge(k, 23) && false);
  let stray = 0;
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++)
      if (c.alphaAt(x, y) && !c.alphaAt(x - 1, y) && !c.alphaAt(x + 1, y) && !c.alphaAt(x, y - 1) && !c.alphaAt(x, y + 1)) stray++;
  if (!bottomOpaque || clipped || stray) {
    problems++;
    console.log(`เฟรม ${i} (${f.anim}): bottom=${bottomOpaque} clipped=${clipped} stray=${stray}`);
  }
});
console.log(`เฟรมทั้งหมด ${frames.length} · ปัญหา ${problems} · เขียนไฟล์ที่ ${OUT}`);

// ภาพ debug (ตั้ง CAT_DEBUG=ไฟล์.png) — กริดแต่ละแอนิเมชันเป็นแถว ขยาย ×6 บนพื้นฟ้า
if (process.env.CAT_DEBUG) {
  const S = Number(process.env.CAT_SCALE || 6);
  const only = process.env.CAT_ONLY ? process.env.CAT_ONLY.split(",") : null;
  const list = only ? anims.filter((a) => only.includes(a.name)) : anims;
  const cell = 24 * S + 6;
  const cols = Math.min(4, Math.max(...list.map((a) => a.count)));
  const rowsN = list.reduce((n, a) => n + Math.ceil(a.count / cols), 0);
  const dbg = new Canvas(cols * cell, rowsN * cell);
  dbg.rect(0, 0, dbg.w, dbg.h, 0x9fd8f2);
  let row = 0;
  list.forEach((a) => {
    for (let k = 0; k < a.count; k++) {
      const rr = row + Math.floor(k / cols);
      const cc = k % cols;
      dbg.blit(frames[a.start + k].canvas.scale(S), cc * cell + 3, rr * cell + 3);
    }
    row += Math.ceil(a.count / cols);
  });
  writePng(process.env.CAT_DEBUG, dbg);
}

// ตัวช่วย debug: CAT_DUMP=เลขเฟรม พิมพ์เฟรมเป็นตัวอักษร
if (process.env.CAT_DUMP) {
  const c = frames[Number(process.env.CAT_DUMP)].canvas;
  const names = new Map([[CAT.O1, 'o'], [CAT.O2, 'l'], [CAT.O3, 'd'], [CAT.OUT, '#'], [CAT.SCARF, 'R'], [CAT.SCARF2, 'r'], [CAT.PINK, 'p'], [CAT.EYE, 'E'], [CAT.WHITE, 'w'], [CAT.FAR, 'f'], [CAT.FARFOOT, 'F'], [CAT.FARARM, 'a'], [CAT.INNER, 'i']]);
  for (let y = 0; y < 24; y++) {
    let row = '';
    for (let x = 0; x < 24; x++) {
      if (!c.alphaAt(x, y)) { row += '.'; continue; }
      const i = (y * 24 + x) * 4;
      row += names.get((c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2]) || '?';
    }
    console.log(String(y).padStart(2) + ' ' + row);
  }
}
