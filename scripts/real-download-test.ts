// Real download check against Hugging Face with ONE small licence-OK file (flux2-vae, Apache-2.0, 336 MB), pausing and resuming once.
//   node real-download-test.mjs <modelsDir> <statefile>
import { DownloadManager } from '../server/src/downloads.js';
import { loadRegistry } from '../server/src/registry.js';
const [dir, state] = process.argv.slice(2);
const reg = loadRegistry();
const v = reg.variants.find(x => x.id === 'flux2-klein-4b-bf16')!;
const small = { ...v, id: 'vae-only', files: v.files.filter(f => f.name === 'flux2-vae.safetensors') };
reg.variants = [small];
const m = new DownloadManager(state, reg, () => dir);
const t0 = Date.now(); m.start('vae-only', small.license);
await new Promise(r => setTimeout(r, 4000)); m.pause('vae-only'); await m.idle();
let i = m.get('vae-only')!; console.log('paused at', i.files[0].got, 'of', i.files[0].sizeBytes, i.status);
const t1 = Date.now(); m.resume('vae-only'); await m.idle(); i = m.get('vae-only')!;
console.log('final status', i.status, i.error ?? '', 'file got', i.files[0].got, 'seconds total', ((Date.now() - t0) / 1000).toFixed(1), 'after resume', ((Date.now() - t1) / 1000).toFixed(1));
