// Screenshots of the "Same character" card in the real running app (headless Edge/Chrome over DevTools, throw-away profile).
//   node scripts/shots-same.mjs <browser.exe> <appUrlWithToken> <outDir>
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const [exe, url, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'is-shots-')); const port = 9334;
const br = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1440,1300', '--hide-scrollbars', '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, name), Buffer.from(r.result.data, 'base64')); console.log('shot', name); };
const click = (txt, sel = 'button') => ev(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(b=>b.textContent.trim().startsWith(${JSON.stringify(txt)}));if(!b)return false;b.click();return true})()`);
await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1300, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url }); await sleep(3500);
await click('Generate', 'nav button'); await sleep(2000);
await ev(`document.getElementById('same-character')?.scrollIntoView()`); await sleep(500);
await click('Smart blazer'); await click('Cafe'); await click('Sitting'); await sleep(500); await shot('same-1-scene.png');
await click('New camera angle'); await sleep(300); await click('Front-left'); await click('Low angle'); await sleep(500); await shot('same-2-angle.png');
await ev(`window.scrollTo(0,0)`); await sleep(300); await shot('same-3-generate-top.png');
await send('Browser.close').catch(() => {}); br.kill();
