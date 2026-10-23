// Điểm vào: màn hình đăng nhập → vào thế giới
import { boot } from './game.js';
import { G } from './state.js';
import * as UI from './ui.js';

const regState = { cls: 1 };
const guestState = { cls: 1 };

function sendWhenReady(obj, tries = 40) {
  if (!G.net || !G.net.ws || G.net.ws.readyState !== 1) {
    if (tries > 0) setTimeout(() => sendWhenReady(obj, tries - 1), 150);
    return;
  }
  G.net.send(obj);
}

const handlers = {
  regState,
  guestState,
  login(user, pass) {
    if (!user) return UI.setError('err-login', 'Vui lòng nhập tài khoản.');
    G.lastForm = 'login';
    UI.setError('err-login', '');
    UI.showLoading(true);
    G.auth = { type: 'login', user, pass };
    sendWhenReady({ t: 'login', user, pass });
    setTimeout(() => UI.showLoading(false), 4000);
  },
  register(user, pass, char, cls) {
    if (user.length < 3) return UI.setError('err-register', 'Tài khoản cần ít nhất 3 ký tự.');
    if (char.length < 2) return UI.setError('err-register', 'Tên nhân vật cần ít nhất 2 ký tự.');
    G.lastForm = 'register';
    UI.setError('err-register', '');
    UI.showLoading(true);
    G.auth = { type: 'register', user, pass };
    sendWhenReady({ t: 'register', user, pass, char, cls });
    setTimeout(() => UI.showLoading(false), 4000);
  },
  guest(cls) {
    UI.showLoading(true);
    sendWhenReady({ t: 'guest', cls });
    setTimeout(() => UI.showLoading(false), 4000);
  },
};

// Kết nối & giao diện
boot(handlers);

// Hiện thông tin máy chủ
fetch('/api/status')
  .then((r) => r.json())
  .then((s) => UI.setServerStatus(`Máy chủ: ${s.online} người online · ${s.accounts} nhân vật đã tạo`))
  .catch(() => UI.setServerStatus('Đang kết nối…'));

// Tự vào chơi nhanh nếu có ?guest=1
if (new URLSearchParams(location.search).get('guest')) {
  setTimeout(() => handlers.guest(1), 600);
}
