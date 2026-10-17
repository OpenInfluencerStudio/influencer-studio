// Thumbnail generator. Runs where ComfyUI runs (loopback only). Uses the app's own template sandbox, so it also tests the pipeline.
//   node scripts/thumbs/run.mjs --out ./thumbs_work [--retest] [--refs-only] [--only hairStyle,outfit] [--limit N] [--dry]
// Resumable (skips existing PNGs). Sequential (one job at a time). Writes a timing log. FLUX.2 klein 4B only (Apache-2.0).
import fs from 'node:fs'; import path from 'node:path';
import { ComfyClient } from '../../server/dist/comfy.js';
import { loadTemplates, fillTemplate } from '../../server/dist/workflows.js';
import { buildThumbManifest, referencePrompt, sizeThumbPrompt, seedFor, FRAMINGS, LOOKS } from '../../server/dist/thumbs.js';
import { compileCharacter } from '../../server/dist/compiler/index.js';
import crypto from 'node:crypto';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') || i + 1 >= process.argv.length ? true : process.argv[i + 1]); };
const OUT = arg('out', './thumbs_work'); const retest = !!arg('retest', false); const refsOnly = !!arg('refs-only', false); const dry = !!arg('dry', false);
const only = typeof arg('only') === 'string' ? arg('only').split(',') : null; const limit = Number(arg('limit', 0)) || 0;
const comfy = new ComfyClient({ baseUrl: process.env.COMFYUI_URL ?? 'http://127.0.0.1:8288', timeoutMs: 8000 });
const tpls = loadTemplates(); const t2i = tpls.get('klein_t2i'); const edit = tpls.get('klein_edit');
fs.mkdirSync(OUT, { recursive: true });
const logf = path.join(OUT, 'gen_log.jsonl');

async function run(wf) {
  const t0 = Date.now(); const id = await comfy.submit(wf, crypto.randomUUID());
  for (;;) { await new Promise(r => setTimeout(r, 300)); const s = await comfy.poll(id); if (s.state === 'done') { if (!s.images.length) throw new Error('no image'); return { buf: await comfy.fetchImage(s.images[0]), sec: (Date.now() - t0) / 1000 }; } if (Date.now() - t0 > 20 * 60_000) throw new Error('timeout'); }
}
const write = (file, buf) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); };
const log = o => fs.appendFileSync(logf, JSON.stringify({ at: new Date().toISOString(), ...o }) + '\n');
async function t2iImage(prompt, w, h, seed, file, meta) {
  if (fs.existsSync(file)) return 'skip'; if (dry) { console.log('dry t2i', path.basename(file)); return 'dry'; }
  const { buf, sec } = await run(fillTemplate(t2i, { prompt, width: w, height: h, seed, prefix: 'thumb' })); write(file, buf);
  log({ kind: 't2i', file: path.relative(OUT, file), seed, sec, prompt, ...meta }); console.log('t2i', path.relative(OUT, file), sec.toFixed(1) + 's'); return 'ok';
}
const uploaded = new Set();
async function ensureRef(look, framing) {
  const [w, h] = FRAMINGS[framing].gen; const file = path.join(OUT, 'refs', `ref_${look}_${framing}.png`);
  await t2iImage(referencePrompt(look, framing), w, h, seedFor(look, framing), file, { ref: true });
  const name = `thumbref_${look}_${framing}.png`;
  if (!dry && !uploaded.has(name)) { await comfy.uploadImage(name, fs.readFileSync(file), 'image/png'); uploaded.add(name); }
  return name;
}

if (arg('retest2', false)) { // iteration C: pinned outfit colour and shoes, stronger slim wording, man and woman
  for (const look of ['man', 'woman']) for (const s of ['ultra_fat', 'fat', 'medium', 'thin', 'skinny', 'stick_thin'])
    await t2iImage(sizeThumbPrompt(look, s), 576, 768, seedFor(look, 'full'), path.join(OUT, 'retest', `C_${look}_${s}.png`), { retest: 'C', look, size: s });
  process.exit(0);
}
if (retest) {
  // 12 core (B: thumbnail prompt, knees-up, stronger silhouette wording) + 12 extra (app prompt "A" on a human, remaining alien/monster sizes)
  const SIZES = ['ultra_fat', 'fat', 'medium', 'thin', 'skinny', 'stick_thin'];
  const jobs = [];
  for (const s of SIZES) jobs.push({ set: 'core', v: 'B', look: 'man', size: s });
  for (const look of ['alien', 'monster']) for (const s of ['ultra_fat', 'medium', 'stick_thin']) jobs.push({ set: 'core', v: 'B', look, size: s });
  for (const s of SIZES) jobs.push({ set: 'extra', v: 'A', look: 'man', size: s });
  for (const look of ['alien', 'monster']) for (const s of ['fat', 'thin', 'skinny']) jobs.push({ set: 'extra', v: 'B', look, size: s });
  for (const j of jobs) {
    const file = path.join(OUT, 'retest', `${j.set}_${j.v}_${j.look}_${j.size}.png`);
    if (j.v === 'A') { // the real app prompt for this character, at the app's default 768x1024
      const c = compileCharacter({ type: 'male', bodySize: j.size, age: 28, outfit: 'white_tee_jeans', hairStyle: 'short_crop', expression: 'neutral', background: 'studio' }, 1);
      await t2iImage(c.positive, 768, 1024, 7301, file, { retest: j });
    } else await t2iImage(sizeThumbPrompt(j.look, j.size), 576, 768, seedFor(j.look, 'full'), file, { retest: j });
  }
  process.exit(0);
}

let items = buildThumbManifest();
if (only) items = items.filter(i => only.includes(i.group));
if (limit) items = items.slice(0, limit);
for (const look of LOOKS) for (const fr of ['face', 'upper', 'full']) if (items.some(i => i.mode === 'edit' && i.look === look && i.framing === fr)) await ensureRef(look, fr);
if (refsOnly) process.exit(0);
let n = 0;
for (const it of items) {
  const file = path.join(OUT, it.file.replace(/\.webp$/, '.png'));
  if (it.mode === 't2i') { await t2iImage(it.prompt, it.gen[0], it.gen[1], it.seed, file, { key: it.key }); continue; }
  if (fs.existsSync(file)) continue; if (dry) { console.log('dry edit', it.key); continue; }
  const name = await ensureRef(it.look, it.framing);
  const mp = Math.round((it.gen[0] * it.gen[1]) / 1e4) / 100;
  const { buf, sec } = await run(fillTemplate(edit, { prompt: it.prompt, image: name, megapixels: mp, seed: it.seed, prefix: 'thumb' })); write(file, buf);
  log({ kind: 'edit', key: it.key, seed: it.seed, sec, fragment: it.fragment }); console.log('edit', it.key, sec.toFixed(1) + 's'); n++;
}
