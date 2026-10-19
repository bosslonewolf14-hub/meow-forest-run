import { LEVELS } from './levels.js';

// สถานะของการเล่น 1 รอบ (ข้ามการรีสตาร์ตฉากตอนตาย): เก็บไว้ใน registry ของเกม
// level        ดัชนีด่านปัจจุบัน (0 = ด่าน 1)
// checkpoint   Checkpoint ล่าสุดที่ผ่าน {order, x, y} หรือ null (ตายแล้วเกิดที่นี่)
// collected    id ของเหรียญที่เก็บแล้วในด่านนี้ (ตายแล้วไม่โผล่กลับมา และไม่เก็บซ้ำ)
// levelCoins   จำนวนเหรียญที่เก็บได้ในด่านนี้
// banked       เหรียญรวมจากด่านที่ผ่านไปแล้ว · bankedTotal = เหรียญทั้งหมดของด่านเหล่านั้น
export function newRun(level = 0) {
  return { level, checkpoint: null, collected: [], levelCoins: 0, banked: 0, bankedTotal: 0 };
}

// ตอนพัฒนา (npm run dev) เปิดด่านที่ต้องการได้ด้วย ?level=2 (นับจาก 1) ไว้ทดสอบด่านหลัง ๆ
function devStartLevel() {
  if (!import.meta.env.DEV) return 0;
  const n = Number(new URLSearchParams(window.location.search).get('level'));
  return Number.isInteger(n) && n >= 1 && n <= LEVELS.length ? n - 1 : 0;
}

export function getRun(game) {
  let run = game.registry.get('run');
  if (!run) {
    run = newRun(devStartLevel());
    game.registry.set('run', run);
  }
  return run;
}

export function resetRun(game, level = devStartLevel()) {
  const run = newRun(level);
  game.registry.set('run', run);
  return run;
}

// ไปด่านถัดไป: ล้าง Checkpoint/เหรียญของด่านเก่า (เหรียญที่ได้ถูกเก็บเข้า banked ตอนชนะแล้ว)
export function advanceLevel(run) {
  run.level += 1;
  run.checkpoint = null;
  run.collected = [];
  run.levelCoins = 0;
}
