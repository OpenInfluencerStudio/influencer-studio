// Playwright screenshots of the mode switch and scan spacing (run against a mock-mode server). Usage: node shots-mode.mjs <urlWithToken>  (needs: npm i playwright; set executablePath to your Chrome)
import { chromium } from 'playwright';
const url = process.argv[2]; const out = '/workspace/influencer-studio-repo/docs-shots-local/mode/';
import fs from 'node:fs'; fs.mkdirSync(out,{recursive:true});
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args:['--no-sandbox'] });
for (const [w,h] of [[1280,800],[1920,1080]]) {
  const p = await b.newPage({ viewport:{width:w,height:h} }); await p.goto(url); await p.waitForTimeout(2500);
  const hdr0 = await p.locator('header.top').boundingBox();
  await p.getByRole('button',{name:'Hardware'}).click(); await p.waitForTimeout(2800);
  const chips = await p.locator('.chips').last().boundingBox(); const cta = await p.locator('.scan-cta button').boundingBox();
  console.log(w,'gap chips->cta',Math.round(cta.y-(chips.y+chips.height)));
  await p.locator('.scan-cta').scrollIntoViewIfNeeded(); await p.screenshot({path:out+`scan-${w}.png`});
  await p.getByRole('button',{name:'Home'}).click(); await p.waitForTimeout(500); await p.screenshot({path:out+`image-home-${w}.png`});
  await p.locator('header.top').getByRole('radio',{name:/Video/}).click(); await p.waitForTimeout(1200);
  const hdr1 = await p.locator('header.top').boundingBox(); console.log('header h',hdr0.height,hdr1.height);
  await p.screenshot({path:out+`video-mode-${w}.png`});
  await p.getByRole('tab',{name:/Motion transfer/}).click(); await p.waitForTimeout(400); await p.screenshot({path:out+`video-motion-locked-${w}.png`});
  await p.reload(); await p.waitForTimeout(1500);
  console.log('persist', await p.locator('header.top').getByRole('radio',{name:/Video/}).getAttribute('aria-checked'));
  await p.locator('header.top').getByRole('radio',{name:/Video/}).focus(); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(500);
  console.log('kbd', await p.locator('header.top').getByRole('radio',{name:/Image/}).getAttribute('aria-checked'));
  await p.getByRole('button',{name:'Generate'}).first().click(); await p.waitForTimeout(800); await p.screenshot({path:out+`image-generate-${w}.png`});
  await p.close();
}
await b.close();
