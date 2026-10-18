// A transient failure of a tile request must not leave the drawn fallback: the tile retries and shows the photo.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
p.setDefaultTimeout(6000);
await p.addInitScript(() => localStorage.setItem('is_walkthrough_done', '1'));
let hits = 0; await p.route('**/previews/hairStyle/rainbow_mohawk__man.webp*', r => (++hits <= 2 ? r.abort() : r.continue()));
await p.goto(process.argv[2]); await p.waitForTimeout(1200); await p.click('nav >> text=Character'); await p.waitForTimeout(500);
await p.locator('.bt:has-text("Man")').first().click();
const bt = p.locator('.bt', { hasText: 'Rainbow mohawk' }).first(); await bt.scrollIntoViewIfNeeded(); await p.waitForTimeout(3500);
const ok = await bt.locator('img.pimg').evaluate(i => i.complete && i.naturalWidth > 0).catch(() => false);
console.log(ok ? 'PASS' : 'FAIL', 'tile recovers after 2 failed loads (requests:', hits + ')'); await b.close(); process.exit(ok ? 0 : 1);
