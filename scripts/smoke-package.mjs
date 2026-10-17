// Start a packaged build with its own bundled Node, read /api/health and /api/hardware, then stop it.
//   node scripts/smoke-package.mjs <package-folder>
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const dir = path.resolve(process.argv[2] ?? '');
const exe = fs.existsSync(path.join(dir, 'node', 'node.exe')) ? 'node.exe' : 'node';
const runnable = exe === 'node.exe' ? process.platform === 'win32' : process.platform !== 'win32';
if (!runnable) { console.log('skip: package is for another operating system'); process.exit(0); }
const port = 8900 + Math.floor(Math.random() * 90); const data = fs.mkdtempSync(path.join(os.tmpdir(), 'is-smoke-'));
const child = spawn(path.join(dir, 'node', exe), [path.join(dir, 'app', 'server.mjs')], { cwd: dir, env: { ...process.env, PORT: String(port), INFLUENCER_STUDIO_DATA: data, INFLUENCER_STUDIO_TOKEN: 'smoke', INFLUENCER_STUDIO_MOCK: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let out = ''; child.stdout.on('data', d => (out += d)); child.stderr.on('data', d => (out += d));
const get = async p => { const r = await fetch(`http://127.0.0.1:${port}${p}`, { headers: { authorization: 'Bearer smoke' } }); return { status: r.status, body: await r.json().catch(() => null) }; };
let ok = false;
try {
  for (let i = 0; i < 60; i++) { try { const h = await get('/api/health'); if (h.status === 200) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 250)); }
  const h = await get('/api/health'); const hw = await get('/api/hardware'); const o = await get('/api/options');
  const page = await fetch(`http://127.0.0.1:${port}/`); const html = await page.text();
  console.log('health', h.status, JSON.stringify(h.body)); console.log('hardware', hw.status, 'tier', hw.body?.tier, 'gpus', hw.body?.gpus?.length, 'ram', hw.body?.ramGb, 'disk', hw.body?.freeDiskGb, 'os', hw.body?.os?.platform);
  console.log('options models', o.body?.models?.length, 'ui html', page.status, html.includes('<div id="app"') || html.includes('id="app"') ? 'has app root' : 'no app root');
  ok = h.status === 200 && hw.status === 200 && !!hw.body?.tier && o.status === 200 && o.body.models.length >= 3 && page.status === 200;
} catch (e) { console.log('error', e.message, out); }
child.kill();
console.log(ok ? 'SMOKE OK' : 'SMOKE FAILED'); process.exit(ok ? 0 : 1);
