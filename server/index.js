// Máy chủ Linh Khí Online: HTTP tĩnh + WebSocket thời gian thực
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';

import { buildAllMaps, encodeTiles } from './maps.js';
import { World } from './world.js';
import { Player } from './player.js';
import * as save from './save.js';
import * as U from './util.js';
import { ITEM_MAP, itemPrice, RARITY } from '../shared/items.js';
import { SKILL_MAP, CLASS_BY_ID } from '../shared/classes.js';
import { TICK_MS, SNAPSHOT_MS, MAX_LEVEL, INV_SIZE } from '../shared/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_NAMES = (process.env.ADMIN || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// ---------- Khởi tạo ----------
save.load();
const maps = buildAllMaps();
const world = new World(maps, {
  onMap: (p, mapId) => send(p.ws, { t: 'map', ...mapInfo(mapId, p) }),
});

const app = express();
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.get('/api/status', (req, res) => {
  res.json({
    online: world.players.size,
    monsters: world.monsters.size,
    accounts: save.accountCount(),
    maps: Object.values(maps).map((m) => ({ id: m.id, name: m.name })),
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ---------- Tiện ích gửi tin ----------
function send(ws, obj) {
  try {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  } catch (e) {
    /* bỏ qua */
  }
}
function broadcast(obj) {
  const s = JSON.stringify(obj);
  for (const p of world.players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s);
}
function sysChat(ws, msg) {
  send(ws, { t: 'chat', ch: 'sys', msg });
}
function mapInfo(id, p) {
  const m = maps[id];
  return {
    id: m.id,
    name: m.name,
    w: m.w,
    h: m.h,
    tiles: encodeTiles(m.tiles),
    portals: m.portals,
    npcs: m.npcs,
    ambient: m.ambient,
    safe: m.safe,
    pvp: m.pvp,
    x: p ? Math.round(p.x) : Math.round(m.start.x),
    y: p ? Math.round(p.y) : Math.round(m.start.y),
  };
}
function enterWorld(ws, p) {
  world.addPlayer(p);
  p.ws = ws;
  ws.player = p;
  send(ws, { t: 'welcome', id: p.id, self: p.netSelf(), map: mapInfo(p.map, p), online: world.players.size, tick: TICK_MS });
  send(ws, { t: 'chat', ch: 'sys', msg: `Chào mừng ${p.name} đến với Linh Khí Online! Gõ /help để xem lệnh.` });
  broadcast({ t: 'chat', ch: 'sys', msg: `${p.name} (${p.cls.name} Lv.${p.lv}) đã xuất hiện tại ${maps[p.map].name}.` });
  p.dirty = false;
}

const TIPS = [
  'Mẹo: Đứng trong làng hồi máu rất nhanh — mau về đây khi sắp hết sinh lực.',
  'Mẹo: Nhấn phím 1/2/3/4 để dùng kỹ năng, giữ chuột trái để đánh liên tục.',
  'Mẹo: Cường hóa trang bị ở thợ rèn Thiết Tượng (Làng Khởi Nguyên).',
  'Mẹo: Đánh boss (có thanh máu to) rơi trang bị phẩm chất cao.',
  'Mẹo: Nhấn B để mở túi đồ, C để mở bảng nhân vật, M để xem bản đồ.',
  'Mẹo: Nhặt đồ tự động — cứ đi ngang qua vật phẩm rơi ra là nhặt được.',
];

// ---------- Lệnh chat ----------
function handleCommand(p, ws, raw) {
  const acc = save.getAccount(p.acc);
  const isAdmin = acc && (acc.admin || ADMIN_NAMES.includes(p.acc.toLowerCase()));
  const [cmd, ...rest] = raw.slice(1).split(' ');
  const arg = rest.join(' ');

  switch (cmd.toLowerCase()) {
    case 'help':
      sysChat(ws, 'Lệnh: /who (ai đang online) · /w <tên> <nội dung> (riêng tư) · /r <nội dung> (trả lời) · /pos · /time');
      if (isAdmin) sysChat(ws, 'Quản trị: /ann <thông báo> · /lv <cấp> · /gold <vàng> · /item <mã> <cấp> <phẩm> · /tp <map> · /heal · /killall · /admin <tên>');
      return true;
    case 'who': {
      const list = [...world.players.values()].map((x) => `${x.name} Lv.${x.lv}(${maps[x.map].name})`);
      sysChat(ws, `Đang online (${list.length}): ${list.join(', ') || '—'}`);
      return true;
    }
    case 'w': {
      const [to, ...msg] = rest;
      const target = [...world.players.values()].find((x) => x.name.toLowerCase() === (to || '').toLowerCase());
      if (!target) return sysChat(ws, `Không tìm thấy người chơi "${to}".`);
      const text = U.safeStr(msg.join(' '));
      send(target.ws, { t: 'chat', ch: 'pm', from: p.name, msg: text });
      send(ws, { t: 'chat', ch: 'pm', from: p.name, to: target.name, msg: text });
      target.lastPm = p.name;
      return true;
    }
    case 'r': {
      const target = [...world.players.values()].find((x) => x.name === p.lastPm);
      if (!target) return sysChat(ws, 'Chưa có ai nhắn tin riêng cho bạn.');
      const text = U.safeStr(arg);
      send(target.ws, { t: 'chat', ch: 'pm', from: p.name, msg: text });
      send(ws, { t: 'chat', ch: 'pm', from: p.name, to: target.name, msg: text });
      return true;
    }
    case 'pos':
      sysChat(ws, `Bạn đang ở ${maps[p.map].name} (${Math.round(p.x / 32)}, ${Math.round(p.y / 32)}).`);
      return true;
    case 'time':
      sysChat(ws, `Giờ máy chủ: ${new Date().toLocaleString('vi-VN')} · Online: ${world.players.size}`);
      return true;
  }

  if (!isAdmin) return false;

  switch (cmd.toLowerCase()) {
    case 'ann':
      broadcast({ t: 'chat', ch: 'sys', msg: `[Thông báo] ${U.safeStr(arg)}` });
      return true;
    case 'lv': {
      const lv = U.clamp(parseInt(rest[0]) || 1, 1, MAX_LEVEL);
      p.lv = lv;
      p.xp = 0;
      p.recompute();
      p.hp = p.maxHp;
      p.ki = p.maxKi;
      sysChat(ws, `Đã đặt cấp độ thành ${lv}.`);
      return true;
    }
    case 'gold': {
      p.gold = Math.max(0, parseInt(rest[0]) || 0);
      sysChat(ws, `Vàng hiện tại: ${U.fmt(p.gold)}`);
      return true;
    }
    case 'item': {
      const [tplId, lv, rar] = rest;
      const tpl = ITEM_MAP[tplId];
      if (!tpl) return sysChat(ws, `Mã vật phẩm không hợp lệ. Ví dụ: /item kiem-sat 10 2`);
      const ok = p.addItem({
        uid: U.uid(),
        t: tplId,
        lv: U.clamp(parseInt(lv) || p.lv, 1, MAX_LEVEL),
        rar: U.clamp(parseInt(rar) || 0, 0, 4),
        upg: 0,
        q: 1,
      });
      sysChat(ws, ok ? `Đã nhận ${tpl.name}.` : 'Túi đồ đã đầy!');
      return true;
    }
    case 'tp': {
      const id = parseInt(rest[0]) || 0;
      if (!maps[id]) return sysChat(ws, 'Bản đồ không tồn tại (0-5).');
      world.teleport(p, id, maps[id].start.x, maps[id].start.y);
      send(ws, { t: 'map', ...mapInfo(id, p) });
      return true;
    }
    case 'heal':
      p.hp = p.maxHp;
      p.ki = p.maxKi;
      p.dead = false;
      return true;
    case 'killall': {
      let n = 0;
      for (const m of world.monsters.values())
        if (m.map === p.map && !m.dead) {
          world.damageMonster(m, m.hp + 1, p, {});
          n++;
        }
      sysChat(ws, `Đã hạ ${n} quái trong khu vực.`);
      return true;
    }
    case 'admin': {
      const target = save.getAccount(rest[0] || '');
      if (!target) return sysChat(ws, 'Không tìm thấy tài khoản.');
      target.admin = true;
      save.saveSoon();
      sysChat(ws, `Đã cấp quyền quản trị cho ${target.name}.`);
      return true;
    }
  }
  return false;
}

// ---------- Xử lý gói tin ----------
wss.on('connection', (ws) => {
  ws.player = null;
  let lastChat = 0;
  let lastAction = 0;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      return;
    }
    const now = Date.now();

    // --- Đăng ký / đăng nhập ---
    if (msg.t === 'register') {
      if (ws.player) return;
      const user = U.cleanName(msg.user, 18);
      const charName = U.cleanName(msg.char, 16);
      if (user.length < 3) return send(ws, { t: 'err', msg: 'Tên tài khoản cần ít nhất 3 ký tự.' });
      if (charName.length < 2) return send(ws, { t: 'err', msg: 'Tên nhân vật cần ít nhất 2 ký tự.' });
      if (save.getAccount(user)) return send(ws, { t: 'err', msg: 'Tài khoản đã tồn tại.' });
      if (Object.values(save.accounts()).some((a) => a.char && a.char.name.toLowerCase() === charName.toLowerCase()))
        return send(ws, { t: 'err', msg: 'Tên nhân vật đã được dùng.' });
      const first = save.accountCount() === 0;
      const acc = save.createAccount(user, msg.pass || '', {
        admin: first,
        char: Player.create(user, charName, msg.cls || 1).toSave(),
      });
      if (!acc) return send(ws, { t: 'err', msg: 'Không tạo được tài khoản.' });
      const p = Player.create(user, charName, msg.cls || 1);
      ws.acc = acc;
      enterWorld(ws, p);
      if (first) sysChat(ws, 'Bạn là người chơi đầu tiên — đã được cấp quyền quản trị (gõ /help).');
      return;
    }

    if (msg.t === 'login') {
      if (ws.player) return;
      const acc = save.verify(U.cleanName(msg.user, 18), msg.pass || '');
      if (!acc) return send(ws, { t: 'err', msg: 'Sai tài khoản hoặc mật khẩu.' });
      if (!acc.char) return send(ws, { t: 'err', msg: 'Tài khoản chưa có nhân vật.' });
      const existing = [...world.players.values()].find((x) => x.acc === acc.key);
      if (existing) return send(ws, { t: 'err', msg: 'Tài khoản này đang online ở nơi khác.' });
      const p = new Player(acc.key, acc.char);
      ws.acc = acc;
      enterWorld(ws, p);
      return;
    }

    if (msg.t === 'guest') {
      if (ws.player) return;
      let name;
      let guard = 0;
      do {
        name = 'Khách_' + U.uid().slice(0, 5);
        guard++;
      } while (save.getAccount(name) && guard < 20);
      const cls = U.clamp(parseInt(msg.cls) || 1, 1, 4);
      const clsDef = CLASS_BY_ID[cls];
      const acc = save.createAccount(name, U.uid(), { guest: true, char: Player.create(name, name, cls).toSave() });
      const p = new Player(acc.key, acc.char);
      ws.acc = acc;
      enterWorld(ws, p);
      return;
    }

    const p = ws.player;
    if (!p) return;

    switch (msg.t) {
      case 'ping':
        send(ws, { t: 'pong', ts: msg.ts, now });
        return;
      case 'input': {
        const b = msg.b | 0;
        p.input.up = b & 1 ? 1 : 0;
        p.input.down = b & 2 ? 1 : 0;
        p.input.left = b & 4 ? 1 : 0;
        p.input.right = b & 8 ? 1 : 0;
        return;
      }
      case 'atk': {
        if (p.dead) return;
        if (now - lastAction < 40) return;
        lastAction = now;
        world.playerAttack(p, msg.x, msg.y);
        return;
      }
      case 'sk': {
        if (p.dead) return;
        const r = world.castSkill(p, msg.id, msg.x, msg.y, msg.tid);
        if (r && !r.ok && r.msg) sysChat(ws, r.msg);
        return;
      }
      case 'chat': {
        const text = U.safeStr(msg.msg, 200);
        if (!text) return;
        if (now - lastChat < 450) return sysChat(ws, 'Nhắn chậm thôi nào!');
        lastChat = now;
        if (text[0] === '/' && handleCommand(p, ws, text)) return;
        const packet = { t: 'chat', ch: 'world', from: p.name, cls: p.clsKey, lv: p.lv, msg: text, map: p.map };
        for (const o of world.players.values()) if (o.ws) send(o.ws, packet);
        return;
      }
      case 'use': {
        const i = msg.i | 0;
        const it = p.inv[i];
        if (!it) return;
        const tpl = ITEM_MAP[it.t];
        if (!tpl || tpl.kind !== 'use') return;
        if ((p.cds.use || 0) > now) return;
        const eff = tpl.effect || {};
        if (p.dead && !eff.warp) return sysChat(ws, 'Bạn đã ngã xuống, chờ hồi sinh...');
        p.cds.use = now + 800;
        let used = false;
        if (eff.hpPct) {
          const h = p.heal(Math.round(p.maxHp * eff.hpPct));
          world.ev({ k: 'heal', id: p.id, v: h, map: p.map });
          used = true;
        }
        if (eff.kiPct) {
          p.restoreKi(Math.round(p.maxKi * eff.kiPct));
          used = true;
        }
        if (eff.warp === 'village') {
          world.teleport(p, 0, maps[0].start.x, maps[0].start.y);
          used = true;
        }
        if (used) p.removeAt(i, 1);
        return;
      }
      case 'npc': {
        const map = maps[p.map];
        const n = map.npcs.find((x) => Math.hypot(x.x - p.x, x.y - p.y) < 80);
        if (!n) return sysChat(ws, 'Không có ai ở gần đây.');
        if (n.type === 'healer') {
          p.hp = p.maxHp;
          p.ki = p.maxKi;
          p.dead = false;
          p.dirty = true;
          sysChat(ws, `${n.name}: "Đã chữa lành cho bạn."`);
        }
        send(ws, { t: 'npc', npc: n });
        return;
      }
      case 'respawn':
        if (p.dead) world.respawn(p);
        return;
      case 'equip':
        if (!p.equipFrom(msg.i | 0)) sysChat(ws, 'Không thể trang bị vật phẩm này.');
        return;
      case 'unequip':
        if (!p.unequip(msg.slot)) sysChat(ws, 'Túi đồ đã đầy hoặc ô trống.');
        return;
      case 'sell': {
        const i = msg.i | 0;
        const it = p.inv[i];
        if (!it) return;
        const price = itemPrice(it);
        p.gold += price;
        p.removeAt(i, 99);
        sysChat(ws, `Đã bán, nhận ${U.fmt(price)} vàng.`);
        return;
      }
      case 'buy': {
        const tpl = ITEM_MAP[msg.id];
        if (!tpl || tpl.kind !== 'use') return sysChat(ws, 'Vật phẩm không bán ở đây.');
        const qty = U.clamp(parseInt(msg.q) || 1, 1, 20);
        const cost = (tpl.price || 50) * qty;
        if (p.gold < cost) return sysChat(ws, `Không đủ vàng (cần ${U.fmt(cost)}).`);
        if (!p.addItem({ uid: U.uid(), t: tpl.id, q: qty })) return sysChat(ws, 'Túi đồ đã đầy.');
        p.gold -= cost;
        sysChat(ws, `Đã mua ${tpl.name} x${qty} (${U.fmt(cost)} vàng).`);
        return;
      }
      case 'enhance': {
        const i = msg.i | 0;
        const it = p.inv[i];
        if (!it) return;
        const tpl = ITEM_MAP[it.t];
        if (!tpl || tpl.kind !== 'equip') return sysChat(ws, 'Chỉ cường hóa được trang bị.');
        if ((it.upg || 0) >= 15) return sysChat(ws, 'Vật phẩm đã đạt giới hạn +15.');
        const cost = p.enhanceCost(it);
        if (p.gold < cost) return sysChat(ws, `Cần ${U.fmt(cost)} vàng để cường hóa.`);
        p.gold -= cost;
        const rate = Math.max(0.15, 0.92 - (it.upg || 0) * 0.06);
        if (world.rng() < rate) {
          it.upg = (it.upg || 0) + 1;
          sysChat(ws, `Cường hóa thành công! ${tpl.name} +${it.upg}`);
        } else {
          sysChat(ws, `Cường hóa thất bại (${Math.round(rate * 100)}%). Vật phẩm vẫn giữ nguyên.`);
        }
        p.recompute();
        return;
      }
      case 'stat': {
        const key = ['str', 'agi', 'vit', 'int'].includes(msg.k) ? msg.k : null;
        const n = U.clamp(parseInt(msg.n) || 1, 1, 99);
        if (!key || p.points < n) return;
        p.points -= n;
        p.stats[key] += n;
        p.recompute();
        return;
      }
      case 'mapinfo':
        send(ws, { t: 'map', ...mapInfo(p.map, p) });
        return;
      case 'logout':
        ws.close();
        return;
    }
  });

  ws.on('close', () => {
    const p = ws.player;
    if (p) {
      const acc = save.getAccount(p.acc);
      if (acc) {
        acc.char = p.toSave();
        save.saveSoon();
      }
      world.removePlayer(p);
      broadcast({ t: 'chat', ch: 'sys', msg: `${p.name} đã rời khỏi Linh Khí Online.` });
    }
  });

  ws.on('error', () => {});
});

// ---------- Vòng lặp game ----------
let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(120, now - last);
  last = now;
  try {
    world.tick(dt, now);
  } catch (e) {
    console.error('[tick]', e);
  }
}, TICK_MS);

setInterval(() => {
  const now = Date.now();
  const snaps = world.snapshots();
  for (const p of world.players.values()) {
    const s = snaps.get(p.map);
    if (s) send(p.ws, { t: 's', ts: now, ...s });
    if (p.dirty || now - (p._selfAt || 0) > 900) {
      send(p.ws, { t: 'self', s: p.netSelf() });
      p.dirty = false;
      p._selfAt = now;
    }
  }
}, SNAPSHOT_MS);

// Tự động lưu
setInterval(() => {
  for (const p of world.players.values()) {
    const acc = save.getAccount(p.acc);
    if (acc) acc.char = p.toSave();
  }
  save.flush();
}, 20000);

// Thông báo định kỳ
setInterval(() => {
  if (world.players.size === 0) return;
  broadcast({ t: 'chat', ch: 'sys', msg: TIPS[Math.floor(Math.random() * TIPS.length)] });
}, 180000);

server.listen(PORT, HOST, () => {
  console.log(`⚔  Linh Khí Online đang chạy tại http://localhost:${PORT}`);
  console.log(`   Bản đồ: ${Object.keys(maps).length} · Quái vật: ${world.monsters.size} · Tài khoản: ${save.accountCount()}`);
});

process.on('SIGINT', () => {
  for (const p of world.players.values()) {
    const acc = save.getAccount(p.acc);
    if (acc) acc.char = p.toSave();
  }
  save.flush();
  process.exit(0);
});
