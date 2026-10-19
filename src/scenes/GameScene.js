import Phaser from 'phaser';
import { PHYSICS, PLAYER, JUMP, CAMERA, CAT_ANIM, GAMEPLAY, ENEMY, AUDIO, DEV } from '../config.js';
import { playSfx, playSfxVaried, ensureBgm, fadeBgm, createMuteButton } from '../audio.js';
import { LEVELS, bgKey, tilesetKey } from '../levels.js';
import { getRun, resetRun, advanceLevel } from '../run.js';
import TouchControls, { wantsTouchControls } from '../touchControls.js';

// อ่านค่า property ของออบเจกต์ใน Tiled (Phaser ให้มาเป็นอาร์เรย์ [{name, value}] หรือออบเจกต์ ขึ้นกับเวอร์ชัน)
function prop(obj, name, fallback) {
  const p = obj.properties;
  if (!p) return fallback;
  if (Array.isArray(p)) {
    const found = p.find((q) => q.name === name);
    return found ? found.value : fallback;
  }
  return p[name] ?? fallback;
}

// ชั้นพื้นหลัง Parallax: [ชั้น, ความเร็วเลื่อนเทียบกล้อง (0 = อยู่นิ่ง, 1 = เลื่อนเท่าฉากหน้า), ความลึก]
const PARALLAX = [
  ['far', 0.12, -20],
  ['mid', 0.3, -10],
  ['near', 0.55, -5],
];

// ฉากหลักของด่าน — ด่านอ่านจากแผนที่ Tiled (public/assets/maps/forest-N.tmj) ตามด่านปัจจุบันใน run (src/run.js)
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.run = getRun(this.game);
    this.levelDef = LEVELS[this.run.level];
    this.map = this.make.tilemap({ key: this.levelDef.key });
    this.theme = prop(this.map, 'theme', this.levelDef.theme);
    this.worldWidth = this.map.widthInPixels;
    this.worldHeight = this.map.heightInPixels;

    // ขอบโลก: ชนซ้าย/ขวา แต่ไม่ชนบน/ล่าง (ล่างต้องเปิดไว้ให้ตกลำธารได้)
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.physics.world.setBoundsCollision(true, true, false, false);

    this.state = 'playing'; // playing | dead | won — ตรวจสถานะนี้ก่อนทำอะไรทุกครั้ง กันนับ/ตายซ้ำ
    this.coinCount = this.run.levelCoins; // เหรียญที่เก็บแล้วในด่านนี้ (คงอยู่แม้ตายแล้วเกิดที่ Checkpoint)

    this.readObjects();
    this.createBackground();
    this.createTerrain();
    this.createThorns();
    this.createGoal();
    this.createCheckpoints();
    this.createCoins();
    this.createEnemies();
    this.createCat();
    this.createControls();
    this.createCamera();
    this.createHud();
    this.createAmbience();
    this.showLevelBanner();
    createMuteButton(this, 16, 62);
    this.touch = wantsTouchControls(this) ? new TouchControls(this) : null; // ปุ่มสัมผัสบนมือถือ
    ensureBgm(this); // เพลงเล่นวนต่อเนื่อง (เริ่มจากหน้าเมนู) — คืนระดับเสียงปกติหลังหน้าชนะ
    // แผงปรับค่าสด: โหลดแบบ dynamic เฉพาะตอน dev ให้ตัดออกจากไฟล์ build ทั้งก้อน
    if (import.meta.env.DEV && DEV.TUNING_PANEL) {
      import('../tuningPanel.js').then((m) => {
        if (this.sys.isActive()) this.tuning = new m.default(this);
      });
    }

    // ตัวแมวต้องสร้างก่อนจึงผูกการชนได้
    this.physics.add.overlap(this.cat, this.coins, this.collectCoin, null, this);
    this.physics.add.overlap(this.cat, this.hazards, (cat, hazard) => this.die(hazard.hazard), null, this);
    this.physics.add.overlap(this.cat, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.cat, this.goal, () => this.win(), null, this);
    this.physics.add.overlap(this.cat, this.checkpoints, this.reachCheckpoint, null, this);

    console.log(`[เหมียววิ่งป่า] Phaser ${Phaser.VERSION} — ด่าน ${this.run.level + 1} "${prop(this.map, 'levelName', '')}" (${this.theme}) พร้อม`);
  }

  // แยกออบเจกต์จากเลเยอร์ Objects ตามชื่อ (spawn, goal, coin, thorn, beetle, checkpoint)
  readObjects() {
    const all = this.map.getObjectLayer('Objects').objects;
    const named = (name) => all.filter((o) => (o.type || o.name) === name);
    this.objs = {
      spawn: named('spawn')[0],
      goal: named('goal')[0],
      coins: named('coin'),
      thorns: named('thorn'),
      beetles: named('beetle'),
      checkpoints: named('checkpoint').sort((a, b) => prop(a, 'order', 0) - prop(b, 'order', 0)),
    };
  }

  // พื้นหลัง: ฟ้านิ่ง + 3 ชั้นที่เลื่อนช้ากว่ากล้อง (ยิ่งไกลยิ่งช้า) ตรึงกับจอ — ภาพเปลี่ยนตามชุดของด่าน
  createBackground() {
    const { width, height } = this.scale;
    this.add.image(0, 0, bgKey('sky', this.theme)).setOrigin(0).setScrollFactor(0).setDepth(-30);
    this.parallax = PARALLAX.map(([layer, factor, depth]) => ({
      factor,
      sprite: this.add.tileSprite(0, 0, width, height, bgKey(layer, this.theme)).setOrigin(0).setScrollFactor(0).setDepth(depth),
    }));
  }

  // บรรยากาศเพิ่มของแต่ละชุด: ป่ายามค่ำมีหิ่งห้อยลอยเรืองแสงทั่วด่าน
  createAmbience() {
    if (this.theme !== 'night') return;
    const groundY = this.worldHeight - 2 * 32;
    for (let i = 0; i < Math.round(this.worldWidth / 80); i++) {
      const x = Phaser.Math.Between(40, this.worldWidth - 40);
      const y = Phaser.Math.Between(groundY - 230, groundY - 20);
      const fly = this.add.circle(x, y, 2.5, 0xd8ff7a).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
      const glow = this.add.circle(x, y, 7, 0xd8ff7a, 0.18).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: [fly, glow],
        x: x + Phaser.Math.Between(-50, 50),
        y: y + Phaser.Math.Between(-30, 30),
        alpha: { from: 0.2, to: 1 },
        duration: Phaser.Math.Between(1800, 3600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 1500),
      });
    }
  }

  // ป้ายชื่อด่านตอนเริ่มด่านใหม่ (ไม่แสดงตอนเกิดใหม่ที่ Checkpoint) แล้วค่อย ๆ จางหาย
  showLevelBanner() {
    if (this.run.checkpoint) return;
    const { width } = this.scale;
    const banner = this.add
      .text(width / 2, 120, `ด่าน ${this.run.level + 1} · ${this.levelDef.title}`, {
        fontFamily: 'sans-serif', fontSize: '52px', color: '#ffffff', stroke: '#2a1508', strokeThickness: 8, align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(150);
    this.tweens.add({ targets: banner, alpha: 0, delay: 1800, duration: 700, onComplete: () => banner.destroy() });
  }

  updateBackground() {
    const x = this.cameras.main.scrollX;
    for (const layer of this.parallax) layer.sprite.tilePositionX = x * layer.factor;
  }

  // ภูมิประเทศ: ภาพจากเลเยอร์ Tile (Ground, Water, Decoration) · การชนมาจากเลเยอร์ข้อมูล (Collision, Hazards)
  // จึงชนตามข้อมูลที่ตั้ง ไม่ใช่ตามภาพที่วาด
  createTerrain() {
    const tileset = this.map.addTilesetImage('forest', tilesetKey(this.theme)); // 'forest' = ชื่อ tileset ในไฟล์แผนที่
    this.map.createLayer('Decoration', tileset, 0, 0).setDepth(0);
    this.map.createLayer('Ground', tileset, 0, 0).setDepth(1);
    this.map.createLayer('Water', tileset, 0, 0).setDepth(2);

    // Collision: สี่เหลี่ยมที่ชนได้ (พื้นและขอนไม้) — Zone ไม่มีภาพ มีแต่ Body
    this.ground = this.physics.add.staticGroup();
    for (const o of this.map.getObjectLayer('Collision').objects) {
      this.ground.add(this.add.zone(o.x + o.width / 2, o.y + o.height / 2, o.width, o.height));
    }

    // Hazards: น้ำ แตะแล้วตาย (พุ่มหนามเพิ่มเข้ากลุ่มเดียวกันใน createThorns)
    this.hazards = this.physics.add.staticGroup();
    for (const o of this.map.getObjectLayer('Hazards').objects) {
      const zone = this.add.zone(o.x + o.width / 2, o.y + o.height / 2, o.width, o.height);
      zone.hazard = o.name; // ชนิดอันตราย ('water') ใช้เลือกเสียงตอนตาย
      this.hazards.add(zone);
    }
  }

  // พุ่มหนาม: ภาพเต็มช่อง แต่ Hitbox เล็กกว่าภาพ ที่ฐาน (ให้ยุติธรรมกับผู้เล่น)
  createThorns() {
    const { w, h } = GAMEPLAY.THORN_HITBOX;
    for (const o of this.objs.thorns) {
      this.add.image(o.x, o.y, 'thorn').setOrigin(0.5, 1).setDepth(3);
      const zone = this.add.zone(o.x, o.y - h / 2, w, h);
      zone.hazard = 'thorn';
      this.hazards.add(zone);
    }
  }

  // บ้านต้นไม้ (จุดจบ): ภาพสูง 128 px จุดอ้างอิงที่ฐานกลาง
  createGoal() {
    const { w, h } = GAMEPLAY.GOAL;
    const o = this.objs.goal;
    this.add.image(o.x, o.y, 'treehouse').setOrigin(0.5, 1).setDepth(3);
    this.goal = this.physics.add.staticGroup();
    this.goal.add(this.add.zone(o.x, o.y - h / 2, w, h));
  }

  // Checkpoint: ตอไม้ป้ายอุ้งเท้า แตะแล้วตายครั้งต่อไปเกิดที่นี่ (เหรียญที่เก็บแล้วยังอยู่)
  // ข้ามได้เฉพาะไปข้างหน้า: ผ่านจุดที่ลำดับสูงกว่าเท่านั้นถึงจะอัปเดต
  createCheckpoints() {
    this.checkpoints = this.physics.add.staticGroup();
    this.checkpointSprites = [];
    const reached = this.run.checkpoint ? this.run.checkpoint.order : -1;

    this.objs.checkpoints.forEach((o, i) => {
      const order = prop(o, 'order', i);
      const sprite = this.add.sprite(o.x, o.y, 'checkpoint', order <= reached ? 1 : 0).setOrigin(0.5, 1).setDepth(3);
      const zone = this.add.zone(o.x, o.y - 32, 32, 64);
      zone.order = order;
      zone.sprite = sprite;
      zone.baseX = o.x;
      zone.baseY = o.y;
      this.checkpoints.add(zone);
      this.checkpointSprites[order] = sprite;
    });
  }

  reachCheckpoint(cat, zone) {
    const current = this.run.checkpoint ? this.run.checkpoint.order : -1;
    if (this.state !== 'playing' || zone.order <= current) return;

    this.run.checkpoint = { order: zone.order, x: zone.baseX, y: zone.baseY };
    this.checkpointSprites.forEach((s, order) => s && order <= zone.order && s.setFrame(1)); // จุดก่อนหน้าก็ถือว่าผ่านแล้ว
    playSfx(this, 'sfx-checkpoint');
    this.tweens.add({ targets: zone.sprite, scaleX: 1.25, scaleY: 0.85, duration: 120, yoyo: true });

    const note = this.add
      .text(zone.baseX, zone.baseY - 90, 'บันทึกแล้ว!', { fontFamily: 'sans-serif', fontSize: '22px', color: '#fff3a0', stroke: '#2a1508', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: note, y: note.y - 36, alpha: 0, duration: 1100, onComplete: () => note.destroy() });
  }

  createCoins() {
    this.coins = this.physics.add.staticGroup();
    const size = GAMEPLAY.COIN_RADIUS * 2;

    this.objs.coins.forEach((o, i) => {
      if (this.run.collected.includes(o.id)) return; // เก็บไปแล้วก่อนตาย ไม่โผล่กลับมาอีก
      const coin = this.add.sprite(o.x, o.y, 'coin').setDepth(4);
      this.coins.add(coin);
      coin.body.setSize(size, size, true); // Hitbox เล็กกว่าภาพ ตรงกลางเหรียญ
      coin.collected = false;
      coin.objId = o.id; // id จากแผนที่ ใช้จำว่าเหรียญไหนถูกเก็บแล้ว
      coin.play({ key: 'coin-spin', startFrame: i % 6 }); // เริ่มคนละเฟรม ให้หมุนไม่พร้อมกันหมด
    });
    this.coinTotal = this.objs.coins.length;
  }

  // ด้วงแรด: เดินไปมาบนพื้น/ขอนไม้
  createEnemies() {
    this.enemies = this.physics.add.group({ collideWorldBounds: true });

    for (const o of this.objs.beetles) {
      const beetle = this.enemies.create(o.x, o.y - ENEMY.HEIGHT / 2, 'beetle').setDepth(5);
      beetle.body.setSize(ENEMY.WIDTH, ENEMY.HEIGHT);
      beetle.body.setOffset((32 - ENEMY.WIDTH) / 2, 0);
      beetle.body.setCollideWorldBounds(true);
      beetle.play('beetle-walk');

      beetle.dead = false; // ล็อกสถานะ: ตายแล้วไม่ใช่ศัตรูอีก กันเหยียบ/ชนซ้ำทุกเฟรม
      beetle.dir = -1;
      beetle.minX = prop(o, 'rangeMin', 0);
      beetle.maxX = prop(o, 'rangeMax', this.worldWidth);
      beetle.body.setVelocityX(beetle.dir * ENEMY.SPEED);
    }

    this.physics.add.collider(this.enemies, this.ground);
  }

  // มีพื้น/ขอนไม้ตรงจุด (x, y) ไหม — ใช้ดูว่าข้างหน้าด้วงเป็นขอบหรือเปล่า
  isSolidAt(x, y) {
    return this.ground.getChildren().some((g) => {
      const b = g.body;
      return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    });
  }

  updateEnemies() {
    for (const beetle of this.enemies.getChildren()) {
      if (beetle.dead) continue;
      const body = beetle.body;

      const hitWall = (beetle.dir < 0 && body.blocked.left) || (beetle.dir > 0 && body.blocked.right);
      const pastRange = (beetle.dir < 0 && body.left <= beetle.minX) || (beetle.dir > 0 && body.right >= beetle.maxX);
      // ขอบ: ไม่มีพื้นใต้เท้าด้านหน้า (เช็กเฉพาะตอนยืนอยู่บนพื้น)
      const probeX = beetle.dir < 0 ? body.left - 2 : body.right + 2;
      const atEdge = body.blocked.down && !this.isSolidAt(probeX, body.bottom + 4);

      if (hitWall || pastRange || atEdge) beetle.dir *= -1;
      body.setVelocityX(beetle.dir * ENEMY.SPEED);
      beetle.setFlipX(beetle.dir < 0); // ภาพต้นฉบับหันขวา
    }
  }

  // ตอนแมวตาย/ชนะ ด้วงหยุดเดิน (ฉากค้างไว้ ไม่ให้ด้วงเดินตกขอบไปเอง)
  freezeEnemies() {
    for (const beetle of this.enemies.getChildren()) {
      beetle.body.setVelocityX(0);
      beetle.anims.stop();
    }
  }

  // แมวชนด้วง: เหยียบหัว (กำลังตกลงและจมลงในตัวด้วงไม่มาก) = ด้วงตาย แมวเด้ง / นอกนั้น = แมวตาย
  hitEnemy(cat, beetle) {
    if (beetle.dead || this.state !== 'playing') return;

    const stomping = cat.body.velocity.y > 0 && cat.body.bottom - beetle.body.top <= ENEMY.STOMP_TOLERANCE;
    if (!stomping) {
      this.die('beetle');
      return;
    }

    playSfx(this, 'sfx-stomp');
    beetle.dead = true;
    beetle.body.enable = false;
    beetle.anims.stop();
    beetle.setTint(0x888888);
    this.tweens.add({
      targets: beetle,
      scaleY: 0.25,
      y: beetle.y + beetle.height * 0.375,
      duration: ENEMY.SQUISH_MS,
      onComplete: () => beetle.destroy(),
    });

    cat.body.setVelocityY(-(this.isJumpHeld() ? ENEMY.STOMP_BOUNCE_HELD : ENEMY.STOMP_BOUNCE));
    this.isJumping = 'cut'; // อยู่กลางอากาศแล้ว: กันกระโดดซ้ำจาก Coyote และไม่ให้ตัดความเร็วเด้งทิ้ง
    this.coyoteTimer = 0;
  }

  collectCoin(cat, coin) {
    // เหรียญเดียวนับครั้งเดียว: ล็อกสถานะทันที เพราะ overlap เรียกซ้ำได้ทุกเฟรมที่ยังชนกัน
    if (coin.collected || this.state !== 'playing') return;
    coin.collected = true;
    coin.body.enable = false;
    coin.setVisible(false);
    playSfxVaried(this, 'sfx-coin');
    this.run.collected.push(coin.objId);
    this.run.levelCoins += 1;
    this.coinCount = this.run.levelCoins;
    this.updateHud();
  }

  createHud() {
    this.hudIcon = this.add.sprite(34, 32, 'coin', 0).setScrollFactor(0).setDepth(100);
    this.hud = this.add
      .text(60, 14, '', { fontSize: '28px', fontFamily: 'sans-serif', color: '#ffffff', stroke: '#2a1508', strokeThickness: 5 })
      .setScrollFactor(0)
      .setDepth(100);
    this.add
      .text(16, 88, `ด่าน ${this.run.level + 1}/${LEVELS.length} · ${this.levelDef.title}`, { fontSize: '18px', fontFamily: 'sans-serif', color: '#ffffff', stroke: '#2a1508', strokeThickness: 4 })
      .setScrollFactor(0)
      .setDepth(100);
    this.updateHud();
  }

  updateHud() {
    this.hud.setText(`× ${this.coinCount}`);
  }

  // ตาย: หยุดแมวสั้น ๆ (ท่าตกใจ) แล้วเริ่มด่านใหม่ทั้งฉาก (เหรียญ ตัวนับ สถานะทุกอย่างสร้างใหม่หมด ไม่มีของค้าง)
  // cause: 'water' = ตกน้ำ (เสียงน้ำกระฉอก) · อย่างอื่น (thorn, beetle) = แมวร้อง
  die(cause) {
    if (this.state !== 'playing') return;
    this.state = 'dead';
    playSfx(this, cause === 'water' ? 'sfx-splash' : 'sfx-meow');

    this.freezeEnemies();
    this.cat.anims.play('cat-hurt');
    this.cat.body.setVelocity(0, 0);
    this.cat.body.setAllowGravity(false);
    this.cameras.main.stopFollow();

    this.time.delayedCall(GAMEPLAY.DEATH_RESTART_MS, () => this.scene.restart());
  }

  win() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    playSfx(this, 'sfx-win');
    fadeBgm(this, AUDIO.BGM_VOLUME_WIN);

    this.freezeEnemies();
    this.cat.body.setVelocity(0, 0);
    this.cat.body.enable = false;

    // แมวกระโดดดีใจอยู่กับที่ (ท่าดีใจ + ตัวเด้งขึ้นลง)
    this.cat.setFlipX(false);
    this.cat.anims.play('cat-celebrate');
    this.tweens.add({ targets: this.cat, y: this.cat.y - 30, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });

    // เก็บคะแนนของด่านนี้เข้ากองรวม (ทำครั้งเดียว เพราะ state กัน win ซ้ำอยู่แล้ว)
    this.run.banked += this.run.levelCoins;
    this.run.bankedTotal += this.coinTotal;
    const isLast = this.run.level >= LEVELS.length - 1;

    const { width, height } = this.scale;
    const cx = width / 2;
    const style = { fontFamily: 'sans-serif', color: '#ffffff', stroke: '#2a1508', strokeThickness: 6, align: 'center' };
    const label = (y, text, size) => this.add.text(cx, y, text, { ...style, fontSize: `${size}px` }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.rectangle(cx, height / 2, width, height, 0x000000, 0.45).setScrollFactor(0).setDepth(200);
    label(height / 2 - 100, isLast ? 'ผ่านครบทุกด่านแล้ว!' : 'ถึงบ้านแล้ว!', 56);
    label(height / 2 - 36, `ด่าน ${this.run.level + 1}: เก็บเหรียญอุ้งเท้าได้ ${this.coinCount} / ${this.coinTotal}`, 30);
    if (isLast) label(height / 2 + 4, `รวมทั้งเกม ${this.run.banked} / ${this.run.bankedTotal} เหรียญ`, 30);

    // ปุ่มไปต่อ: ด่านสุดท้าย = เล่นใหม่ทั้งเกม · ด่านอื่น = ด่านถัดไป (คลิกหรือ Enter)
    let proceeded = false; // กันกดซ้ำ (คลิกสองที/คลิกแล้วกด Enter) ที่จะข้ามด่านไปสองด่าน
    const proceed = () => {
      if (proceeded) return;
      proceeded = true;
      if (isLast) resetRun(this.game, 0);
      else advanceLevel(this.run);
      this.scene.restart();
    };
    const button = label(height / 2 + 76, isLast ? 'เล่นใหม่ทั้งเกม (Enter)' : 'ด่านถัดไป (Enter)', 32)
      .setBackgroundColor('#4caf50')
      .setPadding(24, 12, 24, 12)
      .setInteractive({ useHandCursor: true });
    button.on('pointerdown', proceed);
    // ใช้อีเวนต์ (ไม่ใช่ตรวจทุกเฟรม) กันพลาดการกดสั้น ๆ; once = ทำครั้งเดียว กันรีสตาร์ตซ้อน
    this.input.keyboard.once('keydown-ENTER', proceed);
  }

  createCat() {
    // เกิดที่ Checkpoint ล่าสุด ถ้ายังไม่ผ่านจุดไหนก็เกิดที่จุดเริ่มด่าน
    const spawn = this.run.checkpoint || this.objs.spawn;
    this.spawnX = spawn.x;
    this.spawnY = spawn.y - PLAYER.HEIGHT / 2;
    this.facing = 1; // 1 = หันขวา (ภาพต้นฉบับ), -1 = หันซ้าย (พลิกภาพ)
    this.wasOnGround = true; // ใช้จับจังหวะ "เพิ่งลงพื้น" เพื่อเล่นท่าลงพื้น
    this.peakFallSpeed = 0; // ความเร็วตกสูงสุดในรอบที่อยู่กลางอากาศ
    this.landUntil = 0; // เวลา (ms) ที่ท่าลงพื้นจะหมด

    // เฟรมภาพ 48×48 แต่ Hitbox 32×48 อยู่กลางตัว — หางที่ยื่นออกนอก Hitbox จึงไม่ชนอะไร
    this.cat = this.physics.add.sprite(this.spawnX, this.spawnY, 'cat', 0).setDepth(10);
    this.cat.body.setSize(PLAYER.WIDTH, PLAYER.HEIGHT);
    this.cat.body.setOffset((48 - PLAYER.WIDTH) / 2, 0);
    this.cat.body.setCollideWorldBounds(true);
    this.cat.body.setMaxVelocityY(PHYSICS.MAX_FALL_SPEED);
    this.cat.play('cat-idle');

    this.physics.add.collider(this.cat, this.ground);

    // สถานะระบบกระโดด (หน่วยเวลาเป็น มิลลิวินาที นับจาก delta จึงไม่ผูกกับ FPS)
    this.coyoteTimer = 0; // เหลือเวลาที่ยังกระโดดได้หลังพ้นพื้น
    this.bufferTimer = 0; // เหลือเวลาที่ยังจำคำสั่งกระโดดไว้
    this.isJumping = false; // กำลังอยู่ในการกระโดดที่เราสั่ง (กันกระโดดซ้ำจาก Coyote)
  }

  createControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('A,D,W');
  }

  createCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.worldWidth, this.worldHeight);
    cam.centerOn(this.cat.x, this.cat.y); // เกิดกลางด่านที่ Checkpoint: ตั้งกล้องตรงตัวแมวทันที ไม่ไหลจากต้นด่าน
    cam.startFollow(this.cat, true, CAMERA.LERP, CAMERA.LERP);
    cam.setDeadzone(CAMERA.DEADZONE_WIDTH, this.scale.height);
  }

  // เหยียบพื้นอยู่ไหม — ต้องไม่กำลังพุ่งขึ้น เพราะบางเฟรมฟิสิกส์ไม่ได้ก้าว (จอ 75Hz+ แต่ฟิสิกส์ 60Hz)
  // ทำให้ blocked.down ค้างค่าเก่าอยู่ ถ้าไม่เช็กความเร็วจะนึกว่ายังอยู่บนพื้นหลังเพิ่งกระโดด
  isOnGround() {
    const body = this.cat.body;
    return body.blocked.down && body.velocity.y >= 0;
  }

  update(time, delta) {
    this.updateBackground();
    if (this.touch) this.touch.update();
    if (this.state !== 'playing') return;

    this.updateMovement(delta);
    this.updateJump(delta);
    this.updateCatAnimation(time);
    this.updateEnemies();

    // กันพลาด: ตกพ้นขอบล่างของด่านโดยไม่โดนน้ำ ไม่ควรหลุดโลกไปเรื่อย ๆ
    if (this.cat.y > this.worldHeight + 100) this.die('water');
  }

  // เลือกท่าตามสถานะ: กลางอากาศ (ขึ้น → จุดสูงสุด → ตก) → ลงพื้น (ยุบสั้น ๆ ถ้าตกแรงและหยุดนิ่ง) → วิ่ง/ยืน
  // และหันหน้าตามทิศที่เดิน
  updateCatAnimation(time) {
    const body = this.cat.body;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const onGround = this.isOnGround();

    if (vx > 10) this.facing = 1;
    else if (vx < -10) this.facing = -1;
    this.cat.setFlipX(this.facing < 0);

    // จับจังหวะเพิ่งลงพื้น: ถ้าตกมาเร็วพอ ให้เล่นท่าลงพื้นช่วงสั้น ๆ
    if (!onGround) {
      this.peakFallSpeed = Math.max(this.peakFallSpeed, vy);
    } else if (!this.wasOnGround) {
      if (this.peakFallSpeed > CAT_ANIM.LAND_MIN_FALL_SPEED) this.landUntil = time + CAT_ANIM.LAND_MS;
      this.peakFallSpeed = 0;
    }
    this.wasOnGround = onGround;

    let key;
    if (!onGround) {
      key = vy < -CAT_ANIM.APEX_SPEED ? 'cat-jump-up' : vy > CAT_ANIM.APEX_SPEED ? 'cat-fall' : 'cat-apex';
    } else if (Math.abs(vx) > 20) {
      key = 'cat-run'; // วิ่งต่อทันที ไม่ต้องรอท่าลงพื้น
    } else {
      key = time < this.landUntil ? 'cat-land' : 'cat-idle';
    }
    this.cat.anims.play(key, true); // true = ถ้าท่านี้เล่นอยู่แล้วไม่ต้องเริ่มใหม่
  }

  updateMovement(delta) {
    const body = this.cat.body;
    const onGround = this.isOnGround();
    const left = this.cursors.left.isDown || this.keys.A.isDown || (this.touch && this.touch.state.left);
    const right = this.cursors.right.isDown || this.keys.D.isDown || (this.touch && this.touch.state.right);

    let dir = 0;
    if (left && !right) dir = -1;
    else if (right && !left) dir = 1;

    // เร่ง/เบรกเข้าหาความเร็วเป้าหมายตามเวลาจริง (delta) — ไม่ผูกกับ FPS
    const target = dir * PLAYER.WALK_SPEED;
    const speedingUp = dir !== 0 && Math.sign(body.velocity.x) !== -dir;
    const rate = onGround
      ? speedingUp ? PLAYER.ACCEL_GROUND : PLAYER.DECEL_GROUND
      : speedingUp ? PLAYER.ACCEL_AIR : PLAYER.DECEL_AIR;

    const step = rate * (delta / 1000);
    const diff = target - body.velocity.x;
    body.setVelocityX(Math.abs(diff) <= step ? target : body.velocity.x + Math.sign(diff) * step);
  }

  isJumpHeld() {
    return this.cursors.space.isDown || this.cursors.up.isDown || this.keys.W.isDown || Boolean(this.touch && this.touch.state.jump);
  }

  updateJump(delta) {
    const body = this.cat.body;
    const onGround = this.isOnGround();

    const jumpHeld = this.isJumpHeld();
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.W) ||
      Boolean(this.touch && this.touch.jumpPressed);

    // Coyote Time: อยู่บนพื้น = เติมเวลาเต็ม / พ้นพื้นแล้ว = ค่อย ๆ ลด
    if (onGround) {
      this.coyoteTimer = JUMP.COYOTE_MS;
      this.isJumping = false;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - delta);
    }

    // Jump Buffer: จำการกดไว้ชั่วครู่ เผื่อกดก่อนแตะพื้นนิดเดียว
    if (jumpPressed) this.bufferTimer = JUMP.BUFFER_MS;
    else this.bufferTimer = Math.max(0, this.bufferTimer - delta);

    // กระโดดได้เมื่อมีคำสั่งค้างอยู่ และยังอยู่ในช่วงที่ถือว่าเหยียบพื้น (รวม Coyote)
    // ต้องไม่ใช่กลางการกระโดดที่สั่งไปแล้ว — กันกระโดดซ้ำ
    if (this.bufferTimer > 0 && this.coyoteTimer > 0 && !this.isJumping) {
      body.setVelocityY(-JUMP.JUMP_VELOCITY);
      playSfxVaried(this, 'sfx-jump');
      this.isJumping = true;
      this.coyoteTimer = 0;
      this.bufferTimer = 0;
    }

    // กระโดดแบบแปรผัน: ปล่อยปุ่มขณะยังพุ่งขึ้น → ตัดความเร็วขึ้น (ทำครั้งเดียวต่อการกระโดด)
    if (this.isJumping === true && !jumpHeld && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y * JUMP.JUMP_CUT);
      this.isJumping = 'cut'; // ยังนับว่ากำลังกระโดดอยู่ (กันกระโดดซ้ำ) แต่ตัดความเร็วไปแล้วจะไม่ตัดซ้ำ
    }
  }
}
