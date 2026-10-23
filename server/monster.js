// Quái vật phía server
import { MONSTER_MAP, monsterStats } from '../shared/monsters.js';
import { clamp, randInt } from './util.js';

export class Monster {
  constructor(id, tplId, x, y, spawnIdx, mapId) {
    this.id = id;
    this.tplId = tplId;
    this.tpl = MONSTER_MAP[tplId];
    const st = monsterStats(this.tpl);
    this.maxHp = st.maxHp;
    this.hp = st.maxHp;
    this.atk = st.atk;
    this.def = st.def;
    this.xp = st.xp;
    this.gold = st.gold;
    this.speed = st.speed;
    this.aggro = st.aggro;
    this.atkRange = st.atkRange;
    this.atkCd = st.atkCd;
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
    this.spawnIdx = spawnIdx;
    this.map = mapId;
    this.dir = 0;
    this.state = 'idle';
    this.animT = Math.random() * 6;
    this.nextAtk = 0;
    this.target = null;
    this.wanderUntil = 0;
    this.wx = 0;
    this.wy = 0;
    this.dead = false;
    this.deadAt = 0;
    this.damageMap = new Map(); // playerId -> damage
    this.dots = [];
    this.leash = 460;
    this.hitFlash = 0;
  }

  get radius() {
    return 12 + this.tpl.size * 6;
  }

  netBrief() {
    let flags = 0;
    if (this.state === 'move') flags |= 1;
    if (this.state === 'attack') flags |= 2;
    if (this.dead) flags |= 4;
    if (this.tpl.boss) flags |= 8;
    return [this.id, this.tplId, Math.round(this.x), Math.round(this.y), Math.round(this.dir * 100) / 100, Math.round(this.hp), this.maxHp, flags, this.target ? this.target.id : 0];
  }
}
