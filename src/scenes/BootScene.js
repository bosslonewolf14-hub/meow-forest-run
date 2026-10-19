import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { initAudio } from '../audio.js';
import { LEVELS, THEMES, bgKey, tilesetKey } from '../levels.js';

// โหลดภาพ/แผนที่ทั้งหมด สร้างแอนิเมชัน แล้วเริ่มเกม
// ไฟล์ภาพสร้างจาก tools/generate-art.mjs — จะวางภาพจาก PixelLab ทับชื่อ/ขนาดเฟรมเดียวกันก็ได้
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.createLoadingBar();

    const img = 'assets/images/';
    // ภาพพื้นหลังและ tileset ของทุกชุด (forest / deep / night)
    for (const theme of THEMES) {
      for (const layer of ['sky', 'far', 'mid', 'near']) this.load.image(bgKey(layer, theme), `${img}${bgKey(layer, theme)}.png`);
      this.load.image(tilesetKey(theme), `${img}${tilesetKey(theme)}.png`);
    }
    this.load.image('thorn', `${img}thorn.png`);
    this.load.image('treehouse', `${img}treehouse.png`);

    // ขนาดเฟรมต้องตรงกับไฟล์ภาพ (ดู "ข้อกำหนดภาพ" ใน GAME_PROJECT.md)
    this.load.spritesheet('cat', `${img}cat.png`, { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('beetle', `${img}beetle.png`, { frameWidth: 32, frameHeight: 24 });
    this.load.spritesheet('coin', `${img}coin.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('checkpoint', `${img}checkpoint.png`, { frameWidth: 32, frameHeight: 48 }); // 0 = ยังไม่ผ่าน · 1 = ผ่านแล้ว

    // ช่องพื้นแยกเฟรมไว้วาดพื้นในหน้าเมนู (ไฟล์เดียวกับ tileset ของแผนที่)
    this.load.spritesheet('tiles', `${img}tileset-forest.png`, { frameWidth: 32, frameHeight: 32 });

    for (const level of LEVELS) this.load.tilemapTiledJSON(level.key, `assets/maps/${level.file}`);

    // เสียงประกอบ: sfx-coin เป็นไฟล์ที่ผู้ใช้ใส่เอง (mp3) ที่เหลือสร้างจาก tools/generate-audio.mjs
    const snd = 'assets/audio/';
    this.load.audio('sfx-jump', `${snd}jump.wav`);
    this.load.audio('sfx-coin', `${snd}coin.mp3`);
    this.load.audio('sfx-stomp', `${snd}stomp.wav`);
    this.load.audio('sfx-meow', `${snd}meow.wav`);
    this.load.audio('sfx-splash', `${snd}splash.wav`);
    this.load.audio('sfx-win', `${snd}win.wav`);
    this.load.audio('sfx-click', `${snd}click.wav`);
    this.load.audio('sfx-checkpoint', `${snd}checkpoint.wav`);
    this.load.audio('bgm-forest', `${snd}bgm-forest.wav`);
  }

  create() {
    const anims = this.anims;
    const frames = (key, start, end) => anims.generateFrameNumbers(key, { start, end });

    // แมว 27 เฟรม (ตรงกับ preview/cat-animation/cat-sheet.json)
    // ยืน 0–5 · วิ่ง 6–13 · กระโดดขึ้น 14–15 · จุดสูงสุด 16 · ตก 17–18 · ลงพื้น 19–20 · ตกใจ 21–22 · ดีใจ 23–26
    anims.create({ key: 'cat-idle', frames: frames('cat', 0, 5), frameRate: 5, repeat: -1 });
    anims.create({ key: 'cat-run', frames: frames('cat', 6, 13), frameRate: 12, repeat: -1 });
    anims.create({ key: 'cat-jump-up', frames: frames('cat', 14, 15), frameRate: 10 });
    anims.create({ key: 'cat-apex', frames: frames('cat', 16, 16), frameRate: 6 });
    anims.create({ key: 'cat-fall', frames: frames('cat', 17, 18), frameRate: 8, repeat: -1 });
    anims.create({ key: 'cat-land', frames: frames('cat', 19, 20), frameRate: 10 });
    anims.create({ key: 'cat-hurt', frames: frames('cat', 21, 22), frameRate: 8, repeat: -1 });
    anims.create({ key: 'cat-celebrate', frames: frames('cat', 23, 26), frameRate: 8, repeat: -1 });

    anims.create({ key: 'beetle-walk', frames: frames('beetle', 0, 1), frameRate: 6, repeat: -1 });
    anims.create({ key: 'coin-spin', frames: frames('coin', 0, 5), frameRate: 9, repeat: -1 });

    initAudio(this.game);
    this.scene.start('MenuScene');
  }

  createLoadingBar() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(cx, cy, 320, 22, 0x1b2a1b).setStrokeStyle(2, 0xffffff);
    const bar = this.add.rectangle(cx - 156, cy, 4, 14, 0x4caf50).setOrigin(0, 0.5);
    this.add
      .text(cx, cy - 36, 'กำลังโหลด...', { fontFamily: 'sans-serif', fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);
    this.load.on('progress', (p) => (bar.width = Math.max(4, 312 * p)));
  }
}
