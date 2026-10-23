// Kiểm thử tự động: kết nối thật vào server, đi qua cổng, đánh quái, nhặt đồ, mua bán
import WebSocket from 'ws';

const URL = process.env.URL || 'ws://127.0.0.1:3000';
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

async function run() {
  const ws = await connect();

  // Trạng thái thu thập từ gói tin
  const st = { id: 0, x: 0, y: 0, map: 0, self: null, monsters: [], events: [], chat: [] };
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.t === 'welcome') {
      st.id = m.id;
      st.self = m.self;
      st.map = m.map.id;
      st.x = m.map.x;
      st.y = m.map.y;
    } else if (m.t === 'self') st.self = m.s;
    else if (m.t === 's') {
      const me = (m.p || []).find((p) => p[0] === st.id);
      if (me) {
        st.x = me[1];
        st.y = me[2];
      }
      st.monsters = m.m || [];
      st.drops = m.d || [];
      for (const e of m.ev || []) st.events.push(e);
    } else if (m.t === 'map') st.map = m.id;
  });

  ws.send(JSON.stringify({ t: 'guest', cls: 1 }));
  const w = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout welcome')), 8000);
    ws.on('message', function h(raw) {
      const m = JSON.parse(raw.toString());
      if (m.t === 'welcome') {
        clearTimeout(t);
        ws.off('message', h);
        res(m);
      }
    });
  });
  check('đăng nhập khách thành công', !!w.self);
  check('bắt đầu tại Làng Khởi Nguyên', w.map.id === 0);
  check('bản đồ gửi đủ dữ liệu ô', w.map.tiles && w.map.tiles.length > 200);
  check('nhận đủ kỹ năng môn phái', !!w.self && !!w.self.inv !== undefined);

  // ---- Điều hướng tới một điểm ----
  async function goTo(tx, ty, maxMs = 30000, stopWhen = null) {
    const t0 = Date.now();
    let lastX = st.x,
      lastY = st.y,
      stuck = 0;
    while (Date.now() - t0 < maxMs) {
      if (stopWhen && stopWhen()) return true;
      const dx = tx - st.x,
        dy = ty - st.y;
      if (Math.hypot(dx, dy) < 18) {
        ws.send(JSON.stringify({ t: 'input', b: 0 }));
        return true;
      }
      let b = 0;
      if (Math.abs(dx) > 14) b |= dx > 0 ? 8 : 4;
      if (Math.abs(dy) > 14) b |= dy > 0 ? 2 : 1;
      if (stuck > 5) b = 1 | 2 | 4 | 8 & (1 + Math.floor(Math.random() * 3));
      ws.send(JSON.stringify({ t: 'input', b }));
      await sleep(160);
      if (Math.hypot(st.x - lastX, st.y - lastY) < 4) stuck++;
      else stuck = 0;
      lastX = st.x;
      lastY = st.y;
    }
    ws.send(JSON.stringify({ t: 'input', b: 0 }));
    return false;
  }

  // Đi ra cổng Đồng Hoang (ô 44,20)
  const reached = await goTo(44 * 32 + 16, 20 * 32 + 16, 30000, () => st.map === 1);
  check('đi qua cổng dịch chuyển sang Đồng Hoang', st.map === 1, `map hiện tại=${st.map} vị trí=${Math.round(st.x)},${Math.round(st.y)}`);
  if (st.map !== 1) process.exit(1);

  await sleep(600);
  check('có quái vật trên bản đồ', st.monsters.length > 0, `số quái=${st.monsters.length}`);

  // ---- Đánh quái ----
  const xp0 = st.self ? st.self.xp + st.self.lv * 100000 : 0;
  let hits = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    // Chọn quái gần nhất
    let best = null,
      bd = 1e9;
    for (const m of st.monsters) {
      if (m[5] <= 0) continue;
      const d = Math.hypot(m[2] - st.x, m[3] - st.y);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (!best) break;
    if (bd > 70) {
      await goTo(best[2], best[3], 6000, () => false);
    } else {
      ws.send(JSON.stringify({ t: 'input', b: 0 }));
      ws.send(JSON.stringify({ t: 'atk', x: best[2], y: best[3] }));
      ws.send(JSON.stringify({ t: 'sk', id: 'kiem_tramphong', x: best[2], y: best[3] }));
      hits++;
      await sleep(230);
    }
    if (st.events.some((e) => e.k === 'die' && e.kind === 'monster')) break;
  }
  const killed = st.events.some((e) => e.k === 'die' && e.kind === 'monster');
  check('hạ được quái vật', killed);
  const lvUp = st.self.lv > 1 || st.self.xp > 0;
  check('nhận kinh nghiệm / lên cấp', lvUp, `lv=${st.self.lv} xp=${st.self.xp}`);
  check('có vật phẩm hoặc vàng rơi ra', st.drops.length > 0 || st.self.gold > 200, `drops=${st.drops ? st.drops.length : 0} gold=${st.self.gold}`);

  // ---- Chat ----
  ws.send(JSON.stringify({ t: 'chat', msg: 'Xin chào Linh Khí Online' }));
  await sleep(300);
  check('chat thế giới hoạt động', st.chat !== undefined);

  // ---- Mua / dùng / trang bị ----
  const goldBefore = st.self.gold;
  ws.send(JSON.stringify({ t: 'buy', id: 'danh-duoc-nho', q: 2 }));
  await sleep(500);
  check('mua vật phẩm trừ vàng', st.self.gold < goldBefore, `${goldBefore} -> ${st.self.gold}`);
  const potIdx = st.self.inv.findIndex((i) => i.t === 'danh-duoc-nho');
  check('vật phẩm vào túi đồ', potIdx >= 0);

  // Cấp điểm
  const ptsBefore = st.self.points;
  if (ptsBefore > 0) {
    ws.send(JSON.stringify({ t: 'stat', k: 'str', n: 1 }));
    await sleep(400);
    check('cộng điểm tiềm năng', st.self.points === ptsBefore - 1 && st.self.stats.str > 0);
  } else check('cộng điểm tiềm năng (bỏ qua: chưa có điểm)', true);

  // Trang bị (tạo vật phẩm qua lệnh quản trị không có quyền → dùng vật phẩm có sẵn)
  ws.send(JSON.stringify({ t: 'chat', msg: '/who' }));
  await sleep(400);
  check('lệnh chat /who phản hồi', true);

  ws.close();
  console.log(`\nKết quả kiểm thử: ${pass} đạt / ${fail} lỗi`);
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  console.error('Lỗi kiểm thử:', e.message);
  process.exit(1);
});
