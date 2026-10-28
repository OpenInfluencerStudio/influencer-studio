// UI alignment audit. Usage: node align-check.mjs <url> <outdir> [--shots]
// For every screen x viewport it screenshots (optional) and measures DOM boxes: sibling controls that sit on the same line must have the same
// height and top (tolerance 1px); wrapped groups must not leave one orphan control on the last line; nothing may overflow horizontally.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, out = '/tmp/align'] = process.argv.slice(2); const shots = process.argv.includes('--shots'); fs.mkdirSync(out, { recursive: true });
const VPS = [[1280, 800], [1440, 900], [1920, 1080], [390, 844]];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const findings = [];
function measure() {
  const CTRL = 'button, select, input:not([type=hidden]):not([type=range]):not([type=file]):not([type=checkbox]):not([type=radio]), a.chip, .pill, .chip';
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden]') && !e.closest('.pickerlist'); };
  const path = e => { const p = []; while (e && e.nodeType === 1 && p.length < 4) { p.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); e = e.parentElement; } return p.join(' > '); };
  const res = []; const parents = new Map();
  for (const e of document.querySelectorAll(CTRL)) { if (!vis(e)) continue; const p = e.parentElement; if (!p) continue; (parents.get(p) ?? parents.set(p, []).get(p)).push(e); }
  for (const [p, els] of parents) {
    if (els.length < 2) continue;
    if (p.matches('.grid, .tiles, .tgrid') ) continue;
    const boxes = els.map(e => ({ e, r: e.getBoundingClientRect() })).sort((a, c) => a.r.top - c.r.top || a.r.left - c.r.left);
    const lines = [];
    for (const x of boxes) { const ln = lines.find(l => { const o = Math.min(l.b, x.r.bottom) - Math.max(l.t, x.r.top); return o > 0.5 * Math.min(l.b - l.t, x.r.height); }); if (ln) { ln.items.push(x); ln.t = Math.min(ln.t, x.r.top); ln.b = Math.max(ln.b, x.r.bottom); } else lines.push({ t: x.r.top, b: x.r.bottom, items: [x] }); }
    for (const ln of lines) {
      if (ln.items.length < 2) continue;
      const hs = ln.items.map(i => i.r.height), ts = ln.items.map(i => i.r.top);
      const dh = Math.max(...hs) - Math.min(...hs), dt = Math.max(...ts) - Math.min(...ts);
      if (dh > 1.01 || dt > 1.01) res.push({ kind: 'row', where: path(p), dh: +dh.toFixed(1), dt: +dt.toFixed(1), items: ln.items.map(i => (i.e.textContent || i.e.getAttribute('aria-label') || i.e.placeholder || i.e.tagName).trim().slice(0, 18) + ' ' + Math.round(i.r.height)) });
    }
    if (lines.length > 1 && els.length >= 3 && els.length <= 12) { const last = lines[lines.length - 1]; if (last.items.length === 1 && lines[0].items.length >= 2 && last.items[0].r.width < 0.9 * p.getBoundingClientRect().width) res.push({ kind: 'orphan', where: path(p), item: (last.items[0].e.textContent || '').trim().slice(0, 20), perLine: lines.map(l => l.items.length) }); }
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) res.push({ kind: 'hscroll', where: 'document', sw: document.documentElement.scrollWidth, iw: innerWidth });
  return res;
}
async function visit(p, name, w, h) {
  await p.waitForTimeout(500);
  if (shots) await p.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: false });
  const r = await p.evaluate(measure); for (const f of r) findings.push({ screen: name, vp: `${w}x${h}`, ...f });
}
for (const [w, h] of VPS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage(); p.setDefaultTimeout(2500); await p.addInitScript(() => { if (!sessionStorage.__t0) { sessionStorage.__t0 = 1; } });
  // tour first (fresh storage), then dismiss
  await p.goto(url); await p.waitForTimeout(1200); await visit(p, 'tour', w, h);
  await p.evaluate(() => localStorage.setItem('is_walkthrough_done', '1')); await p.reload(); await p.waitForTimeout(1200);
  const nav = async t => { await p.locator(`nav >> text=${t}`).first().click(); await p.waitForTimeout(700); };
  await visit(p, 'scan', w, h);
  const cust = p.locator('button:has-text("Custom")').first(); if (await cust.count()) { await cust.click().catch(() => {}); await p.waitForTimeout(500); await visit(p, 'custom', w, h); }
  await nav('Home'); await visit(p, 'home', w, h);
  await nav('Character'); await visit(p, 'builder', w, h);
  await p.locator('.top .tog, .top button:has-text("Advanced")').first().click().catch(() => {}); await p.waitForTimeout(600); await visit(p, 'builder-adv', w, h);
  await p.locator('text=/^Motion$/').first().click().catch(() => {}); await p.waitForTimeout(500); await visit(p, 'builder-motion', w, h);
  await nav('Generate'); await visit(p, 'generate', w, h);
  await p.locator('.top button:has-text("Video")').first().click().catch(() => {}); await p.waitForTimeout(700); await visit(p, 'video', w, h);
  await p.locator('#vin-audio').click().catch(() => {}); await p.waitForTimeout(500); await visit(p, 'audio-music', w, h);
  await p.locator('#audio-mode-pills button:has-text("Speech")').click().catch(() => {}); await p.waitForTimeout(500); await visit(p, 'audio-speech', w, h);
  await p.locator('#vin-i2v').click().catch(() => {});
  await p.locator('.top button:has-text("Image")').first().click().catch(() => {});
  await nav('Models'); await visit(p, 'models', w, h);
  await nav('About'); await visit(p, 'about', w, h);
  await p.locator('.top').first().screenshot({ path: `${out}/header-${w}.png` }).catch(() => {});
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${out}/findings.json`, JSON.stringify(findings, null, 1));
const by = {}; for (const f of findings) { const k = `${f.kind} ${f.where}`; (by[k] ??= []).push(`${f.screen}@${f.vp}`); }
for (const [k, v] of Object.entries(by)) console.log(String(v.length).padStart(3), k, '|', [...new Set(v)].slice(0, 3).join(', '));
console.log('TOTAL', findings.length); process.exit(findings.length ? 1 : 0);
