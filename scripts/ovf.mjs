import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.setDefaultTimeout(2500);
await p.addInitScript(() => localStorage.setItem('is_walkthrough_done', '1'));
await p.goto(process.argv[2]); await p.waitForTimeout(1200);
for (const s of ['Hardware','Home','Character','Generate','Models','About']) {
  await p.locator(`nav >> text=${s}`).first().click().catch(()=>{}); await p.waitForTimeout(600);
  const r = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 && r.width > 0 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 6).map(e => e.tagName + '#' + e.id + '.' + e.className + ' r=' + Math.round(e.getBoundingClientRect().right)));
  console.log(s, JSON.stringify(r));
}
await b.close();
