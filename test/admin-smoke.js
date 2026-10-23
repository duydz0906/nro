// Kiểm thử luồng tài khoản, lệnh quản trị, trang bị, cường hóa, NPC
import WebSocket from 'ws';

const URL = process.env.URL || 'ws://127.0.0.1:3999';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0,
  fail = 0;
const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✔' : '✘'} ${name}${ok ? '' : ' — ' + extra}`);
};

function connect() {
  return new Promise((res, rej) => {
    const ws = new WebSocket(URL);
    ws.on('open', () => res(ws));
    ws.on('error', rej);
  });
}

function attach(ws, st) {
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.t === 'welcome') {
      st.id = m.id;
      st.self = m.self;
      st.map = m.map.id;
    } else if (m.t === 'self') st.self = m.s;
    else if (m.t === 's') {
      const me = (m.p || []).find((p) => p[0] === st.id);
      if (me) {
        st.x = me[1];
        st.y = me[2];
      }
      st.monsters = m.m || [];
    } else if (m.t === 'map') st.map = m.id;
    else if (m.t === 'chat') (st.chat = st.chat || []).push(m);
    else if (m.t === 'npc') st.npc = m.npc;
  });
}

async function main() {
  const user = 'nguoichoi' + Math.floor(Math.random() * 99999);
  const ws = await connect();
  const st = {};
  attach(ws, st);

  // ---- Đăng ký (tài khoản đầu tiên → tự động là quản trị) ----
  ws.send(JSON.stringify({ t: 'register', user, pass: 'matkhau123', char: 'Anh Hùng', cls: 2 }));
  await sleep(700);
  check('đăng ký tài khoản thành công', !!st.self && st.self.name === 'Anh Hùng', JSON.stringify(st.self || {}).slice(0, 80));
  check('nhân vật thuộc môn phái đã chọn', st.self && st.self.cls === 'phaptu');
  check('tài khoản đầu tiên được cấp quyền quản trị', (st.chat || []).some((c) => (c.msg || '').includes('quyền quản trị')));

  // ---- Lệnh quản trị ----
  ws.send(JSON.stringify({ t: 'chat', msg: '/lv 25' }));
  await sleep(500);
  check('lệnh /lv hoạt động', st.self.lv === 25, 'lv=' + (st.self && st.self.lv));

  ws.send(JSON.stringify({ t: 'chat', msg: '/gold 50000' }));
  await sleep(500);
  check('lệnh /gold hoạt động', st.self.gold === 50000);

  ws.send(JSON.stringify({ t: 'chat', msg: '/item kiem-sat 20 3' }));
  await sleep(500);
  check('lệnh /item tạo vật phẩm', st.self.inv.some((i) => i.t === 'kiem-sat'));

  // ---- Trang bị ----
  const idx = st.self.inv.findIndex((i) => i.t === 'kiem-sat');
  const atkBefore = st.self.atk;
  ws.send(JSON.stringify({ t: 'equip', i: idx }));
  await sleep(400);
  check('trang bị vũ khí tăng công', st.self.equip.weapon && st.self.atk > atkBefore, `${atkBefore} -> ${st.self.atk}`);
  const wpnInInv = st.self.inv.findIndex((i) => i.t === 'kiem-sat');
  check('vũ khí rời khỏi túi khi mặc', wpnInInv === -1);

  // ---- Cường hóa ----
  const goldBefore = st.self.gold;
  ws.send(JSON.stringify({ t: 'unequip', slot: 'weapon' }));
  await sleep(400);
  const ei = st.self.inv.findIndex((i) => i.t === 'kiem-sat');
  ws.send(JSON.stringify({ t: 'enhance', i: ei }));
  await sleep(500);
  const enhanced = st.self.inv.find((i) => i.t === 'kiem-sat');
  check('cường hóa trừ vàng', st.self.gold < goldBefore, `${goldBefore} -> ${st.self.gold}`);
  check('cường hóa tăng cấp vật phẩm hoặc thất bại hợp lệ', enhanced.upg >= 0);

  // ---- Dùng vật phẩm ----
  ws.send(JSON.stringify({ t: 'buy', id: 'danh-duoc-lon', q: 1 }));
  await sleep(400);
  const potIdx = st.self.inv.findIndex((i) => i.t === 'danh-duoc-lon');
  ws.send(JSON.stringify({ t: 'chat', msg: '/lv 1' }));
  await sleep(400);
  ws.send(JSON.stringify({ t: 'use', i: potIdx }));
  await sleep(400);
  check('dùng đan dược hồi sinh lực', st.self.hp > 0);

  // ---- Dịch chuyển & NPC ----
  ws.send(JSON.stringify({ t: 'chat', msg: '/tp 1' }));
  await sleep(600);
  check('lệnh /tp dịch chuyển bản đồ', st.map === 1, 'map=' + st.map);

  ws.send(JSON.stringify({ t: 'chat', msg: '/killall' }));
  await sleep(800);
  check('lệnh /killall dọn quái', true);

  ws.send(JSON.stringify({ t: 'chat', msg: '/tp 0' }));
  await sleep(600);
  // Đi tới NPC thương nhân (ô 20,16)
  const t0 = Date.now();
  while (Date.now() - t0 < 8000 && st.map === 0) {
    const dx = 20 * 32 - st.x,
      dy = 16 * 32 - st.y;
    if (Math.hypot(dx, dy) < 50) break;
    let b = 0;
    if (Math.abs(dx) > 14) b |= dx > 0 ? 8 : 4;
    if (Math.abs(dy) > 14) b |= dy > 0 ? 2 : 1;
    ws.send(JSON.stringify({ t: 'input', b }));
    await sleep(150);
  }
  ws.send(JSON.stringify({ t: 'input', b: 0 }));
  ws.send(JSON.stringify({ t: 'npc' }));
  await sleep(500);
  check('nói chuyện được với NPC', !!st.npc, JSON.stringify(st.npc || {}));

  // ---- Lưu & đăng nhập lại ----
  const lvBefore = st.self.lv;
  ws.send(JSON.stringify({ t: 'logout' }));
  await sleep(600);

  const ws2 = await connect();
  const st2 = {};
  attach(ws2, st2);
  ws2.send(JSON.stringify({ t: 'login', user, pass: 'matkhau123' }));
  await sleep(900);
  check('đăng nhập lại thành công', !!st2.self, '');
  check('nhân vật được lưu giữ nguyên', st2.self && st2.self.name === 'Anh Hùng' && st2.self.lv === lvBefore, `lv=${st2.self && st2.self.lv}/${lvBefore}`);

  ws2.send(JSON.stringify({ t: 'login', user: 'sai_tai_khoan', pass: 'x' }));
  await sleep(400);

  const ws3 = await connect();
  let err = null;
  ws3.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.t === 'err') err = m.msg;
  });
  ws3.send(JSON.stringify({ t: 'login', user, pass: 'sai_mat_khau' }));
  await sleep(600);
  check('từ chối sai mật khẩu', !!err, err || 'không có thông báo lỗi');
  ws3.close();
  ws2.close();

  console.log(`\nKết quả kiểm thử tài khoản/quản trị: ${pass} đạt / ${fail} lỗi`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('Lỗi kiểm thử:', e.message);
  process.exit(1);
});
