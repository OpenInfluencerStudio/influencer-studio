// Real end-to-end video test: make a picture with the app (klein), save it, then animate it with Wan 2.2 TI2V-5B through the app API, with timings.
// Usage (app already running): node scripts/e2e-video.mjs <port> <token> <outDir>
import fs from 'node:fs'; import path from 'node:path';
const [port, token, outDir] = process.argv.slice(2);
const base = `http://127.0.0.1:${port}`;
const call = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { authorization: 'Bearer ' + token, origin: base, ...(b ? { 'content-type': 'application/json' } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, body: r.headers.get('content-type')?.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) }; };
fs.mkdirSync(outDir, { recursive: true });
const timings = [];
async function job(name, body, ext) {
  const t0 = Date.now(); const r = await call('POST', '/api/jobs', body);
  if (r.status !== 202) { console.log(name, 'submit failed', r.status, JSON.stringify(r.body)); timings.push({ name, error: r.status, body: r.body }); return null; }
  let last = '';
  for (;;) {
    const j = (await call('GET', '/api/jobs/' + r.body.id)).body; const s = `${j.status} ${j.progress}% ${j.message ?? ''}`; if (s !== last) { console.log('  ', ((Date.now() - t0) / 1000).toFixed(1) + 's', s); last = s; }
    if (['done', 'failed', 'cancelled'].includes(j.status)) {
      const sec = (Date.now() - t0) / 1000; timings.push({ name, status: j.status, sec, template: j.template, w: j.width, h: j.height, frames: j.frames, error: j.error }); console.log(name, j.status, sec.toFixed(1) + 's', j.error ?? '');
      if (j.status === 'done') fs.writeFileSync(path.join(outDir, name + ext), (await call('GET', `/api/outputs/${j.id}/0`)).body);
      return j;
    }
    await new Promise(r => setTimeout(r, 500));
  }
}
const character = { type: 'male', bodySize: 'medium', age: 34, hairStyle: 'short_crop', hairColor: 'dark_brown', facialHair: 'short_beard', outfit: 'smart_blazer', expression: 'soft_smile', background: 'city_street', lighting: 'golden_hour', renderStyle: 'photo' };
const b0 = await job('00_base', { character, seed: 777, width: 768, height: 1024 }, '.png');
if (!b0) process.exit(1);
const ref = (await call('POST', '/api/refs/from-job', { jobId: b0.id, index: 0 })).body;
const runs = [
  ['v1_gentle_2s_640_cold', { motion: 'gentle', seconds: 2, size: 640 }],
  ['v2_wave_2s_640_warm', { motion: 'wave', seconds: 2, size: 640 }],
  ['v3_headturn_pushin_4s_640', { motion: 'head_turn', camera: 'push_in', seconds: 4, size: 640 }],
  ['v4_walk_2s_832', { motion: 'walk', seconds: 2, size: 832 }],
];
for (const [n, v] of runs) await job(n, { character, seed: 5, video: { refId: ref.id, ...v } }, '.mp4');
fs.writeFileSync(path.join(outDir, 'timings.json'), JSON.stringify(timings, null, 1));
console.log(JSON.stringify(timings));
