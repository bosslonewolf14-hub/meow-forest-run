import { AUDIO } from './config.js';

const MUTE_STORAGE_KEY = 'meow-forest-muted';

// อ่านสถานะปิดเสียงที่จำไว้ (localStorage อาจใช้ไม่ได้ในบางโหมด จึงครอบด้วย try/catch)
export function initAudio(game) {
  try {
    game.sound.mute = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    // ใช้ค่าเริ่มต้น (เปิดเสียง)
  }
}

// สลับปิด/เปิดเสียง คืนค่าสถานะใหม่ (true = ปิดเสียงอยู่)
// คำนวณค่าใหม่เก็บไว้ก่อน แล้วอย่าอ่านกลับจาก sound.mute ทันที เพราะตัวจัดการเสียงอาจอัปเดตค่านี้ช้ากว่าหนึ่งจังหวะ
export function toggleMute(scene) {
  const muted = !scene.sound.mute;
  scene.sound.mute = muted;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // จำค่าไม่ได้ก็ไม่เป็นไร ยังปิด/เปิดเสียงได้ในรอบนี้
  }
  return muted;
}

// เล่นเสียงประกอบครั้งเดียว: ระดับเสียงมาจาก AUDIO.SFX_VOLUME · rate = ความสูงเสียง (1 = ปกติ)
export function playSfx(scene, key, rate = 1) {
  scene.sound.play(key, { volume: AUDIO.SFX_VOLUME[key] ?? 0.5, rate });
}

// เสียงที่ซ้ำบ่อย (เหรียญ กระโดด) สุ่มความสูงเสียงเล็กน้อยให้ไม่จำเจ
export function playSfxVaried(scene, key) {
  playSfx(scene, key, 0.94 + Math.random() * 0.12);
}

// เพลงพื้นหลัง: เล่นวนต่อเนื่องข้ามการรีสตาร์ตฉาก (Sound Manager เป็นของทั้งเกม ไม่ใช่ของฉาก)
export function ensureBgm(scene, volume = AUDIO.BGM_VOLUME) {
  let bgm = scene.sound.get('bgm-forest');
  if (!bgm) bgm = scene.sound.add('bgm-forest', { loop: true, volume });
  if (!bgm.isPlaying) bgm.play({ loop: true, volume });
  else bgm.setVolume(volume);
  return bgm;
}

// ค่อย ๆ ปรับเสียงเพลง (เช่น เบาลงตอนขึ้นหน้าชนะ)
export function fadeBgm(scene, volume, ms = 500) {
  const bgm = scene.sound.get('bgm-forest');
  if (bgm) scene.tweens.add({ targets: bgm, volume, duration: ms });
}

// ปุ่มปิด/เปิดเสียง: คลิกหรือกด M
export function createMuteButton(scene, x, y) {
  const label = (muted) => `เสียง: ${muted ? 'ปิด' : 'เปิด'} [M]`;
  const text = scene.add
    .text(x, y, label(scene.sound.mute), { fontSize: '18px', fontFamily: 'sans-serif', color: '#ffffff', stroke: '#2a1508', strokeThickness: 4 })
    .setScrollFactor(0)
    .setDepth(100)
    .setInteractive({ useHandCursor: true });

  const toggle = () => text.setText(label(toggleMute(scene)));
  text.on('pointerdown', toggle);
  scene.input.keyboard.on('keydown-M', toggle);
  return text;
}
