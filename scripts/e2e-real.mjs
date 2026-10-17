// Real end-to-end check: builder selection -> app API -> real ComfyUI -> image on disk, with timing and progress trace.
// Usage (app already running): node scripts/e2e-real.mjs <port> <token> <outDir> [warm]
import fs from 'node:fs'; import path from 'node:path';
const [port, token, outDir] = process.argv.slice(2);
const base = `http://127.0.0.1:${port}`;
const call = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { authorization: 'Bearer ' + token, origin: base, ...(b ? { 'content-type': 'application/json' } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, body: r.headers.get('content-type')?.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) }; };
fs.mkdirSync(outDir, { recursive: true });
const h = (await call('GET', '/api/health')).body; console.log('health', JSON.stringify(h));
const hw = (await call('GET', '/api/hardware')).body; console.log('hardware', hw.tier, hw.vramGb + 'GB VRAM', hw.ramGb + 'GB RAM', hw.gpus?.[0]?.name);
const chars = [
  { name: 'man_athletic', character: { type: 'male', bodySize: 'medium', age: 34, hairStyle: 'buzz_cut', facialHair: 'full_beard', outfit: 'hoodie_joggers', accessory: 'round_glasses', background: 'city_street', lighting: 'golden_hour', renderStyle: 'photo' } },
  { name: 'alien_verdant', character: { type: 'alien', species: 'verdant', bodySize: 'fat', age: 40, outfit: 'smart_blazer', background: 'studio', renderStyle: 'photo' } },
];
const refFile = path.join(outDir, 'man_athletic.png');
if (fs.existsSync(refFile)) {
  const up = await fetch(base + '/api/refs', { method: 'POST', headers: { authorization: 'Bearer ' + token, origin: base, 'content-type': 'image/png' }, body: fs.readFileSync(refFile) });
  const ref = await up.json(); console.log('ref upload', up.status, JSON.stringify(ref));
  if (up.status === 201) chars.push({ name: 'style_ref_man_blazer', styleRef: ref.id, character: { type: 'male', bodySize: 'medium', age: 34, outfit: 'smart_blazer', background: 'studio', renderStyle: 'photo' } });
}
for (const c of chars) {
  const t0 = Date.now(); const trace = [];
  const r = await call('POST', '/api/jobs', { character: c.character, seed: 4242, ...(c.styleRef ? { styleRef: c.styleRef } : { width: 768, height: 1024 }) });
  if (r.status !== 202) { console.log('submit failed', r.status, JSON.stringify(r.body)); continue; }
  const id = r.body.id; let last = '';
  for (;;) {
    const j = (await call('GET', '/api/jobs/' + id)).body;
    const s = `${j.status} ${j.progress}% ${j.message ?? ''}`; if (s !== last) { trace.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`); last = s; }
    if (['done', 'failed', 'cancelled'].includes(j.status)) { console.log(c.name, j.status, ((Date.now() - t0) / 1000).toFixed(1) + 's total', j.error ?? ''); console.log('  prompt:', j.prompt?.slice(0, 400)); console.log('  trace:\n    ' + trace.join('\n    ')); if (j.status === 'done') { const o = await call('GET', `/api/outputs/${id}/0`); fs.writeFileSync(path.join(outDir, c.name + '.png'), o.body); console.log('  saved', c.name + '.png', o.body.length, 'bytes'); } break; }
    await new Promise(r => setTimeout(r, 250));
  }
}
