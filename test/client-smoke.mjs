// Chạy thử mã nguồn client trong DOM giả lập (jsdom) kết nối vào server thật
// Mục tiêu: bắt lỗi runtime (import sai, hàm thiếu, lỗi canvas…)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import WebSocket from 'ws';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = '/tmp/ct';
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(path.join(TMP, 'js'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'shared'), { recursive: true });

// Sao chép & đổi đường dẫn import tuyệt đối '/shared/...' thành tương đối
for (const f of fs.readdirSync(path.join(ROOT, 'public', 'js'))) {
  let src = fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8').replace(/from '\/shared\//g, "from '../shared/");
  fs.writeFileSync(path.join(TMP, 'js', f), src);
}
for (const f of fs.readdirSync(path.join(ROOT, 'shared'))) {
  fs.copyFileSync(path.join(ROOT, 'shared', f), path.join(TMP, 'shared', f));
}

const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://127.0.0.1:3000', pretendToBeVisual: true });
const { window } = dom;

// --- Stub canvas 2D ---
const noop = () => {};
function makeCtx(canvas) {
  const store = { canvas };
  return new Proxy(store, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'measureText') return () => ({ width: 32 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof p === 'symbol') return undefined;
      t[p] = (...a) => undefined;
      return t[p];
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    },
  });
}
window.HTMLCanvasElement.prototype.getContext = function () {
  if (!this.__ctx) this.__ctx = makeCtx(this);
  return this.__ctx;
};

// --- Toàn cục ---
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
globalThis.location = window.location;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.removeEventListener = window.removeEventListener.bind(window);
globalThis.performance = performance;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.WebSocket = class extends WebSocket {
  constructor(url) {
    super(url);
  }
};
globalThis.fetch = async () => ({ json: async () => ({ online: 1, accounts: 1, maps: [] }) });
window.WebSocket = globalThis.WebSocket;

const errors = [];
process.on('uncaughtException', (e) => errors.push('uncaught: ' + e.message));
process.on('unhandledRejection', (e) => errors.push('rejection: ' + (e && e.message)));
window.addEventListener('error', (e) => errors.push('window error: ' + e.message));

// --- Chạy ---
const { G } = await import(path.join(TMP, 'js', 'state.js'));
await import(path.join(TMP, 'js', 'main.js'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(400);

// Nhấn "Bắt đầu phiêu lưu" (chơi ngay)
const btn = window.document.getElementById('btn-guest');
btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

await sleep(2500);
const results = [];
const check = (name, ok, extra = '') => {
  results.push([ok, name, extra]);
};

check('kết nối máy chủ từ client', !!G.net && G.net.ws && G.net.ws.readyState === 1);
check('nhận gói welcome & vào game', G.inGame, JSON.stringify({ id: G.id, map: G.map && G.map.name }));
check('có dữ liệu nhân vật', !!G.self, G.self ? `lv=${G.self.lv} hp=${G.self.hp}` : '');
check('bản đồ đã dựng ảnh nền', !!G.mapArt && !!G.mapArt.canvas);
check('thanh kỹ năng đã tạo', window.document.querySelectorAll('#skillbar .slot').length >= 4);

// Mô phỏng: giữ phím D (sang phải), đánh liên tục, dùng kỹ năng
window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyD' }));
await sleep(300);
const x0 = G.me.x;
await sleep(2000);
check('nhân vật di chuyển sang phải', G.me.x > x0, `${Math.round(x0)} -> ${Math.round(G.me.x)}`);

// Bấm phím skill 1 & đánh
for (let i = 0; i < 6; i++) {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Digit1' }));
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Digit4' }));
  await sleep(250);
}

// Mở các bảng
for (const p of ['char', 'inv', 'skill', 'worldmap', 'help']) {
  window.document.querySelector(`.iconbtn[data-panel="${p}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(150);
}
check('mở được các bảng điều khiển', true);
window.document.querySelector('#panel-inv .close').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

// Chat
const chatInput = window.document.getElementById('chat-input');
chatInput.value = 'hello từ client test';
chatInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await sleep(400);
check('gửi chat không lỗi', window.document.querySelectorAll('#chat-log div').length > 0);

// Đi về phía quái (nếu đang ở map 1) — test nhắm mục tiêu
window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Tab' }));
await sleep(300);
check('phím Tab chọn mục tiêu không lỗi', true);

await sleep(1200);
check('không có lỗi runtime', errors.length === 0, errors.slice(0, 4).join(' | '));

let pass = 0;
for (const [ok, name, extra] of results) {
  console.log(`  ${ok ? '✔' : '✘'} ${name}${ok ? '' : ' — ' + extra}`);
  if (ok) pass++;
}
console.log(`\nClient: ${pass}/${results.length} kiểm tra đạt.`);
if (errors.length) {
  console.log('\nLỗi chi tiết:');
  for (const e of errors.slice(0, 12)) console.log('   -', e);
}
process.exit(errors.length || pass < results.length ? 1 : 0);
