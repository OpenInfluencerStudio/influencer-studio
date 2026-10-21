// Preset cards: every card shows a real image; clicking one fills the builder and shows its hero image in the big preview. Usage: node test-presets.mjs <url> <outdir>
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, out = '/tmp/presets-shots'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
p.setDefaultTimeout(5000); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => localStorage.setItem('is_walkthrough_done', '1'));
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
await p.goto(url); await p.waitForTimeout(1200); await p.click('nav >> text=Character'); await p.waitForTimeout(800);
const cards = p.locator('.pcard'); ok(await cards.count() === 39, 'preset cards: ' + await cards.count());
await p.locator('#presets').scrollIntoViewIfNeeded();
await p.evaluate(async () => { const g = document.querySelector('#silly-pack .pgrid'); for (let y = 0; y < g.scrollHeight; y += 200) { g.scrollTop = y; await new Promise(r => setTimeout(r, 80)); } g.scrollTop = 0; });
await p.waitForTimeout(1200);
const broken = await p.evaluate(() => [...document.querySelectorAll('.pcard')].filter(c => { const i = c.querySelector('img'); return !i || !(i.complete && i.naturalWidth > 0); }).map(c => c.textContent));
ok(broken.length === 0, 'every preset card shows a real image ' + broken.join(','));
await p.locator('#presets').screenshot({ path: out + '/preset-grid-regular.png' });
await p.locator('#silly-pack').screenshot({ path: out + '/preset-grid-silly.png' });
for (const [name, file] of [['Captain Frog', 'captain_frog'], ['Sir Pompadour', 'sir_pompadour']]) {
  await p.locator(`.pcard:has-text("${name}")`).first().click(); await p.waitForTimeout(900);
  const src = await p.locator('#live-preview img.hero').getAttribute('src').catch(() => null);
  ok(!!src && src.includes(file), `${name}: big preview shows its hero (${src})`);
  ok(await p.locator(`.pcard.on:has-text("${name}")`).count() === 1, `${name}: card marked active`);
}
await p.locator('.pcard:has-text("Sir Pompadour")').first().click(); await p.waitForTimeout(600);
ok(await p.locator('.bt.on:has-text("Man")').count() >= 1, 'Sir Pompadour filled the builder (type Man)');
await p.locator('.bt:has-text("Woman")').first().click(); await p.waitForTimeout(500);
await p.locator('#presets .pcard').first().click(); await p.waitForTimeout(900);
const s2 = await p.locator('#live-preview img.hero').getAttribute('src').catch(() => null);
ok(!!s2 && /__woman\.webp$/.test(s2), 'regular preset hero follows the chosen type: ' + s2);
await p.locator('#live-preview').scrollIntoViewIfNeeded(); await p.screenshot({ path: out + '/preset-applied.png' });
await p.locator('.bt:has-text("Man")').first().click(); await p.waitForTimeout(500);
ok(await p.locator('#live-preview img.hero').count() === 0, 'changing the selection drops the preset hero');
const ex = await p.locator('#live-preview img.phimg').getAttribute('src').catch(() => null);
ok(!!ex && ex.includes('presets/example_man_'), 'colourful example preview shown: ' + ex);
ok(errs.length === 0, 'no page errors ' + errs.join('|'));
await b.close(); process.exit(fails ? 1 : 0);
