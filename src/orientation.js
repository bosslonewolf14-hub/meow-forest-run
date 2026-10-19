// ตัวตรวจจับการพลิกหน้าจอ: มือถือ/แท็บเล็ตที่ถือแนวตั้ง → หยุดเกม ขึ้นหน้า "พลิกเป็นแนวนอน" (ใน index.html)
// ปุ่มกด "พลิกเป็นแนวนอน" ขอเต็มจอ + ล็อกแนวจอเป็นแนวนอน · เมื่อเป็นแนวนอนแล้วเกมเล่นต่อเองทันที
//
// ข้อจำกัดของเบราว์เซอร์ (ไม่ใช่ข้อบกพร่องของเกม):
//  - ล็อกแนวจอได้เฉพาะตอนเต็มจอ และมีแต่ Chrome/Edge/Firefox บน Android เท่านั้นที่รองรับ
//  - iPhone/iPad (Safari) ไม่มี API ล็อกแนวจอ → ปุ่มจะบอกให้หมุนเครื่องเอง
const QUERY = '(orientation: portrait) and (pointer: coarse)'; // ต้องตรงกับ media query ใน index.html

export function setupOrientationGuard(game) {
  const overlay = document.getElementById('rotate');
  const button = document.getElementById('rotate-button');
  const note = document.getElementById('rotate-note');
  if (!overlay || !button || !note) return;

  const media = window.matchMedia(QUERY);
  const defaultNote = note.textContent;
  let pausedByUs = false;

  // หยุด/เล่นเกมตามแนวจอ (หยุดทั้งลูปเกมและเสียง กันเกมวิ่งต่อข้างหลังหน้าที่ขอให้พลิก)
  const apply = () => {
    if (!game.isBooted) return;
    if (media.matches && !pausedByUs) {
      pausedByUs = true;
      game.pause();
      game.sound.pauseAll();
    } else if (!media.matches && pausedByUs) {
      pausedByUs = false;
      game.resume();
      game.sound.resumeAll();
      note.textContent = defaultNote;
    }
  };

  if (game.isBooted) apply();
  else game.events.once('ready', apply);
  media.addEventListener('change', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 200)); // บางเครื่องแจ้งเหตุการณ์ช้ากว่าค่าจริง

  // Phaser เล่นเกมต่อเองเมื่อกลับมาที่แท็บ (visibilitychange) — ถ้ายังเป็นแนวตั้งอยู่ ให้หยุดซ้ำ
  game.events.on('resume', () => {
    if (media.matches && pausedByUs) game.pause();
  });

  button.addEventListener('click', async () => {
    const el = document.documentElement;
    const requestFullscreen = el.requestFullscreen || el.webkitRequestFullscreen;
    let enteredFullscreen = false;
    let locked = false;

    try {
      if (requestFullscreen && !document.fullscreenElement) {
        await requestFullscreen.call(el);
        enteredFullscreen = true;
      }
    } catch {
      // ขอเต็มจอไม่ได้ (เบราว์เซอร์ไม่อนุญาต) — ลองล็อกแนวจอต่อไปอยู่ดี
    }

    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
        locked = true;
      }
    } catch {
      // ไม่รองรับ/ไม่อนุญาตให้ล็อก
    }

    if (!locked) {
      // ล็อกไม่ได้ก็ไม่ต้องค้างเต็มจอไว้เฉย ๆ แล้วบอกผู้เล่นให้หมุนเครื่องเอง
      if (enteredFullscreen && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      note.textContent = isIOS
        ? 'iPhone/iPad ให้เบราว์เซอร์พลิกจอให้ไม่ได้ — ปิด "ล็อกการหมุนหน้าจอ" ใน Control Center แล้วหมุนเครื่องเป็นแนวนอน'
        : 'เบราว์เซอร์นี้พลิกจอให้ไม่ได้ — กรุณาหมุนโทรศัพท์เป็นแนวนอนเอง (และเปิดการหมุนหน้าจออัตโนมัติของเครื่อง)';
    }
  });

  // ออกจากเต็มจอแล้วคืนการล็อกแนวจอ ให้ผู้เล่นกลับไปหมุนอิสระได้ตามปกติ
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && screen.orientation && screen.orientation.unlock) {
      try {
        screen.orientation.unlock();
      } catch {
        // ไม่มีอะไรต้องคืน
      }
    }
  });
}
