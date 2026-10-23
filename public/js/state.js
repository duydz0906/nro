// Trạng thái game phía client
import { TILE, isBlocked } from '/shared/tiles.js';

export const G = {
  net: null,
  inGame: false,
  id: 0,
  self: null,
  map: null,
  mapArt: null,
  me: { x: 0, y: 0, dir: 0, state: 'idle', animT: 0, anim: 0, shield: 0 },
  players: new Map(),
  monsters: new Map(),
  drops: new Map(),
  projs: new Map(),
  fx: [],
  floaters: [],
  particles: [],
  target: 0,
  cam: { x: 0, y: 0 },
  view: { w: 960, h: 600 },
  keys: {},
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },
  time: 0,
  lastAtk: 0,
  npcNear: null,
  dead: false,
  deadUntil: 0,
  ping: 0,
  online: 1,
  auth: null,
};

export function tileAt(map, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (!map || tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return 7;
  return map.tiles[ty * map.w + tx];
}

export function collides(map, x, y, r) {
  if (!map) return true;
  const pts = [
    [x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r],
    [x, y - r], [x, y + r], [x - r, y], [x + r, y],
  ];
  for (const [px, py] of pts) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
    if (isBlocked(map.tiles[ty * map.w + tx])) return true;
  }
  return false;
}

export function moveEntity(e, dx, dy, r, map) {
  const nx = e.x + dx;
  if (!collides(map, nx, e.y, r)) e.x = nx;
  const ny = e.y + dy;
  if (!collides(map, e.x, ny, r)) e.y = ny;
  e.x = Math.max(TILE * 0.9, Math.min(map.w * TILE - TILE * 0.9, e.x));
  e.y = Math.max(TILE * 0.9, Math.min(map.h * TILE - TILE * 0.9, e.y));
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx,
    dy = ay - by;
  return dx * dx + dy * dy;
}

export function decodeTiles(str) {
  const out = [];
  for (const part of str.split(',')) {
    if (!part) continue;
    const [v, n] = part.split('x');
    const val = parseInt(v);
    const count = n ? parseInt(n) : 1;
    for (let i = 0; i < count; i++) out.push(val);
  }
  return Uint8Array.from(out);
}
