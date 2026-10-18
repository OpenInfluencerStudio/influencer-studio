// Type-switch persistence: no creature state may leak into human selections. Usage: node test-typeswitch.mjs <url>
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.addInitScript(() => localStorage.setItem('is_walkthrough_done', '1'));
const bodies = []; p.on('request', r => { if (r.method() === 'POST' && /\/api\/(jobs|compile)$/.test(r.url())) bodies.push(JSON.parse(r.postData() || '{}')); });
await p.goto(process.argv[2]); await p.waitForTimeout(1500); await p.click('nav >> text=Character'); await p.waitForTimeout(1000);
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const CREATURE = /frog|lizard|reptil|amphib|creature|species|insect|cat_person|dog_person|fox|bird|rodent|plush|robot|alien|monster/i;
for (const human of ['Man', 'Woman', 'Non-binary', 'Trans woman', 'Trans man', 'Surprise me']) {
  for (const creature of ['Frog person', 'Reptile person', 'Alien', 'Monster']) {
    await p.locator(`.bt:has-text("${creature}")`).first().click(); await p.waitForTimeout(250);
    await p.locator(`.bt:has-text("${human}")`).first().click(); await p.waitForTimeout(300);
    bodies.length = 0;
    await p.click('#live-preview button.primary'); await p.waitForTimeout(900);
    const ch = bodies.find(x => x.character)?.character ?? {};
    ok(!CREATURE.test(JSON.stringify(ch).replace(/"type":"[a-z_]+"/, '')) && !('species' in ch), `${creature} -> ${human}: job character has no creature state ${JSON.stringify(ch)}`);
    const hasSpeciesSection = await p.locator('text=/species · \\d+/').count();
    ok(hasSpeciesSection === 0, `${creature} -> ${human}: no species section`);
    const src = await p.locator('#live-preview img.phimg').first().getAttribute('src').catch(() => null);
    ok(!src || !/(creature|frog|reptile|alien|monster)/.test(src), `${creature} -> ${human}: placeholder ${src}`);
  }
}
const ls = await p.evaluate(() => JSON.stringify({ ...localStorage }));
ok(!/frog|reptile|species/i.test(ls), 'localStorage has no creature state');
await b.close(); process.exit(fails ? 1 : 0);
