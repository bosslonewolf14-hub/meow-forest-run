// สร้างแผนที่ Tiled จากข้อมูลด่านใน tools/levels/levelN.mjs → public/assets/maps/forest-N.tmj
// รัน: node tools/build-map.mjs <เลขด่าน> [โฟลเดอร์ปลายทาง]   เช่น node tools/build-map.mjs 2
// (ทำครั้งเดียวตอนเริ่มแต่ละด่าน — หลังจากนั้นแก้ใน Tiled โดยตรง · รันซ้ำจะเขียนทับ!)
//
// เลเยอร์ (เรียงจากหลังไปหน้า):
//   Ground      (ภาพ)   พื้นหญ้า/ดิน และขอนไม้ลอย
//   Water       (ภาพ)   น้ำในลำธาร/เหว
//   Decoration  (ภาพ)   ดอกไม้ เห็ด เฟิร์น พุ่มไม้ — ไม่ชน
//   Collision   (ข้อมูล) สี่เหลี่ยมที่ชนได้ (พื้น/ขอนไม้) — เกมชนตามเลเยอร์นี้ ไม่ใช่ตามภาพ
//   Hazards     (ข้อมูล) สี่เหลี่ยมอันตราย (น้ำ) แตะแล้วตาย
//   Objects     (ข้อมูล) จุดเกิด จุดจบ เหรียญ พุ่มหนาม ด้วง Checkpoint
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gid, TILESET_COLUMNS, TILESET_ROWS } from './tileset.mjs';
import { rng } from './pixel.mjs';

const levelNumber = Number(process.argv[2]);
if (!Number.isInteger(levelNumber) || levelNumber < 1) {
  console.error('ใช้: node tools/build-map.mjs <เลขด่าน> [โฟลเดอร์ปลายทาง]');
  process.exit(1);
}
const { default: L } = await import(`./levels/level${levelNumber}.mjs`);
const THEME = L.theme || 'forest';

const TILE = 32;
const W = L.widthTiles;
const H = L.heightTiles;
const G = L.groundTopRow;
const groundY = G * TILE;

const newLayer = () => new Array(W * H).fill(0);
const ground = newLayer();
const water = newLayer();
const deco = newLayer();
const put = (layer, col, row, name) => (layer[row * W + col] = gid(name));

// พื้น: ขอบซ้าย/ขวาของแต่ละช่วงใช้ช่องมุม
for (const [a, b] of L.ground) {
  for (let c = a; c <= b; c++) {
    put(ground, c, G, c === a ? 'grass_left' : c === b ? 'grass_right' : 'grass');
    put(ground, c, G + 1, c === a ? 'dirt_left' : c === b ? 'dirt_right' : 'dirt');
  }
}

// ขอนไม้ลอย: ผิวบนอยู่ที่แถว (groundTopRow − ความสูง)
for (const [col, width, height] of L.logs) {
  for (let i = 0; i < width; i++) put(ground, col + i, G - height, i === 0 ? 'log_left' : i === width - 1 ? 'log_right' : 'log_mid');
}

// น้ำ: ช่องว่างระหว่างช่วงพื้น
const gaps = [];
for (let i = 0; i < L.ground.length - 1; i++) gaps.push([L.ground[i][1] + 1, L.ground[i + 1][0] - 1]);
for (const [a, b] of gaps) {
  for (let c = a; c <= b; c++) {
    put(water, c, G, 'water_surface');
    put(water, c, G + 1, 'water');
  }
}

// ของตกแต่ง: โรยบนหญ้าแบบสุ่มคงที่ เว้นจุดเกิด พุ่มหนาม และบ้านต้นไม้
const R = rng(2026 + (levelNumber - 1) * 101);
const kinds = ['tuft', 'tuft', 'flower_red', 'flower_yellow', 'mushroom', 'fern', 'bush'];
const avoid = new Set([L.spawnCol - 1, L.spawnCol, L.spawnCol + 1, ...L.thorns, ...[-2, -1, 0, 1, 2].map((d) => L.goalCol + d)]);
const checkpointCols = new Set(L.checkpoints || []); // เว้นไว้หลังสุ่มแล้ว เพื่อไม่ให้ลำดับสุ่มของด่านเดิมเปลี่ยน
for (const [a, b] of L.ground) {
  for (let c = a + 1; c < b; c++) {
    if (avoid.has(c) || R() > 0.3) continue;
    const kind = kinds[Math.floor(R() * kinds.length)];
    if (!checkpointCols.has(c)) put(deco, c, G - 1, kind);
  }
}

let nextObjectId = 1;
const obj = (name, x, y, w = 0, h = 0, props = {}) => {
  const o = { id: nextObjectId++, name, type: name, x, y, width: w, height: h, rotation: 0, visible: true };
  if (!w && !h) o.point = true;
  const entries = Object.entries(props);
  if (entries.length) o.properties = entries.map(([n, v]) => ({ name: n, type: typeof v === 'number' ? 'float' : 'string', value: v }));
  return o;
};

// ชนได้: พื้นแต่ละช่วง + ขอนไม้ (หนา 16 px)
const collision = [
  ...L.ground.map(([a, b]) => obj('ground', a * TILE, groundY, (b - a + 1) * TILE, (H - G) * TILE)),
  ...L.logs.map(([col, width, height]) => obj('log', col * TILE, groundY - height * TILE, width * TILE, 16)),
];

// อันตราย: ผิวน้ำต่ำกว่าพื้น 12 px ลงไปถึงขอบล่างของด่าน
const waterTop = groundY + 12;
const hazards = gaps.map(([a, b]) => obj('water', a * TILE, waterTop, (b - a + 1) * TILE, H * TILE - waterTop));

// ออบเจกต์ในด่าน (ตำแหน่งเป็น px): จุดเกิด/ด้วง/บ้านต้นไม้/พุ่มหนาม อ้างจากฐานที่เท้า เหรียญอ้างจากจุดกึ่งกลาง
const objects = [
  obj('spawn', L.spawnCol * TILE + TILE / 2, groundY),
  obj('goal', L.goalCol * TILE, groundY),
  ...L.coins.map(([col, height]) => obj('coin', col * TILE + TILE / 2, groundY - height * TILE)),
  ...L.thorns.map((col) => obj('thorn', col * TILE + TILE / 2, groundY)),
  ...L.enemies.map((e) => obj('beetle', e.col * TILE + TILE / 2, groundY - e.height * TILE, 0, 0, e.range ? { rangeMin: e.range[0] * TILE, rangeMax: (e.range[1] + 1) * TILE } : {})),
  // Checkpoint: ตอไม้ป้ายอุ้งเท้า อ้างจากฐานที่เท้า · property order = ลำดับในด่าน (ใช้จำว่าผ่านจุดไหนแล้ว)
  ...(L.checkpoints || []).map((col, i) => obj('checkpoint', col * TILE + TILE / 2, groundY, 0, 0, { order: i })),
];

const tileLayer = (id, name, data) => ({ id, name, type: 'tilelayer', data, width: W, height: H, x: 0, y: 0, opacity: 1, visible: true });
const objectLayer = (id, name, objs, visible = true) => ({ id, name, type: 'objectgroup', draworder: 'topdown', objects: objs, x: 0, y: 0, opacity: 1, visible });

const map = {
  compressionlevel: -1,
  type: 'map',
  version: '1.10',
  tiledversion: '1.10.2',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  width: W,
  height: H,
  tilewidth: TILE,
  tileheight: TILE,
  // theme เลือกชุดภาพ: tileset-<theme>.png และพื้นหลัง bg-*-<theme>.png (forest ใช้ชื่อเดิมไม่มีส่วนต่อท้าย)
  properties: [
    { name: 'levelName', type: 'string', value: L.name },
    { name: 'theme', type: 'string', value: THEME },
  ],
  layers: [
    tileLayer(1, 'Ground', ground),
    tileLayer(2, 'Water', water),
    tileLayer(3, 'Decoration', deco),
    objectLayer(4, 'Collision', collision),
    objectLayer(5, 'Hazards', hazards),
    objectLayer(6, 'Objects', objects),
  ],
  nextlayerid: 7,
  nextobjectid: nextObjectId,
  tilesets: [
    {
      firstgid: 1,
      name: 'forest',
      image: `../images/tileset-${THEME}.png`,
      imagewidth: TILESET_COLUMNS * TILE,
      imageheight: TILESET_ROWS * TILE,
      tilewidth: TILE,
      tileheight: TILE,
      tilecount: TILESET_COLUMNS * TILESET_ROWS,
      columns: TILESET_COLUMNS,
      margin: 0,
      spacing: 0,
    },
  ],
};

const outDir = process.argv[3] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'maps');
const out = path.join(outDir, `forest-${levelNumber}.tmj`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(map, null, 1));
console.log(`สร้างแผนที่แล้ว: ${out}`);
console.log(`ช่อง Ground ${ground.filter(Boolean).length} · Water ${water.filter(Boolean).length} · Decoration ${deco.filter(Boolean).length}`);
console.log(`Collision ${collision.length} · Hazards ${hazards.length} · Objects ${objects.length} (เหรียญ ${L.coins.length}, หนาม ${L.thorns.length}, ด้วง ${L.enemies.length})`);
