import { TILE, PHYSICS, PLAYER, JUMP } from './config.js';

// แผงปรับค่าสดตอนเล่น (เฉพาะตอนพัฒนา — เปิด/ปิดที่ DEV.TUNING_PANEL ใน config.js)
// ใช้ตอนบาลานซ์ขั้น 5: ปรับทีละค่า ลองเล่น เจอค่าที่ชอบแล้วค่อยจดลง config.js
// ค่าที่ปรับค้างอยู่จนกว่าจะรีเฟรชหน้า (ตายแล้วเริ่มใหม่ ค่ายังอยู่)
//
// ปุ่ม: Q ซ่อน/แสดงแผง · P พิมพ์ค่าลงคอนโซลเพื่อคัดลอกไปใส่ config.js
//   1 / 2  ความเร็วเดิน  −/+ 10
//   3 / 4  แรงกระโดด     −/+ 20
//   5 / 6  แรงโน้มถ่วง   −/+ 100
//   7 / 8  ตัดกระโดดเมื่อปล่อยปุ่ม −/+ 0.05 (น้อย = แตะแล้วเตี้ยลง)
const ADJUSTMENTS = [
  { keys: ['ONE', 'TWO'], hint: '1/2', label: 'ความเร็วเดิน', get: () => PLAYER.WALK_SPEED, set: (v) => (PLAYER.WALK_SPEED = v), step: 10, min: 80, max: 500 },
  { keys: ['THREE', 'FOUR'], hint: '3/4', label: 'แรงกระโดด', get: () => JUMP.JUMP_VELOCITY, set: (v) => (JUMP.JUMP_VELOCITY = v), step: 20, min: 300, max: 1000 },
  { keys: ['FIVE', 'SIX'], hint: '5/6', label: 'แรงโน้มถ่วง', get: () => PHYSICS.GRAVITY, set: (v) => (PHYSICS.GRAVITY = v), step: 100, min: 600, max: 3000 },
  { keys: ['SEVEN', 'EIGHT'], hint: '7/8', label: 'ตัดกระโดด', get: () => JUMP.JUMP_CUT, set: (v) => (JUMP.JUMP_CUT = Math.round(v * 100) / 100), step: 0.05, min: 0.1, max: 1 },
];

export default class TuningPanel {
  constructor(scene) {
    this.scene = scene;
    this.visible = true;

    this.text = scene.add
      .text(scene.scale.width - 12, 12, '', {
        fontSize: '15px',
        fontFamily: 'monospace',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: { x: 8, y: 6 },
        align: 'left',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(150);

    const kb = scene.input.keyboard;
    for (const adj of ADJUSTMENTS) {
      kb.on(`keydown-${adj.keys[0]}`, () => this.change(adj, -adj.step));
      kb.on(`keydown-${adj.keys[1]}`, () => this.change(adj, +adj.step));
    }
    kb.on('keydown-Q', () => {
      this.visible = !this.visible;
      this.text.setVisible(this.visible);
    });
    kb.on('keydown-P', () => this.print());

    this.refresh();
  }

  change(adj, delta) {
    const next = Math.min(adj.max, Math.max(adj.min, adj.get() + delta));
    adj.set(Math.round(next * 100) / 100);
    if (adj.label === 'แรงโน้มถ่วง') this.scene.physics.world.gravity.y = PHYSICS.GRAVITY;
    this.refresh();
  }

  // ค่าที่คำนวณให้ดูเพื่อประกอบการออกแบบด่าน (เป็นค่าประมาณ ไม่รวมการเร่ง/ขนาดตัว)
  stats() {
    const v = JUMP.JUMP_VELOCITY;
    const g = PHYSICS.GRAVITY;
    const height = (v * v) / (2 * g);
    const airTime = (2 * v) / g;
    const reach = airTime * PLAYER.WALK_SPEED;
    return { height, reach };
  }

  refresh() {
    const { height, reach } = this.stats();
    const lines = ADJUSTMENTS.map((a) => `${a.hint} ${a.label} ${a.get()}`);
    lines.push(`สูงสุด ≈ ${height.toFixed(0)}px (${(height / TILE).toFixed(1)} ช่อง)`);
    lines.push(`ไกลสุด ≈ ${reach.toFixed(0)}px (${(reach / TILE).toFixed(1)} ช่อง)`);
    lines.push('Q ซ่อน · P พิมพ์ค่า');
    this.text.setText(lines.join('\n'));
  }

  print() {
    console.log(
      `[tuning] วางลง config.js:\n` +
        `PHYSICS.GRAVITY = ${PHYSICS.GRAVITY}\n` +
        `PLAYER.WALK_SPEED = ${PLAYER.WALK_SPEED}\n` +
        `JUMP.JUMP_VELOCITY = ${JUMP.JUMP_VELOCITY}\n` +
        `JUMP.JUMP_CUT = ${JUMP.JUMP_CUT}`
    );
  }
}
