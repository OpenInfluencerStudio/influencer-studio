// Screenshots of the Hardware, Models and Video screens in a running app (headless Edge/Chrome over DevTools, throw-away profile).
//   node scripts/shots-parts.mjs <browser.exe> <appUrlWithToken> <outDir> <prefix> <steps comma list: hardware,models,licence,video>
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const [exe, url, out, prefix, stepsArg] = process.argv.slice(2); const steps = (stepsArg ?? 'hardware,models').split(','); fs.mkdirSync(out, { recursive: true });
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'is-shots-')); const port = 9335;
const br = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1440,1100', '--hide-scrollbars', '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (name, h = 1100) => { await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(300); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, `${prefix}-${name}.png`), Buffer.from(r.result.data, 'base64')); console.log('shot', name); };
const click = (txt, sel = 'button') => ev(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(b=>b.textContent.trim().startsWith(${JSON.stringify(txt)}));if(!b)return false;b.click();return true})()`);
await send('Page.enable'); await send('Page.navigate', { url }); await sleep(3500);
if (steps.includes('hardware')) { await click('Hardware', 'nav button'); await sleep(1200); await shot('hardware'); }
if (steps.includes('models') || steps.includes('licence')) {
  await click('Models', 'nav button'); await sleep(1500); await shot('models', 1300);
  if (steps.includes('licence')) { await click('Download'); await sleep(600); await shot('licence-dialog', 1300); }
}
if (steps.includes('video')) {
  await click('Generate', 'nav button'); await sleep(2500);
  await ev(`document.getElementById('video-card')?.scrollIntoView()`); await sleep(1500); await shot('video-card', 1500);
  await ev(`window.scrollTo(0,0)`); await sleep(600); await shot('generate-top', 1300);
}
await send('Browser.close').catch(() => {}); br.kill();
