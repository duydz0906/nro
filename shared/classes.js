// Bốn môn phái + kỹ năng (dùng chung server + client)

export const STAT_KEYS = ['str', 'agi', 'vit', 'int'];
export const STAT_NAME = {
  str: 'Sức Mạnh',
  agi: 'Thân Pháp',
  vit: 'Thể Chất',
  int: 'Linh Lực',
};
export const STAT_DESC = {
  str: '+3.2 công vật lý mỗi điểm',
  agi: '+1.5% chí mạng, +2 tốc chạy, đánh nhanh hơn',
  vit: '+12 sinh lực, +1.8 thủ mỗi điểm',
  int: '+10 linh lực, tăng sát thương phép',
};

// type: melee | proj | aoe | heal | buff | dash
const S = (o) => ({ cd: 2500, ki: 10, mult: 1, range: 400, color: '#9be7ff', ...o });

export const SKILLS = [
  // ---- Kiếm Tu ----
  S({ id: 'kiem_tramphong', cls: 'kiemtu', name: 'Trảm Phong', icon: '⚔', type: 'melee', ki: 12, cd: 2400, mult: 2.3, range: 120, arc: 1.9, color: '#ffb37a', desc: 'Vung kiếm quét cung rộng, gây 230% công vật lý lên mọi kẻ địch phía trước.' }),
  S({ id: 'kiem_khikhi', cls: 'kiemtu', name: 'Kiếm Khí Tung Hoành', icon: '🗡', type: 'proj', ki: 16, cd: 3200, mult: 2.5, range: 620, speed: 560, radius: 18, pierce: 2, color: '#9be7ff', desc: 'Bắn một đạo kiếm khí xuyên qua 2 mục tiêu, gây 250% công vật lý.' }),
  S({ id: 'kiem_kimcuong', cls: 'kiemtu', name: 'Kim Cang Bất Hoại', icon: '🛡', type: 'buff', ki: 25, cd: 24000, dur: 12000, buff: { def: 0.6, shield: 0.5 }, color: '#ffe08a', desc: 'Tăng 60% thủ và nhận khiên bằng 50% sinh lực tối đa trong 12 giây.' }),

  // ---- Pháp Tu ----
  S({ id: 'phap_hoacau', cls: 'phaptu', name: 'Hỏa Cầu Thuật', icon: '🔥', type: 'proj', ki: 10, cd: 1600, mult: 2.1, range: 560, speed: 520, radius: 16, magic: true, color: '#ff8a4c', desc: 'Bắn cầu lửa gây 210% sát thương phép.' }),
  S({ id: 'phap_bangphong', cls: 'phaptu', name: 'Băng Phong Trận', icon: '❄', type: 'aoe', ki: 22, cd: 6000, mult: 1.9, range: 520, radius: 130, delay: 500, magic: true, slow: 0.45, slowDur: 3000, color: '#8fd8ff', desc: 'Triệu hồi vùng băng bão, gây 190% sát thương phép và làm chậm 45% trong 3 giây.' }),
  S({ id: 'phap_loikiep', cls: 'phaptu', name: 'Lôi Kiếp', icon: '⚡', type: 'aoe', ki: 38, cd: 14000, mult: 3.6, range: 560, radius: 165, delay: 900, magic: true, color: '#ffe066', desc: 'Sét giáng xuống một vùng, gây 360% sát thương phép sau 0.9 giây.' }),

  // ---- Linh Y ----
  S({ id: 'y_hoixuan', cls: 'linhy', name: 'Hồi Xuân Thuật', icon: '🌿', type: 'heal', ki: 14, cd: 2200, healPct: 0.34, healFlat: 60, range: 420, color: '#7cf0a8', desc: 'Hồi 34% sinh lực tối đa (+60) cho bản thân hoặc đồng đội được chọn.' }),
  S({ id: 'y_tinhtam', cls: 'linhy', name: 'Tịnh Tâm Chú', icon: '✨', type: 'aoe', ki: 30, cd: 12000, radius: 180, delay: 400, healPct: 0.26, healFlat: 40, ally: true, magic: false, color: '#b8ffd9', desc: 'Tạo vùng linh khí hồi 26% sinh lực cho mọi người chơi trong vùng.' }),
  S({ id: 'y_linhquang', cls: 'linhy', name: 'Linh Quang Hộ Thể', icon: '🔆', type: 'buff', ki: 26, cd: 20000, dur: 10000, buff: { shield: 0.7, atk: 0.25 }, color: '#fff2a8', desc: 'Tạo khiên 70% sinh lực tối đa và tăng 25% công trong 10 giây.' }),

  // ---- Ẩn Tu ----
  S({ id: 'an_anhtram', cls: 'antu', name: 'Ảnh Trảm', icon: '🌑', type: 'dash', ki: 14, cd: 3400, mult: 2.2, range: 260, radius: 90, color: '#c79bff', desc: 'Lướt tới điểm chỉ định, gây 220% công vật lý lên kẻ địch trên đường đi.' }),
  S({ id: 'an_docnhan', cls: 'antu', name: 'Độc Nhận', icon: '☠', type: 'proj', ki: 12, cd: 2600, mult: 1.3, range: 540, speed: 600, radius: 14, poison: 0.35, poisonDur: 5000, color: '#a6e22e', desc: 'Phi độc nhận gây 130% công và trúng độc (35% công mỗi 1.5 giây, 5 giây).' }),
  S({ id: 'an_baoanh', cls: 'antu', name: 'Bạo Ảnh Kích', icon: '💥', type: 'melee', ki: 30, cd: 13000, mult: 4.2, range: 110, arc: 2.4, crit: 0.5, color: '#ff7ad9', desc: 'Đòn kết liễu: 420% công vật lý, +50% tỷ lệ chí mạng.' }),
];

export const SKILL_MAP = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export const CLASSES = [
  {
    id: 1,
    key: 'kiemtu',
    name: 'Kiếm Tu',
    color: '#ff7a59',
    hair: '#2b1c14',
    icon: '⚔',
    role: 'Cận chiến – Đỡ đòn',
    weapon: 'sword',
    base: { str: 14, agi: 8, vit: 12, int: 6 },
    skills: ['kiem_tramphong', 'kiem_khikhi', 'kiem_kimcuong'],
    desc: 'Lấy kiếm làm đạo. Công thủ toàn diện, sống dai, hợp với người mới chơi.',
  },
  {
    id: 2,
    key: 'phaptu',
    name: 'Pháp Tu',
    color: '#6aa8ff',
    hair: '#1d2b52',
    icon: '🔥',
    role: 'Phép thuật – Diện rộng',
    weapon: 'staff',
    base: { str: 6, agi: 9, vit: 8, int: 16 },
    skills: ['phap_hoacau', 'phap_bangphong', 'phap_loikiep'],
    desc: 'Điều khiển hỏa, băng, lôi. Sát thương diện rộng khủng khiếp nhưng máu giấy.',
  },
  {
    id: 3,
    key: 'linhy',
    name: 'Linh Y',
    color: '#58d68d',
    hair: '#27402c',
    icon: '🌿',
    role: 'Hỗ trợ – Hồi phục',
    weapon: 'fan',
    base: { str: 7, agi: 8, vit: 10, int: 14 },
    skills: ['y_hoixuan', 'y_tinhtam', 'y_linhquang'],
    desc: 'Cứu người độ thế. Vừa hồi máu vừa tạo khiên, rất được săn đón khi đi cùng.',
  },
  {
    id: 4,
    key: 'antu',
    name: 'Ẩn Tu',
    color: '#b98cff',
    hair: '#2a1f3d',
    icon: '🌑',
    role: 'Đột kích – Chí mạng',
    weapon: 'dagger',
    base: { str: 11, agi: 15, vit: 8, int: 6 },
    skills: ['an_anhtram', 'an_docnhan', 'an_baoanh'],
    desc: 'Ra tay nhanh như bóng câu. Chí mạng cao, cơ động bậc nhất, đánh chớp nhoáng.',
  },
];

export const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.key, c]));
export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
