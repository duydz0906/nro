// Vẽ toàn bộ bằng Canvas 2D — không dùng bất kỳ tài nguyên hình ảnh bên ngoài
import { T, TILE } from '/shared/tiles.js';
import { CLASS_MAP } from '/shared/classes.js';
import { MONSTER_MAP } from '/shared/monsters.js';
import { ITEM_MAP } from '/shared/items.js';

export function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}
const rnd = (x, y, a, b) => a + hash2(x, y) * (b - a);

// ---------------- Bản đồ tĩnh ----------------
export function makeMapCanvas(map) {
  const cv = document.createElement('canvas');
  cv.width = map.w * TILE;
  cv.height = map.h * TILE;
  const ctx = cv.getContext('2d');
  const anim = [];
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      const t = map.tiles[ty * map.w + tx];
      drawTileBase(ctx, t, tx * TILE, ty * TILE, tx, ty);
      if (t === T.WATER || t === T.LAVA || t === T.PORTAL || t === T.CRYSTAL) anim.push({ t, tx, ty });
    }
  }
  return { canvas: cv, anim };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawTileBase(ctx, t, px, py, tx, ty) {
  const v = hash2(tx, ty);
  switch (t) {
    case T.GRASS:
    case T.FLOWER: {
      const g = ctx.createLinearGradient(px, py, px, py + TILE);
      g.addColorStop(0, `hsl(${100 + v * 14}, ${28 + v * 8}%, ${26 + v * 6}%)`);
      g.addColorStop(1, `hsl(${100 + v * 14}, ${26 + v * 8}%, ${20 + v * 5}%)`);
      ctx.fillStyle = g;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const gx = px + rnd(tx * 7 + i, ty * 13, 3, 29);
        const gy = py + rnd(tx * 11, ty * 5 + i, 3, 29);
        ctx.beginPath();
        ctx.moveTo(gx, gy + 4);
        ctx.lineTo(gx - 1.5, gy - 2);
        ctx.moveTo(gx + 2, gy + 4);
        ctx.lineTo(gx + 3.5, gy - 1);
        ctx.strokeStyle = `rgba(${120 + v * 40},${190 + v * 40},${90},.35)`;
        ctx.stroke();
      }
      if (t === T.FLOWER) {
        ctx.fillStyle = ['#ffd166', '#ff8fa3', '#c78bff', '#fff'][Math.floor(v * 4)];
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.arc(px + rnd(tx + i, ty * 3, 6, 26), py + rnd(tx * 3, ty + i, 6, 26), 1.6, 0, 7);
          ctx.fill();
        }
      }
      break;
    }
    case T.PATH: {
      ctx.fillStyle = `hsl(${32 + v * 10}, ${26 + v * 6}%, ${38 + v * 6}%)`;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,.07)';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(px + rnd(tx * 3 + i, ty * 7, 2, 30), py + rnd(tx * 5, ty * 2 + i, 2, 30), 1 + v * 1.6, 0, 7);
        ctx.fill();
      }
      break;
    }
    case T.STONE: {
      ctx.fillStyle = `hsl(${210 + v * 12}, ${6 + v * 5}%, ${26 + v * 8}%)`;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      ctx.fillStyle = 'rgba(255,255,255,.045)';
      ctx.fillRect(px + 2, py + 2, TILE - 4, 3);
      if (v > 0.7) {
        ctx.strokeStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath();
        ctx.moveTo(px + 6, py + 8);
        ctx.lineTo(px + 20, py + 22);
        ctx.stroke();
      }
      break;
    }
    case T.WATER: {
      ctx.fillStyle = '#1d5a8c';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.fillRect(px, py, TILE, 6);
      break;
    }
    case T.TREE: {
      drawTileBase(ctx, T.GRASS, px, py, tx, ty);
      ctx.fillStyle = '#4a3524';
      ctx.fillRect(px + TILE / 2 - 3, py + TILE / 2 + 2, 6, 10);
      const shades = ['#2f5d2c', '#376b31', '#285026'];
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(px + TILE / 2 + (i - 1) * 5, py + TILE / 2 - 4 + (i === 1 ? -4 : 2), 9 - i, 0, 7);
        ctx.fillStyle = shades[i % 3];
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.beginPath();
      ctx.arc(px + TILE / 2 - 3, py + TILE / 2 - 8, 4, 0, 7);
      ctx.fill();
      break;
    }
    case T.BAMBOO: {
      drawTileBase(ctx, T.GRASS, px, py, tx, ty);
      ctx.fillStyle = '#6f9e3f';
      for (let i = 0; i < 3; i++) {
        const bx = px + 6 + i * 9 + v * 3;
        ctx.fillRect(bx, py + 2, 4, TILE - 4);
        ctx.fillStyle = i % 2 ? '#5c8a34' : '#7cb14a';
      }
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 6 + i * 9 + v * 3, py + 2, 1.4, TILE - 4);
      break;
    }
    case T.SAND: {
      ctx.fillStyle = `hsl(${40 + v * 8}, ${34 + v * 8}%, ${52 + v * 6}%)`;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,.05)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(px + rnd(tx + i, ty * 9, 3, 29), py + rnd(tx * 9, ty + i, 3, 29), 1.2, 0, 7);
        ctx.fill();
      }
      break;
    }
    case T.SNOW: {
      ctx.fillStyle = `hsl(${205 + v * 10}, ${18 + v * 8}%, ${76 + v * 8}%)`;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(px + rnd(tx * 2 + i, ty * 6, 3, 29), py + rnd(tx * 6, ty * 2 + i, 3, 29), 1, 0, 7);
        ctx.fill();
      }
      break;
    }
    case T.ICE: {
      ctx.fillStyle = '#9fd2ef';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px + 4, py + TILE - 6);
      ctx.lineTo(px + TILE / 2, py + 6);
      ctx.lineTo(px + TILE - 5, py + TILE - 8);
      ctx.stroke();
      break;
    }
    case T.ROCK: {
      drawTileBase(ctx, T.GRASS, px, py, tx, ty);
      ctx.fillStyle = `hsl(${205 + v * 20}, 6%, ${34 + v * 8}%)`;
      ctx.beginPath();
      ctx.moveTo(px + 4, py + TILE - 4);
      ctx.lineTo(px + 9, py + 9);
      ctx.lineTo(px + TILE / 2, py + 4);
      ctx.lineTo(px + TILE - 7, py + 11);
      ctx.lineTo(px + TILE - 3, py + TILE - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      ctx.beginPath();
      ctx.moveTo(px + 9, py + 9);
      ctx.lineTo(px + TILE / 2, py + 4);
      ctx.lineTo(px + TILE / 2 - 3, py + 12);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case T.FLOOR: {
      ctx.fillStyle = `hsl(${28 + v * 8}, ${22 + v * 6}%, ${30 + v * 6}%)`;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py + TILE / 2);
      ctx.lineTo(px + TILE, py + TILE / 2);
      ctx.stroke();
      break;
    }
    case T.WALL: {
      ctx.fillStyle = `hsl(${25 + v * 8}, 12%, ${26 + v * 6}%)`;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fillRect(px + 2, py + 2, TILE - 4, 2);
      break;
    }
    case T.ROOF: {
      ctx.fillStyle = '#7a3b2e';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      for (let i = 0; i < 4; i++) ctx.fillRect(px, py + i * 8 + 2, TILE, 2);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(px, py + 2, TILE, 3);
      break;
    }
    case T.LAVA: {
      ctx.fillStyle = '#5a1a0c';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#ff6a2b';
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      break;
    }
    case T.BRIDGE: {
      ctx.fillStyle = '#6b5136';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath();
      ctx.moveTo(px, py + 10);
      ctx.lineTo(px + TILE, py + 10);
      ctx.moveTo(px, py + 22);
      ctx.lineTo(px + TILE, py + 22);
      ctx.stroke();
      break;
    }
    case T.BUSH: {
      drawTileBase(ctx, T.GRASS, px, py, tx, ty);
      ctx.fillStyle = '#2c5a2a';
      ctx.beginPath();
      ctx.arc(px + TILE / 2 - 5, py + TILE / 2 + 2, 7, 0, 7);
      ctx.arc(px + TILE / 2 + 5, py + TILE / 2 + 2, 7, 0, 7);
      ctx.arc(px + TILE / 2, py + TILE / 2 - 3, 8, 0, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.beginPath();
      ctx.arc(px + TILE / 2 - 2, py + TILE / 2 - 5, 4, 0, 7);
      ctx.fill();
      break;
    }
    case T.PORTAL: {
      ctx.fillStyle = '#2a2438';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(180,140,255,.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
      break;
    }
    case T.CRYSTAL: {
      drawTileBase(ctx, T.STONE, px, py, tx, ty);
      ctx.fillStyle = '#7fd7ff';
      ctx.beginPath();
      ctx.moveTo(px + TILE / 2, py + 3);
      ctx.lineTo(px + TILE - 6, py + TILE / 2);
      ctx.lineTo(px + TILE / 2, py + TILE - 4);
      ctx.lineTo(px + 6, py + TILE / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath();
      ctx.moveTo(px + TILE / 2, py + 3);
      ctx.lineTo(px + TILE / 2 - 3, py + TILE / 2);
      ctx.lineTo(px + TILE / 2, py + TILE - 6);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default:
      ctx.fillStyle = '#222';
      ctx.fillRect(px, py, TILE, TILE);
  }
}

// Ô động (nước, dung nham, cổng) vẽ lại mỗi khung hình
export function drawAnimatedTile(ctx, a, time) {
  const px = a.tx * TILE,
    py = a.ty * TILE;
  if (a.t === T.WATER) {
    ctx.fillStyle = '#1d5a8c';
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = 'rgba(160,220,255,.35)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 2; i++) {
      const off = ((time * 26 + a.tx * 11 + a.ty * 7 + i * 17) % 34) - 6;
      ctx.beginPath();
      ctx.moveTo(px + 3, py + off);
      ctx.quadraticCurveTo(px + TILE / 2, py + off + 3, px + TILE - 3, py + off);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.fillRect(px, py, TILE, 4);
  } else if (a.t === T.LAVA) {
    const p = 0.5 + 0.5 * Math.sin(time * 2 + a.tx + a.ty);
    ctx.fillStyle = `rgb(${180 + p * 70},${60 + p * 50},20)`;
    ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = 'rgba(255,220,120,.55)';
    ctx.beginPath();
    ctx.arc(px + TILE / 2 + Math.sin(time * 1.3 + a.tx) * 4, py + TILE / 2 + Math.cos(time * 1.1 + a.ty) * 4, 4 + p * 3, 0, 7);
    ctx.fill();
  } else if (a.t === T.PORTAL) {
    const cx = px + TILE / 2,
      cy = py + TILE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 3; i++) {
      const r = 4 + i * 3.5 + Math.sin(time * 2.4 + i) * 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, r, time * (1.4 + i * 0.6), time * (1.4 + i * 0.6) + Math.PI * 1.35);
      ctx.strokeStyle = `hsla(${270 + i * 22}, 90%, ${62 + i * 6}%, ${0.75 - i * 0.16})`;
      ctx.lineWidth = 2.2 - i * 0.5;
      ctx.stroke();
    }
    ctx.restore();
  } else if (a.t === T.CRYSTAL) {
    const p = 0.5 + 0.5 * Math.sin(time * 1.6 + a.tx * 0.6 + a.ty);
    ctx.fillStyle = `rgba(127,215,255,${0.10 + p * 0.22})`;
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, 13, 0, 7);
    ctx.fill();
  }
}

// ---------------- Nhân vật ----------------
export function drawCharacter(ctx, o, time) {
  const cls = CLASS_MAP[o.cls] || CLASS_MAP.kiemtu;
  const moving = o.state === 'move';
  const tt = o.anim || 0;
  const legPhase = Math.sin(tt * (moving ? 11 : 2));
  const bob = moving ? Math.abs(Math.sin(tt * 11)) * 2.4 : Math.sin(tt * 2) * 0.8;
  const flip = Math.cos(o.dir) < 0;
  const attacking = o.state === 'attack';
  const swing = attacking ? 1 - Math.min(1, (o.animT || 0) / 0.3) : 0;

  ctx.save();
  ctx.translate(o.x, o.y);

  // Bóng
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 11, 4.5, 0, 0, 7);
  ctx.fill();

  // Khiên / buff
  if (o.shield > 0) {
    ctx.strokeStyle = 'rgba(255,230,150,.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -20, 17, 24, 0, 0, 7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,230,150,.10)';
    ctx.fill();
  }
  if (o.buffed) {
    ctx.fillStyle = 'rgba(255,215,120,.13)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16 + Math.sin(time * 3) * 1.5, 8, 0, 0, 7);
    ctx.fill();
  }

  ctx.translate(0, -bob);
  if (o.dead) ctx.globalAlpha = 0.45;
  if (flip) ctx.scale(-1, 1);

  const robe = cls.color;
  const robeDark = shade(robe, -0.35);

  // Chân
  ctx.fillStyle = shade(robe, -0.55);
  ctx.fillRect(-6 + legPhase * 3, -12, 5, 12);
  ctx.fillRect(1 - legPhase * 3, -12, 5, 12);

  // Áo
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-8, -10);
  ctx.lineTo(8, -10);
  ctx.lineTo(10, -30);
  ctx.lineTo(-10, -30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = robeDark;
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(10, -30);
  ctx.lineTo(8, -10);
  ctx.lineTo(0, -10);
  ctx.closePath();
  ctx.fill();

  // Thắt lưng
  ctx.fillStyle = shade(robe, -0.7);
  ctx.fillRect(-8, -16, 16, 3);

  // Vạt áo bay
  if (moving) {
    ctx.fillStyle = robeDark;
    ctx.beginPath();
    ctx.moveTo(-9, -28);
    ctx.quadraticCurveTo(-16 - legPhase * 2, -20, -12, -8);
    ctx.lineTo(-6, -12);
    ctx.closePath();
    ctx.fill();
  }

  // Tay
  ctx.fillStyle = shade(robe, -0.25);
  ctx.fillRect(9, -29 + legPhase * 1.5, 4, 10);
  ctx.fillStyle = shade(robe, -0.4);
  ctx.fillRect(-13, -29 - legPhase * 1.5, 4, 10);

  // Đầu
  ctx.fillStyle = '#f0c39a';
  ctx.beginPath();
  ctx.arc(0, -37, 7, 0, 7);
  ctx.fill();
  // Tóc
  ctx.fillStyle = cls.hair;
  ctx.beginPath();
  ctx.arc(0, -38, 7.4, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-7.4, -39, 15, 3);
  // Mắt
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(1, -37, 1.8, 2.4);
  ctx.fillRect(4.2, -37, 1.8, 2.4);

  // Vũ khí
  ctx.save();
  ctx.translate(11, -22);
  ctx.rotate(attacking ? -1.3 + swing * 2.5 : -0.35 + legPhase * 0.06);
  drawWeapon(ctx, cls.weapon, robe);
  ctx.restore();

  ctx.restore();
}

function drawWeapon(ctx, kind, color) {
  switch (kind) {
    case 'sword':
      ctx.fillStyle = '#d8dde5';
      ctx.fillRect(-1.5, -18, 3, 22);
      ctx.fillStyle = '#8d939c';
      ctx.fillRect(-4, 2, 8, 2.5);
      ctx.fillStyle = '#7a5a2c';
      ctx.fillRect(-1.4, 4, 2.8, 7);
      break;
    case 'staff':
      ctx.fillStyle = '#8a6a3f';
      ctx.fillRect(-1.5, -20, 3, 30);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -22, 4.6, 0, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath();
      ctx.arc(-1.4, -23.4, 1.7, 0, 7);
      ctx.fill();
      break;
    case 'fan':
      ctx.fillStyle = '#f2e2c4';
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.arc(0, 4, 15, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#c0a476';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI * 0.85 + (i * Math.PI * 0.7) / 3;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(Math.cos(a) * 15, 4 + Math.sin(a) * 15);
        ctx.stroke();
      }
      break;
    case 'dagger':
      ctx.fillStyle = '#cfd6de';
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(2, 0);
      ctx.lineTo(0, -16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5d4a2a';
      ctx.fillRect(-3.5, -1, 7, 2);
      break;
  }
}

// ---------------- Quái vật ----------------
export function drawMonster(ctx, o, time, animT) {
  const tpl = MONSTER_MAP[o.tpl];
  if (!tpl) return;
  const s = (tpl.size || 1) * (o.scale || 1);
  const flip = Math.cos(o.dir) < 0;
  const moving = o.state === 'move';
  const ph = Math.sin((animT || 0) * (moving ? 10 : 2.2));
  const attacking = o.state === 'attack';

  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 14 * s, 5.5 * s, 0, 0, 7);
  ctx.fill();
  if (tpl.boss) {
    ctx.fillStyle = 'rgba(255,60,90,.10)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26 * s, 12 * s, 0, 0, 7);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(0, -2);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(s, s);
  if (o.hitFlash > 0) ctx.globalAlpha = 0.85;

  const P = tpl.palette;
  const body = o.hitFlash > 0 ? '#ffffff' : P.body;

  switch (tpl.shape) {
    case 'wolf':
    case 'fox':
      drawBeast(ctx, body, P.accent, P.eye, ph, moving, tpl.shape === 'fox');
      break;
    case 'boar':
      drawBeast(ctx, body, P.accent, P.eye, ph, moving, false, true);
      break;
    case 'elephant':
      drawElephant(ctx, body, P.accent, P.eye, ph);
      break;
    case 'snake':
      drawSnake(ctx, body, P.accent, P.eye, animT || 0);
      break;
    case 'bird':
      drawBird(ctx, body, P.accent, P.eye, animT || 0);
      break;
    case 'golem':
      drawGolem(ctx, body, P.accent, P.eye, ph, animT || 0);
      break;
    case 'ape':
    case 'yeti':
      drawBiped(ctx, body, P.accent, P.eye, ph, attacking, tpl.shape === 'yeti');
      break;
    default:
      drawBeast(ctx, body, P.accent, P.eye, ph, moving, false);
  }
  ctx.restore();

  if (o.hitFlash > 0) {
    ctx.globalAlpha = Math.min(0.7, o.hitFlash * 3);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, -16 * s, 16 * s, 18 * s, 0, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBeast(ctx, body, accent, eye, ph, moving, slim, tusks) {
  const w = slim ? 17 : 20;
  ctx.fillStyle = shade(body, -0.35);
  ctx.fillRect(-11 + ph * 3, -8, 4, 9);
  ctx.fillRect(5 - ph * 3, -8, 4, 9);
  ctx.fillRect(-7 - ph * 2, -8, 4, 8);
  ctx.fillRect(3 + ph * 2, -8, 4, 8);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -14, w, 9.5, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(-2, -10, w - 5, 4.5, 0, 0, 7);
  ctx.fill();
  // Đuôi
  ctx.strokeStyle = body;
  ctx.lineWidth = slim ? 5 : 3.5;
  ctx.beginPath();
  ctx.moveTo(-w + 1, -16);
  ctx.quadraticCurveTo(-w - 9, -20 + ph * 3, -w - 6, -26 + ph * 2);
  ctx.stroke();
  // Đầu
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(w - 3, -20, 8.5, 7, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = shade(body, -0.2);
  ctx.beginPath();
  ctx.moveTo(w + 3, -21);
  ctx.lineTo(w + 12, -18);
  ctx.lineTo(w + 3, -14);
  ctx.closePath();
  ctx.fill();
  // Tai
  ctx.fillStyle = shade(body, -0.25);
  ctx.beginPath();
  ctx.moveTo(w - 9, -25);
  ctx.lineTo(w - 5, -34);
  ctx.lineTo(w - 3, -24);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w - 2, -26);
  ctx.lineTo(w + 1, -34);
  ctx.lineTo(w + 4, -25);
  ctx.closePath();
  ctx.fill();
  if (tusks) {
    ctx.fillStyle = '#f2ead4';
    ctx.beginPath();
    ctx.moveTo(w + 4, -16);
    ctx.lineTo(w + 11, -12);
    ctx.lineTo(w + 5, -13);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(w + 1, -22, 1.9, 0, 7);
  ctx.fill();
}

function drawElephant(ctx, body, accent, eye, ph) {
  ctx.fillStyle = shade(body, -0.3);
  ctx.fillRect(-13 + ph * 2, -12, 6, 13);
  ctx.fillRect(7 - ph * 2, -12, 6, 13);
  ctx.fillRect(-4, -12, 6, 13);
  ctx.fillRect(3, -12, 6, 13);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -20, 21, 13, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(-4, -14, 14, 5, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(18, -25, 10, 10, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = shade(body, -0.12);
  ctx.beginPath();
  ctx.ellipse(12, -23, 8, 10, 0.3, 0, 7);
  ctx.fill();
  ctx.strokeStyle = body;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(24, -22);
  ctx.quadraticCurveTo(33, -14, 28 + ph, -4);
  ctx.stroke();
  ctx.fillStyle = '#f2ead4';
  ctx.beginPath();
  ctx.moveTo(26, -18);
  ctx.lineTo(36, -12);
  ctx.lineTo(27, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(21, -28, 1.9, 0, 7);
  ctx.fill();
}

function drawSnake(ctx, body, accent, eye, t) {
  ctx.strokeStyle = body;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const x = -26 + i * 4;
    const y = -12 + Math.sin(t * 3 + i * 0.7) * 4;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(18, -16 + Math.sin(t * 3 + 6) * 2, 9, 7, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(15, -13, 5, 3, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(21, -18, 2, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#ff5f56';
  ctx.beginPath();
  ctx.moveTo(24, -11);
  ctx.lineTo(21, -6);
  ctx.lineTo(27, -10);
  ctx.closePath();
  ctx.fill();
}

function drawBird(ctx, body, accent, eye, t) {
  const flap = Math.sin(t * 9);
  ctx.fillStyle = shade(body, -0.4);
  ctx.beginPath();
  ctx.moveTo(-2, -20);
  ctx.quadraticCurveTo(-26, -26 + flap * 10, -32, -12 + flap * 6);
  ctx.quadraticCurveTo(-18, -12, -2, -12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, -20);
  ctx.quadraticCurveTo(26, -26 - flap * 10, 32, -12 - flap * 6);
  ctx.quadraticCurveTo(18, -12, 2, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -20, 11, 13, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(0, -16, 6, 7, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, -34, 7, 0, 7);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(5, -34);
  ctx.lineTo(14, -32);
  ctx.lineTo(5, -30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(2, -36, 1.9, 0, 7);
  ctx.fill();
}

function drawGolem(ctx, body, accent, eye, ph, t) {
  const glow = 0.5 + 0.5 * Math.sin(t * 2.6);
  ctx.fillStyle = shade(body, -0.3);
  ctx.fillRect(-13 + ph * 2, -12, 8, 14);
  ctx.fillRect(6 - ph * 2, -12, 8, 14);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-16, -14);
  ctx.lineTo(-13, -32);
  ctx.lineTo(13, -32);
  ctx.lineTo(16, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(body, 0.12);
  ctx.beginPath();
  ctx.moveTo(-13, -32);
  ctx.lineTo(13, -32);
  ctx.lineTo(9, -44);
  ctx.lineTo(-9, -44);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(-9, -40, 18, 2.5);
  ctx.fillStyle = `rgba(255,180,60,${0.55 + glow * 0.45})`;
  ctx.beginPath();
  ctx.arc(0, -26, 4.5 + glow, 0, 7);
  ctx.fill();
  ctx.fillStyle = eye;
  ctx.fillRect(-6, -40, 4, 3.5);
  ctx.fillRect(2, -40, 4, 3.5);
}

function drawBiped(ctx, body, accent, eye, ph, attacking, furry) {
  ctx.fillStyle = shade(body, -0.35);
  ctx.fillRect(-8 + ph * 2, -13, 6, 15);
  ctx.fillRect(3 - ph * 2, -13, 6, 15);
  const bodyTop = -40;
  ctx.fillStyle = body;
  if (furry) {
    ctx.beginPath();
    ctx.moveTo(-14, -14);
    ctx.quadraticCurveTo(-17, -34, -10, bodyTop);
    ctx.lineTo(10, bodyTop);
    ctx.quadraticCurveTo(17, -34, 14, -14);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-12, -14);
    ctx.lineTo(-10, bodyTop);
    ctx.lineTo(10, bodyTop);
    ctx.lineTo(12, -14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(0, -22, 8, 9, 0, 0, 7);
  ctx.fill();
  // Tay
  ctx.strokeStyle = body;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const armA = attacking ? -1.9 : -0.5 + ph * 0.25;
  ctx.beginPath();
  ctx.moveTo(-10, -36);
  ctx.lineTo(-10 + Math.cos(armA) * 16, -36 + Math.sin(armA) * 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, -36);
  ctx.lineTo(10 + Math.cos(armA) * 16, -36 + Math.sin(armA) * 16);
  ctx.stroke();
  // Đầu
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, bodyTop - 5, 8.5, 0, 7);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(0, bodyTop - 1, 6, 4, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(-3, bodyTop - 6, 2, 0, 7);
  ctx.arc(3, bodyTop - 6, 2, 0, 7);
  ctx.fill();
}

// ---------------- Vật phẩm rơi ----------------
const ITEM_ICON = {
  'kiem-sat': '🗡️', 'dao-nguyet': '⚔️', 'truong-thuong': '🔱', 'phap-truong': '🪄', 'quat-linh': '🪭',
  'song-doan-dao': '🔪', 'kiem-thanh-phong': '⚔️',
  'ao-vo': '🥋', 'ao-linh': '🧥', 'ao-da': '🦺', 'ao-tuyet': '🧥', 'ao-long-lan': '🥋',
  'mu-sat': '🪖', 'bang-le': '🎀', 'mu-da': '🧢', 'kim-quan': '👑',
  'giay-vai': '👟', 'giay-da': '🥾', 'van-tat': '🥿', 'ngoc-hai': '👢',
  'nhan-ngoc': '💍', 'nhan-huyet': '💍', 'nhan-linh': '💍', 'nhan-van-menh': '💎',
  'danh-duoc-nho': '🧪', 'danh-duoc-lon': '🍶', 'linh-thach': '💠', 'hoi-khi-dan': '🌿', 'phu-tro-ve': '📜',
};
export function itemIcon(id) {
  return ITEM_ICON[id] || '📦';
}

export function drawDrop(ctx, d, time) {
  const bob = Math.sin(time * 3 + d.id) * 3;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 8, 3.5, 0, 0, 7);
  ctx.fill();
  const color = d.color || '#ffd166';
  ctx.globalAlpha = 0.45 + 0.25 * Math.sin(time * 4 + d.id);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -10 - bob, 13, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = '18px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.icon, 0, -10 - bob);
  ctx.restore();
}

export function drawProjectile(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, 0, p.r + 6 + Math.sin(time * 20) * 1.5, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.beginPath();
  ctx.arc(-2, -2, p.r * 0.42, 0, 7);
  ctx.fill();
  ctx.restore();
}

// ---------------- NPC ----------------
export function drawNpc(ctx, n, time) {
  ctx.save();
  ctx.translate(n.x, n.y);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 11, 4.5, 0, 0, 7);
  ctx.fill();
  const bob = Math.sin(time * 1.6 + n.x) * 1.2;
  ctx.translate(0, -bob);
  const colors = { shop: '#c8a24d', smith: '#8d8f96', healer: '#5fd07a', elder: '#9ad6ff' };
  const c = colors[n.type] || '#c8a24d';
  ctx.fillStyle = shade(c, -0.5);
  ctx.fillRect(-6, -12, 5, 12);
  ctx.fillRect(1, -12, 5, 12);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(-9, -10);
  ctx.lineTo(9, -10);
  ctx.lineTo(7, -32);
  ctx.lineTo(-7, -32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f0c39a';
  ctx.beginPath();
  ctx.arc(0, -38, 7, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath();
  ctx.arc(0, -40, 7.4, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(-3, -38, 1.8, 2.2);
  ctx.fillRect(1.5, -38, 1.8, 2.2);
  ctx.restore();
}

// ---------------- Hiệu ứng ----------------
export const FX = {
  slash(ctx, x, y, dir, range, arc, color, p) {
    ctx.save();
    ctx.translate(x, y - 18);
    ctx.rotate(dir);
    ctx.globalAlpha = (1 - p) * 0.85;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5 - p * 3;
    ctx.beginPath();
    ctx.arc(0, 0, range * (0.6 + p * 0.4), -arc / 2 + p * 0.6, arc / 2 + p * 0.6);
    ctx.stroke();
    ctx.restore();
  },
  boom(ctx, x, y, r, color, p) {
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r * p, 0, 7);
    ctx.stroke();
    ctx.globalAlpha = (1 - p) * 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r * p * 0.85, 0, 7);
    ctx.fill();
    ctx.restore();
  },
  hit(ctx, x, y, color, p) {
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + p;
      const d = 4 + p * 16;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * d * 0.4, y + Math.sin(a) * d * 0.4);
      ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      ctx.stroke();
    }
    ctx.restore();
  },
  heal(ctx, x, y, p) {
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = '#7cf0a8';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const yy = y - 10 - (1 - p) * 34 - i * 3;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a + p * 3) * 13, yy, 2.6, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  },
  buff(ctx, x, y, color, p) {
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y - 14, 12 + p * 22, (12 + p * 22) * 1.3, 0, 0, 7);
    ctx.stroke();
    ctx.restore();
  },
  dash(ctx, x, y, color, p) {
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y - 16, 26 * (1 - p), 16 * (1 - p), 0, 0, 7);
    ctx.fill();
    ctx.restore();
  },
};

// Đổi màu sáng/tối
export function shade(hex, amt) {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  if (amt >= 0) {
    r = r + (255 - r) * amt;
    g = g + (255 - g) * amt;
    b = b + (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export { rr };
