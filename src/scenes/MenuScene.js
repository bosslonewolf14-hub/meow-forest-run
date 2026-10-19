import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { playSfx, ensureBgm, createMuteButton } from '../audio.js';
import { resetRun } from '../run.js';

const GROUND_Y = 480; // ระดับพื้นเดียวกับในด่าน
const SCROLL_SPEED = 140; // px/วินาที ที่พื้นไหลไปทางซ้าย (แมวดูเหมือนวิ่งอยู่กับที่)

// หน้าเมนูเริ่มเกม — ปุ่ม "เริ่มเกม" ช่วยปลดล็อกเสียง (เบราว์เซอร์ต้องให้ผู้เล่นกด/กดปุ่มก่อนถึงเล่นเสียงได้)
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.starting = false;
    const cx = GAME_WIDTH / 2;

    // พื้นหลัง: ฟ้านิ่ง + 3 ชั้นเลื่อนเองช้า ๆ ให้เมนูมีชีวิต
    this.add.image(0, 0, 'bg-sky').setOrigin(0).setDepth(-30);
    this.layers = [
      ['bg-far', 12, -20],
      ['bg-mid', 35, -10],
      ['bg-near', 70, -5],
    ].map(([key, speed, depth]) => ({
      speed,
      sprite: this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, key).setOrigin(0).setDepth(depth),
    }));

    // พื้นหญ้า-ดินที่เลื่อนวนต่อเนื่อง
    this.ground = [];
    const cols = Math.ceil(GAME_WIDTH / 32) + 2;
    for (let c = 0; c < cols; c++) {
      this.ground.push(this.add.image(c * 32, GROUND_Y, 'tiles', 0).setOrigin(0).setDepth(1));
      this.ground.push(this.add.image(c * 32, GROUND_Y + 32, 'tiles', 1).setOrigin(0).setDepth(1));
    }
    this.groundWidth = cols * 32;

    // แมววิ่งอยู่กับที่ (ขยาย 3 เท่า) + เหรียญลอยเบา ๆ
    this.add.sprite(210, GROUND_Y, 'cat').setOrigin(0.5, 1).setScale(3).setDepth(5).play('cat-run');
    [[330, 400], [390, 370], [450, 400]].forEach(([x, y], i) => {
      const coin = this.add.sprite(x, y, 'coin').setDepth(4).setScale(1.2);
      coin.play({ key: 'coin-spin', startFrame: i * 2 });
      this.tweens.add({ targets: coin, y: y - 10, duration: 700, yoyo: true, repeat: -1, delay: i * 150, ease: 'Sine.easeInOut' });
    });

    // ชื่อเกม
    const outline = { fontFamily: 'sans-serif', color: '#ffffff', stroke: '#2a1508', align: 'center' };
    this.add.text(cx, 96, 'เหมียววิ่งป่า', { ...outline, fontSize: '84px', strokeThickness: 10 }).setOrigin(0.5).setDepth(10);
    this.add
      .text(cx, 168, 'แมวสองเท้าผู้กล้า วิ่งฝ่าด่านป่าไปให้ถึงบ้านต้นไม้', { ...outline, fontSize: '26px', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(10);

    // ปุ่มเริ่มเกม (คลิก / Enter / Space)
    const button = this.add
      .text(cx, 250, 'เริ่มเกม', { ...outline, fontSize: '44px', strokeThickness: 6, backgroundColor: '#4caf50', padding: { x: 40, y: 14 } })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: button, scale: 1.06, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add
      .text(cx, 306, 'คลิกปุ่มหรือกด Enter / Space', { ...outline, fontSize: '18px', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(10);

    // วิธีเล่น
    this.add
      .text(
        GAME_WIDTH - 40,
        360,
        ['วิธีเล่น', '← → หรือ A D   เดิน', 'Space / ↑ / W   กระโดด (กดค้างสูงขึ้น)', 'กระโดดเหยียบหัวด้วงเพื่อกำจัด', 'เก็บเหรียญอุ้งเท้า ไปให้ถึงบ้านต้นไม้'].join('\n'),
        { ...outline, fontSize: '20px', strokeThickness: 4, align: 'right', lineSpacing: 6 }
      )
      .setOrigin(1, 0)
      .setDepth(10);

    createMuteButton(this, 16, 16);

    button.on('pointerdown', () => this.startGame());
    this.input.keyboard.once('keydown-ENTER', () => this.startGame());
    this.input.keyboard.once('keydown-SPACE', () => this.startGame());
  }

  startGame() {
    if (this.starting) return; // กันกดซ้ำหรือกดหลายปุ่มพร้อมกัน
    this.starting = true;
    resetRun(this.game); // เริ่มเกมใหม่ตั้งแต่ด่านแรก (ตอนพัฒนา ?level=2 เริ่มที่ด่านนั้น)
    playSfx(this, 'sfx-click');
    ensureBgm(this); // กดแล้วจึงเริ่มเพลง (ผ่านการปลดล็อกเสียงของเบราว์เซอร์แล้ว)
    this.scene.start('GameScene');
  }

  update(time, delta) {
    const dt = delta / 1000;
    for (const layer of this.layers) layer.sprite.tilePositionX += layer.speed * dt;
    for (const tile of this.ground) {
      tile.x -= SCROLL_SPEED * dt;
      if (tile.x <= -32) tile.x += this.groundWidth;
    }
  }
}
