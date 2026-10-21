// Preset hero image generator. Runs where ComfyUI runs (loopback). Resumable, sequential, FLUX.2 klein 4B text-to-image.
//   node scripts/presets/run.mjs --out ./presets_work [--only id1,id2] [--force id1,id2]
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { ComfyClient } from '../../server/dist/comfy.js';
import { loadTemplates, fillTemplate } from '../../server/dist/workflows.js';
import { presetHeroJobs, exampleJobs } from '../../server/dist/presetHero.js';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const OUT = arg('out', './presets_work'); const only = arg('only')?.split(','); const force = arg('force')?.split(',') ?? [];
const comfy = new ComfyClient({ baseUrl: process.env.COMFYUI_URL ?? 'http://127.0.0.1:8288', timeoutMs: 8000 });
const t2i = loadTemplates().get('klein_t2i'); fs.mkdirSync(OUT, { recursive: true });
const jobs = [...(process.argv.includes('--examples') ? [] : presetHeroJobs()), ...(process.argv.includes('--examples') || process.argv.includes('--with-examples') ? exampleJobs().map(e => ({ ...e, id: 'example' })) : [])].filter(j => !only || only.includes(j.id));
fs.writeFileSync(path.join(OUT, 'jobs.json'), JSON.stringify(jobs, null, 1));
for (const j of jobs) {
  const file = path.join(OUT, j.file.replace('.webp', '.png').replace('presets/', ''));
  if (fs.existsSync(file) && !force.includes(j.id)) continue;
  const t0 = Date.now(); const id = await comfy.submit(fillTemplate(t2i, { prompt: j.prompt, width: j.width, height: j.height, seed: j.seed, prefix: 'preset' }), crypto.randomUUID());
  for (;;) { await new Promise(r => setTimeout(r, 400)); const s = await comfy.poll(id); if (s.state === 'done') { fs.writeFileSync(file, await comfy.fetchImage(s.images[0])); break; } if (s.state === 'failed' || s.state === 'error') { console.log('FAIL', j.file, JSON.stringify(s).slice(0, 200)); break; } if (Date.now() - t0 > 240000) { console.log('TIMEOUT', j.file); break; } }
  console.log(j.file, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
console.log('ALLDONE');
