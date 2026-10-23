// Cơ sở dữ liệu vật phẩm (dùng chung server + client, thuần JS không phụ thuộc Node)
// stats: { key: [giá trị cơ bản, cộng thêm mỗi cấp vật phẩm] }

export const RARITY = [
  { id: 0, name: 'Phẩm Thường', color: '#a9b4c4', mult: 1.0, bonus: 0 },
  { id: 1, name: 'Tinh Luyện', color: '#5fd07a', mult: 1.2, bonus: 1 },
  { id: 2, name: 'Linh Khí', color: '#4aa8ff', mult: 1.45, bonus: 3 },
  { id: 3, name: 'Sử Thi', color: '#c678ff', mult: 1.8, bonus: 6 },
  { id: 4, name: 'Thần Khí', color: '#ffb02e', mult: 2.3, bonus: 10 },
];

export const SLOTS = ['weapon', 'armor', 'helm', 'boots', 'ring'];

export const SLOT_NAME = {
  weapon: 'Vũ khí',
  armor: 'Áo',
  helm: 'Mũ',
  boots: 'Giày',
  ring: 'Nhẫn',
};

const W = (id, name, stats, extra = {}) => ({ id, name, slot: 'weapon', kind: 'equip', stats, ...extra });
const A = (id, name, stats, extra = {}) => ({ id, name, slot: 'armor', kind: 'equip', stats, ...extra });
const H = (id, name, stats, extra = {}) => ({ id, name, slot: 'helm', kind: 'equip', stats, ...extra });
const B = (id, name, stats, extra = {}) => ({ id, name, slot: 'boots', kind: 'equip', stats, ...extra });
const R = (id, name, stats, extra = {}) => ({ id, name, slot: 'ring', kind: 'equip', stats, ...extra });
const U = (id, name, price, effect, desc, extra = {}) => ({ id, name, kind: 'use', price, effect, desc, stack: 99, ...extra });

export const ITEMS = [
  // ---- Vũ khí ----
  W('kiem-sat', 'Kiếm Sắt', { atk: [8, 3.2] }),
  W('dao-nguyet', 'Đao Nguyệt', { atk: [9, 3.4], crit: [2, 0.12] }),
  W('truong-thuong', 'Trường Thương', { atk: [7, 3.0], def: [2, 0.8] }),
  W('phap-truong', 'Pháp Trượng', { atk: [6, 2.7], ki: [18, 5.5] }),
  W('quat-linh', 'Quạt Linh', { atk: [5, 2.4], ki: [14, 4.5], hp: [10, 4] }),
  W('song-doan-dao', 'Song Đoản Đao', { atk: [7, 3.1], crit: [4, 0.2] }),
  W('kiem-thanh-phong', 'Kiếm Thanh Phong', { atk: [12, 4.0], crit: [3, 0.15], spd: [2, 0.4] }),

  // ---- Áo ----
  A('ao-vo', 'Áo Võ', { def: [5, 2.2], hp: [20, 9] }),
  A('ao-linh', 'Áo Linh', { def: [3, 1.5], ki: [22, 7] }),
  A('ao-da', 'Áo Da', { def: [4, 1.9], hp: [14, 7], spd: [3, 0.5] }),
  A('ao-tuyet', 'Áo Tuyết', { def: [6, 2.5], hp: [26, 11] }),
  A('ao-long-lan', 'Long Lân Giáp', { def: [8, 3.0], hp: [30, 12], crit: [1, 0.08] }),

  // ---- Mũ ----
  H('mu-sat', 'Mũ Sắt', { def: [3, 1.3], hp: [12, 5] }),
  H('bang-le', 'Băng Lệ', { def: [2, 1.0], ki: [12, 4] }),
  H('mu-da', 'Mũ Da', { def: [2, 1.1], hp: [8, 4], crit: [1, 0.1] }),
  H('kim-quan', 'Kim Quan', { def: [4, 1.6], hp: [16, 6], ki: [8, 3] }),

  // ---- Giày ----
  B('giay-vai', 'Giày Vải', { def: [1, 0.6], spd: [4, 0.9] }),
  B('giay-da', 'Giày Da', { def: [2, 0.9], spd: [6, 1.2], hp: [8, 3] }),
  B('van-tat', 'Vân Tất', { def: [2, 1.0], spd: [9, 1.6], ki: [8, 3] }),
  B('ngoc-hai', 'Ngọc Hải', { def: [3, 1.2], spd: [11, 1.9], hp: [10, 4] }),

  // ---- Nhẫn ----
  R('nhan-ngoc', 'Nhẫn Ngọc', { atk: [3, 1.2], crit: [2, 0.14] }),
  R('nhan-huyet', 'Nhẫn Huyết', { hp: [26, 10], atk: [2, 1.0] }),
  R('nhan-linh', 'Nhẫn Linh', { ki: [20, 6], def: [1, 0.7] }),
  R('nhan-van-menh', 'Nhẫn Vận Mệnh', { atk: [4, 1.4], def: [2, 0.9], crit: [2, 0.1] }),

  // ---- Vật phẩm tiêu hao ----
  U('danh-duoc-nho', 'Tiểu Hồi Đan', 60, { hpPct: 0.3 }, 'Hồi 30% sinh lực ngay lập tức.'),
  U('danh-duoc-lon', 'Đại Hồi Đan', 140, { hpPct: 0.6 }, 'Hồi 60% sinh lực ngay lập tức.'),
  U('linh-thach', 'Linh Thạch', 100, { kiPct: 0.6 }, 'Hồi 60% linh lực.'),
  U('hoi-khi-dan', 'Hồi Khí Đan', 220, { hpPct: 0.35, kiPct: 0.5 }, 'Hồi 35% sinh lực và 50% linh lực.'),
  U('phu-tro-ve', 'Phù Trở Về', 300, { warp: 'village' }, 'Đưa bạn về Làng Khởi Nguyên.'),
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export function rarityOf(item) {
  return RARITY[item.rar] || RARITY[0];
}

// Tính chỉ số thực tế của một vật phẩm
export function itemStats(item) {
  const tpl = ITEM_MAP[item.t];
  if (!tpl || !tpl.stats) return {};
  const rar = RARITY[item.rar] || RARITY[0];
  const lv = Math.max(1, item.lv || 1);
  const upgMul = 1 + (item.upg || 0) * 0.09;
  const out = {};
  for (const key of Object.keys(tpl.stats)) {
    const [base, growth] = tpl.stats[key];
    let v = (base + growth * (lv - 1)) * rar.mult * upgMul;
    if (growth > 0) v += rar.bonus;
    out[key] = key === 'crit' || key === 'spd' ? Math.round(v * 10) / 10 : Math.round(v);
  }
  return out;
}

// Điểm sức mạnh để so sánh trang bị
export function itemPower(item) {
  const s = itemStats(item);
  return Math.round((s.atk || 0) * 3 + (s.def || 0) * 2.2 + (s.hp || 0) * 0.5 + (s.ki || 0) * 0.3 + (s.crit || 0) * 4 + (s.spd || 0) * 3);
}

export function itemName(item) {
  const tpl = ITEM_MAP[item.t];
  if (!tpl) return 'Vật phẩm lạ';
  let n = tpl.name;
  if (item.upg > 0) n += ` +${item.upg}`;
  return n;
}

export function itemPrice(item) {
  const tpl = ITEM_MAP[item.t];
  if (!tpl) return 1;
  if (tpl.kind === 'use') return tpl.price || 10;
  const lv = Math.max(1, item.lv || 1);
  const rar = RARITY[item.rar] || RARITY[0];
  return Math.round((40 + lv * 26 + (item.upg || 0) * 90) * rar.mult);
}

// Tên hiển thị đầy đủ (kèm phẩm chất)
export function itemFullLabel(item) {
  const rar = rarityOf(item);
  return { text: itemName(item), color: rar.color, rarity: rar.name };
}

export const EQUIP_DROP_POOL = ITEMS.filter((i) => i.kind === 'equip').map((i) => i.id);
export const POTION_IDS = ITEMS.filter((i) => i.kind === 'use').map((i) => i.id);
