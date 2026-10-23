// Thế giới game: bản đồ, thực thể, chiến đấu, rơi đồ, gói tin trạng thái
import { TILE, isBlocked } from '../shared/tiles.js';
import { SKILL_MAP } from '../shared/classes.js';
import { ITEM_MAP, EQUIP_DROP_POOL, POTION_IDS } from '../shared/items.js';
import * as C from '../shared/config.js';
import { Monster } from './monster.js';
import { mulberry32, randInt, rand, pick, clamp, dist, dist2, uid } from './util.js';

const MONSTER_ID_BASE = 100000;

function rollRarity(rng, lv, boss) {
  const r = rng();
  const bonus = boss ? 0.28 : Math.min(0.1, lv * 0.0025);
  if (r < 0.56 - bonus) return 0;
  if (r < 0.8 - bonus * 0.5) return 1;
  if (r < 0.93) return 2;
  if (r < 0.985) return 3;
  return 4;
}

export class World {
  constructor(maps, hooks = {}) {
    this.maps = maps;
    this.hooks = hooks;
    this.rng = mulberry32(20240607);
    this.players = new Map();
    this.monsters = new Map();
    this.drops = new Map();
    this.projectiles = new Map();
    this.zones = [];
    this.events = [];
    this.nextPlayerId = 1;
    this.nextMonsterId = MONSTER_ID_BASE;
    this.nextDropId = 1;
    this.nextProjId = 1;
    this.spawnState = {};

    for (const map of Object.values(maps)) {
      this.spawnState[map.id] = map.spawns.map(() => ({ count: 0, next: 0 }));
      for (let i = 0; i < map.spawns.length; i++) this.fillSpawn(map, i);
    }
  }

  // ---- Bản đồ & va chạm ----
  mapOf(id) {
    return this.maps[id];
  }
  tileAt(mapId, x, y) {
    const map = this.maps[mapId];
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (!map || tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return 7;
    return map.tiles[ty * map.w + tx];
  }
  collides(mapId, x, y, r) {
    const map = this.maps[mapId];
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
  moveEntity(e, dx, dy, r) {
    const nx = e.x + dx;
    if (!this.collides(e.map, nx, e.y, r)) e.x = nx;
    const ny = e.y + dy;
    if (!this.collides(e.map, e.x, ny, r)) e.y = ny;
    const map = this.mapOf(e.map);
    e.x = clamp(e.x, TILE * 0.9, map.w * TILE - TILE * 0.9);
    e.y = clamp(e.y, TILE * 0.9, map.h * TILE - TILE * 0.9);
  }
  randomFreeSpot(mapId, cx, cy, r) {
    for (let i = 0; i < 24; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = this.rng() * r;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      if (!this.collides(mapId, x, y, 12)) return [x, y];
    }
    return [cx, cy];
  }

  // ---- Sinh quái ----
  fillSpawn(map, idx) {
    const zone = map.spawns[idx];
    if (!zone) return;
    const st = this.spawnState[map.id][idx];
    while (st.count < zone.max) this.spawnMonster(map, idx);
  }
  spawnMonster(map, idx) {
    const zone = map.spawns[idx];
    const st = this.spawnState[map.id][idx];
    const id = this.nextMonsterId++;
    const [x, y] = this.randomFreeSpot(map.id, zone.x, zone.y, zone.r);
    const tplId = pick(this.rng, zone.ids);
    const m = new Monster(id, tplId, x, y, idx, map.id);
    this.monsters.set(id, m);
    st.count++;
    return m;
  }
  scheduleRespawn(map, idx, delay) {
    const st = this.spawnState[map.id][idx];
    st.next = Date.now() + delay;
  }

  // ---- Sự kiện ----
  ev(e) {
    this.events.push(e);
    if (this.events.length > 400) this.events.splice(0, 200);
  }

  // ---- Người chơi ----
  addPlayer(p) {
    p.id = this.nextPlayerId++;
    const map = this.mapOf(p.map);
    if (!p.x || !p.y || this.collides(p.map, p.x, p.y, 10)) {
      const [x, y] = this.randomFreeSpot(p.map, map.start.x, map.start.y, 60);
      p.x = x;
      p.y = y;
    }
    this.players.set(p.id, p);
    this.ev({ k: 'join', id: p.id, name: p.name, map: p.map });
    return p;
  }
  removePlayer(p) {
    this.players.delete(p.id);
    this.ev({ k: 'leave', id: p.id, name: p.name, map: p.map });
  }

  // ---- Sát thương ----
  damagePlayer(p, raw, src, opts = {}) {
    if (p.dead) return 0;
    const map = this.mapOf(p.map);
    if (map.safe) return 0;
    let dmg = Math.max(1, Math.round(raw * rand(this.rng, 0.9, 1.1)));
    if (p.shield > 0) {
      const absorb = Math.min(p.shield, dmg);
      p.shield -= absorb;
      dmg -= absorb;
      if (absorb > 0) this.ev({ k: 'dmg', id: p.id, v: absorb, t: 'shield', map: p.map });
    }
    if (dmg <= 0) return 0;
    p.hp -= dmg;
    p.lastDamageAt = Date.now();
    p.dirty = true;
    this.ev({ k: 'dmg', id: p.id, v: dmg, t: opts.type || 'hit', c: opts.crit ? 1 : 0, map: p.map });
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      p.deadUntil = Date.now() + C.RESPAWN_DELAY;
      p.dots = [];
      p.buffs = [];
      this.ev({ k: 'die', id: p.id, kind: 'player', name: p.name, map: p.map });
      if (src && src !== p && src.kills !== undefined) src.kills++;
      if (p.ws) this.send(p.ws, { t: 'died', by: src && src.name ? src.name : null });
    }
    return dmg;
  }

  damageMonster(m, raw, src, opts = {}) {
    if (m.dead) return 0;
    const dmg = Math.max(1, Math.round(raw * rand(this.rng, 0.92, 1.08)));
    m.hp -= dmg;
    m.hitFlash = 0.18;
    if (src && src.id) m.damageMap.set(src.id, (m.damageMap.get(src.id) || 0) + dmg);
    this.ev({ k: 'dmg', id: m.id, v: dmg, t: opts.type || 'hit', c: opts.crit ? 1 : 0, monster: 1, map: m.map });
    if (m.hp <= 0) {
      m.hp = 0;
      m.dead = true;
      m.deadAt = Date.now();
      this.ev({ k: 'die', id: m.id, kind: 'monster', name: m.tpl.name, x: m.x, y: m.y, map: m.map });
      this.onMonsterDeath(m, src);
    }
    return dmg;
  }

  onMonsterDeath(m, killer) {
    // Chia kinh nghiệm theo tỷ lệ sát thương
    let total = 0;
    for (const v of m.damageMap.values()) total += v;
    if (total > 0) {
      for (const [pid, dmg] of m.damageMap) {
        const p = this.players.get(pid);
        if (!p || p.map !== m.map) continue;
        const gain = Math.max(1, Math.round((m.xp * dmg) / total));
        const ups = p.addXp(gain);
        if (ups > 0) this.ev({ k: 'lvlup', id: p.id, name: p.name, lv: p.lv, map: p.map });
        if (p.ws) this.send(p.ws, { t: 'xp', v: gain });
      }
    } else if (killer) {
      const ups = killer.addXp(m.xp);
      if (ups > 0) this.ev({ k: 'lvlup', id: killer.id, name: killer.name, lv: killer.lv, map: killer.map });
    }

    // Rơi vàng
    const gold = Math.round(m.gold * rand(this.rng, 0.8, 1.35));
    if (gold > 0) this.addDrop(m.map, m.x + randInt(this.rng, -14, 14), m.y + randInt(this.rng, -10, 10), { gold });

    // Rơi vật phẩm
    const lv = m.tpl.lv;
    const boss = !!m.tpl.boss;
    let rolls = boss ? 3 : this.rng() < 0.42 ? 1 : 0;
    for (let i = 0; i < rolls; i++) {
      const item = this.rollItem(lv, boss);
      if (item) this.addDrop(m.map, m.x + randInt(this.rng, -22, 22), m.y + randInt(this.rng, -16, 16), { item });
    }
    if (this.rng() < (boss ? 0.6 : 0.16)) {
      const potion = pick(this.rng, POTION_IDS.filter((x) => x !== 'phu-tro-ve'));
      this.addDrop(m.map, m.x + randInt(this.rng, -18, 18), m.y + randInt(this.rng, -12, 12), { item: { t: potion, q: 1 } });
    }

    this.scheduleRespawn(this.mapOf(m.map), m.spawnIdx, m.tpl.boss ? 180000 : 4500);
    const st = this.spawnState[m.map][m.spawnIdx];
    st.count--;
    setTimeout(() => {
      this.monsters.delete(m.id);
    }, 1200);
  }

  rollItem(lv, boss) {
    if (this.rng() < 0.18) {
      return { t: pick(this.rng, POTION_IDS), q: 1 };
    }
    const tplId = pick(this.rng, EQUIP_DROP_POOL);
    const tpl = ITEM_MAP[tplId];
    if (!tpl) return null;
    return {
      uid: uid(),
      t: tplId,
      lv: clamp(lv + randInt(this.rng, -2, 3), 1, C.MAX_LEVEL),
      rar: rollRarity(this.rng, lv, boss),
      upg: boss && this.rng() < 0.3 ? 1 : 0,
      q: 1,
    };
  }

  addDrop(mapId, x, y, payload) {
    const id = this.nextDropId++;
    const d = { id, map: mapId, x, y, until: Date.now() + C.DROP_LIFETIME, ...payload };
    this.drops.set(id, d);
    return d;
  }

  // ---- Đánh thường ----
  basicAttackCd(p) {
    return Math.round(900 * (1 - Math.min(0.35, p.stats.agi * 0.006)));
  }
  playerAttack(p, tx, ty) {
    const now = Date.now();
    if (p.dead) return;
    if ((p.cds.atk || 0) > now) return;
    const map = this.mapOf(p.map);
    if (map.safe) return;
    p.cds.atk = now + this.basicAttackCd(p);
    p.dir = Math.atan2(ty - p.y, tx - p.x);
    p.state = 'attack';
    p.animT = 0.28;
    const range = 84;
    const arc = 1.15;
    let hits = 0;
    for (const m of this.monsters.values()) {
      if (m.map !== p.map || m.dead) continue;
      if (dist2(m.x, m.y, p.x, p.y) > (range + m.radius) ** 2) continue;
      if (Math.abs(this.angDiff(Math.atan2(m.y - p.y, m.x - p.x), p.dir)) > arc) continue;
      const crit = this.rng() < p.effCrit();
      const dmg = C.calcDamage(p.effAtk() * (crit ? 1.8 : 1), m.def);
      this.damageMonster(m, dmg, p, { crit });
      hits++;
    }
    if (map.pvp) {
      for (const o of this.players.values()) {
        if (o.map !== p.map || o.dead || o.id === p.id) continue;
        if (dist2(o.x, o.y, p.x, p.y) > range ** 2) continue;
        if (Math.abs(this.angDiff(Math.atan2(o.y - p.y, o.x - p.x), p.dir)) > arc) continue;
        const crit = this.rng() < p.effCrit();
        this.damagePlayer(o, C.calcDamage(p.effAtk() * (crit ? 1.8 : 1), o.effDef()), p, { crit });
        hits++;
      }
    }
    if (hits === 0) this.ev({ k: 'miss', id: p.id, map: p.map });
  }

  angDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  // ---- Kỹ năng ----
  castSkill(p, skillId, tx, ty, targetId) {
    const now = Date.now();
    const sk = SKILL_MAP[skillId];
    if (!sk || p.dead) return { ok: false, msg: 'Kỹ năng không tồn tại' };
    if (!p.cls.skills.includes(skillId)) return { ok: false, msg: 'Kỹ năng không thuộc môn phái' };
    if ((p.cds[skillId] || 0) > now) return { ok: false, msg: 'Kỹ năng đang hồi' };
    if (p.ki < sk.ki) return { ok: false, msg: 'Không đủ linh lực' };
    const map = this.mapOf(p.map);
    if (map.safe && (sk.type === 'melee' || sk.type === 'aoe' || sk.type === 'proj' || sk.type === 'dash')) {
      if (!map.pvp) return { ok: false, msg: 'Khu vực an toàn: không dùng được kỹ năng tấn công' };
    }
    p.ki -= sk.ki;
    p.cds[skillId] = now + sk.cd;
    p.dirty = true;
    p.state = 'attack';
    p.animT = 0.3;
    if (tx !== undefined && tx !== null) p.dir = Math.atan2(ty - p.y, tx - p.x);

    const distToTarget = dist(p.x, p.y, tx ?? p.x, ty ?? p.y);
    const clamped = Math.min(distToTarget, sk.range || 200);
    const cx = p.x + Math.cos(p.dir) * clamped;
    const cy = p.y + Math.sin(p.dir) * clamped;

    switch (sk.type) {
      case 'melee': {
        const range = sk.range || 110;
        const arc = sk.arc || 1.6;
        for (const m of this.monsters.values()) {
          if (m.map !== p.map || m.dead) continue;
          if (dist2(m.x, m.y, p.x, p.y) > (range + m.radius) ** 2) continue;
          if (Math.abs(this.angDiff(Math.atan2(m.y - p.y, m.x - p.x), p.dir)) > arc) continue;
          const crit = this.rng() < p.effCrit(sk.crit || 0);
          const power = sk.magic ? p.magic : p.effAtk();
          this.damageMonster(m, C.calcDamage(power * sk.mult * (crit ? 1.8 : 1), m.def), p, { crit, type: skillId });
        }
        if (map.pvp) {
          for (const o of this.players.values()) {
            if (o.map !== p.map || o.dead || o.id === p.id) continue;
            if (dist2(o.x, o.y, p.x, p.y) > range ** 2) continue;
            if (Math.abs(this.angDiff(Math.atan2(o.y - p.y, o.x - p.x), p.dir)) > arc) continue;
            const crit = this.rng() < p.effCrit(sk.crit || 0);
            const power = sk.magic ? p.magic : p.effAtk();
            this.damagePlayer(o, C.calcDamage(power * sk.mult * (crit ? 1.8 : 1), o.effDef()), p, { crit, type: skillId });
          }
        }
        this.ev({ k: 'fx', kind: 'slash', x: p.x, y: p.y, dir: p.dir, range, arc, color: sk.color, map: p.map, id: p.id });
        break;
      }
      case 'proj': {
        const [vx, vy] = [Math.cos(p.dir), Math.sin(p.dir)];
        const id = this.nextProjId++;
        this.projectiles.set(id, {
          id, map: p.map, x: p.x + vx * 22, y: p.y + vy * 22,
          vx: vx * sk.speed, vy: vy * sk.speed, r: sk.radius || 14,
          ownerId: p.id, sk, pierce: sk.pierce || 0, hit: new Set(),
          life: (sk.range || 500) / (sk.speed || 500), color: sk.color,
        });
        break;
      }
      case 'aoe': {
        const zx = sk.range ? cx : p.x;
        const zy = sk.range ? cy : p.y;
        this.zones.push({
          id: uid(), map: p.map, x: zx, y: zy, r: sk.radius || 120,
          at: now + (sk.delay || 400), sk, ownerId: p.id, skillId,
        });
        break;
      }
      case 'heal': {
        let target = p;
        if (targetId) {
          const o = this.players.get(targetId);
          if (o && o.map === p.map && !o.dead && dist(o.x, o.y, p.x, p.y) <= (sk.range || 400)) target = o;
        }
        const amount = Math.round(target.maxHp * (sk.healPct || 0.3) + (sk.healFlat || 0));
        const healed = target.heal(amount);
        this.ev({ k: 'heal', id: target.id, v: healed, map: target.map });
        this.ev({ k: 'fx', kind: 'heal', x: target.x, y: target.y, color: sk.color, map: target.map, id: target.id });
        break;
      }
      case 'buff': {
        for (const [key, val] of Object.entries(sk.buff || {})) {
          if (key === 'shield') {
            p.shield += Math.round(p.maxHp * val);
            p.dirty = true;
          } else {
            p.addBuff(key, val, sk.dur || 8000, sk.name, sk.color);
          }
        }
        this.ev({ k: 'fx', kind: 'buff', x: p.x, y: p.y, color: sk.color, map: p.map, id: p.id });
        break;
      }
      case 'dash': {
        const steps = 10;
        const dx = (cx - p.x) / steps;
        const dy = (cy - p.y) / steps;
        const hitSet = new Set();
        for (let i = 0; i < steps; i++) {
          const nx = p.x + dx;
          if (!this.collides(p.map, nx, p.y, 10)) p.x = nx;
          const ny = p.y + dy;
          if (!this.collides(p.map, p.x, ny, 10)) p.y = ny;
          for (const m of this.monsters.values()) {
            if (m.map !== p.map || m.dead || hitSet.has(m.id)) continue;
            if (dist2(m.x, m.y, p.x, p.y) > (sk.radius || 80) ** 2) continue;
            hitSet.add(m.id);
            const crit = this.rng() < p.effCrit();
            this.damageMonster(m, C.calcDamage(p.effAtk() * sk.mult * (crit ? 1.8 : 1), m.def), p, { crit, type: skillId });
          }
          if (map.pvp) {
            for (const o of this.players.values()) {
              if (o.map !== p.map || o.dead || o.id === p.id || hitSet.has(o.id)) continue;
              if (dist2(o.x, o.y, p.x, p.y) > (sk.radius || 80) ** 2) continue;
              hitSet.add(o.id);
              const crit = this.rng() < p.effCrit();
              this.damagePlayer(o, C.calcDamage(p.effAtk() * sk.mult * (crit ? 1.8 : 1), o.effDef()), p, { crit, type: skillId });
            }
          }
        }
        this.ev({ k: 'fx', kind: 'dash', x: p.x, y: p.y, color: sk.color, map: p.map, id: p.id });
        break;
      }
    }
    return { ok: true };
  }

  // ---- Vòng lặp chính ----
  tick(dtMs, now) {
    const dt = dtMs / 1000;

    for (const p of this.players.values()) {
      p.tickStatus(now, this);
      if (p.animT > 0) {
        p.animT -= dt;
        if (p.animT <= 0 && p.state === 'attack') p.state = 'idle';
      }
      if (p.dead) {
        if (now >= p.deadUntil) this.respawn(p);
        continue;
      }
      // Hồi phục
      const map = this.mapOf(p.map);
      const inCombat = now - p.lastDamageAt < 5000;
      const rate = map.safe ? 0.08 : inCombat ? 0.012 : 0.035;
      if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * rate * dt);
      if (p.ki < p.maxKi) p.ki = Math.min(p.maxKi, p.ki + p.maxKi * (map.safe ? 0.12 : 0.045) * dt);
      if (p.shield > 0) {
        p.shield = Math.max(0, p.shield - p.maxHp * 0.02 * dt);
      }

      // Di chuyển
      const ix = (p.input.right ? 1 : 0) - (p.input.left ? 1 : 0);
      const iy = (p.input.down ? 1 : 0) - (p.input.up ? 1 : 0);
      if (ix || iy) {
        const len = Math.hypot(ix, iy);
        const sp = p.effSpeed() * dt;
        p.dir = Math.atan2(iy, ix);
        this.moveEntity(p, (ix / len) * sp, (iy / len) * sp, 10);
        if (p.state !== 'attack') p.state = 'move';
      } else if (p.state !== 'attack') {
        p.state = 'idle';
      }

      // Cổng dịch chuyển
      for (const portal of map.portals) {
        if (dist2(p.x, p.y, portal.x, portal.y) < 34 * 34) {
          this.teleport(p, portal.to, portal.tox, portal.toy);
          break;
        }
      }
    }

    // Quái vật
    for (const m of this.monsters.values()) {
      if (m.dead) continue;
      m.animT += dt;
      if (m.hitFlash > 0) m.hitFlash -= dt;
      this.updateMonster(m, dt, now);
    }

    // Đạn
    for (const pr of [...this.projectiles.values()]) {
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.life <= 0 || this.collides(pr.map, pr.x, pr.y, 4)) {
        this.ev({ k: 'fx', kind: 'hit', x: pr.x, y: pr.y, color: pr.color, map: pr.map });
        this.projectiles.delete(pr.id);
        continue;
      }
      const owner = this.players.get(pr.ownerId);
      // Trúng quái
      let hitSomething = false;
      for (const m of this.monsters.values()) {
        if (m.map !== pr.map || m.dead || pr.hit.has(m.id)) continue;
        if (dist2(m.x, m.y, pr.x, pr.y) > (pr.r + m.radius) ** 2) continue;
        pr.hit.add(m.id);
        hitSomething = true;
        if (owner) {
          const crit = this.rng() < owner.effCrit();
          const power = pr.sk.magic ? owner.magic : owner.effAtk();
          this.damageMonster(m, C.calcDamage(power * pr.sk.mult * (crit ? 1.8 : 1), m.def), owner, { crit, type: pr.sk.id });
          if (pr.sk.poison && crit !== null) m.dots.push({ type: 'poison', val: pr.sk.poison, until: now + (pr.sk.poisonDur || 5000), next: now + 1500, tickMs: 1500, srcId: owner.id });
        }
        break;
      }
      // Trúng người chơi (PvP)
      if (!hitSomething && owner) {
        const map = this.mapOf(pr.map);
        if (map.pvp) {
          for (const o of this.players.values()) {
            if (o.map !== pr.map || o.dead || o.id === owner.id || pr.hit.has(o.id)) continue;
            if (dist2(o.x, o.y, pr.x, pr.y) > (pr.r + 12) ** 2) continue;
            pr.hit.add(o.id);
            hitSomething = true;
            const crit = this.rng() < owner.effCrit();
            const power = pr.sk.magic ? owner.magic : owner.effAtk();
            this.damagePlayer(o, C.calcDamage(power * pr.sk.mult * (crit ? 1.8 : 1), o.effDef()), owner, { crit, type: pr.sk.id });
            break;
          }
        }
      }
      if (hitSomething) {
        this.ev({ k: 'fx', kind: 'hit', x: pr.x, y: pr.y, color: pr.color, map: pr.map });
        if (pr.pierce > 0) pr.pierce--;
        else this.projectiles.delete(pr.id);
      }
    }

    // Độc trên quái
    for (const m of this.monsters.values()) {
      if (m.dead || !m.dots.length) continue;
      m.dots = m.dots.filter((d) => {
        if (d.until <= now) return false;
        if (now >= d.next) {
          d.next = now + d.tickMs;
          const src = this.players.get(d.srcId);
          this.damageMonster(m, Math.max(1, (src ? src.effAtk() : 20) * d.val), src, { type: 'poison' });
        }
        return true;
      });
    }

    // Vùng hiệu ứng nổ chậm
    if (this.zones.length) {
      this.zones = this.zones.filter((z) => {
        if (now < z.at) return true;
        const owner = this.players.get(z.ownerId);
        this.ev({ k: 'boom', x: z.x, y: z.y, r: z.r, color: z.sk.color, map: z.map });
        if (z.sk.healPct) {
          for (const o of this.players.values()) {
            if (o.map !== z.map || o.dead) continue;
            if (dist2(o.x, o.y, z.x, z.y) > z.r * z.r) continue;
            const amt = Math.round(o.maxHp * z.sk.healPct + (z.sk.healFlat || 0));
            this.ev({ k: 'heal', id: o.id, v: o.heal(amt), map: o.map });
          }
        } else if (owner) {
          for (const m of this.monsters.values()) {
            if (m.map !== z.map || m.dead) continue;
            if (dist2(m.x, m.y, z.x, z.y) > z.r * z.r) continue;
            const crit = this.rng() < owner.effCrit();
            const power = z.sk.magic ? owner.magic : owner.effAtk();
            this.damageMonster(m, C.calcDamage(power * z.sk.mult * (crit ? 1.8 : 1), m.def), owner, { crit, type: z.sk.id });
            if (z.sk.slow) m.speedPenalty = { val: z.sk.slow, until: now + (z.sk.slowDur || 3000) };
          }
          const map = this.mapOf(z.map);
          if (map.pvp) {
            for (const o of this.players.values()) {
              if (o.map !== z.map || o.dead || o.id === owner.id) continue;
              if (dist2(o.x, o.y, z.x, z.y) > z.r * z.r) continue;
              const crit = this.rng() < owner.effCrit();
              const power = z.sk.magic ? owner.magic : owner.effAtk();
              this.damagePlayer(o, C.calcDamage(power * z.sk.mult * (crit ? 1.8 : 1), o.effDef()), owner, { crit, type: z.sk.id });
              if (z.sk.slow) o.addDot('slow', z.sk.slow, z.sk.slowDur || 3000, owner.id, 99999);
            }
          }
        }
        return false;
      });
    }

    // Nhặt đồ
    for (const d of [...this.drops.values()]) {
      if (now > d.until) {
        this.drops.delete(d.id);
        continue;
      }
      for (const p of this.players.values()) {
        if (p.map !== d.map || p.dead) continue;
        if (dist2(p.x, p.y, d.x, d.y) > C.PICKUP_RANGE ** 2) continue;
        if (d.gold) {
          p.gold += d.gold;
          p.dirty = true;
          if (p.ws) this.send(p.ws, { t: 'pickup', gold: d.gold });
          this.drops.delete(d.id);
        } else if (d.item) {
          if (p.addItem({ ...d.item })) {
            if (p.ws) this.send(p.ws, { t: 'pickup', item: d.item });
            this.drops.delete(d.id);
          }
        }
        break;
      }
    }

    // Hồi sinh quái
    for (const map of Object.values(this.maps)) {
      for (let i = 0; i < map.spawns.length; i++) {
        const st = this.spawnState[map.id][i];
        if (st.count < map.spawns[i].max && now >= st.next) {
          this.spawnMonster(map, i);
          st.next = now + map.spawns[i].respawn;
        }
      }
    }
  }

  updateMonster(m, dt, now) {
    let sp = m.speed;
    if (m.speedPenalty && m.speedPenalty.until > now) sp *= 1 - m.speedPenalty.val;
    let target = m.target;
    if (target && (target.dead || target.map !== m.map || dist2(target.x, target.y, m.homeX, m.homeY) > m.leash * m.leash)) target = null;

    if (!target) {
      let best = null,
        bestD = m.aggro * m.aggro;
      for (const p of this.players.values()) {
        if (p.map !== m.map || p.dead) continue;
        const d = dist2(p.x, p.y, m.x, m.y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      target = best;
    }
    m.target = target;

    if (target) {
      const d = dist(m.x, m.y, target.x, target.y);
      m.dir = Math.atan2(target.y - m.y, target.x - m.x);
      if (d <= m.atkRange) {
        m.state = 'attack';
        if (now >= m.nextAtk) {
          m.nextAtk = now + m.atkCd;
          m.animT = 0;
          const crit = this.rng() < 0.08;
          this.damagePlayer(target, C.calcDamage(m.atk * (crit ? 1.6 : 1), target.effDef()), null, { crit, type: 'monster' });
        }
      } else {
        m.state = 'move';
        this.moveEntity(m, Math.cos(m.dir) * sp * dt, Math.sin(m.dir) * sp * dt, m.radius);
      }
      return;
    }

    // Lang thang quanh vị trí sinh
    if (dist2(m.x, m.y, m.homeX, m.homeY) > 40000) {
      m.dir = Math.atan2(m.homeY - m.y, m.homeX - m.x);
      m.state = 'move';
      this.moveEntity(m, Math.cos(m.dir) * sp * 0.7 * dt, Math.sin(m.dir) * sp * 0.7 * dt, m.radius);
      return;
    }
    if (now >= m.wanderUntil) {
      m.wanderUntil = now + 1500 + this.rng() * 2500;
      const a = this.rng() * Math.PI * 2;
      const r = this.rng() * 120;
      m.wx = m.homeX + Math.cos(a) * r;
      m.wy = m.homeY + Math.sin(a) * r;
    }
    const dd = dist(m.x, m.y, m.wx, m.wy);
    if (dd > 8) {
      m.dir = Math.atan2(m.wy - m.y, m.wx - m.x);
      m.state = 'move';
      this.moveEntity(m, Math.cos(m.dir) * sp * 0.35 * dt, Math.sin(m.dir) * sp * 0.35 * dt, m.radius);
    } else {
      m.state = 'idle';
    }
  }

  respawn(p) {
    const village = this.maps[0];
    p.dead = false;
    p.hp = Math.max(1, Math.round(p.maxHp * 0.6));
    p.ki = Math.round(p.maxKi * 0.6);
    p.dots = [];
    p.buffs = [];
    p.shield = 0;
    this.teleport(p, 0, village.start.x, village.start.y);
    p.dirty = true;
    if (p.ws) this.send(p.ws, { t: 'revive' });
    this.ev({ k: 'revive', id: p.id, name: p.name, map: p.map });
  }

  teleport(p, mapId, x, y) {
    const map = this.mapOf(mapId);
    if (!map) return;
    p.map = mapId;
    let px = x,
      py = y;
    if (this.collides(mapId, px, py, 10)) [px, py] = this.randomFreeSpot(mapId, x, y, 80);
    p.x = px;
    p.y = py;
    p.dirty = true;
    if (p.ws && this.hooks.onMap) this.hooks.onMap(p, mapId, Math.round(px), Math.round(py));
  }

  // ---- Gói tin trạng thái ----
  snapshots() {
    const byMap = new Map();
    const get = (id) => {
      if (!byMap.has(id)) byMap.set(id, { p: [], m: [], d: [], pr: [], ev: [] });
      return byMap.get(id);
    };
    for (const p of this.players.values()) get(p.map).p.push(p.netBrief());
    for (const m of this.monsters.values()) get(m.map).m.push(m.netBrief());
    for (const d of this.drops.values()) {
      const item = d.item ? [d.item.t, d.item.lv || 1, d.item.rar || 0, d.item.upg || 0, d.item.q || 1] : 0;
      get(d.map).d.push([d.id, Math.round(d.x), Math.round(d.y), d.gold || 0, item]);
    }
    for (const pr of this.projectiles.values())
      get(pr.map).pr.push([pr.id, Math.round(pr.x), Math.round(pr.y), Math.round((Math.atan2(pr.vy, pr.vx) * 100) | 0) / 100, pr.color]);
    for (const e of this.events) {
      if (e.map !== undefined) get(e.map).ev.push(e);
      else for (const g of byMap.values()) g.ev.push(e);
    }
    this.events = [];
    return byMap;
  }

  send(ws, obj) {
    try {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
    } catch (e) {
      /* bỏ qua */
    }
  }
}
