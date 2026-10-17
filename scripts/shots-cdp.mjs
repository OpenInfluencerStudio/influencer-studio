// Screenshots of the REAL running app (real ComfyUI behind it) using headless Edge/Chrome over the DevTools protocol. No dependencies (Node 22+).
// Uses a throw-away browser profile folder, never the user's own profile.
//   node scripts/shots-cdp.mjs <browser.exe> <appUrlWithToken> <outDir> [refImagePath]
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const [exe, url, out, refImg] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'is-shots-'));
const port = 9333;
const br = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1440,1000', '--hide-scrollbars', '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (name, clip) => { const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) }); fs.writeFileSync(path.join(out, name), Buffer.from(r.result.data, 'base64')); console.log('shot', name); };
const click = (txt, sel = 'button') => ev(`(()=>{const t=${JSON.stringify(txt)};const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(b=>{const l=b.querySelector('.tl');return l?l.textContent.trim()===t:b.textContent.trim().startsWith(t)});if(!b)return false;b.click();return true})()`);
await send('Page.enable'); await send('DOM.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url }); await sleep(3500);
await click('Character'); await sleep(1500);
await shot('b1-builder-surprise.png');
await click('Man', '.bt'); await sleep(1200);
await ev(`document.querySelector('.pscroll').scrollTo(0,0)`); await sleep(800); await shot('b2-builder-man-thumbs.png');
await click('Very large', '.bt'); await sleep(800);
await ev(`(()=>{const s=[...document.querySelectorAll('.sec')].find(x=>x.textContent.includes('Body size'));s.scrollIntoView()})()`); await sleep(900); await shot('b3-body-sizes.png');
await click('Alien', '.bt'); await sleep(1200);
await ev(`document.querySelector('.pscroll').scrollTo(0,0)`); await sleep(800); await shot('b4-builder-alien.png');
// real generation (type back to Woman, medium size)
await click('Woman', '.bt'); await click('Medium', '.bt'); await sleep(500);
await ev(`document.querySelector('.pscroll').scrollTo(0,0)`); await shot('b5-woman-selected.png');
await click('Generate', '.gen-btn');
for (let i = 0; i < 120; i++) { await sleep(1000); const t = await ev(`document.querySelector('.preview img')?'done':(document.querySelector('.alert')?'alert':'')`); if (i === 3) await shot('g0-progress.png'); if (t) break; }
await sleep(1500); await shot('g1-generate-real-result.png');
if (refImg) {
  await click('Character'); await sleep(1000); await click('Man', '.bt'); await sleep(500);
  const doc = (await send('DOM.getDocument')).result.root.nodeId;
  const inp = (await send('DOM.querySelector', { nodeId: doc, selector: 'input[type=file]' })).result.nodeId;
  await send('DOM.setFileInputFiles', { nodeId: inp, files: [refImg] }); await sleep(2000);
  await ev(`document.querySelector('.pscroll').scrollTo(0,0)`); await shot('r1-style-reference-added.png');
  await click('Generate', '.gen-btn');
  for (let i = 0; i < 120; i++) { await sleep(1000); const t = await ev(`document.querySelector('.preview img')&&!document.querySelector('.spin')?'done':(document.querySelector('.alert')?'alert':'')`); if (t) break; }
  await sleep(1500); await shot('r2-generate-with-style-ref.png');
}
ws.close(); br.kill(); await sleep(500); try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
