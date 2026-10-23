// Vòng lặp game, nhập liệu, dự đoán chuyển động, xử lý gói tin
import { G, moveEntity, decodeTiles, clamp, dist2 } from './state.js';
import { Net } from './net.js';
import { initRenderer, render as renderWorld, setMap, screenToWorld } from './renderer.js';
import * as UI from './ui.js';
import { MONSTER_MAP } from '/shared/monsters.js';
import { CLASS_BY_ID, CLASS_MAP, SKILL_MAP } from '/shared/classes.js';
import { ITEM_MAP, RARITY } from '/shared/items.js';
import { itemIcon } from './art.js';

export function sendAction(obj) {
  if (G.net) G.net.send(obj);
}

// ---------------- Âm thanh (tổng hợp, không dùng file) ----------------
let actx = null;
let muted = false;
export function sfx(type) {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.connect(g);
    g.connect(actx.destination);
    const cfg = {
      swing: { type: 'sine', f0: 620, f1: 220, d: 0.09, v: 0.05 },
      hit: { type: 'square', f0: 180, f1: 60, d: 0.09, v: 0.07 },
      crit: { type: 'sawtooth', f0: 380, f1: 110, d: 0.16, v: 0.09 },
      hurt: { type: 'triangle', f0: 220, f1: 90, d: 0.2, v: 0.09 },
      heal: { type: 'sine', f0: 480, f1: 760, d: 0.22, v: 0.06 },
      pickup: { type: 'sine', f0: 700, f1: 1250, d: 0.1, v: 0.05 },
      level: { type: 'triangle', f0: 440, f1: 990, d: 0.5, v: 0.09 },
      die: { type: 'sawtooth', f0: 260, f1: 50, d: 0.5, v: 0.08 },
      cast: { type: 'sine', f0: 300, f1: 900, d: 0.18, v: 0.05 },
    }[type];
    if (!cfg) return;
    o.type = cfg.type;
    o.frequency.setValueAtTime(cfg.f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, cfg.f1), t + cfg.d);
    g.gain.setValueAtTime(cfg.v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + cfg.d);
    o.start(t);
    o.stop(t + cfg.d + 0.02);
  } catch (e) {
    /* trình duyệt chặn âm thanh */
  }
}

export function toggleMute() {
  muted = !muted;
  UI.toast(muted ? 'Đã tắt âm thanh.' : 'Đã bật âm thanh.');
  return muted;
}

// ---------------- Khởi động ----------------
export function boot(handlers) {
  G.net = new Net();
  UI.initUI(handlers);
  initRenderer(document.getElementById('game'));
  bindInput();
  bindNet();
  G.net.connect();
  let last = performance.now();
  let miniAcc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    G.time += dt;
    update(dt);
    renderWorld(dt);
    UI.updateHud();
    miniAcc += dt;
    if (miniAcc > 0.1) {
      miniAcc = 0;
      UI.drawMinimap();
      UI.markInventoryDirty();
    }
    G.ping = G.net.ping;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function bindNet() {
  const net = G.net;
  net.onOpen = () => UI.setServerStatus('Đã kết nối · máy chủ trực tuyến');
  net.onClose = () => {
    UI.setServerStatus('Mất kết nối — đang thử lại…');
    UI.toast('Mất kết nối máy chủ. Đang thử kết nối lại…', 'bad');
    setTimeout(() => location.reload(), 2500);
  };

  net.on('welcome', (m) => {
    G.id = m.id;
    G.online = m.online;
    G.inGame = true;
    applySelf(m.self);
    applyMap(m.map);
    G.me.x = m.map.x;
    G.me.y = m.map.y;
    G.cam.x = G.me.x - G.view.w / 2;
    G.cam.y = G.me.y - G.view.h / 2;
    UI.showLoading(false);
    UI.showGame(true);
    UI.buildMinimap();
  });

  net.on('self', (m) => {
    const prevLv = G.self ? G.self.lv : 0;
    applySelf(m.s);
    if (G.self.lv > prevLv && prevLv > 0) {
      UI.levelUpFlash(G.self.lv);
      UI.toast(`Lên cấp ${G.self.lv}! Bạn có ${G.self.points} điểm cộng.`, 'good');
      sfx('level');
    }
    UI.markInventoryDirty();
  });

  net.on('s', (m) => onSnapshot(m));
  net.on('map', (m) => applyMap(m));
  net.on('chat', (m) => UI.addChat(m));
  net.on('err', (m) => UI.setError(G.lastForm === 'register' ? 'err-register' : 'err-login', m.msg));
  net.on('died', () => {
    G.dead = true;
    G.deadUntil = Date.now() + 5000;
    sfx('die');
  });
  net.on('revive', () => {
    G.dead = false;
    UI.toast('Bạn đã được hồi sinh tại Làng Khởi Nguyên.', 'warn');
  });
  net.on('xp', (m) => floater(G.me.x, G.me.y - 40, `+${m.v} EXP`, '#c08bff', 12, 1.1));
  net.on('pickup', (m) => {
    if (m.gold) {
      floater(G.me.x, G.me.y - 30, `+${m.gold} vàng`, '#ffd166', 14, 1);
      sfx('pickup');
    }
    if (m.item) {
      const tpl = ITEM_MAP[m.item.t];
      const rar = RARITY[m.item.rar] || RARITY[0];
      UI.toast(`Nhặt được <b style="color:${rar.color}">${tpl ? tpl.name : 'vật phẩm'}</b>`, 'good');
      sfx('pickup');
    }
  });
  net.on('npc', (m) => UI.openShop(m.npc));
}

function applySelf(s) {
  G.self = s;
  G.me.shield = s.shield || 0;
}

function applyMap(m) {
  const tiles = decodeTiles(m.tiles);
  G.map = { id: m.id, name: m.name, w: m.w, h: m.h, tiles, portals: m.portals || [], npcs: m.npcs || [], ambient: m.ambient, safe: m.safe, pvp: m.pvp };
  setMap(G.map);
  G.monsters.clear();
  G.players.clear();
  G.drops.clear();
  G.projs.clear();
  G.target = 0;
  if (m.x !== undefined) {
    G.me.x = m.x;
    G.me.y = m.y;
  }
  UI.buildMinimap();
}

// ---------------- Gói tin trạng thái ----------------
function onSnapshot(m) {
  const seenP = new Set();
  const seenM = new Set();
  const seenD = new Set();
  const seenPr = new Set();

  for (const a of m.p || []) {
    const [id, x, y, dir, hp, maxHp, lv, clsId, name, flags, shield] = a;
    seenP.add(id);
    if (id === G.id) {
      const d = Math.hypot(x - G.me.x, y - G.me.y);
      if (d > 90) {
        G.me.x = x;
        G.me.y = y;
      } else if (d > 2) {
        G.me.x += (x - G.me.x) * 0.25;
        G.me.y += (y - G.me.y) * 0.25;
      }
      if (G.self) {
        G.self.hp = hp;
        G.self.shield = shield;
      }
      continue;
    }
    let p = G.players.get(id);
    if (!p) {
      p = { id, rx: x, ry: y, animT: 0, anim: 0 };
      G.players.set(id, p);
    }
    p.x = x;
    p.y = y;
    p.dir = dir;
    p.hp = hp;
    p.maxHp = maxHp;
    p.lv = lv;
    p.cls = (CLASS_BY_ID[clsId] || CLASS_BY_ID[1]).key;
    p.name = name;
    p.shield = shield;
    p.buffed = !!(flags & 8);
    p.dead = !!(flags & 4);
    const st = flags & 2 ? 'attack' : flags & 1 ? 'move' : 'idle';
    if (st === 'attack' && p.state !== 'attack') p.animT = 0.3;
    p.state = st;
  }
  for (const id of [...G.players.keys()]) if (!seenP.has(id)) G.players.delete(id);

  for (const a of m.m || []) {
    const [id, tpl, x, y, dir, hp, maxHp, flags, targetId] = a;
    seenM.add(id);
    let mo = G.monsters.get(id);
    if (!mo) {
      mo = { id, tpl, rx: x, ry: y, animT: 0, hitFlash: 0, name: (MONSTER_MAP[tpl] || {}).name, lv: (MONSTER_MAP[tpl] || {}).lv };
      G.monsters.set(id, mo);
    }
    mo.x = x;
    mo.y = y;
    mo.dir = dir;
    mo.hp = hp;
    mo.maxHp = maxHp;
    mo.state = flags & 2 ? 'attack' : flags & 1 ? 'move' : 'idle';
    mo.dead = !!(flags & 4);
    mo.boss = !!(flags & 8);
    if (hp < (mo.prevHp ?? hp)) mo.hitFlash = 0.16;
    mo.prevHp = hp;
  }
  for (const id of [...G.monsters.keys()]) if (!seenM.has(id)) G.monsters.delete(id);

  for (const a of m.d || []) {
    const [id, x, y, gold, item] = a;
    seenD.add(id);
    let d = G.drops.get(id);
    if (!d) {
      d = { id, x, y, gold, icon: item ? itemIcon(item[0]) : '🪙', color: item ? (RARITY[item[2]] || RARITY[0]).color : '#ffd166' };
      G.drops.set(id, d);
    }
    d.x = x;
    d.y = y;
  }
  for (const id of [...G.drops.keys()]) if (!seenD.has(id)) G.drops.delete(id);

  for (const a of m.pr || []) {
    const [id, x, y, ang, color] = a;
    seenPr.add(id);
    let p = G.projs.get(id);
    if (!p) {
      p = { id, r: 9 };
      G.projs.set(id, p);
    }
    p.x = x;
    p.y = y;
    p.ang = ang;
    p.color = color;
  }
  for (const id of [...G.projs.keys()]) if (!seenPr.has(id)) G.projs.delete(id);

  for (const e of m.ev || []) handleEvent(e);
  G.online = Math.max(1, (m.p || []).length);
}

function handleEvent(e) {
  switch (e.k) {
    case 'dmg': {
      let ent = null;
      if (e.monster) ent = G.monsters.get(e.id);
      else if (e.id === G.id) ent = G.me;
      else ent = G.players.get(e.id);
      if (!ent) break;
      const x = ent.rx ?? ent.x,
        y = (ent.ry ?? ent.y) - 34;
      const color = e.t === 'shield' ? '#ffe08a' : e.t === 'poison' ? '#a6e22e' : e.c ? '#ffd166' : e.monster ? '#ffffff' : '#ff8a80';
      floater(x, y, (e.c ? '⚡' : '') + e.v, color, e.c ? 19 : 15, e.c ? 1.1 : 0.9);
      if (!e.monster && e.id === G.id) {
        sfx('hurt');
        UI.toast(`Bị ${e.v} sát thương!`, 'bad');
      }
      break;
    }
    case 'heal': {
      const ent = e.id === G.id ? G.me : G.players.get(e.id);
      if (!ent) break;
      floater(ent.rx ?? ent.x, (ent.ry ?? ent.y) - 40, `+${e.v}`, '#7cf0a8', 15, 1);
      if (e.id === G.id) sfx('heal');
      break;
    }
    case 'boom':
      G.fx.push({ kind: 'boom', x: e.x, y: e.y, r: e.r, color: e.color, t: 0, dur: 0.45 });
      sfx('cast');
      break;
    case 'fx': {
      const dur = e.kind === 'slash' ? 0.28 : 0.35;
      G.fx.push({ kind: e.kind, x: e.x, y: e.y, dir: e.dir || 0, range: e.range || 110, arc: e.arc || 1.6, r: e.radius || 60, color: e.color || '#fff', t: 0, dur });
      if (e.kind === 'slash') sfx('swing');
      if (e.kind === 'hit') sfx('hit');
      break;
    }
    case 'die':
      if (e.kind === 'monster') {
        sfx('hit');
        for (let i = 0; i < 8; i++)
          G.fx.push({ kind: 'hit', x: e.x + (Math.random() - 0.5) * 30, y: e.y - 18 + (Math.random() - 0.5) * 20, color: '#ffd166', t: -i * 0.02, dur: 0.35 });
        if (G.target === e.id) G.target = 0;
      }
      break;
    case 'lvlup':
      if (e.id === G.id) {
        UI.levelUpFlash(e.lv);
        UI.toast(`Lên cấp ${e.lv}! Bạn nhận 3 điểm cộng.`, 'good');
        sfx('level');
      }
      break;
    case 'revive':
      if (e.id === G.id) G.dead = false;
      break;
    case 'miss':
      if (e.id === G.id) sfx('swing');
      break;
    case 'join':
      if (e.id !== G.id) UI.toast(`${e.name} vừa vào khu vực.`, '');
      break;
  }
}

export function floater(x, y, text, color, size = 15, life = 0.9) {
  G.floaters.push({ x, y, text, color, size, life, t: 0, ox: (Math.random() - 0.5) * 26 });
  if (G.floaters.length > 60) G.floaters.splice(0, 20);
}

// ---------------- Nhập liệu ----------------
const MOVE_KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
let inputMask = -1;

function bindInput() {
  const canvas = document.getElementById('game');

  addEventListener('keydown', (e) => {
    if (G.chatFocus) return;
    const code = e.code;
    if (MOVE_KEYS[code]) {
      G.keys[MOVE_KEYS[code]] = 1;
      e.preventDefault();
      sendInputMask();
      return;
    }
    if (code === 'Escape') {
      UI.closePanels();
      return;
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      document.getElementById('chat-input').focus();
      e.preventDefault();
      return;
    }
    if (UI.isPanelOpen()) {
      if (code === 'KeyS' && G.openPanel === 'inv') sendAction({ t: 'sell', i: UI.selectedIndex() });
      return;
    }
    if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3' || code === 'Digit4') {
      const idx = +code.slice(5) - 1;
      const slots = G.self && CLASS_MAP[G.self.cls] ? CLASS_MAP[G.self.cls].skills : [];
      UI.useSkill(idx < 3 && slots[idx] ? slots[idx] : 'atk');
      return;
    }
    if (code === 'Tab') {
      e.preventDefault();
      targetNearest();
      return;
    }
    if (code === 'KeyE') {
      if (G.npcNear) sendAction({ t: 'npc' });
      return;
    }
    if (code === 'KeyB') UI.openPanel('inv');
    if (code === 'KeyC') UI.openPanel('char');
    if (code === 'KeyK') UI.openPanel('skill');
    if (code === 'KeyM') UI.openPanel('worldmap');
    if (code === 'KeyH') UI.openPanel('help');
    if (code === 'KeyN') toggleMute();
  });

  addEventListener('keyup', (e) => {
    if (MOVE_KEYS[e.code]) {
      G.keys[MOVE_KEYS[e.code]] = 0;
      sendInputMask();
    }
  });

  addEventListener('blur', () => {
    G.keys = {};
    sendInputMask();
  });

  canvas.addEventListener('mousemove', (e) => {
    G.mouse.x = e.clientX;
    G.mouse.y = e.clientY;
    const w = screenToWorld(e.clientX, e.clientY);
    G.mouse.wx = w.x;
    G.mouse.wy = w.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      G.mouse.down = true;
      pickTargetAt(G.mouse.wx, G.mouse.wy);
      tryAttack();
    }
  });
  addEventListener('mouseup', () => (G.mouse.down = false));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
}

function sendInputMask() {
  const k = G.keys;
  const mask = (k.up ? 1 : 0) | (k.down ? 2 : 0) | (k.left ? 4 : 0) | (k.right ? 8 : 0);
  if (mask === inputMask) return;
  inputMask = mask;
  sendAction({ t: 'input', b: mask });
}

function pickTargetAt(wx, wy) {
  let best = null,
    bestD = 46 * 46;
  for (const m of G.monsters.values()) {
    if (m.dead) continue;
    const d = dist2(m.rx ?? m.x, m.ry ?? m.y - 14, wx, wy);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  if (best) G.target = best.id;
}

function targetNearest() {
  let best = null,
    bestD = 520 * 520;
  for (const m of G.monsters.values()) {
    if (m.dead) continue;
    const d = dist2(m.rx ?? m.x, m.ry ?? m.y, G.me.x, G.me.y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  G.target = best ? best.id : 0;
  if (best) floater(best.rx ?? best.x, (best.ry ?? best.y) - 50, '▼', '#ff5f56', 14, 0.6);
}

function tryAttack() {
  if (!G.inGame || G.dead || !G.self) return;
  const now = performance.now();
  const cd = G.self.cds && G.self.cds.atk ? G.self.cds.atk : 0;
  if (now - G.lastAtk < Math.max(120, cd)) return;
  G.lastAtk = now;
  const t = G.target ? G.monsters.get(G.target) : null;
  const tx = t ? t.rx ?? t.x : G.mouse.wx;
  const ty = t ? t.ry ?? t.y : G.mouse.wy;
  G.me.dir = Math.atan2(ty - G.me.y, tx - G.me.x);
  G.me.state = 'attack';
  G.me.animT = 0.3;
  sendAction({ t: 'atk', x: tx, y: ty });
}

// ---------------- Cập nhật mỗi khung hình ----------------
function update(dt) {
  if (!G.inGame || !G.map) return;

  // Dự đoán chuyển động của chính mình
  const k = G.keys;
  if (G.dead) {
    G.me.state = 'idle';
  } else if (G.self) {
    let ix = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    let iy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    if (ix || iy) {
      const len = Math.hypot(ix, iy) || 1;
      const sp = (G.self.spd || 160) * dt;
      moveEntity(G.me, (ix / len) * sp, (iy / len) * sp, 10, G.map);
      G.me.dir = Math.atan2(iy, ix);
      if (G.me.animT <= 0) G.me.state = 'move';
    } else if (G.me.animT <= 0) {
      G.me.state = 'idle';
    }
  }
  G.me.anim += dt * (G.me.state === 'move' ? 1 : 0.25);
  if (G.me.animT > 0) G.me.animT -= dt;

  // Tấn công khi giữ chuột
  if (G.mouse.down && !G.chatFocus && !UI.isPanelOpen()) tryAttack();

  // Nội suy thực thể khác
  const kf = 1 - Math.exp(-22 * dt);
  for (const p of G.players.values()) {
    p.rx = (p.rx ?? p.x) + (p.x - (p.rx ?? p.x)) * kf;
    p.ry = (p.ry ?? p.y) + (p.y - (p.ry ?? p.y)) * kf;
    p.anim += dt * (p.state === 'move' ? 1 : 0.25);
    if (p.animT > 0) p.animT -= dt;
  }
  for (const m of G.monsters.values()) {
    m.rx = (m.rx ?? m.x) + (m.x - (m.rx ?? m.x)) * kf;
    m.ry = (m.ry ?? m.y) + (m.y - (m.ry ?? m.y)) * kf;
    m.animT += dt;
    if (m.hitFlash > 0) m.hitFlash -= dt;
  }

  // NPC gần nhất
  G.npcNear = null;
  for (const n of G.map.npcs) {
    if (dist2(n.x, n.y, G.me.x, G.me.y) < 76 * 76) G.npcNear = n;
  }

  // Mục tiêu chết thì bỏ chọn
  const t = G.target ? G.monsters.get(G.target) : null;
  if (G.target && (!t || t.dead)) G.target = 0;
}
