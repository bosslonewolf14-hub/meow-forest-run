// เก็บไฟล์ที่ build แล้ว (dist/) เป็นรุ่นที่ย้อนกลับได้ → releases/v<เวอร์ชัน>/
// รัน: npm run release   (= vite build แล้วเรียกสคริปต์นี้)
//
// ก่อนปล่อยรุ่นใหม่ให้เพิ่มเลขเวอร์ชันใน package.json ("version") — ไม่เขียนทับรุ่นเก่า
// ย้อนกลับ = เอาโฟลเดอร์ releases/v<เลขรุ่นเก่า>/ ไปโฮสต์แทนรุ่นปัจจุบัน
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const dist = path.join(ROOT, 'dist');
const target = path.join(ROOT, 'releases', `v${pkg.version}`);

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('ไม่พบ dist/index.html — ต้อง build ก่อน (npm run release จะ build ให้เอง)');
  process.exit(1);
}
if (fs.existsSync(target)) {
  console.error(`มีรุ่น v${pkg.version} อยู่แล้ว (${target}) — เพิ่มเลขเวอร์ชันใน package.json ก่อน เพื่อไม่เขียนทับรุ่นเก่า`);
  process.exit(1);
}

fs.cpSync(dist, target, { recursive: true });

// สรุปรุ่น: รายการไฟล์และขนาด
const files = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else files.push([path.relative(target, p).split(path.sep).join('/'), fs.statSync(p).size]);
  }
};
walk(target);
const total = files.reduce((sum, [, size]) => sum + size, 0);
const notes = [
  `เหมียววิ่งป่า v${pkg.version}`,
  `สร้างเมื่อ ${new Date().toISOString()}`,
  `ขนาดรวม ${(total / 1024 / 1024).toFixed(2)} MB (${files.length} ไฟล์)`,
  '',
  'โฮสต์: วางทั้งโฟลเดอร์นี้บนเว็บเซิร์ฟเวอร์แบบ Static ที่ไหนก็ได้ (โฟลเดอร์ย่อยก็ได้) เปิด index.html ผ่านเซิร์ฟเวอร์ (ห้ามเปิดไฟล์ตรง ๆ แบบ file://)',
  '',
  ...files.map(([name, size]) => `${String(size).padStart(9)}  ${name}`),
].join('\n');
fs.writeFileSync(path.join(target, 'RELEASE.txt'), notes + '\n');
fs.writeFileSync(path.join(ROOT, 'releases', 'LATEST.txt'), `v${pkg.version}\n`);

console.log(`สร้างรุ่น v${pkg.version} แล้วที่ ${target}`);
console.log(`ขนาดรวม ${(total / 1024 / 1024).toFixed(2)} MB (${files.length} ไฟล์)`);
