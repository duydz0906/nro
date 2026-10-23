// Quái vật (dùng chung server + client)
// shape: wolf | boar | fox | snake | ape | golem | bird | elephant | yeti | boss

export const MONSTERS = [
  { id: 'soi-xam', name: 'Sói Xám', lv: 3, shape: 'wolf', size: 1.0, palette: { body: '#7d7f8a', accent: '#c9ccd6', eye: '#ffd166' }, xp: 26, gold: 12 },
  { id: 'da-tru', name: 'Dã Trư Răng Kiếm', lv: 6, shape: 'boar', size: 1.15, palette: { body: '#8a6042', accent: '#f0e3c8', eye: '#ff8a4c' }, xp: 48, gold: 24 },
  { id: 'cao-ho-ly', name: 'Cáo Hồ Ly', lv: 9, shape: 'fox', size: 0.95, palette: { body: '#e0813c', accent: '#ffd9a0', eye: '#7cf0a8' }, xp: 82, gold: 40 },
  { id: 'ran-ho-mang', name: 'Rắn Hổ Mang', lv: 12, shape: 'snake', size: 1.05, palette: { body: '#4f8f5a', accent: '#d9f2a0', eye: '#ff5f5f' }, xp: 130, gold: 62 },
  { id: 'khi-da', name: 'Khỉ Đá', lv: 15, shape: 'ape', size: 1.1, palette: { body: '#8c8377', accent: '#c3b9a5', eye: '#ffd166' }, xp: 190, gold: 88 },
  { id: 'u-minh-lang', name: 'U Minh Lang', lv: 19, shape: 'wolf', size: 1.25, palette: { body: '#3a3550', accent: '#7a6cff', eye: '#ff4d6d' }, xp: 300, gold: 130 },
  { id: 'thiet-giap-te', name: 'Thiết Giáp Tê', lv: 23, shape: 'boar', size: 1.4, palette: { body: '#5f6b74', accent: '#a9bcc4', eye: '#ff8a4c' }, xp: 430, gold: 180 },
  { id: 'hoa-diep-diep', name: 'Hỏa Diệp Điệp', lv: 27, shape: 'bird', size: 1.0, palette: { body: '#ff7a3c', accent: '#ffd166', eye: '#fff2a8' }, xp: 600, gold: 240 },
  { id: 'bang-tuong', name: 'Băng Tượng', lv: 31, shape: 'elephant', size: 1.5, palette: { body: '#a8c4d8', accent: '#e8f6ff', eye: '#8fd8ff' }, xp: 800, gold: 320 },
  { id: 'hoa-linh', name: 'Hỏa Linh', lv: 35, shape: 'bird', size: 1.2, palette: { body: '#ff4d4d', accent: '#ffb02e', eye: '#fff' }, xp: 1050, gold: 400 },
  { id: 'thach-nhan', name: 'Thạch Nhân', lv: 39, shape: 'golem', size: 1.45, palette: { body: '#6f6a63', accent: '#9c948a', eye: '#ffd166' }, xp: 1350, gold: 500 },

  // ---- Boss ----
  { id: 'ho-vuong', name: 'Hổ Vương', lv: 14, boss: true, shape: 'wolf', size: 1.9, palette: { body: '#d9822b', accent: '#3a2a18', eye: '#ff2d55' }, xp: 900, gold: 600 },
  { id: 'ho-ly-vuong', name: 'Hồ Ly Vương', lv: 24, boss: true, shape: 'fox', size: 1.9, palette: { body: '#ff8ad8', accent: '#fff2a8', eye: '#ff2d55' }, xp: 2200, gold: 1400 },
  { id: 'thach-ma-vuong', name: 'Thạch Ma Vương', lv: 34, boss: true, shape: 'golem', size: 2.1, palette: { body: '#4c4a55', accent: '#b06cff', eye: '#ff2d55' }, xp: 4200, gold: 2600 },
  { id: 'tuyet-son-lao-quai', name: 'Tuyết Sơn Lão Quái', lv: 46, boss: true, shape: 'yeti', size: 2.2, palette: { body: '#dff0ff', accent: '#7fb4e8', eye: '#ff2d55' }, xp: 9000, gold: 6000 },
];

export const MONSTER_MAP = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));

// Chỉ số chiến đấu của quái theo cấp
export function monsterStats(tpl) {
  const lv = tpl.lv;
  const bossMul = tpl.boss ? 4.5 : 1;
  return {
    maxHp: Math.round((50 + lv * 40) * bossMul),
    atk: Math.round(6 + lv * 3.6 * (tpl.boss ? 1.3 : 1)),
    def: Math.round(lv * 1.8 * (tpl.boss ? 1.25 : 1)),
    xp: tpl.xp,
    gold: tpl.gold,
    speed: tpl.boss ? 96 : 62 + lv * 1.2,
    aggro: tpl.boss ? 320 : 210,
    atkRange: tpl.boss ? 90 : 52 + tpl.size * 12,
    atkCd: tpl.boss ? 1100 : 1500,
  };
}
