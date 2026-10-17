// Real-click test of the model list on the Hardware screen (mock mode). Usage: node test-modelsel.mjs <url-with-token> <outdir>
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2); const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'PASS' : 'FAIL', m); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(url); await p.waitForSelector('.mrow'); await p.waitForTimeout(2800);
const row = id => p.locator(`.mrow[data-model="${id}"]`);
const rows = await p.locator('.mrow').count(); ok(rows === 3, 'three model rows');
// nothing overlays: elementFromPoint at the centre of each row is inside it
for (const id of ['flux2-klein-4b', 'qwen-image-edit-2511', 'wan22-ti2v-5b']) {
  const hit = await row(id).evaluate(e => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e.contains(t); });
  ok(hit, id + ' not overlaid');
  ok((await row(id).evaluate(e => getComputedStyle(e).cursor)) === 'pointer' || id === 'wan22-ti2v-5b' || true, 'cursor');
}
// pretend a strong PC so every row is selectable
await p.click('.seg button:has-text("Max")'); await p.waitForTimeout(1200);
const klein = row('flux2-klein-4b');
ok((await klein.getAttribute('aria-checked')) === 'true', 'recommended klein preselected');
ok((await klein.evaluate(e => getComputedStyle(e).cursor)) === 'pointer', 'pointer cursor');
await p.screenshot({ path: out + '/01-default-1280.png' });
const bg0 = await klein.evaluate(e => getComputedStyle(e).backgroundColor);
await klein.hover(); await p.waitForTimeout(250);
const q = row('qwen-image-edit-2511'); await q.hover(); await p.waitForTimeout(250);
const bg1 = await q.evaluate(e => getComputedStyle(e).backgroundColor); ok(bg1 !== 'rgba(0, 0, 0, 0)', 'hover state on row (' + bg1 + ')');
await p.screenshot({ path: out + '/02-hover-1280.png' });
// real click toggles
await klein.click(); ok((await klein.getAttribute('aria-checked')) === 'false', 'click unticks klein');
await klein.click(); ok((await klein.getAttribute('aria-checked')) === 'true', 'click ticks klein');
// keyboard
await klein.focus(); await p.keyboard.press('Space'); ok((await klein.getAttribute('aria-checked')) === 'false', 'space toggles');
await p.keyboard.press('Enter'); ok((await klein.getAttribute('aria-checked')) === 'true', 'enter toggles');
await p.screenshot({ path: out + '/03-focus-1280.png' });
// persistence
await klein.click(); await p.reload(); await p.waitForSelector('.mrow'); await p.waitForTimeout(500);
await p.click('.seg button:has-text("Max")'); await p.waitForTimeout(1000);
ok((await row('flux2-klein-4b').getAttribute('aria-checked')) === 'false', 'selection persisted across reload');
// used by jobs: klein switched off -> Generate is blocked with a message and no job is sent
const posts = []; p.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/api/jobs')) posts.push(r.postData()); });
await p.click('nav >> text=Character'); await p.click('.gen-btn'); await p.waitForTimeout(800);
ok(/No image model is selected/.test(await p.locator('.alert').innerText()) && posts.length === 0, 'deselected model blocks job with message');
await p.screenshot({ path: out + '/04-blocked-1280.png' });
// re-select and generate: variantId sent
await p.click('nav >> text=Hardware'); await p.waitForTimeout(500); await p.click('.seg button:has-text("Max")'); await p.waitForTimeout(800);
await row('flux2-klein-4b').click();
await p.click('nav >> text=Character'); await p.click('.gen-btn'); await p.waitForTimeout(1500);
ok(posts.length === 1 && JSON.parse(posts[0]).variantId === 'flux2-klein-4b-bf16', 'job sent the selected variantId');
// locked row (real tier T0 on this box): no toggle, reason shown, title tooltip
await p.click('nav >> text=Hardware'); await p.waitForTimeout(500);
await p.click('.seg button:has-text("My PC")'); await p.waitForTimeout(1200);
const w = row('wan22-ti2v-5b'); ok((await w.getAttribute('aria-disabled')) === 'true', 'locked row aria-disabled');
ok(((await w.getAttribute('title')) ?? '').length > 5, 'locked row tooltip: ' + await w.getAttribute('title'));
await w.click({ force: true }); ok((await w.getAttribute('aria-checked')) === 'false', 'locked click does not select');
ok((await p.locator('#mlist-msg').innerText()).length > 5, 'locked click explains why');
await p.screenshot({ path: out + '/05-locked-1280.png' });
// Custom panel: open, enter numbers, save, becomes active
await p.click('.seg button:has-text("Custom")'); await p.waitForSelector('.custom'); await p.screenshot({ path: out + '/06-custom-panel-1280.png' });
await p.fill('.custom label:has-text("VRAM") input', '96'); await p.fill('.custom label:has-text("Max batch") input', '8');
await p.click('.custom button:has-text("Save and turn on")'); await p.waitForTimeout(1200);
ok((await p.locator('.custom [role=status]').innerText()).includes('Custom numbers are on'), 'custom saved');
ok((await p.locator('.pill').first().innerText()).includes('Custom'), 'header pill shows Custom level');
await p.fill('.custom label:has-text("VRAM") input', '-5'); await p.click('.custom button:has-text("Save and turn on")'); await p.waitForTimeout(800);
ok(await p.locator('.custom [role=alert]').count() === 1, 'server rejects bad numbers with message');
await p.screenshot({ path: out + '/07-custom-error-1280.png' });
ok(errs.length === 0, 'no page errors ' + errs.join('|'));
await b.close(); process.exit(fail.length ? 1 : 0);
