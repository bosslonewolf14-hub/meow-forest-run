// รายการด่านตามลำดับ — เพิ่มด่านใหม่: ใส่แผนที่ที่ public/assets/maps/ แล้วเพิ่มบรรทัดที่นี่
// key = ชื่อแผนที่ในแคช · title = ชื่อด่านที่โชว์ · theme = ชุดภาพ (ต้องตรงกับ property `theme` ในแผนที่)
export const LEVELS = [
  { key: 'forest1', file: 'forest-1.tmj', title: 'ชายป่า', theme: 'forest' },
  { key: 'forest2', file: 'forest-2.tmj', title: 'ป่าลึก', theme: 'deep' },
  { key: 'forest3', file: 'forest-3.tmj', title: 'ป่ายามค่ำ', theme: 'night' },
];

export const THEMES = ['forest', 'deep', 'night'];

// ชื่อภาพพื้นหลังตามชุด: forest ใช้ชื่อเดิม (bg-far) ชุดอื่นต่อท้ายด้วย -<theme> (bg-far-deep)
export const bgKey = (layer, theme) => (theme === 'forest' ? `bg-${layer}` : `bg-${layer}-${theme}`);
export const tilesetKey = (theme) => `tileset-${theme}`;
