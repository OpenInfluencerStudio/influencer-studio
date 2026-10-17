// Real end-to-end: one character across 3 new scenes and 3 new camera angles through the app API, real ComfyUI, with timings.
// Usage (app already running): node scripts/e2e-same-character.mjs <port> <token> <outDir>
import fs from 'node:fs'; import path from 'node:path';
const [port, token, outDir] = process.argv.slice(2);
const base = `http://127.0.0.1:${port}`;
const call = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { authorization: 'Bearer ' + token, origin: base, ...(b ? { 'content-type': 'application/json' } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, body: r.headers.get('content-type')?.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) }; };
fs.mkdirSync(outDir, { recursive: true });
const timings = [];
async function job(name, body) {
  const t0 = Date.now(); const r = await call('POST', '/api/jobs', body);
  if (r.status !== 202) { console.log(name, 'submit failed', r.status, JSON.stringify(r.body)); timings.push({ name, error: r.status }); return null; }
  let last = '';
  for (;;) {
    const j = (await call('GET', '/api/jobs/' + r.body.id)).body; const s = `${j.status} ${j.progress}% ${j.message ?? ''}`; if (s !== last) { console.log('  ', ((Date.now() - t0) / 1000).toFixed(1) + 's', s); last = s; }
    if (['done', 'failed', 'cancelled'].includes(j.status)) {
      const sec = (Date.now() - t0) / 1000; timings.push({ name, status: j.status, sec, template: j.template, error: j.error }); console.log(name, j.status, sec.toFixed(1) + 's', j.error ?? '');
      if (j.status === 'done') fs.writeFileSync(path.join(outDir, name + '.png'), (await call('GET', `/api/outputs/${j.id}/0`)).body);
      return j;
    }
    await new Promise(r => setTimeout(r, 300));
  }
}
const character = { type: 'female', bodySize: 'medium', age: 31, hairStyle: 'curly', hairColor: 'ginger', features: ['light_freckles'], accessory: 'round_glasses', outfit: 'white_tee_jeans', expression: 'soft_smile', background: 'studio', lighting: 'soft_daylight', renderStyle: 'photo' };
const base0 = await job('00_base', { character, seed: 31031, width: 768, height: 1024 });
if (!base0) process.exit(1);
const ref = (await call('POST', '/api/refs/from-job', { jobId: base0.id, index: 0 })).body;
const saved = (await call('POST', '/api/characters', { name: 'Maeve', character, seed: 31031, refImage: ref.id })).body; console.log('saved character', saved.id, 'ref', ref.id, ref.width + 'x' + ref.height);
const scenes = [
  ['s1_blazer_cafe', { outfit: 'smart_blazer', background: 'cafe', pose: 'sitting' }],
  ['s2_hoodie_street', { outfit: 'hoodie_joggers', background: 'city_street', pose: 'walking', lighting: 'golden_hour' }],
  ['s3_sport_park', { outfit: 'sport_set', background: 'park', pose: 'waving', expression: 'big_grin' }],
];
for (const [n, e] of scenes) await job(n, { character, seed: 5, edit: { kind: 'scene', refId: ref.id, ...e } });
const angles = [['a1_right_eye_medium', 'right', 'eye', 'medium'], ['a2_frontleft_low_medium', 'front_left', 'low', 'medium'], ['a3_frontright_high_close', 'front_right', 'high', 'close'], ['a4_back_left_eye_medium', 'back_left', 'eye', 'medium']];
for (const [n, a, e, d] of angles) await job(n, { character, seed: 5, edit: { kind: 'angle', refId: ref.id, azimuth: a, elevation: e, distance: d } });
fs.writeFileSync(path.join(outDir, 'timings.json'), JSON.stringify(timings, null, 1));
console.log(JSON.stringify(timings));
