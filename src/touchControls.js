import Phaser from 'phaser';
import { GAME_WIDTH } from './config.js';

// ปุ่มสัมผัสบนหน้าจอ (มือถือ/แท็บเล็ต): ซ้าย ขวา กระโดด — ตำแหน่งเป็นพิกัดของจอเกม 960×544
const BUTTONS = {
  left: { x: 90, y: 466, r: 54, label: '◀' },
  right: { x: 218, y: 466, r: 54, label: '▶' },
  jump: { x: GAME_WIDTH - 100, y: 456, r: 66, label: '▲' },
};
const HIT_SCALE = 1.25; // พื้นที่ตอบสนองกว้างกว่าวงกลมที่เห็น นิ้วไม่ต้องแม่นมาก

// แสดงปุ่มสัมผัสเมื่ออุปกรณ์รองรับการสัมผัส (ตอน npm run dev ใส่ ?touch ท้าย URL เพื่อลองบนคอม)
export function wantsTouchControls(scene) {
  const forced = import.meta.env.DEV && new URLSearchParams(window.location.search).has('touch');
  return forced || scene.sys.game.device.input.touch;
}

export default class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.state = { left: false, right: false, jump: false };
    this.jumpPressed = false; // true เฉพาะเฟรมที่เพิ่งแตะปุ่มกระโดด (เหมือน JustDown ของคีย์บอร์ด)

    scene.input.addPointer(3); // รองรับหลายนิ้วพร้อมกัน เช่น กดวิ่งค้างด้วยนิ้วหนึ่ง กระโดดด้วยอีกนิ้ว

    this.visuals = {};
    for (const [name, b] of Object.entries(BUTTONS)) {
      const circle = scene.add.circle(b.x, b.y, b.r, 0xffffff, 0.22).setStrokeStyle(4, 0xffffff, 0.6).setScrollFactor(0).setDepth(120);
      const label = scene.add
        .text(b.x, b.y, b.label, { fontFamily: 'sans-serif', fontSize: `${Math.round(b.r * 0.9)}px`, color: '#ffffff' })
        .setOrigin(0.5)
        .setAlpha(0.8)
        .setScrollFactor(0)
        .setDepth(121);
      this.visuals[name] = { circle, label };
    }
  }

  // เรียกทุกเฟรม: ดูทุกนิ้วที่กดอยู่ว่าอยู่บนปุ่มไหน (ลากนิ้วข้ามจากปุ่มซ้ายไปขวาได้โดยไม่ต้องยกนิ้ว)
  update() {
    const next = { left: false, right: false, jump: false };
    for (const pointer of this.scene.input.manager.pointers) {
      if (!pointer.isDown) continue;
      for (const [name, b] of Object.entries(BUTTONS)) {
        if (Phaser.Math.Distance.Between(pointer.x, pointer.y, b.x, b.y) <= b.r * HIT_SCALE) next[name] = true;
      }
    }
    this.jumpPressed = next.jump && !this.state.jump;
    this.state = next;

    for (const [name, v] of Object.entries(this.visuals)) v.circle.setFillStyle(0xffffff, next[name] ? 0.5 : 0.22);
  }
}
