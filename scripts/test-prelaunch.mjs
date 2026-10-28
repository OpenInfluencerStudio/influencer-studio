// Real-click test: version stamp, feedback link, About/diagnostics, first-run walkthrough (mock mode). Usage: node test-prelaunch.mjs <url> <outdir>
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2); const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'PASS' : 'FAIL', m); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
const reqs = []; p.on('request', r => { if (!r.url().startsWith(new URL(url).origin)) reqs.push(r.url()); });
await p.goto(url); await p.waitForTimeout(1500);
// first run: walkthrough appears, is a labelled modal, skippable
ok(await p.locator('#walkthrough [role=dialog][aria-modal=true]').count() === 1, 'walkthrough shown on first run as a modal dialog');
await p.screenshot({ path: out + '/40-walkthrough-step1.png' });
await p.click('#walk-next'); await p.waitForTimeout(300); ok((await p.locator('#walkthrough h2').innerText()).includes('Hardware'), 'Next goes to the Hardware step');
await p.click('#walk-next'); await p.waitForTimeout(300); ok((await p.locator('#walkthrough h2').innerText()).includes('Character'), 'Next goes to the Character step');
await p.screenshot({ path: out + '/41-walkthrough-step3.png' });
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
ok(await p.locator('#walkthrough').count() === 0, 'Escape closes the tour');
await p.reload(); await p.waitForTimeout(1200); ok(await p.locator('#walkthrough').count() === 0, 'tour does not return after reload');
// version stamp + feedback link
const ver = (await p.locator('#ver-badge').innerText()).trim(); ok(ver === 'v0.2.0-prelaunch', 'header version badge: ' + ver);
const fb = p.locator('header #feedback-link'); ok(await fb.count() === 1, 'feedback link in header');
ok((await fb.getAttribute('href')).startsWith('https://github.com/OpenInfluencerStudio/influencer-studio/issues/new'), 'feedback link points to GitHub issues');
ok(await fb.getAttribute('target') === '_blank' && (await fb.getAttribute('rel')).includes('noopener'), 'feedback link opens a new tab safely');
const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), fb.click()]); ok(!!pop, 'click opens a new tab'); if (pop) await pop.close();
// About and diagnostics
await p.click('nav >> text=About'); await p.waitForSelector('#diag-report'); await p.waitForTimeout(500);
ok((await p.locator('#version-stamp').innerText()).trim() === '0.2.0-prelaunch', 'About shows the version');
const pb = (await p.locator('#platform-badge').innerText()).trim(); ok(pb.includes('Built on the Comfy Developer Platform — Comfy SDK 0.5.0 (Comfy API v2 via comfy-api-proxy)'), 'About shows the Comfy Developer Platform badge: ' + pb);
const rep = await p.locator('#diag-report').inputValue(); ok(rep.includes('0.2.0-prelaunch') && rep.includes('GPU:') && rep.includes('Models:'), 'report has version, GPU and models');
ok(!/[A-Za-z]:\\Users|\/home\/|\/Users\/|#t=[A-Za-z0-9_-]{20}/.test(rep), 'report has no private paths or token');
await p.click('#copy-report'); await p.waitForTimeout(400);
const clip = await p.evaluate(() => navigator.clipboard.readText()); ok(clip === rep, 'Copy report puts the report on the clipboard');
ok((await p.locator('#copy-report').innerText()).includes('Copied'), 'copy button confirms');
await p.screenshot({ path: out + '/42-about-diagnostics.png' });
await p.click('#show-walkthrough'); await p.waitForTimeout(300); ok(await p.locator('#walkthrough').count() === 1, 'tour can be reopened from About');
await p.click('#walk-skip'); await p.waitForTimeout(300);
ok(await p.locator('#walkthrough').count() === 0, 'Skip closes the tour');
ok(reqs.length === 0, 'no requests left the app origin: ' + reqs.join(','));
ok(errs.length === 0, 'no page errors ' + errs.join('|'));
await b.close(); process.exit(fail.length ? 1 : 0);
