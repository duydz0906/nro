// Giao diện người dùng: HUD, chat, bảng nhân vật, túi đồ, cửa hàng…
import { G } from './state.js';
import { sendAction } from './game.js';
import { CLASSES, CLASS_MAP, SKILL_MAP, STAT_NAME, STAT_DESC } from '/shared/classes.js';
import { ITEMS, ITEM_MAP, RARITY, SLOTS, SLOT_NAME, itemStats, itemPrice, itemPower } from '/shared/items.js';
import { itemIcon } from './art.js';
import { MAP_META } from './worldmeta.js';

const $ = (s) => document.querySelector(s);
let els = {};
let selectedInv = -1;
let shopNpc = null;
let miniCanvas = null;
let miniCtx = null;
let miniArt = null;

export function initUI(handlers) {
  els = {
    hud: $('#hud'),
    login: $('#login-screen'),
    name: $('#hud-name'),
    lv: $('#hud-lv'),
    cls: $('#hud-cls'),
    portrait: $('#portrait'),
    barHp: $('#bar-hp'),
    barKi: $('#bar-ki'),
    barXp: $('#bar-xp'),
    txtHp: $('#txt-hp'),
    txtKi: $('#txt-ki'),
    txtXp: $('#txt-xp'),
    target: $('#target-hud'),
    tName: $('#t-name'),
    tLv: $('#t-lv'),
    barTHp: $('#bar-thp'),
    txtTHp: $('#txt-thp'),
    skillbar: $('#skillbar'),
    chatLog: $('#chat-log'),
    chatInput: $('#chat-input'),
    toasts: $('#toasts'),
    flash: $('#levelup-flash'),
    mini: $('#minimap'),
    miniName: $('#mm-name'),
    statline: $('#statline'),
    death: $('#death'),
    deathMsg: $('#death-msg'),
    barRespawn: $('#bar-respawn'),
    loading: $('#loading'),
  };
  miniCanvas = els.mini;
  miniCtx = miniCanvas.getContext('2d');

  // Tabs đăng nhập
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tabpane').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      $('#pane-' + tab.dataset.tab).classList.add('active');
    };
  });

  // Chọn môn phái
  const buildClasses = (host, state) => {
    host.innerHTML = CLASSES.map(
      (c) => `<div class="clscard ${state.cls === c.id ? 'sel' : ''}" data-cls="${c.id}">
        <div class="ci">${c.icon}</div>
        <div class="cn" style="color:${c.color}">${c.name}</div>
        <div class="cr">${c.role}</div></div>`
    ).join('');
    host.querySelectorAll('.clscard').forEach((card) => {
      card.onclick = () => {
        state.cls = +card.dataset.cls;
        buildClasses(host, state);
      };
      card.onmouseenter = (e) => showTip(e, `<b>${card.querySelector('.cn').textContent}</b><br>${CLASSES.find((c) => c.id === +card.dataset.cls).desc}`);
      card.onmouseleave = hideTip;
    });
  };
  buildClasses($('#rg-classes'), handlers.regState);
  buildClasses($('#gs-classes'), handlers.guestState);

  $('#pane-login').onsubmit = (e) => {
    e.preventDefault();
    handlers.login($('#in-user').value.trim(), $('#in-pass').value);
  };
  $('#pane-register').onsubmit = (e) => {
    e.preventDefault();
    handlers.register($('#rg-user').value.trim(), $('#rg-pass').value, $('#rg-char').value.trim(), handlers.regState.cls);
  };
  $('#btn-guest').onclick = () => handlers.guest(handlers.guestState.cls);
  $('#btn-help').onclick = () => openPanel('help');

  // Nút bảng điều khiển
  document.querySelectorAll('.iconbtn').forEach((b) => (b.onclick = () => openPanel(b.dataset.panel)));
  document.querySelectorAll('.modal .close').forEach((b) => (b.onclick = closePanels));
  document.querySelectorAll('.modal').forEach((m) =>
    (m.onclick = (e) => {
      if (e.target === m) closePanels();
    })
  );
  $('#btn-respawn').onclick = () => sendAction({ t: 'respawn' });

  // Chat
  els.chatInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const v = els.chatInput.value.trim();
      if (v) sendAction({ t: 'chat', msg: v });
      els.chatInput.value = '';
      els.chatInput.blur();
    } else if (e.key === 'Escape') els.chatInput.blur();
    e.stopPropagation();
  };
  els.chatInput.onfocus = () => (G.chatFocus = true);
  els.chatInput.onblur = () => (G.chatFocus = false);

  document.addEventListener('click', hideTip);
}

export function showLoading(v) {
  els.loading.classList.toggle('hidden', !v);
}

export function showLogin(v) {
  els.login.classList.toggle('hidden', !v);
}

export function showGame(v) {
  els.hud.classList.toggle('hidden', !v);
  els.login.classList.toggle('hidden', v);
}

export function setServerStatus(text) {
  const el = $('#srv-status');
  if (el) el.textContent = text;
}

export function setError(id, msg) {
  const el = $('#' + id);
  if (el) el.textContent = msg || '';
}

// ---------------- HUD ----------------
export function updateHud() {
  const s = G.self;
  if (!s) return;
  els.name.textContent = s.name;
  els.lv.textContent = 'Lv.' + s.lv;
  const c = CLASS_MAP[s.cls];
  els.cls.textContent = c ? c.name : '';
  els.portrait.textContent = c ? c.icon : '⚔';
  els.portrait.style.boxShadow = `inset 0 0 18px ${c ? c.color : '#fff'}55`;

  const hp = Math.max(0, s.hp) + (s.shield > 0 ? ` +${s.shield}` : '');
  els.barHp.style.width = (100 * Math.max(0, s.hp)) / s.maxHp + '%';
  els.txtHp.textContent = `${hp} / ${s.maxHp}`;
  els.barKi.style.width = (100 * s.ki) / s.maxKi + '%';
  els.txtKi.textContent = `${s.ki} / ${s.maxKi}`;
  const xpPct = s.xpNext ? (100 * s.xp) / s.xpNext : 0;
  els.barXp.style.width = xpPct + '%';
  els.txtXp.textContent = `${Math.floor(xpPct)}% · ${s.gold.toLocaleString('vi-VN')} vàng`;
  els.statline.textContent = `Online: ${G.online} · Ping: ${G.ping}ms · ${G.map ? G.map.name : ''}`;

  // Mục tiêu
  const t = G.target ? G.monsters.get(G.target) : null;
  if (t) {
    els.target.classList.remove('hidden');
    els.tName.textContent = t.name;
    els.tLv.textContent = `Lv.${t.lv}`;
    els.barTHp.style.width = (100 * t.hp) / t.maxHp + '%';
    els.txtTHp.textContent = `${t.hp} / ${t.maxHp}`;
  } else els.target.classList.add('hidden');

  // Thanh kỹ năng
  updateSkillbar();

  // Chờ hồi sinh
  if (G.dead) {
    els.death.classList.remove('hidden');
    const left = Math.max(0, G.deadUntil - Date.now());
    els.barRespawn.style.width = 100 * (1 - left / 5000) + '%';
    els.deathMsg.textContent = left > 0 ? `Hồi sinh sau ${(left / 1000).toFixed(1)}s…` : 'Nhấn nút để hồi sinh tại làng.';
  } else els.death.classList.add('hidden');
}

function buildSkillbar() {
  const s = G.self;
  if (!s) return;
  const c = CLASS_MAP[s.cls];
  const skills = c.skills.map((id, i) => ({ id, key: String(i + 1), sk: SKILL_MAP[id] }));
  skills.push({ id: 'atk', key: '4', sk: { name: 'Đánh thường', icon: '👊', ki: 0, cd: 0, desc: 'Đòn đánh cơ bản (giữ chuột trái để đánh liên tục)' } });
  els.skillbar.innerHTML = skills
    .map(
      (k) => `<div class="slot" data-skill="${k.id}">
        <span class="key">${k.key}</span>
        <span class="ico">${k.sk.icon}</span>
        ${k.sk.ki ? `<span class="cost">${k.sk.ki}</span>` : ''}
        <div class="cd hidden"></div>
      </div>`
    )
    .join('');
  els.skillbar.querySelectorAll('.slot').forEach((sl) => {
    sl.onclick = () => useSkill(sl.dataset.skill);
    sl.onmouseenter = (e) => {
      const id = sl.dataset.skill;
      const sk = id === 'atk' ? null : SKILL_MAP[id];
      showTip(e, sk ? `<b>${sk.name}</b> <span style="color:#7fd3ff">(${sk.ki} linh lực · ${(sk.cd / 1000).toFixed(1)}s)</span><br>${sk.desc}` : '<b>Đánh thường</b><br>Giữ chuột trái để tấn công liên tục.');
    };
    sl.onmouseleave = hideTip;
  });
}

function updateSkillbar() {
  if (!G.self) return;
  if (!els.skillbar.children.length) buildSkillbar();
  const cds = G.self.cds || {};
  for (const sl of els.skillbar.children) {
    const id = sl.dataset.skill;
    const cd = cds[id] || 0;
    const cdEl = sl.querySelector('.cd');
    if (cd > 90) {
      cdEl.classList.remove('hidden');
      cdEl.textContent = (cd / 1000).toFixed(1);
      sl.classList.add('cooling');
    } else {
      cdEl.classList.add('hidden');
      sl.classList.remove('cooling');
    }
    const sk = id === 'atk' ? null : SKILL_MAP[id];
    sl.classList.toggle('noki', !!sk && G.self.ki < sk.ki);
  }
}

export function useSkill(id) {
  if (id === 'atk') {
    const t = G.target ? G.monsters.get(G.target) : null;
    sendAction({ t: 'atk', x: t ? t.rx ?? t.x : G.mouse.wx, y: t ? t.ry ?? t.y : G.mouse.wy });
    return;
  }
  sendAction({ t: 'sk', id, x: G.mouse.wx, y: G.mouse.wy, tid: G.target });
}

// ---------------- Chat ----------------
export function addChat(m) {
  const log = els.chatLog;
  const div = document.createElement('div');
  if (m.ch === 'sys') {
    div.className = 'sys';
    div.innerHTML = `[Hệ thống] ${escapeHtml(m.msg)}`;
  } else if (m.ch === 'pm') {
    div.className = 'pm';
    div.innerHTML = m.to ? `[Riêng] <b>${escapeHtml(m.from)}</b> → ${escapeHtml(m.to)}: ${escapeHtml(m.msg)}` : `[Riêng] <b>${escapeHtml(m.from)}</b>: ${escapeHtml(m.msg)}`;
  } else {
    const c = CLASS_MAP[m.cls] || {};
    div.className = 'world';
    div.innerHTML = `<b style="color:${c.color || '#ffe6a8'}">${escapeHtml(m.from)}</b> <span style="color:#7f8f9c">(Lv.${m.lv || 1})</span>: ${escapeHtml(m.msg)}`;
  }
  log.appendChild(div);
  while (log.children.length > 120) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(text, kind = '') {
  const div = document.createElement('div');
  div.className = 'toast ' + kind;
  div.innerHTML = text;
  els.toasts.appendChild(div);
  setTimeout(() => div.remove(), 4200);
  while (els.toasts.children.length > 6) els.toasts.firstChild.remove();
}

export function levelUpFlash(lv) {
  els.flash.textContent = `LÊN CẤP ${lv}!`;
  els.flash.classList.remove('show');
  void els.flash.offsetWidth;
  els.flash.classList.add('show');
}

// ---------------- Bảng điều khiển ----------------
const PANELS = { char: '#panel-char', inv: '#panel-inv', skill: '#panel-skill', worldmap: '#panel-worldmap', shop: '#panel-shop', help: '#panel-help' };

export function openPanel(name) {
  closePanels();
  const sel = PANELS[name];
  if (!sel) return;
  if (name === 'char') renderCharacter();
  if (name === 'inv') renderInventory();
  if (name === 'skill') renderSkills();
  if (name === 'worldmap') renderWorldMap();
  if (name === 'shop') renderShop();
  $(sel).classList.remove('hidden');
  G.openPanel = name;
}
export function closePanels() {
  for (const sel of Object.values(PANELS)) $(sel).classList.add('hidden');
  G.openPanel = null;
  hideTip();
}
export function isPanelOpen() {
  return !!G.openPanel;
}

function renderCharacter() {
  const s = G.self;
  const c = CLASS_MAP[s.cls];
  const rows = ['str', 'agi', 'vit', 'int']
    .map(
      (k) => `<div class="statrow">
        <span class="sname">${STAT_NAME[k]}</span>
        <span class="sval">${s.stats[k]}</span>
        <button class="plusbtn" data-stat="${k}" ${s.points < 1 ? 'disabled' : ''}>+</button>
        <span class="sdesc">${STAT_DESC[k]}</span>
      </div>`
    )
    .join('');
  $('#char-body').innerHTML = `
    <div class="charhead">
      <div class="bigpor" style="box-shadow:inset 0 0 22px ${c.color}66">${c.icon}</div>
      <div>
        <div style="font-size:19px;font-weight:700;color:${c.color}">${escapeHtml(s.name)}</div>
        <div style="color:#93a3b1;font-size:12.5px">${c.name} · Cấp ${s.lv} · ${escapeHtml(c.role)}</div>
        <div style="color:#93a3b1;font-size:12.5px;margin-top:3px">Kinh nghiệm: ${s.xp.toLocaleString('vi-VN')} / ${s.xpNext.toLocaleString('vi-VN')}
          <span class="points">Điểm cộng: ${s.points}</span></div>
      </div>
    </div>
    <div class="charstats">
      <div>
        <div class="statrow"><span class="sname">Sinh lực</span><span class="sval">${s.maxHp}</span></div>
        <div class="statrow"><span class="sname">Linh lực</span><span class="sval">${s.maxKi}</span></div>
        <div class="statrow"><span class="sname">Công vật lý</span><span class="sval">${s.atk}</span></div>
        <div class="statrow"><span class="sname">Thủ</span><span class="sval">${s.def}</span></div>
      </div>
      <div>
        <div class="statrow"><span class="sname">Sát thương phép</span><span class="sval">${s.magic}</span></div>
        <div class="statrow"><span class="sname">Chí mạng</span><span class="sval">${s.crit}%</span></div>
        <div class="statrow"><span class="sname">Tốc độ</span><span class="sval">${s.spd}</span></div>
        <div class="statrow"><span class="sname">Sức mạnh tổng</span><span class="sval">${s.power}</span></div>
      </div>
    </div>
    <h3 style="margin:16px 0 4px;color:#ffe6a8;font-size:14px">Điểm tiềm năng</h3>
    ${rows}`;
  $('#char-body').querySelectorAll('.plusbtn').forEach((b) => {
    b.onclick = () => {
      sendAction({ t: 'stat', k: b.dataset.stat, n: 1 });
      renderCharacter();
    };
  });
}

function itemTipHtml(it, extra = '') {
  const tpl = ITEM_MAP[it.t];
  if (!tpl) return '';
  const rar = RARITY[it.rar] || RARITY[0];
  const st = itemStats(it);
  const lines = Object.entries(st)
    .map(([k, v]) => `<div class="tstat">+${v} ${STAT_LABEL[k] || k}</div>`)
    .join('');
  return `<div class="tname" style="color:${rar.color}">${tpl.name}${it.upg ? ` +${it.upg}` : ''}</div>
    <div class="trar" style="color:${rar.color}">${rar.name}${tpl.kind === 'equip' ? ` · Cấp ${it.lv}` : ''} · ${SLOT_NAME[tpl.slot] || 'Tiêu hao'}</div>
    ${lines}${tpl.desc ? `<div class="tdesc">${tpl.desc}</div>` : ''}
    ${extra}<div class="tsell">Giá bán: ${itemPrice(it).toLocaleString('vi-VN')} vàng</div>`;
}

const STAT_LABEL = { atk: 'Công', def: 'Thủ', hp: 'Sinh lực', ki: 'Linh lực', crit: '% Chí mạng', spd: 'Tốc độ' };

function renderInventory() {
  const s = G.self;
  const slots = [];
  for (let i = 0; i < 32; i++) {
    const it = s.inv[i];
    if (!it) {
      slots.push(`<div class="islot" data-i="${i}"></div>`);
      continue;
    }
    const tpl = ITEM_MAP[it.t];
    const rar = RARITY[it.rar] || RARITY[0];
    slots.push(`<div class="islot ${selectedInv === i ? 'sel' : ''}" data-i="${i}" style="border-color:${rar.color}88;box-shadow:inset 0 0 14px ${rar.color}22">
      <span>${itemIcon(it.t)}</span>
      ${tpl && tpl.kind === 'use' && it.q > 1 ? `<span class="qty">${it.q}</span>` : ''}
      ${it.upg ? `<span class="upg">+${it.upg}</span>` : ''}
    </div>`);
  }
  $('#inv-grid').innerHTML = slots.join('');

  $('#equip-col').innerHTML =
    SLOTS.map((slot) => {
      const it = s.equip[slot];
      const rar = it ? RARITY[it.rar] || RARITY[0] : null;
      return `<div class="eslot ${it ? 'filled' : ''}" data-slot="${slot}" style="${it ? `border-color:${rar.color};box-shadow:inset 0 0 14px ${rar.color}22` : ''}">
        ${it ? itemIcon(it.t) : '<span style="font-size:11px;color:#5c6b78">trống</span>'}
        <span class="elabel">${SLOT_NAME[slot]}</span>
      </div>`;
    }).join('') + `<div style="width:100%;height:8px"></div>`;

  $('#inv-gold').textContent = s.gold.toLocaleString('vi-VN');

  const bind = (el, it) => {
    el.onmouseenter = (e) => showTip(e, itemTipHtml(it, `<div class="tdesc">Nhấp phải: ${ITEM_MAP[it.t].kind === 'use' ? 'sử dụng' : 'trang bị'}${ITEM_MAP[it.t].kind === 'equip' ? ' · Nhấp trái + C: cường hóa' : ''}</div>`));
    el.onmouseleave = hideTip;
  };

  $('#inv-grid')
    .querySelectorAll('.islot')
    .forEach((el) => {
      const i = +el.dataset.i;
      const it = s.inv[i];
      el.onclick = () => {
        selectedInv = i;
        renderInventory();
      };
      el.oncontextmenu = (e) => {
        e.preventDefault();
        if (!it) return;
        sendAction(ITEM_MAP[it.t].kind === 'use' ? { t: 'use', i } : { t: 'equip', i });
      };
      if (it) bind(el, it);
    });
  $('#equip-col')
    .querySelectorAll('.eslot')
    .forEach((el) => {
      const slot = el.dataset.slot;
      const it = s.equip[slot];
      el.onclick = () => sendAction({ t: 'unequip', slot });
      if (it) bind(el, it);
    });
}

function renderSkills() {
  const s = G.self;
  const c = CLASS_MAP[s.cls];
  $('#skill-body').innerHTML = `<div class="skill-list">${c.skills
    .map((id) => {
      const sk = SKILL_MAP[id];
      return `<div class="skill-card">
        <div class="sk-ico" style="box-shadow:inset 0 0 18px ${sk.color}44">${sk.icon}</div>
        <div>
          <h4>${sk.name}</h4>
          <div class="meta">${sk.ki} linh lực · hồi ${(sk.cd / 1000).toFixed(1)}s · ${TYPE_NAME[sk.type]}</div>
          <p>${sk.desc}</p>
        </div>
      </div>`;
    })
    .join('')}</div>`;
}

const TYPE_NAME = { melee: 'Cận chiến', proj: 'Bắn xa', aoe: 'Diện rộng', heal: 'Hồi phục', buff: 'Cường hóa', dash: 'Lướt' };

function renderWorldMap() {
  $('#worldmap-body').innerHTML = `<div class="wmap-grid">${MAP_META.map(
    (m) => `<div class="wmap-card">
      <h4>${m.name}</h4>
      <div class="wm">${m.desc}</div>
      <div class="amb">Khuyến nghị: Cấp ${m.lv}${G.map && G.map.id === m.id ? ' · <b style="color:#5fd07a">Bạn đang ở đây</b>' : ''}</div>
    </div>`
  ).join('')}</div>`;
}

export function openShop(npc) {
  shopNpc = npc;
  $('#shop-title').textContent = npc.name;
  openPanel('shop');
}

function renderShop() {
  const s = G.self;
  const npc = shopNpc || { type: 'shop', name: 'Cửa hàng' };
  if (npc.type === 'smith') {
    const items = s.inv.map((it, i) => ({ it, i })).filter((x) => ITEM_MAP[x.it.t] && ITEM_MAP[x.it.t].kind === 'equip');
    $('#shop-body').innerHTML = `
      <p class="hint">Cường hóa tăng 9% chỉ số mỗi cấp (tối đa +15). Tỷ lệ thành công giảm dần.</p>
      <div class="inv-grid">${items
        .map(
          ({ it, i }) => `<div class="islot" data-enh="${i}" style="border-color:${(RARITY[it.rar] || RARITY[0]).color}88">
            <span>${itemIcon(it.t)}</span>${it.upg ? `<span class="upg">+${it.upg}</span>` : ''}
          </div>`
        )
        .join('') || '<div style="color:#7f8f9c">Không có trang bị trong túi.</div>'}</div>
      <div class="inv-foot"><span>Vàng: <b>${s.gold.toLocaleString('vi-VN')}</b></span><span class="hint">Nhấp vào trang bị để cường hóa</span></div>`;
    $('#shop-body')
      .querySelectorAll('[data-enh]')
      .forEach((el) => {
        const it = s.inv[+el.dataset.enh];
        el.onmouseenter = (e) => {
          const cost = Math.round((120 + (it.lv || 1) * 60) * (1 + (it.upg || 0) * 0.65));
          const rate = Math.max(0.15, 0.92 - (it.upg || 0) * 0.06);
          showTip(e, itemTipHtml(it, `<div class="tdesc">Cường hóa: ${cost.toLocaleString('vi-VN')} vàng · tỷ lệ ${Math.round(rate * 100)}%</div>`));
        };
        el.onmouseleave = hideTip;
        el.onclick = () => sendAction({ t: 'enhance', i: +el.dataset.enh });
      });
    return;
  }
  if (npc.type === 'healer') {
    $('#shop-body').innerHTML = `<p class="hint">${npc.name}: "Để ta chữa lành vết thương cho."</p>
      <button class="primary" id="btn-npc-heal">Hồi phục toàn bộ</button>`;
    $('#btn-npc-heal').onclick = () => sendAction({ t: 'npc' });
    return;
  }
  if (npc.type === 'elder') {
    $('#shop-body').innerHTML = `<p class="hint"><b>${npc.name}</b>: "Linh khí trời đất đang nhiễu loạn. Bọn yêu thú từ Hang Sơn và Đỉnh Tuyết Sơn đã tràn xuống.
      Người trẻ tuổi — hãy rèn luyện, nhận lấy sứ mệnh của môn phái, rồi đi dẹp loạn."</p>
      <h3 style="color:#ffe6a8;margin:12px 0 6px">Hành trình đề nghị</h3>
      <ul style="padding-left:18px;color:#c3d0da;line-height:1.7">
        <li>Cấp 1–10: Đồng Hoang</li><li>Cấp 10–20: Rừng Trúc</li>
        <li>Cấp 20–32: Hang Sơn</li><li>Cấp 32–50: Đỉnh Tuyết Sơn</li>
        <li>Cấp 50+: Đấu Trường (tỷ thí với người chơi khác)</li>
      </ul>`;
    return;
  }
  const goods = ITEMS.filter((i) => i.kind === 'use');
  $('#shop-body').innerHTML = `<div class="shop-grid">${goods
    .map(
      (i) => `<div class="shop-item" data-buy="${i.id}">
        <div class="si">${itemIcon(i.id)}</div>
        <div class="sn">${i.name}</div>
        <div class="sp">${i.price.toLocaleString('vi-VN')} vàng</div>
      </div>`
    )
    .join('')}</div>
    <div class="inv-foot"><span>Vàng: <b>${s.gold.toLocaleString('vi-VN')}</b></span><span class="hint">Nhấp để mua · Shift + nhấp mua 5</span></div>`;
  $('#shop-body')
    .querySelectorAll('[data-buy]')
    .forEach((el) => {
      const tpl = ITEM_MAP[el.dataset.buy];
      el.onmouseenter = (e) => showTip(e, `<b>${tpl.name}</b><br>${tpl.desc}`);
      el.onmouseleave = hideTip;
      el.onclick = (e) => sendAction({ t: 'buy', id: el.dataset.buy, q: e.shiftKey ? 5 : 1 });
    });
}

// ---------------- Tooltip ----------------
let tipEl = null;
export function showTip(e, html) {
  hideTip();
  tipEl = document.createElement('div');
  tipEl.className = 'tip';
  tipEl.innerHTML = html;
  document.body.appendChild(tipEl);
  const pad = 14;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  const r = tipEl.getBoundingClientRect();
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
  tipEl.style.left = x + 'px';
  tipEl.style.top = y + 'px';
}
export function hideTip() {
  if (tipEl) tipEl.remove();
  tipEl = null;
}

// ---------------- Bản đồ nhỏ ----------------
export function buildMinimap() {
  if (!G.mapArt || !G.map) return;
  const w = 180,
    h = 140;
  miniArt = document.createElement('canvas');
  miniArt.width = w;
  miniArt.height = h;
  const c = miniArt.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.drawImage(G.mapArt.canvas, 0, 0, w, h);
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.fillRect(0, 0, w, h);
  els.miniName.textContent = G.map.name;
}

export function drawMinimap() {
  if (!miniCtx || !G.map) return;
  const w = miniCanvas.width,
    h = miniCanvas.height;
  if (miniArt) miniCtx.drawImage(miniArt, 0, 0);
  const sx = w / (G.map.w * 32),
    sy = h / (G.map.h * 32);
  // Quái
  miniCtx.fillStyle = '#ff5f56';
  for (const m of G.monsters.values()) {
    if (m.dead) continue;
    miniCtx.fillRect(m.rx * sx - 1, m.ry * sy - 1, 2.5, 2.5);
  }
  // Người chơi khác
  miniCtx.fillStyle = '#5fd07a';
  for (const p of G.players.values()) {
    if (p.id === G.id) continue;
    miniCtx.fillRect((p.rx ?? p.x) * sx - 1.5, (p.ry ?? p.y) * sy - 1.5, 3, 3);
  }
  // Cổng
  miniCtx.fillStyle = '#c78bff';
  for (const pt of G.map.portals) miniCtx.fillRect(pt.x * sx - 2, pt.y * sy - 2, 4, 4);
  // Mình
  miniCtx.fillStyle = '#ffe6a8';
  miniCtx.beginPath();
  miniCtx.arc(G.me.x * sx, G.me.y * sy, 3, 0, 7);
  miniCtx.fill();
  miniCtx.strokeStyle = 'rgba(255,230,168,.7)';
  miniCtx.lineWidth = 1;
  miniCtx.strokeRect(G.cam.x * sx, G.cam.y * sy, G.view.w * sx, G.view.h * sy);
}

export function selectedIndex() {
  return selectedInv;
}

export function markInventoryDirty() {
  if (G.openPanel === 'inv') renderInventory();
  if (G.openPanel === 'char') renderCharacter();
}
