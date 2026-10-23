// Đối tượng người chơi phía server
import { CLASS_BY_ID, CLASS_MAP, STAT_KEYS } from '../shared/classes.js';
import { ITEM_MAP, SLOTS, itemStats, itemPower } from '../shared/items.js';
import * as C from '../shared/config.js';
import { clamp, uid } from './util.js';

export class Player {
  constructor(acc, data) {
    this.id = 0;
    this.ws = null;
    this.acc = acc;
    this.name = data.name;
    this.clsKey = data.cls;
    this.cls = CLASS_MAP[this.clsKey];

    this.lv = data.lv || 1;
    this.xp = data.xp || 0;
    this.stats = { ...(data.stats || this.cls.base) };
    this.points = data.points ?? 0;
    this.gold = data.gold ?? 200;

    this.map = data.map ?? 0;
    this.x = data.x ?? 0;
    this.y = data.y ?? 0;
    this.dir = 0;
    this.inv = Array.isArray(data.inv) ? data.inv : [];
    this.equip = { weapon: null, armor: null, helm: null, boots: null, ring: null, ...(data.equip || {}) };

    this.hp = 0;
    this.ki = 0;
    this.shield = 0;
    this.buffs = [];
    this.dots = [];
    this.cds = {};
    this.state = 'idle';
    this.animT = 0;
    this.dead = false;
    this.deadUntil = 0;
    this.targetId = 0;
    this.input = { up: 0, down: 0, left: 0, right: 0 };
    this.lastDamageAt = 0;
    this.dirty = true;
    this.joinedAt = Date.now();
    this.kills = 0;

    this.recompute();
    this.hp = Math.min(data.hp ?? this.maxHp, this.maxHp);
    this.ki = Math.min(data.ki ?? this.maxKi, this.maxKi);
    if (this.hp <= 0) this.hp = this.maxHp;
  }

  static create(acc, name, clsId) {
    const cls = CLASS_BY_ID[clsId] || CLASS_BY_ID[1];
    return new Player(acc, {
      name,
      cls: cls.key,
      lv: 1,
      xp: 0,
      stats: { ...cls.base },
      points: 0,
      gold: 200,
      map: 0,
      x: 0,
      y: 0,
      inv: [],
      equip: {},
    });
  }

  toSave() {
    return {
      name: this.name,
      cls: this.clsKey,
      lv: this.lv,
      xp: this.xp,
      stats: this.stats,
      points: this.points,
      gold: this.gold,
      map: this.map,
      x: Math.round(this.x),
      y: Math.round(this.y),
      hp: Math.round(this.hp),
      ki: Math.round(this.ki),
      inv: this.inv,
      equip: this.equip,
      kills: this.kills,
    };
  }

  // ---- Chỉ số ----
  recompute() {
    const bonus = { atk: 0, def: 0, hp: 0, ki: 0, crit: 0, spd: 0 };
    for (const slot of SLOTS) {
      const it = this.equip[slot];
      if (!it) continue;
      const s = itemStats(it);
      for (const k of Object.keys(s)) bonus[k] = (bonus[k] || 0) + s[k];
    }
    this.maxHp = C.calcMaxHp(this.lv, this.stats.vit, bonus.hp);
    this.maxKi = C.calcMaxKi(this.lv, this.stats.int, bonus.ki);
    this.atk = C.calcAtk(this.lv, this.stats.str, bonus.atk);
    this.def = C.calcDef(this.lv, this.stats.vit, bonus.def);
    this.crit = C.calcCrit(this.stats.agi, bonus.crit);
    this.speed = C.calcSpeed(this.stats.agi, bonus.spd);
    this.magic = C.calcMagic(this.atk, this.stats.int);
    this.power = Math.round(this.effAtk() * 3 + this.effDef() * 2 + this.maxHp * 0.4 + this.magic * 1.5);
    this.dirty = true;
  }

  buffVal(key) {
    let v = 0;
    for (const b of this.buffs) if (b.key === key) v += b.val;
    return v;
  }
  effAtk() {
    return this.atk * (1 + this.buffVal('atk'));
  }
  effDef() {
    return this.def * (1 + this.buffVal('def'));
  }
  effSpeed() {
    let s = this.speed * (1 + this.buffVal('spd'));
    for (const d of this.dots) if (d.type === 'slow') s *= 1 - d.val;
    return Math.max(50, s);
  }
  effCrit(extra = 0) {
    return clamp(this.crit + extra + this.buffVal('crit'), 0, 0.85);
  }

  addBuff(key, val, dur, name, color) {
    this.buffs = this.buffs.filter((b) => b.key !== key);
    this.buffs.push({ id: uid(), key, val, until: Date.now() + dur, name, color: color || '#ffe08a' });
    this.recompute();
  }
  addDot(type, val, dur, srcId, tickMs = 1500) {
    this.dots = this.dots.filter((d) => d.type !== type);
    this.dots.push({ type, val, until: Date.now() + dur, next: Date.now() + tickMs, tickMs, srcId });
  }
  tickStatus(now, world) {
    if (this.buffs.length) {
      const before = this.buffs.length;
      this.buffs = this.buffs.filter((b) => b.until > now);
      if (this.buffs.length !== before) this.recompute();
    }
    if (this.dots.length) {
      this.dots = this.dots.filter((d) => {
        if (d.until <= now) return false;
        if (now >= d.next) {
          d.next = now + d.tickMs;
          if (d.type === 'poison') {
            const src = world.players.get(d.srcId);
            const dmg = Math.max(1, Math.round((src ? src.effAtk() : 30) * d.val));
            world.damagePlayer(this, dmg, src, { type: 'poison' });
          }
        }
        return true;
      });
    }
  }

  heal(n) {
    const before = this.hp;
    this.hp = clamp(this.hp + n, 0, this.maxHp);
    this.dirty = true;
    return Math.round(this.hp - before);
  }
  restoreKi(n) {
    const before = this.ki;
    this.ki = clamp(this.ki + n, 0, this.maxKi);
    this.dirty = true;
    return Math.round(this.ki - before);
  }

  addXp(n) {
    this.xp += n;
    let ups = 0;
    while (this.lv < C.MAX_LEVEL && this.xp >= C.xpForLevel(this.lv)) {
      this.xp -= C.xpForLevel(this.lv);
      this.lv++;
      this.points += C.STAT_POINTS_PER_LEVEL;
      for (const k of STAT_KEYS) this.stats[k] += 1;
      ups++;
    }
    if (ups) {
      this.recompute();
      this.hp = this.maxHp;
      this.ki = this.maxKi;
    }
    this.dirty = true;
    return ups;
  }

  // ---- Túi đồ ----
  freeSlot() {
    if (this.inv.length < C.INV_SIZE) return this.inv.length;
    return -1;
  }
  addItem(item) {
    const tpl = ITEM_MAP[item.t];
    if (!tpl) return false;
    if (tpl.kind === 'use') {
      const stack = this.inv.find((i) => i.t === item.t && i.q < C.MAX_STACK);
      if (stack) {
        stack.q += item.q || 1;
        this.dirty = true;
        return true;
      }
    }
    if (this.inv.length >= C.INV_SIZE) return false;
    item.uid = item.uid || uid();
    item.q = item.q || 1;
    this.inv.push(item);
    this.dirty = true;
    return true;
  }
  removeAt(i, qty = 1) {
    const it = this.inv[i];
    if (!it) return null;
    it.q -= qty;
    let removed = null;
    if (it.q <= 0) removed = this.inv.splice(i, 1)[0];
    this.dirty = true;
    return removed || { ...it };
  }
  equipFrom(i) {
    const it = this.inv[i];
    if (!it) return false;
    const tpl = ITEM_MAP[it.t];
    if (!tpl || tpl.kind !== 'equip') return false;
    const old = this.equip[tpl.slot];
    this.inv.splice(i, 1);
    if (old) this.inv.push(old);
    this.equip[tpl.slot] = it;
    this.recompute();
    this.dirty = true;
    return true;
  }
  unequip(slot) {
    const it = this.equip[slot];
    if (!it) return false;
    if (this.inv.length >= C.INV_SIZE) return false;
    this.equip[slot] = null;
    this.inv.push(it);
    this.recompute();
    this.dirty = true;
    return true;
  }
  enhanceCost(it) {
    return Math.round((120 + (it.lv || 1) * 60) * (1 + (it.upg || 0) * 0.65));
  }
  totalPower() {
    let p = 0;
    for (const slot of SLOTS) if (this.equip[slot]) p += itemPower(this.equip[slot]);
    return Math.round(p + this.lv * 40);
  }

  // ---- Gói tin gửi cho client ----
  netSelf() {
    return {
      name: this.name,
      cls: this.clsKey,
      lv: this.lv,
      xp: this.xp,
      xpNext: C.xpForLevel(this.lv),
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      ki: Math.round(this.ki),
      maxKi: this.maxKi,
      gold: this.gold,
      stats: this.stats,
      points: this.points,
      inv: this.inv,
      equip: this.equip,
      map: this.map,
      shield: Math.round(this.shield),
      atk: Math.round(this.effAtk()),
      def: Math.round(this.effDef()),
      crit: Math.round(this.effCrit() * 100),
      magic: this.magic,
      spd: Math.round(this.effSpeed()),
      power: this.power,
      buffs: this.buffs.map((b) => ({ k: b.key, n: b.name, c: b.color, u: b.until - Date.now() })),
      dots: this.dots.map((d) => ({ k: d.type, u: d.until - Date.now() })),
      cds: Object.fromEntries(Object.entries(this.cds).map(([k, v]) => [k, Math.max(0, v - Date.now())])),
      dead: this.dead,
      kills: this.kills,
    };
  }

  netBrief() {
    // [id, x, y, dir, hp, maxHp, lv, clsId, name, flags, shield]
    let flags = 0;
    if (this.state === 'move') flags |= 1;
    if (this.state === 'attack') flags |= 2;
    if (this.dead) flags |= 4;
    if (this.buffs.length) flags |= 8;
    return [this.id, Math.round(this.x), Math.round(this.y), Math.round(this.dir * 100) / 100, Math.round(this.hp), this.maxHp, this.lv, this.cls.id, this.name, flags, Math.round(this.shield)];
  }
}
