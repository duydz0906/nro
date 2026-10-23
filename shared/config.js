// Hằng số cân bằng game (dùng chung server + client)
export const TICK_MS = 50; // 20 tick/giây
export const SNAPSHOT_MS = 60;
export const TILE = 32;

export const MAX_LEVEL = 60;
export const INV_SIZE = 32;
export const MAX_STACK = 99;

// Công thức chỉ số người chơi
export const calcMaxHp = (lv, vit, bonus = 0) => 150 + lv * 20 + vit * 12 + bonus;
export const calcMaxKi = (lv, int, bonus = 0) => 80 + lv * 8 + int * 10 + bonus;
export const calcAtk = (lv, str, bonus = 0) => Math.round(10 + lv * 2.5 + str * 3.2 + bonus);
export const calcDef = (lv, vit, bonus = 0) => Math.round(4 + lv * 1.2 + vit * 1.8 + bonus);
export const calcCrit = (agi, bonus = 0) => Math.min(0.6, 0.04 + agi * 0.006 + bonus / 100);
export const calcSpeed = (agi, bonus = 0) => Math.min(300, 150 + agi * 2 + bonus);
export const calcMagic = (atk, int) => Math.round(atk * 0.6 + int * 2.4);

// Sát thương
export const calcDamage = (power, def) => Math.max(1, power - def * 0.5);

// Kinh nghiệm cần để lên cấp tiếp theo
export const xpForLevel = (lv) => Math.round(60 * Math.pow(lv, 1.5) + 30 * lv);

export const STAT_POINTS_PER_LEVEL = 3;

export const PICKUP_RANGE = 34;
export const DROP_LIFETIME = 90000;
export const RESPAWN_DELAY = 5000;
