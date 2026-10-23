// Lưu trữ tài khoản & nhân vật (JSON, không cần database)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'players.json');

let state = { accounts: {} };
let saveTimer = null;

export function load() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(FILE)) {
      state = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (!state.accounts) state.accounts = {};
    }
  } catch (e) {
    console.error('[save] Không đọc được dữ liệu:', e.message);
    state = { accounts: {} };
  }
  return state;
}

export function flush() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, FILE);
  } catch (e) {
    console.error('[save] Lỗi ghi:', e.message);
  }
}

export function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flush();
  }, 1500);
}

export function accounts() {
  return state.accounts;
}
export function accountCount() {
  return Object.keys(state.accounts).length;
}
export function getAccount(name) {
  return state.accounts[name.toLowerCase()];
}

function hash(pass, salt) {
  return crypto.scryptSync(String(pass), salt, 32).toString('hex');
}

export function createAccount(name, pass, opts = {}) {
  const key = name.toLowerCase();
  if (state.accounts[key]) return null;
  const salt = crypto.randomBytes(8).toString('hex');
  const acc = {
    name,
    key,
    salt,
    hash: hash(pass, salt),
    admin: opts.admin || false,
    guest: !!opts.guest,
    created: Date.now(),
    lastSeen: Date.now(),
    char: opts.char || null,
  };
  state.accounts[key] = acc;
  saveSoon();
  return acc;
}

export function verify(name, pass) {
  const acc = getAccount(name);
  if (!acc) return null;
  const h = hash(pass, acc.salt);
  if (h.length !== acc.hash.length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(acc.hash))) return null;
  acc.lastSeen = Date.now();
  return acc;
}

export function touch(acc) {
  if (acc) acc.lastSeen = Date.now();
}
