// Kết xuất thế giới lên canvas
import { G, clamp, lerp } from './state.js';
import { TILE } from '/shared/tiles.js';
import { CLASS_MAP } from '/shared/classes.js';
import { MONSTER_MAP } from '/shared/monsters.js';
import { RARITY, ITEM_MAP } from '/shared/items.js';
import { makeMapCanvas, drawAnimatedTile, drawCharacter, drawMonster, drawDrop, drawProjectile, drawNpc, FX, shade, itemIcon } from './art.js';

let canvas, ctx, dpr = 1;

export function initRenderer(cv) {
  canvas = cv;
  ctx = cv.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

export function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  G.view.w = innerWidth;
  G.view.h = innerHeight;
}

export function setMap(map) {
  G.mapArt = makeMapCanvas(map);
  G.particles.length = 0;
}

function screenToWorld(sx, sy) {
  return { x: G.cam.x + sx, y: G.cam.y + sy };
}
export { screenToWorld };

function spawnParticles(dt) {
  const amb = G.map ? G.map.ambient : 'plain';
  const want = 90;
  const cfg = {
    village: { c: '#ffe0a3', s: 2.2, vy: 16, vx: 10, a: 0.55 },
    plain: { c: '#e8dcc0', s: 2.0, vy: 8, vx: 14, a: 0.35 },
    forest: { c: '#9fd07a', s: 3.0, vy: 20, vx: 16, a: 0.6 },
    cave: { c: '#ffb066', s: 2.0, vy: -14, vx: 8, a: 0.6 },
    snow: { c: '#ffffff', s: 2.6, vy: 34, vx: 12, a: 0.75 },
    arena: { c: '#ffcf8a', s: 2.2, vy: -10, vx: 10, a: 0.45 },
  }[amb] || { c: '#fff', s: 2, vy: 10, vx: 10, a: 0.4 };

  while (G.particles.length < want) {
    G.particles.push({
      x: G.cam.x + Math.random() * G.view.w,
      y: G.cam.y + Math.random() * G.view.h,
      vx: (Math.random() - 0.5) * cfg.vx * 2,
      vy: cfg.vy * (0.6 + Math.random() * 0.8),
      life: 0,
      max: 4 + Math.random() * 5,
      size: cfg.s * (0.6 + Math.random() * 0.8),
      c: cfg.c,
      a: cfg.a,
      spin: Math.random() * 6,
    });
  }
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life += dt;
    p.x += (p.vx + Math.sin(G.time + p.spin) * 8) * dt;
    p.y += p.vy * dt;
    if (p.life > p.max || p.x < G.cam.x - 40 || p.x > G.cam.x + G.view.w + 40 || p.y < G.cam.y - 40 || p.y > G.cam.y + G.view.h + 40) {
      G.particles.splice(i, 1);
    }
  }
}

function updateCamera(dt) {
  if (!G.map) return;
  const mw = G.map.w * TILE,
    mh = G.map.h * TILE;
  let cx = G.me.x - G.view.w / 2;
  let cy = G.me.y - G.view.h / 2;
  cx = mw < G.view.w ? (mw - G.view.w) / 2 : clamp(cx, 0, mw - G.view.w);
  cy = mh < G.view.h ? (mh - G.view.h) / 2 : clamp(cy, 0, mh - G.view.h);
  const k = 1 - Math.exp(-14 * dt);
  G.cam.x = lerp(G.cam.x, cx, k);
  G.cam.y = lerp(G.cam.y, cy, k);
}

function drawNameplate(o, text, color, hpPct, extra) {
  const y = o.y - 56;
  ctx.font = '600 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.max(46, ctx.measureText(text).width + 14);
  ctx.fillStyle = 'rgba(6,10,14,.62)';
  ctx.fillRect(o.x - w / 2, y - 8, w, 15);
  ctx.fillStyle = color;
  ctx.fillText(text, o.x, y);
  if (extra) {
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = '#9fb0bd';
    ctx.fillText(extra, o.x, y + 13);
  }
  if (hpPct !== undefined) {
    const bw = 52;
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(o.x - bw / 2, y - 18, bw, 6);
    ctx.fillStyle = hpPct > 0.5 ? '#5fd07a' : hpPct > 0.22 ? '#ffb02e' : '#ff5f56';
    ctx.fillRect(o.x - bw / 2 + 1, y - 17, (bw - 2) * hpPct, 4);
  }
}

export function render(dt) {
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, G.view.w, G.view.h);
  if (!G.map || !G.inGame) return;

  updateCamera(dt);
  spawnParticles(dt);

  ctx.save();
  ctx.translate(-Math.round(G.cam.x), -Math.round(G.cam.y));

  // ---- Bản đồ ----
  if (G.mapArt) {
    const sx = clamp(Math.floor(G.cam.x) - 64, 0, G.mapArt.canvas.width);
    const sy = clamp(Math.floor(G.cam.y) - 64, 0, G.mapArt.canvas.height);
    const sw = Math.min(G.mapArt.canvas.width - sx, G.view.w + 128);
    const sh = Math.min(G.mapArt.canvas.height - sy, G.view.h + 128);
    if (sw > 0 && sh > 0) ctx.drawImage(G.mapArt.canvas, sx, sy, sw, sh, sx, sy, sw, sh);
  }

  // ---- Ô động ----
  const t0x = Math.max(0, Math.floor(G.cam.x / TILE) - 1);
  const t1x = Math.min(G.map.w - 1, Math.ceil((G.cam.x + G.view.w) / TILE) + 1);
  const t0y = Math.max(0, Math.floor(G.cam.y / TILE) - 1);
  const t1y = Math.min(G.map.h - 1, Math.ceil((G.cam.y + G.view.h) / TILE) + 1);
  if (G.mapArt) {
    for (const a of G.mapArt.anim) {
      if (a.tx < t0x || a.tx > t1x || a.ty < t0y || a.ty > t1y) continue;
      drawAnimatedTile(ctx, a, G.time);
    }
  }

  // ---- Nhãn cổng dịch chuyển ----
  ctx.font = '600 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  for (const p of G.map.portals) {
    ctx.fillStyle = 'rgba(200,170,255,.85)';
    ctx.fillText(p.label, p.x, p.y - 26);
    ctx.fillStyle = 'rgba(200,170,255,.45)';
    ctx.fillText('▸ ' + (G.map.name || ''), p.x, p.y + 34);
  }

  // ---- NPC ----
  for (const n of G.map.npcs) {
    drawNpc(ctx, n, G.time);
    ctx.font = '600 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe6a8';
    ctx.fillText(n.name, n.x, n.y - 58);
    if (G.npcNear === n) {
      ctx.fillStyle = 'rgba(240,192,96,.95)';
      ctx.fillText('[E] Nói chuyện', n.x, n.y - 46);
      ctx.strokeStyle = 'rgba(240,192,96,.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(n.x, n.y - 24, 26 + Math.sin(G.time * 3) * 2, 0, 7);
      ctx.stroke();
    }
  }

  // ---- Vật phẩm rơi ----
  for (const d of G.drops.values()) {
    if (d.x < G.cam.x - 40 || d.x > G.cam.x + G.view.w + 40) continue;
    drawDrop(ctx, d, G.time);
  }

  // ---- Thực thể (sắp theo trục y) ----
  const list = [];
  for (const p of G.players.values()) if (p.id !== G.id) list.push({ y: p.ry ?? p.y, kind: 'p', o: p });
  for (const m of G.monsters.values()) list.push({ y: m.ry ?? m.y, kind: 'm', o: m });
  list.push({ y: G.me.y, kind: 'me', o: G.me });
  list.sort((a, b) => a.y - b.y);

  for (const item of list) {
    if (item.kind === 'm') {
      const m = item.o;
      drawMonster(ctx, { x: m.rx ?? m.x, y: m.ry ?? m.y, dir: m.dir, tpl: m.tpl, state: m.state, animT: m.animT, hitFlash: m.hitFlash }, G.time, m.animT);
      const tpl = MONSTER_MAP[m.tpl];
      const hpPct = m.hp / m.maxHp;
      const isTarget = G.target === m.id;
      if (isTarget || hpPct < 1) {
        const nameColor = tpl && tpl.boss ? '#ff7a7a' : '#ffd9a0';
        drawNameplate(
          { x: m.rx ?? m.x, y: (m.ry ?? m.y) - (tpl ? tpl.size * 14 : 10) },
          (tpl ? tpl.name : '') + (tpl && tpl.boss ? ' • BOSS' : ''),
          nameColor,
          hpPct,
          `Lv.${tpl ? tpl.lv : '?'}`
        );
      }
      if (isTarget) {
        ctx.strokeStyle = 'rgba(255,95,86,.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(m.rx ?? m.x, m.ry ?? m.y, 22 + (tpl ? tpl.size * 8 : 0), 10 + (tpl ? tpl.size * 3 : 0), 0, 0, 7);
        ctx.stroke();
      }
    } else if (item.kind === 'p') {
      const p = item.o;
      drawCharacter(ctx, { x: p.rx ?? p.x, y: p.ry ?? p.y, dir: p.dir, cls: p.cls, state: p.state, animT: p.animT, anim: p.animT, shield: p.shield, dead: p.dead, buffed: p.buffed }, G.time);
      const c = CLASS_MAP[p.cls] || CLASS_MAP.kiemtu;
      drawNameplate({ x: p.rx ?? p.x, y: (p.ry ?? p.y) }, p.name, c.color, p.hp / p.maxHp < 1 || G.target === p.id ? p.hp / p.maxHp : undefined, `Lv.${p.lv} · ${c.name}`);
    } else {
      const me = G.me;
      drawCharacter(ctx, { x: me.x, y: me.y, dir: me.dir, cls: G.self ? G.self.cls : 'kiemtu', state: me.state, animT: me.animT, anim: me.anim, shield: me.shield, dead: G.dead, buffed: G.self && G.self.buffs && G.self.buffs.length > 0 }, G.time);
      const c = CLASS_MAP[G.self ? G.self.cls : 'kiemtu'] || CLASS_MAP.kiemtu;
      drawNameplate({ x: me.x, y: me.y }, G.self ? G.self.name : '', c.color, G.self && G.self.hp / G.self.maxHp < 1 ? G.self.hp / G.self.maxHp : undefined, `Lv.${G.self ? G.self.lv : 1} · ${c.name}`);
    }
  }

  // ---- Đạn ----
  for (const p of G.projs.values()) drawProjectile(ctx, p, G.time);

  // ---- Hiệu ứng kỹ năng ----
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    f.t += dt;
    const p = f.t / f.dur;
    if (p >= 1) {
      G.fx.splice(i, 1);
      continue;
    }
    if (f.kind === 'slash') FX.slash(ctx, f.x, f.y, f.dir, f.range, f.arc, f.color, p);
    else if (f.kind === 'boom') FX.boom(ctx, f.x, f.y, f.r, f.color, p);
    else if (f.kind === 'hit') FX.hit(ctx, f.x, f.y, f.color, p);
    else if (f.kind === 'heal') FX.heal(ctx, f.x, f.y, p);
    else if (f.kind === 'buff') FX.buff(ctx, f.x, f.y, f.color, p);
    else if (f.kind === 'dash') FX.dash(ctx, f.x, f.y, f.color, p);
  }

  // ---- Hạt môi trường ----
  for (const p of G.particles) {
    const fade = Math.sin((p.life / p.max) * Math.PI);
    ctx.globalAlpha = p.a * fade;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ---- Số sát thương ----
  ctx.font = '700 15px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  for (let i = G.floaters.length - 1; i >= 0; i--) {
    const f = G.floaters[i];
    f.t += dt;
    if (f.t > f.life) {
      G.floaters.splice(i, 1);
      continue;
    }
    const p = f.t / f.life;
    ctx.globalAlpha = 1 - p * p;
    ctx.font = `800 ${f.size}px "Segoe UI", sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText(f.text, f.x + f.ox * p, f.y - p * 42);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x + f.ox * p, f.y - p * 42);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // ---- Ánh sáng / bóng tối ----
  const amb = G.map.ambient;
  if (amb === 'cave' || amb === 'snow' || amb === 'arena') {
    const g = ctx.createRadialGradient(G.me.x - G.cam.x, G.me.y - G.cam.y, 60, G.me.x - G.cam.x, G.me.y - G.cam.y, 460);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, amb === 'cave' ? 'rgba(0,0,0,.55)' : 'rgba(6,12,20,.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.view.w, G.view.h);
  }
  // Viền tối
  const vg = ctx.createRadialGradient(G.view.w / 2, G.view.h / 2, Math.min(G.view.w, G.view.h) * 0.45, G.view.w / 2, G.view.h / 2, Math.max(G.view.w, G.view.h) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, G.view.w, G.view.h);

  // ---- Mũi tên chỉ mục tiêu khi ở ngoài màn hình ----
  if (G.target && G.monsters.has(G.target)) {
    const m = G.monsters.get(G.target);
    const sx = (m.rx ?? m.x) - G.cam.x;
    const sy = (m.ry ?? m.y) - G.cam.y;
    if (sx < 20 || sy < 20 || sx > G.view.w - 20 || sy > G.view.h - 20) {
      const cx = G.view.w / 2,
        cy = G.view.h / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const r = Math.min(G.view.w, G.view.h) / 2 - 46;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(255,95,86,.85)';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, 7);
      ctx.lineTo(-8, -7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
