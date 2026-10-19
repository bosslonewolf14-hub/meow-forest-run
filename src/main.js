import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import { GAME_WIDTH, GAME_HEIGHT, PHYSICS, COLORS, DEV } from './config.js';
import { setupOrientationGuard } from './orientation.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.SKY, // ฟ้าอ่อน (ท้องฟ้าเหนือป่า)
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PHYSICS.GRAVITY },
      debug: DEV.PHYSICS_DEBUG,
    },
  },
  scene: [BootScene, MenuScene, GameScene],
};

const game = new Phaser.Game(config);
setupOrientationGuard(game); // มือถือแนวตั้ง: หยุดเกม + ปุ่มพลิกเป็นแนวนอน

// ตอนพัฒนา (npm run dev) เปิดให้ตรวจสถานะเกมจากคอนโซลได้ เช่น __game.scene.getScene('GameScene').cat.x
if (import.meta.env.DEV) {
  window.__game = game;
  import('./devTools.js').then((m) => m.installDevTools(game)); // เครื่องมือตรวจด่าน: await __reach(0)
}

export default game;
