// เครื่องมือตรวจด่านสำหรับตอนพัฒนา (ติดตั้งเฉพาะ npm run dev — ไม่ติดไปกับไฟล์ build)
// เปิดเกมแล้วพิมพ์ในคอนโซลเบราว์เซอร์ (F12):  await __reach(0)   // ตรวจด่าน 1 ; __reach(1) = ด่าน 2 ; __reach(2) = ด่าน 3
//
// __reach(levelIndex): จำลองฟิสิกส์จริงของเกมแบบเร็วกว่าเวลาจริง ลองกระโดดทุกคู่พื้นผิวที่อยู่ใกล้กัน
// (พื้น/ขอนไม้ ซ้ายไปขวา) ด้วยการกดค้างหลายระดับ แล้วสรุปว่า
//   goalReachable      ถึงบ้านต้นไม้ได้ไหม (หาเส้นทางผ่านการกระโดดที่สำเร็จ)
//   unreachedFromSpawn พื้นผิวที่ไปไม่ถึงจากจุดเกิด
//   hardEdges          กระโดดที่ต้องกดค้างตั้งแต่ 500 ms ขึ้นไป (ยากมาก)
//   failingShortEdges  ข้ามไม่ได้ทั้งที่ช่องว่าง ≤ 5 ช่อง (ส่วนใหญ่เป็นคู่ที่ไม่ได้ติดกัน เช่น พื้น → ขอนสูง 4 ช่อง ซึ่งตั้งใจให้ขึ้นไม่ได้)
//   thornBlockedEdges  คู่ที่หนามอยู่ในเส้นทางวิ่งตรง ๆ ก่อนออกตัว (ผู้เล่นต้องกระโดดข้ามหนามก่อน แล้วค่อยกระโดดข้ามช่อง)
export function installDevTools(game) {
  window.__reach = (levelIdx) => reachCheck(game, levelIdx);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const TILE = 32;
const HOLDS = [60, 120, 200, 300, 500, 1000]; // ms ที่กดค้างปุ่มกระโดด (ไล่จากเบาไปหนัก)

async function reachCheck(game, levelIdx) {
  game.loop.wake();
  const run = game.registry.get('run');
  run.level = levelIdx;
  run.checkpoint = null;
  run.collected = [];
  run.levelCoins = 0;
  game.scene.getScene('GameScene').scene.restart();
  await wait(900);

  const s = game.scene.getScene('GameScene');
  game.loop.sleep(); // หยุดลูปปกติ แล้วก้าวฟิสิกส์ด้วยมือทีละเฟรม

  const rects = s.map.getObjectLayer('Collision').objects.map((o) => ({ name: o.name, x0: o.x, x1: o.x + o.width, top: o.y }));
  rects.sort((a, b) => a.x0 - b.x0 || a.top - b.top);
  const label = (r) => `${r.name}@${r.x0 / TILE}h${(480 - r.top) / TILE}`;

  const disableBeetles = () =>
    s.enemies.getChildren().forEach((b) => {
      b.dead = true;
      b.body.enable = false;
      b.setVisible(false);
    });
  const thornsOff = (off) => s.hazards.getChildren().forEach((z) => z.hazard === 'thorn' && (z.body.enable = !off));

  // ลองกระโดดจากพื้นผิว A ไป B: วิ่งไปทางขวา กดกระโดดที่ takeoffX ค้าง holdMs คืน 'ok' ถ้ายืนบน B ได้
  const attempt = (A, B, takeoffX, holdMs, ignoreThorns) => {
    disableBeetles();
    thornsOff(ignoreThorns);
    s.state = 'playing';
    s.cat.body.setAllowGravity(true);
    s.cat.body.reset(Math.max(A.x0 + 16, takeoffX - 90), A.top - 24); // เริ่มห่างจุดออกตัวพอให้ความเร็วเต็ม (เร่ง ≈ 10 px)
    s.cat.body.setVelocity(0, 0);
    s.coyoteTimer = 0;
    s.bufferTimer = 0;
    s.isJumping = false;
    s.cursors.right.isDown = true;
    s.cursors.left.isDown = false;
    s.cursors.up.isDown = false;
    s.cursors.space.isDown = false;
    s.keys.W.isDown = false;

    let t = 1000;
    let jumpFrame = -1;
    let result = 'timeout';
    for (let f = 0; f < 150; f++) {
      if (jumpFrame < 0 && s.cat.x >= takeoffX) {
        jumpFrame = f;
        s.cursors.space.isDown = true;
        s.cursors.space._justDown = true; // ให้ JustDown() ทำงานในเฟรมนี้
      }
      if (jumpFrame >= 0 && s.cursors.space.isDown && (f - jumpFrame) * (1000 / 60) >= holdMs) s.cursors.space.isDown = false;

      s.physics.world.update(t, 1000 / 60 + 0.01);
      s.physics.world.postUpdate();
      s.update(t, 1000 / 60);
      t += 1000 / 60;

      if (s.state !== 'playing') { result = 'died'; break; }
      if (s.cat.y > s.worldHeight + 50) { result = 'fell'; break; }
      const onB = s.isOnGround() && Math.abs(s.cat.body.bottom - B.top) < 1 && s.cat.x >= B.x0 - 8 && s.cat.x <= B.x1 + 8;
      if (jumpFrame >= 0 && f - jumpFrame > 3 && onB) { result = 'ok'; break; }
    }
    s.cursors.right.isDown = false;
    s.cursors.space.isDown = false;
    return result;
  };

  const edges = [];
  for (const A of rects) {
    for (const B of rects) {
      if (A === B) continue;
      const gap = B.x0 - A.x1;
      let takeoff = null;
      let kind = '';
      if (gap >= -8 && gap <= 6 * TILE && B.top >= A.top - 4 * TILE) {
        takeoff = A.x1 - 16; // ข้ามช่องว่างจากขอบ A
        kind = 'across';
      } else if (B.x0 < A.x1 - 8 && B.x1 > A.x0 && B.top < A.top && B.top >= A.top - 4 * TILE && B.x0 - 56 >= A.x0) {
        takeoff = B.x0 - 56; // กระโดดขึ้นขอนที่ลอยอยู่เหนือ A
        kind = 'up-onto';
      }
      if (takeoff === null) continue;

      let minHold = null;
      for (const h of HOLDS) {
        if (attempt(A, B, takeoff, h, true) === 'ok') { minHold = h; break; }
      }
      const thornBlocked = minHold !== null && attempt(A, B, takeoff, minHold, false) !== 'ok';
      edges.push({ from: label(A), to: label(B), kind, gapTiles: +(gap / TILE).toFixed(1), rise: (A.top - B.top) / TILE, minHold, thornBlocked, A: rects.indexOf(A), B: rects.indexOf(B) });
    }
  }

  // หาเส้นทางจากพื้นผิวใต้จุดเกิดไปพื้นผิวใต้บ้านต้นไม้
  const surfaceAt = (p) => rects.findIndex((r) => p.x >= r.x0 && p.x <= r.x1 && Math.abs(r.top - p.y) < 2);
  const goalI = surfaceAt(s.objs.goal);
  const seen = new Set([surfaceAt(s.objs.spawn)]);
  const queue = [...seen];
  while (queue.length) {
    const a = queue.shift();
    for (const e of edges) if (e.A === a && e.minHold !== null && !seen.has(e.B)) { seen.add(e.B); queue.push(e.B); }
  }

  game.loop.wake();
  return {
    level: levelIdx + 1,
    surfaces: rects.length,
    edgesTested: edges.length,
    goalReachable: seen.has(goalI),
    unreachedFromSpawn: rects.filter((r, i) => !seen.has(i)).map(label),
    hardEdges: edges.filter((e) => e.minHold !== null && e.minHold >= 500).map((e) => `${e.from}->${e.to} gap${e.gapTiles} rise${e.rise} hold${e.minHold}`),
    failingShortEdges: edges.filter((e) => e.minHold === null && e.kind === 'across' && e.gapTiles <= 5).map((e) => `${e.from}->${e.to} gap${e.gapTiles} rise${e.rise}`),
    thornBlockedEdges: edges.filter((e) => e.thornBlocked).map((e) => `${e.from}->${e.to}`),
  };
}
