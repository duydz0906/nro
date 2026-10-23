// Chạy toàn bộ kiểm thử, mỗi bộ trên một máy chủ tạm với thư mục dữ liệu riêng
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(name, port) {
  const dir = `/tmp/nro-test-${name}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const srv = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: dir,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stdout.on('data', (d) => process.stdout.write(`[${name}] ` + d));
  srv.stderr.on('data', (d) => process.stderr.write(`[${name}:err] ` + d));
  return srv;
}

function runScript(file, env = {}) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [path.join(ROOT, 'test', file)], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    p.on('exit', (code) => res(code || 0));
  });
}

console.log('=== Kiểm thử luồng chơi ===');
const s1 = startServer('play', 3999);
await sleep(1500);
const a = await runScript('smoke.js', { URL: 'ws://127.0.0.1:3999' });
s1.kill('SIGKILL');

console.log('\n=== Kiểm thử tài khoản & quản trị ===');
const s2 = startServer('admin', 3998);
await sleep(1500);
const b = await runScript('admin-smoke.js', { URL: 'ws://127.0.0.1:3998' });
s2.kill('SIGKILL');

console.log(`\nTổng kết: ${a === 0 && b === 0 ? 'TẤT CẢ ĐẠT ✅' : 'CÓ LỖI ❌'}`);
process.exit(a || b || 0);
