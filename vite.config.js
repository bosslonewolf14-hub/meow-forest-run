import { defineConfig } from 'vite';

export default defineConfig({
  // ใช้ path แบบสัมพัทธ์ เพื่อให้ไฟล์ที่ build แล้วโฮสต์แบบ Static ที่โฟลเดอร์ไหนก็ได้
  base: './',
  server: {
    port: 5173,
  },
});
