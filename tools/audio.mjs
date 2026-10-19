// เครื่องมือสังเคราะห์เสียงเล็ก ๆ ไม่ต้องติดตั้งแพ็กเกจเพิ่ม — ใช้โดย tools/generate-audio.mjs
import fs from 'node:fs';
import path from 'node:path';

export function writeWav(file, samples, sampleRate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

// เลขสุ่มแบบคงที่ 0..1 (ได้เสียงเหมือนเดิมทุกครั้งที่รัน)
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ฟิลเตอร์ band-pass (RBJ biquad) คืนฟังก์ชันประมวลผลทีละตัวอย่าง
export function bandpass(sr, f0, q) {
  const w0 = (2 * Math.PI * f0) / sr;
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = alpha, b2 = -alpha;
  const a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

// ซองเสียง: attack/release แบบเส้นตรง (วินาที) t = เวลาตั้งแต่เริ่มโน้ต dur = ความยาวโน้ต
export function adsr(t, dur, attack, release) {
  if (t < 0 || t > dur + release) return 0;
  if (t < attack) return t / attack;
  if (t <= dur) return 1;
  return 1 - (t - dur) / release;
}

// Karplus-Strong: เสียงดีดสายแบบกีตาร์โปร่ง
export function pluck(sr, freq, seconds, rand, damping = 0.996) {
  const len = Math.max(2, Math.round(sr / freq));
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) buf[i] = rand() * 2 - 1;
  const out = new Float32Array(Math.round(sr * seconds));
  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const next = (idx + 1) % len;
    out[i] = buf[idx];
    buf[idx] = damping * 0.5 * (buf[idx] + buf[next]);
    idx = next;
  }
  return out;
}

export function normalize(samples, peak = 0.85) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max === 0) return samples;
  const g = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
  return samples;
}
