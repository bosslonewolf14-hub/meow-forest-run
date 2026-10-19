// สร้างเสียงเอฟเฟกต์ด้วย ElevenLabs Sound Effects API
// ใช้: node --env-file=.env scripts/gen-sfx.mjs <ชื่อไฟล์> "<คำอธิบายเสียง (อังกฤษได้ผลดีสุด)>" [วินาที]
import { writeFile, mkdir } from 'node:fs/promises';

const [name, prompt, seconds] = process.argv.slice(2);
if (!name || !prompt) {
  console.error('usage: node --env-file=.env scripts/gen-sfx.mjs <name> "<prompt>" [seconds]');
  process.exit(1);
}
const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error('ELEVENLABS_API_KEY is not set (check .env)');
  process.exit(1);
}

const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
  method: 'POST',
  headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: prompt,
    ...(seconds ? { duration_seconds: Number(seconds) } : {}),
  }),
});
if (!res.ok) {
  console.error(res.status, await res.text());
  process.exit(1);
}
await mkdir('public/assets/audio', { recursive: true });
const out = `public/assets/audio/${name}.mp3`;
await writeFile(out, Buffer.from(await res.arrayBuffer()));
console.log('saved', out);
