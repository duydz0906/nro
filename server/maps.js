// Định nghĩa & sinh bản đồ (thuật toán sinh cố định theo seed, không cần file asset)
import { T, TILE, isBlocked } from '../shared/tiles.js';
import { mulberry32, randInt, rand, pick, chance } from './util.js';

class MapBuilder {
  constructor(w, h, base) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h).fill(base);
  }
  idx(x, y) {
    return y * this.w + x;
  }
  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  set(x, y, t) {
    if (this.inside(x, y)) this.tiles[this.idx(x, y)] = t;
  }
  get(x, y) {
    return this.inside(x, y) ? this.tiles[this.idx(x, y)] : T.ROCK;
  }
  rect(x0, y0, w, h, t) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, t);
  }
  frame(x0, y0, w, h, t) {
    for (let x = x0; x < x0 + w; x++) {
      this.set(x, y0, t);
      this.set(x, y0 + h - 1, t);
    }
    for (let y = y0; y < y0 + h; y++) {
      this.set(x0, y, t);
      this.set(x0 + w - 1, y, t);
    }
  }
  disc(cx, cy, r, t) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, t);
  }
  line(x0, y0, x1, y1, t, width = 2) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) + 1;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      this.disc(Math.round(x), Math.round(y), width / 2, t);
    }
  }
  // Rải vật cản ngẫu nhiên, tránh các vùng cần trống
  scatter(rng, count, tile, avoid = []) {
    let placed = 0,
      guard = 0;
    while (placed < count && guard++ < count * 30) {
      const x = randInt(rng, 2, this.w - 3);
      const y = randInt(rng, 2, this.h - 3);
      if (avoid.some((a) => (x - a.x) ** 2 + (y - a.y) ** 2 < a.r * a.r)) continue;
      if (this.get(x, y) !== T.GRASS && this.get(x, y) !== T.SAND && this.get(x, y) !== T.SNOW && this.get(x, y) !== T.STONE) continue;
      // Rải theo cụm cho tự nhiên
      const cluster = randInt(rng, 1, 3);
      for (let k = 0; k < cluster; k++) {
        const ox = x + randInt(rng, 0, 1);
        const oy = y + randInt(rng, 0, 1);
        if (avoid.some((a) => (ox - a.x) ** 2 + (oy - a.y) ** 2 < a.r * a.r)) continue;
        this.set(ox, oy, tile);
      }
      placed++;
    }
  }
  clearArea(x, y, r, t) {
    const base = t ?? this.get(x, y);
    const walk = isBlocked(base) ? T.GRASS : base;
    this.disc(x, y, r, walk);
  }
}

function house(b, x, y, w, h) {
  b.rect(x, y, w, h, T.ROOF);
  b.rect(x + 1, y + 1, w - 2, h - 2, T.FLOOR);
  b.set(x + (w >> 1), y + h - 1, T.FLOOR); // cửa
}

export const MAPS = [
  {
    id: 0,
    key: 'lang-khoi-nguyen',
    name: 'Làng Khởi Nguyên',
    w: 46,
    h: 32,
    base: T.GRASS,
    safe: true,
    pvp: false,
    ambient: 'village',
    start: { x: 23 * TILE, y: 22 * TILE },
    npcs: [
      { x: 20 * TILE, y: 16 * TILE, type: 'shop', name: 'Lão Thương Nhân' },
      { x: 27 * TILE, y: 16 * TILE, type: 'smith', name: 'Thiết Tượng Rèn Đúc' },
      { x: 23 * TILE, y: 12 * TILE, type: 'elder', name: 'Trưởng Lão' },
    ],
    portals: [{ x: 44, y: 20, to: 1, tox: 3, toy: 20, label: 'Đồng Hoang' }],
    spawns: [],
    build(rng, b) {
      // Đường chính
      b.line(4, 20, 44, 20, T.PATH, 4);
      b.line(23, 6, 23, 27, T.PATH, 4);
      b.disc(23, 20, 5, T.PATH);
      // Nhà dân
      house(b, 8, 10, 7, 6);
      house(b, 8, 22, 7, 6);
      house(b, 31, 9, 8, 7);
      house(b, 32, 22, 7, 6);
      house(b, 19, 4, 9, 5);
      // Hàng rào + cây
      for (let i = 0; i < 60; i++) {
        const x = randInt(rng, 2, b.w - 3);
        const y = randInt(rng, 2, b.h - 3);
        if (b.get(x, y) === T.GRASS && Math.hypot(x - 23, y - 20) > 12) b.set(x, y, T.TREE);
      }
      // Hồ nước nhỏ
      b.disc(10, 17, 3.4, T.WATER);
      b.line(13, 17, 20, 16, T.PATH, 2);
      // Hoa trang trí
      for (let i = 0; i < 70; i++) {
        const x = randInt(rng, 3, b.w - 4);
        const y = randInt(rng, 3, b.h - 4);
        if (b.get(x, y) === T.GRASS) b.set(x, y, T.FLOWER);
      }
      b.frame(0, 0, b.w, b.h, T.ROCK);
      b.frame(1, 1, b.w - 2, b.h - 2, T.ROCK);
    },
  },
  {
    id: 1,
    key: 'dong-hoang',
    name: 'Đồng Hoang',
    w: 58,
    h: 42,
    base: T.GRASS,
    ambient: 'plain',
    start: { x: 4 * TILE, y: 21 * TILE },
    npcs: [{ x: 6 * TILE, y: 21 * TILE, type: 'healer', name: 'Dược Đồng' }],
    portals: [
      { x: 2, y: 21, to: 0, tox: 42, toy: 20, label: 'Làng Khởi Nguyên' },
      { x: 55, y: 21, to: 2, tox: 4, toy: 21, label: 'Rừng Trúc' },
    ],
    spawns: [
      { x: 16 * TILE, y: 14 * TILE, r: 190, ids: ['soi-xam', 'da-tru'], max: 9, respawn: 4200 },
      { x: 30 * TILE, y: 24 * TILE, r: 210, ids: ['soi-xam', 'da-tru', 'cao-ho-ly'], max: 10, respawn: 4200 },
      { x: 44 * TILE, y: 14 * TILE, r: 190, ids: ['da-tru', 'cao-ho-ly'], max: 9, respawn: 4200 },
      { x: 49 * TILE, y: 33 * TILE, r: 120, ids: ['ho-vuong'], max: 1, respawn: 90000 },
    ],
    build(rng, b) {
      b.line(3, 21, 55, 21, T.PATH, 3);
      b.scatter(rng, 40, T.TREE, [
        { x: 4, y: 21, r: 6 },
        { x: 54, y: 21, r: 6 },
      ]);
      b.scatter(rng, 26, T.BUSH, []);
      for (let i = 0; i < 120; i++) {
        const x = randInt(rng, 3, b.w - 4);
        const y = randInt(rng, 3, b.h - 4);
        if (b.get(x, y) === T.GRASS) b.set(x, y, T.FLOWER);
      }
      // Ao nước
      b.disc(24, 33, 4.5, T.WATER);
      b.disc(38, 10, 3.2, T.WATER);
      b.frame(0, 0, b.w, b.h, T.TREE);
      b.frame(1, 1, b.w - 2, b.h - 2, T.TREE);
    },
  },
  {
    id: 2,
    key: 'rung-truc',
    name: 'Rừng Trúc',
    w: 58,
    h: 44,
    base: T.GRASS,
    ambient: 'forest',
    start: { x: 5 * TILE, y: 22 * TILE },
    npcs: [],
    portals: [
      { x: 3, y: 22, to: 1, tox: 53, toy: 21, label: 'Đồng Hoang' },
      { x: 54, y: 8, to: 3, tox: 5, toy: 20, label: 'Hang Sơn' },
    ],
    spawns: [
      { x: 18 * TILE, y: 16 * TILE, r: 200, ids: ['cao-ho-ly', 'ran-ho-mang'], max: 10, respawn: 4200 },
      { x: 34 * TILE, y: 28 * TILE, r: 210, ids: ['ran-ho-mang', 'khi-da'], max: 11, respawn: 4200 },
      { x: 46 * TILE, y: 18 * TILE, r: 200, ids: ['khi-da', 'cao-ho-ly'], max: 10, respawn: 4200 },
      { x: 30 * TILE, y: 8 * TILE, r: 110, ids: ['ho-ly-vuong'], max: 1, respawn: 110000 },
    ],
    build(rng, b) {
      b.line(4, 22, 52, 22, T.PATH, 3);
      b.line(50, 22, 53, 9, T.PATH, 3);
      b.scatter(rng, 150, T.BAMBOO, [
        { x: 5, y: 22, r: 7 },
        { x: 54, y: 9, r: 6 },
      ]);
      b.scatter(rng, 30, T.TREE, []);
      b.disc(20, 34, 4, T.WATER);
      b.frame(0, 0, b.w, b.h, T.BAMBOO);
      b.frame(1, 1, b.w - 2, b.h - 2, T.BAMBOO);
      b.frame(2, 2, b.w - 4, b.h - 4, T.BAMBOO);
    },
  },
  {
    id: 3,
    key: 'hang-son',
    name: 'Hang Sơn',
    w: 50,
    h: 40,
    base: T.STONE,
    ambient: 'cave',
    start: { x: 6 * TILE, y: 20 * TILE },
    npcs: [],
    portals: [
      { x: 4, y: 20, to: 2, tox: 52, toy: 9, label: 'Rừng Trúc' },
      { x: 45, y: 20, to: 4, tox: 5, toy: 22, label: 'Đỉnh Tuyết Sơn' },
    ],
    spawns: [
      { x: 20 * TILE, y: 14 * TILE, r: 190, ids: ['khi-da', 'u-minh-lang'], max: 10, respawn: 4200 },
      { x: 32 * TILE, y: 26 * TILE, r: 200, ids: ['u-minh-lang', 'thiet-giap-te'], max: 10, respawn: 4200 },
      { x: 40 * TILE, y: 10 * TILE, r: 170, ids: ['hoa-diep-diep', 'thiet-giap-te'], max: 9, respawn: 4200 },
      { x: 25 * TILE, y: 32 * TILE, r: 110, ids: ['thach-ma-vuong'], max: 1, respawn: 130000 },
    ],
    build(rng, b) {
      b.line(5, 20, 45, 20, T.PATH, 3);
      b.line(25, 8, 25, 32, T.PATH, 3);
      b.scatter(rng, 70, T.ROCK, [
        { x: 6, y: 20, r: 6 },
        { x: 44, y: 20, r: 6 },
      ]);
      for (let i = 0; i < 22; i++) {
        const x = randInt(rng, 5, b.w - 6);
        const y = randInt(rng, 5, b.h - 6);
        if (b.get(x, y) === T.STONE) b.disc(x, y, rand(rng, 1.4, 2.6), T.CRYSTAL);
      }
      for (let i = 0; i < 10; i++) {
        const x = randInt(rng, 5, b.w - 6);
        const y = randInt(rng, 5, b.h - 6);
        if (b.get(x, y) === T.STONE) b.disc(x, y, rand(rng, 1.2, 2.2), T.LAVA);
      }
      b.frame(0, 0, b.w, b.h, T.ROCK);
      b.frame(1, 1, b.w - 2, b.h - 2, T.ROCK);
    },
  },
  {
    id: 4,
    key: 'dinh-tuyet-son',
    name: 'Đỉnh Tuyết Sơn',
    w: 58,
    h: 44,
    base: T.SNOW,
    ambient: 'snow',
    start: { x: 6 * TILE, y: 22 * TILE },
    npcs: [],
    portals: [
      { x: 4, y: 22, to: 3, tox: 43, toy: 20, label: 'Hang Sơn' },
      { x: 53, y: 22, to: 5, tox: 6, toy: 15, label: 'Đấu Trường' },
    ],
    spawns: [
      { x: 20 * TILE, y: 16 * TILE, r: 200, ids: ['bang-tuong', 'hoa-linh'], max: 10, respawn: 4200 },
      { x: 36 * TILE, y: 28 * TILE, r: 200, ids: ['hoa-linh', 'thach-nhan'], max: 10, respawn: 4200 },
      { x: 46 * TILE, y: 12 * TILE, r: 175, ids: ['thach-nhan', 'bang-tuong'], max: 10, respawn: 4200 },
      { x: 30 * TILE, y: 8 * TILE, r: 110, ids: ['tuyet-son-lao-quai'], max: 1, respawn: 180000 },
    ],
    build(rng, b) {
      b.line(5, 22, 53, 22, T.PATH, 3);
      b.scatter(rng, 45, T.ROCK, [
        { x: 6, y: 22, r: 6 },
        { x: 52, y: 22, r: 6 },
      ]);
      b.scatter(rng, 20, T.TREE, []);
      for (let i = 0; i < 26; i++) {
        const x = randInt(rng, 4, b.w - 5);
        const y = randInt(rng, 4, b.h - 5);
        if (b.get(x, y) === T.SNOW) b.disc(x, y, rand(rng, 1.5, 3.2), T.ICE);
      }
      b.frame(0, 0, b.w, b.h, T.ROCK);
      b.frame(1, 1, b.w - 2, b.h - 2, T.ROCK);
    },
  },
  {
    id: 5,
    key: 'dau-truong',
    name: 'Đấu Trường',
    w: 40,
    h: 30,
    base: T.STONE,
    ambient: 'arena',
    pvp: true,
    start: { x: 20 * TILE, y: 22 * TILE },
    npcs: [{ x: 20 * TILE, y: 26 * TILE, type: 'healer', name: 'Y Quan' }],
    portals: [{ x: 4, y: 15, to: 4, tox: 51, toy: 22, label: 'Đỉnh Tuyết Sơn' }],
    spawns: [],
    build(rng, b) {
      b.disc(20, 15, 13, T.FLOOR);
      b.disc(20, 15, 12.2, T.FLOOR);
      b.frame(0, 0, b.w, b.h, T.WALL);
      // Cột trụ
      for (const [x, y] of [[9, 8], [30, 8], [9, 22], [30, 22], [20, 5]]) b.disc(x, y, 1.6, T.ROCK);
      b.line(20, 24, 20, 27, T.PATH, 3);
      b.line(5, 15, 9, 15, T.PATH, 3);
    },
  },
];

export const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]));

// Sinh toàn bộ bản đồ khi khởi động server
export function buildAllMaps() {
  const out = {};
  for (const def of MAPS) {
    const rng = mulberry32(1337 + def.id * 7919);
    const b = new MapBuilder(def.w, def.h, def.base);
    def.build(rng, b);

    // Đặt cổng dịch chuyển + dọn chỗ trống xung quanh
    const portals = def.portals.map((p) => {
      const px = p.x,
        py = p.y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) b.set(px + dx, py + dy, T.PORTAL);
      b.clearArea(px, py, 3, T.PATH);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) b.set(px + dx, py + dy, T.PORTAL);
      return { x: px * TILE + TILE / 2, y: py * TILE + TILE / 2, tileX: px, tileY: py, to: p.to, tox: p.tox * TILE + TILE / 2, toy: p.toy * TILE + TILE / 2, label: p.label };
    });

    // Vùng NPC & điểm hồi sinh luôn trống
    const avoid = [];
    for (const n of def.npcs) {
      b.clearArea(Math.round(n.x / TILE), Math.round(n.y / TILE), 3, T.PATH);
      avoid.push({ x: Math.round(n.x / TILE), y: Math.round(n.y / TILE), r: 3 });
    }
    for (const s of def.spawns) b.clearArea(Math.round(s.x / TILE), Math.round(s.y / TILE), 3);
    b.clearArea(Math.round(def.start.x / TILE), Math.round(def.start.y / TILE), 3);

    out[def.id] = {
      id: def.id,
      key: def.key,
      name: def.name,
      w: def.w,
      h: def.h,
      tiles: b.tiles,
      portals,
      npcs: def.npcs,
      spawns: def.spawns,
      start: def.start,
      safe: !!def.safe,
      pvp: !!def.pvp,
      ambient: def.ambient,
      base: def.base,
    };
  }
  return out;
}

// Nén bản đồ dạng RLE để gửi cho client
export function encodeTiles(tiles) {
  const parts = [];
  let run = 1;
  for (let i = 1; i <= tiles.length; i++) {
    if (i < tiles.length && tiles[i] === tiles[i - 1]) {
      run++;
      continue;
    }
    parts.push(run > 1 ? `${tiles[i - 1]}x${run}` : `${tiles[i - 1]}`);
    run = 1;
  }
  return parts.join(',');
}
