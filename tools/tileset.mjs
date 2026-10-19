// รายชื่อช่องใน tileset ป่า (ใช้ร่วมกันระหว่างตัววาดภาพกับตัวสร้างแผนที่)
// ลำดับในอาร์เรย์ = ตำแหน่งในภาพ (ซ้ายไปขวา บนลงล่าง) · gid ใน Tiled = ลำดับ + 1
export const TILE_NAMES = [
  'grass', // 1  หญ้าบนพื้น
  'dirt', // 2  ดินใต้หญ้า
  'water_surface', // 3  ผิวน้ำ (12 px บนโปร่งใส)
  'water', // 4  น้ำลึก
  'log_left', // 5  ปลายซ้ายของขอนไม้ (หนา 16 px ครึ่งบนของช่อง)
  'log_mid', // 6
  'log_right', // 7
  'grass_left', // 8  มุมซ้ายบนของพื้น
  'grass_right', // 9  มุมขวาบนของพื้น
  'dirt_left', // 10 ขอบซ้ายของดิน
  'dirt_right', // 11 ขอบขวาของดิน
  'flower_red', // 12 ของตกแต่ง (ไม่ชน)
  'flower_yellow', // 13
  'mushroom', // 14
  'fern', // 15
  'bush', // 16
  'tuft', // 17
];

export const TILESET_COLUMNS = 6;
export const TILESET_ROWS = 3;

export const gid = (name) => {
  const i = TILE_NAMES.indexOf(name);
  if (i < 0) throw new Error(`ไม่รู้จักช่อง tileset: ${name}`);
  return i + 1;
};
