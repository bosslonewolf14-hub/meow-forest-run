// สังเคราะห์เสียงประกอบและเพลงพื้นหลังของเกม → public/assets/audio/*.wav
// รัน: node tools/generate-audio.mjs
//
// เสียงสังเคราะห์ด้วยโค้ด (ไม่ใช่ ElevenLabs) เป็นเสียง "ชั่วคราวคุณภาพพอใช้" — อยากได้เสียงจริง
// ให้สร้างด้วย ElevenLabs แล้ววางทับไฟล์ชื่อเดิม (นามสกุล .wav หรือ .mp3 ต้องแก้ชื่อใน BootScene.js ให้ตรง)
// ไม่แตะ coin.mp3 (ไฟล์ที่ผู้ใช้ใส่เอง)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeWav, rng, midiToHz, bandpass, adsr, pluck, normalize } from './audio.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');
const save = (name, samples, sr) => writeWav(path.join(OUT, name), samples, sr);
const TAU = Math.PI * 2;

// ───────────────────────── เสียงประกอบ (44.1 kHz) ─────────────────────────
const SR = 44100;

// กระโดด: เสียงสูงขึ้นสั้น ๆ แบบ "บวบ"
function jump() {
  const dur = 0.17;
  const out = new Float32Array(Math.round(SR * dur));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = 320 + (t / dur) * 480;
    phase += (TAU * f) / SR;
    const env = Math.min(1, t / 0.004) * Math.pow(1 - t / dur, 1.6);
    out[i] = (Math.sin(phase) + 0.3 * Math.sin(2 * phase)) * env;
  }
  return normalize(out, 0.7);
}

// เหยียบด้วง: เสียงตุบ + คลิกสั้น ๆ
function stomp() {
  const dur = 0.22;
  const out = new Float32Array(Math.round(SR * dur));
  const R = rng(3);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = 70 + 200 * Math.exp(-t * 26);
    phase += (TAU * f) / SR;
    const click = t < 0.012 ? (R() * 2 - 1) * (1 - t / 0.012) * 0.6 : 0;
    out[i] = Math.sin(phase) * Math.exp(-t * 20) + click;
  }
  return normalize(out, 0.8);
}

// ตกน้ำ: น้ำกระฉอก (นอยส์กรองต่ำที่ปิดลง) + ตุบต่ำ + ฟองอากาศ
function splash() {
  const dur = 0.8;
  const out = new Float32Array(Math.round(SR * dur));
  const R = rng(11);
  let y = 0;
  const bubbles = Array.from({ length: 6 }, () => ({ start: 0.08 + R() * 0.5, f0: 380 + R() * 500, len: 0.05 + R() * 0.04 }));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const a = 0.55 * Math.exp(-t * 7) + 0.02;
    y += a * ((R() * 2 - 1) - y);
    let v = y * Math.min(1, t / 0.006) * Math.exp(-t * 4.2) * 1.8;
    v += Math.sin(TAU * 90 * t) * Math.exp(-t * 16) * 0.5; // ตุบตอนกระแทกน้ำ
    for (const b of bubbles) {
      const u = t - b.start;
      if (u > 0 && u < b.len) v += Math.sin(TAU * (b.f0 * u + (b.f0 * 1.8 * u * u) / b.len / 2)) * Math.sin((Math.PI * u) / b.len) * 0.25;
    }
    out[i] = v;
  }
  return normalize(out, 0.8);
}

// แมวร้อง "เมี้ยว!" ตกใจ: เสียงเลื่อนสูง-ต่ำ + สั่นเล็กน้อย ผ่านฟอร์แมนต์ ee → ow
function meow() {
  const dur = 0.5;
  const out = new Float32Array(Math.round(SR * dur));
  // ฟอร์แมนต์ชุด A (ee: ต้นเสียง) และชุด B (ow: ท้ายเสียง) แล้วไล่สลับกัน
  const A = [bandpass(SR, 420, 5), bandpass(SR, 2300, 6)];
  const B = [bandpass(SR, 780, 4), bandpass(SR, 1250, 5)];
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const u = t / dur;
    const f = (440 + 420 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - 0.35 * u)) * (1 + 0.015 * Math.sin(TAU * 6 * t));
    phase += (TAU * f) / SR;
    let src = 0;
    for (let k = 1; k <= 14; k++) src += Math.sin(k * phase) / k; // คลื่นฟันเลื่อยแบบจำกัดฮาร์มอนิก
    const mixB = Math.min(1, Math.max(0, (u - 0.25) / 0.5));
    const a = A[0](src) + 1.4 * A[1](src);
    const b = B[0](src) + 1.2 * B[1](src);
    out[i] = (a * (1 - mixB) + b * mixB) * adsr(t, dur - 0.14, 0.035, 0.14);
  }
  return normalize(out, 0.8);
}

// ชนะ: อาร์เพจจิโอไต่ขึ้นแล้วกดคอร์ดค้าง
function win() {
  const notes = [72, 76, 79, 84, 88];
  const out = new Float32Array(Math.round(SR * 1.5));
  const R = rng(5);
  const add = (start, midi, dur, gain) => {
    const f = midiToHz(midi);
    const n = Math.round(SR * dur);
    const s0 = Math.round(SR * start);
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 0.004) * Math.exp(-t * 4);
      out[s0 + i] += (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * 2 * f * t) + 0.1 * Math.sin(TAU * 3 * f * t)) * env * gain;
    }
  };
  notes.forEach((m, i) => add(i * 0.1, m, 0.5, 0.35));
  for (const m of [72, 76, 79, 84]) add(0.5, m, 0.9, 0.22); // คอร์ดปิด
  void R;
  return normalize(out, 0.8);
}

// คลิกปุ่ม
function click() {
  const out = new Float32Array(Math.round(SR * 0.07));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = Math.sin(TAU * 880 * t) * Math.exp(-t * 55) + 0.4 * Math.sin(TAU * 1320 * t) * Math.exp(-t * 70);
  }
  return normalize(out, 0.6);
}

// Checkpoint: กระดิ่งเล็ก ๆ สองโน้ตไต่ขึ้น (G5 → D6) เสียงใสสั้นกว่าเสียงชนะ
function checkpoint() {
  const out = new Float32Array(Math.round(SR * 0.75));
  const add = (start, midi, dur, gain) => {
    const f = midiToHz(midi);
    const s0 = Math.round(SR * start);
    for (let i = 0; i < Math.round(SR * dur) && s0 + i < out.length; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 0.003) * Math.exp(-t * 6);
      out[s0 + i] += (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * 2.76 * f * t) + 0.25 * Math.sin(TAU * 5.4 * f * t)) * env * gain; // ฮาร์มอนิกไม่เป็นจำนวนเต็ม = เสียงระฆัง
    }
  };
  add(0, 79, 0.5, 0.4);
  add(0.14, 86, 0.6, 0.4);
  return normalize(out, 0.75);
}

save('checkpoint.wav', checkpoint(), SR);
save('jump.wav', jump(), SR);
save('stomp.wav', stomp(), SR);
save('splash.wav', splash(), SR);
save('meow.wav', meow(), SR);
save('win.wav', win(), SR);
save('click.wav', click(), SR);

// ───────────────────────── เพลงพื้นหลัง: ป่าสดใส (22.05 kHz วนลูปเนียน) ─────────────────────────
// กีตาร์โปร่งอาร์เพจจิโอ + ฟลุตทำนอง + เบส + แพดนุ่ม ๆ + เสียงนกและชาเกอร์เบา ๆ · 96 BPM · 16 ห้อง ≈ 40 วินาที
const SR2 = 22050;
const BPM = 96;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = 16;
const N = Math.round(SR2 * BAR * BARS);
const TAIL = SR2 * 2; // หางเสียงก้องที่จะพับกลับไปต้นเพลง ให้ลูปไม่สะดุด
const mixBuf = new Float32Array(N + TAIL);
const R2 = rng(42);

const add = (startSec, samples, gain) => {
  const s0 = Math.round(startSec * SR2);
  for (let i = 0; i < samples.length; i++) {
    const idx = s0 + i;
    if (idx >= mixBuf.length) break;
    mixBuf[idx] += samples[i] * gain;
  }
};

// คอร์ด: root = โน้ตเบส, tones = โน้ตสำหรับอาร์เพจจิโอ (MIDI)
const CH = {
  C: { root: 48, tones: [48, 52, 55, 60, 64] },
  Am: { root: 45, tones: [45, 48, 52, 57, 60] },
  F: { root: 41, tones: [41, 45, 48, 53, 57] },
  G: { root: 43, tones: [43, 47, 50, 55, 59] },
  Em: { root: 40, tones: [40, 43, 47, 52, 55] },
};
const PROG = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'];

// ทำนอง [MIDI, จังหวะเริ่ม, ความยาว (จังหวะ)] ต่อห้อง
const MELODY = [
  [[76, 0, 1], [79, 1, 1], [76, 2, 0.5], [74, 2.5, 0.5], [72, 3, 1]],
  [[69, 0, 1.5], [72, 1.5, 0.5], [76, 2, 1], [74, 3, 1]],
  [[69, 0, 1], [72, 1, 1], [77, 2, 1], [76, 3, 0.5], [74, 3.5, 0.5]],
  [[74, 0, 1.5], [71, 1.5, 0.5], [67, 2, 2]],
  [[76, 0, 0.5], [79, 0.5, 0.5], [84, 1, 1], [79, 2, 1], [76, 3, 1]],
  [[81, 0, 1], [79, 1, 0.5], [76, 1.5, 0.5], [72, 2, 1], [76, 3, 1]],
  [[77, 0, 1], [76, 1, 0.5], [72, 1.5, 0.5], [69, 2, 1.5], [72, 3.5, 0.5]],
  [[74, 0, 1], [71, 1, 1], [74, 2, 1], [67, 3, 1]],
  [[72, 0, 1], [77, 1, 1], [81, 2, 1.5], [77, 3.5, 0.5]],
  [[79, 0, 1], [74, 1, 0.5], [71, 1.5, 0.5], [74, 2, 2]],
  [[76, 0, 1], [71, 1, 1], [67, 2, 1], [71, 3, 1]],
  [[69, 0, 1], [72, 1, 1], [76, 2, 2]],
  [[77, 0, 1.5], [76, 1.5, 0.5], [72, 2, 1], [69, 3, 1]],
  [[74, 0, 1], [79, 1, 1], [77, 2, 0.5], [74, 2.5, 0.5], [71, 3, 1]],
  [[72, 0, 1], [76, 1, 1], [79, 2, 2]],
  [[76, 0, 1.5], [74, 1.5, 0.5], [72, 2, 2]],
];

const ARP = [0, 2, 3, 4, 3, 2, 4, 2]; // ลำดับโน้ตของกีตาร์ต่อห้อง (8 ตัว ตัวละ 1/8 ห้อง)

function flute(freq, dur) {
  const rel = 0.14;
  const n = Math.round(SR2 * (dur + rel));
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR2;
    phase += (TAU * freq * (1 + 0.004 * Math.sin(TAU * 5 * t) * Math.min(1, t / 0.25))) / SR2;
    const tone = Math.sin(phase) + 0.18 * Math.sin(2 * phase) + 0.05 * Math.sin(3 * phase);
    const breath = (R2() * 2 - 1) * 0.012;
    out[i] = (tone + breath) * adsr(t, dur, 0.045, rel);
  }
  return out;
}

function tone(freq, dur, h2, attack, release) {
  const n = Math.round(SR2 * (dur + release));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR2;
    out[i] = (Math.sin(TAU * freq * t) + h2 * Math.sin(TAU * 2 * freq * t)) * adsr(t, dur, attack, release);
  }
  return out;
}

function chirp(f0, f1, dur) {
  const n = Math.round(SR2 * dur);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    phase += (TAU * (f0 + (f1 - f0) * u)) / SR2;
    out[i] = Math.sin(phase) * Math.sin(Math.PI * u);
  }
  return out;
}

for (let b = 0; b < BARS; b++) {
  const ch = CH[PROG[b]];
  const t0 = b * BAR;

  // เบส: จังหวะ 1 และ 3
  for (const beat of [0, 2]) add(t0 + beat * BEAT, tone(midiToHz(ch.root), BEAT * 1.6, 0.35, 0.01, 0.25), 0.3);

  // แพด: ไตรแอดนุ่ม ๆ ทั้งห้อง
  for (const m of ch.tones.slice(0, 3)) add(t0, tone(midiToHz(m + 12), BAR * 0.95, 0.1, 0.35, 0.5), 0.045);

  // กีตาร์โปร่งอาร์เพจจิโอ
  ARP.forEach((idx, step) => add(t0 + step * (BEAT / 2), pluck(SR2, midiToHz(ch.tones[idx] + 12), 1.1, R2, 0.9965), 0.2));

  // ชาเกอร์เบา ๆ บนจังหวะผ่าน
  for (let step = 1; step < 8; step += 2) {
    const n = Math.round(SR2 * 0.045);
    const shk = new Float32Array(n);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const x = R2() * 2 - 1;
      shk[i] = (x - prev) * Math.exp((-i / n) * 5);
      prev = x;
    }
    add(t0 + step * (BEAT / 2), shk, 0.055);
  }

  // ทำนองฟลุต
  for (const [m, start, len] of MELODY[b]) add(t0 + start * BEAT, flute(midiToHz(m), len * BEAT * 0.92), 0.3);

  // เสียงนกร้องช่วงท้ายห้องที่ 3 7 11 15
  if (b % 4 === 2) [0, 1, 2].forEach((k) => add(t0 + BEAT * 3.1 + k * 0.11, chirp(2600 + k * 150, 3700 - k * 100, 0.075), 0.06));
}

// เสียงก้องเบา ๆ (ดีเลย์ป้อนกลับ 3 ทาง) แล้วพับหางกลับไปต้นเพลงให้ลูปต่อเนื่อง
const taps = [[0.113, 0.26], [0.171, 0.2], [0.257, 0.14]].map(([sec, g]) => [Math.round(sec * SR2), g]);
for (let i = 0; i < mixBuf.length; i++) {
  for (const [d, g] of taps) if (i >= d) mixBuf[i] += mixBuf[i - d] * g;
}
const loop = new Float32Array(N);
for (let i = 0; i < N; i++) loop[i] = mixBuf[i] + (i < TAIL ? mixBuf[N + i] : 0);
for (let i = 0; i < N; i++) loop[i] = Math.tanh(loop[i] * 1.1);
save('bgm-forest.wav', normalize(loop, 0.8), SR2);

console.log(`สร้างเสียงเสร็จแล้วที่ ${OUT} · เพลงยาว ${(N / SR2).toFixed(1)} วินาที`);
