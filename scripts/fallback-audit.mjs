// Lists every option tile that shows a drawn fallback instead of a real webp, for each character type. Usage: node fallback-audit.mjs <url> [types]
import { chromium } from 'playwright';
const types = process.argv[3] ? process.argv[3].split(',') : ['Surprise me','Man','Woman','Non-binary','Trans woman','Trans man','Alien','Monster','Cat person','Dog person','Fox person','Frog person','Insect person','Bird person','Rodent person','Reptile person','Robot','Plush person'];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 1280, height: 1600 } });
p.setDefaultTimeout(4000);
await p.addInitScript(() => localStorage.setItem('is_walkthrough_done', '1'));
await p.goto(process.argv[2]); await p.waitForTimeout(1500); await p.click('nav >> text=Character'); await p.waitForTimeout(1000);
let total = 0; const LV = Number(process.env.SILLY ?? 0);
if (LV) { await p.evaluate((v) => { const r = document.querySelector('#silly-range'); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, LV); await p.waitForTimeout(500); }
for (const t of types) {
  await p.locator(`.bt:has-text("${t}")`).first().click(); await p.waitForTimeout(400);
  // open every section
  const n = await p.locator('.shead .stog').count();
  for (let i = 0; i < n; i++) { const s = p.locator('.shead .stog').nth(i); if ((await s.getAttribute('aria-expanded')) !== 'true') await s.click().catch(() => {}); }
  await p.waitForTimeout(300);
  // scroll panel to load lazy images
  await p.evaluate(async () => { const sc = document.querySelector('.pscroll'); if (!sc) return; for (let y = 0; y < sc.scrollHeight; y += 400) { sc.scrollTop = y; await new Promise(r => setTimeout(r, 60)); } sc.scrollTop = 0; });
  await p.waitForTimeout(1200);
  const bad = await p.evaluate(() => {
    const out = [];
    for (const sec of document.querySelectorAll('.sec')) {
      const title = sec.querySelector('.stitle')?.textContent?.split(' ·')[0] ?? '?';
      for (const bt of sec.querySelectorAll('.tg .bt')) {
        const label = bt.querySelector('.tl')?.textContent ?? '?';
        if (bt.querySelector('i.sw') || label === 'Surprise me') continue; // colour swatch / intentional Surprise-me icon
        const img = bt.querySelector('img.pimg');
        if (!img || !(img.complete && img.naturalWidth > 0)) out.push(title + ' / ' + label);
      }
    }
    return out;
  });
  total += bad.length; console.log(`${t.padEnd(15)} ${bad.length}`, bad.slice(0, 40).join(' | '));
}
console.log('TOTAL', total); await b.close(); process.exit(total ? 1 : 0);
