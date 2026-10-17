import { describe, it, expect } from 'vitest';
import http from 'node:http';
import type net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DownloadManager, DlError } from '../src/downloads.js';
import { startApp } from '../src/app.js';
import { loadRegistry, type Registry } from '../src/registry.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'is-dl-'));
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');
const A = crypto.randomBytes(300_000), B = crypto.randomBytes(120_000);

interface Fake { url: string; ranges: (string | undefined)[]; hits: number; mode: { ignoreRange?: boolean; slow?: boolean; failFirst?: boolean; redirectOut?: boolean; wrong?: boolean }; close: () => Promise<void> }
async function fakeHost(): Promise<Fake> {
  const f: Fake = { url: '', ranges: [], hits: 0, mode: {}, close: async () => {} };
  const srv = http.createServer(async (req, res) => {
    f.hits++; const range = req.headers.range; f.ranges.push(range);
    const body = req.url === '/a' ? A : B;
    if (req.url === '/redir') { res.writeHead(302, { location: 'https://evil.example.com/x' }); return res.end(); }
    if (f.mode.failFirst && f.hits === 1) { res.writeHead(200, { 'content-length': body.length }); res.write(body.subarray(0, 1000)); return void setTimeout(() => res.destroy(), 20); }
    let start = 0;
    const m = range && /bytes=(\d+)-/.exec(range);
    if (m && !f.mode.ignoreRange) start = Number(m[1]);
    const out = f.mode.wrong ? Buffer.alloc(body.length - start, 1) : body.subarray(start);
    if (start > 0) res.writeHead(206, { 'content-length': out.length, 'content-range': `bytes ${start}-${body.length - 1}/${body.length}` }); else res.writeHead(200, { 'content-length': out.length });
    if (f.mode.slow) { for (let i = 0; i < out.length; i += 20_000) { if (!res.write(out.subarray(i, i + 20_000))) await new Promise(r => res.once('drain', r)); await new Promise(r => setTimeout(r, 40)); } res.end(); }
    else res.end(out);
  });
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', r));
  f.url = `http://127.0.0.1:${(srv.address() as net.AddressInfo).port}`;
  f.close = () => new Promise(r => { srv.closeAllConnections(); srv.close(() => r()); });
  return f;
}

function registry(over: Partial<Registry['variants'][number]> = {}, lic = 'Apache-2.0'): Registry {
  const r = loadRegistry();
  return { ...r, models: [{ ...r.models[0], license: lic }], variants: [{ ...r.variants[0], id: 'tiny', modelId: r.models[0].id, license: lic, files: [
    { name: 'a.safetensors', folder: 'vae', sizeBytes: A.length, sha256: sha(A), source: 'https://huggingface.co/x/y', url: 'https://huggingface.co/x/y/resolve/main/a.safetensors' },
    { name: 'b.safetensors', folder: 'loras', sizeBytes: B.length, sha256: sha(B), source: 'https://huggingface.co/x/y', url: 'https://huggingface.co/x/y/resolve/main/b.safetensors' }], ...over }] };
}
const mk = (f: Fake, reg = registry(), dir = tmp(), extra: object = {}) => {
  const state = path.join(tmp(), 'dl.json');
  const hooks = { urlFor: (u: string) => f.url + (u.endsWith('a.safetensors') ? '/a' : u.endsWith('b.safetensors') ? '/b' : '/redir'), allowHost: (u: URL) => u.hostname === '127.0.0.1', freeBytes: () => 50e9, retryDelayMs: 10, ...extra };
  return { dir, state, mgr: new DownloadManager(state, reg, () => dir, hooks), make: () => new DownloadManager(state, reg, () => dir, hooks), reg };
};
const done = async (m: DownloadManager, id = 'tiny') => { await m.idle(); return m.get(id)!; };

describe('model downloads', () => {
  it('downloads every file, verifies sha256 and installs into the models folder', async () => {
    const f = await fakeHost(); const t = mk(f);
    t.mgr.start('tiny', 'Apache-2.0'); const i = await done(t.mgr);
    expect(i.status).toBe('done'); expect(i.files.every(x => x.status === 'done' && x.got === x.sizeBytes)).toBe(true);
    expect(sha(fs.readFileSync(path.join(t.dir, 'vae', 'a.safetensors')))).toBe(sha(A)); expect(sha(fs.readFileSync(path.join(t.dir, 'loras', 'b.safetensors')))).toBe(sha(B));
    expect(fs.readdirSync(path.join(t.dir, 'vae')).some(n => n.endsWith('.part'))).toBe(false);
    await f.close();
  });
  it('requires the exact licence to be accepted and refuses non-allow-listed licences, missing checksums and unknown variants', async () => {
    const f = await fakeHost(); const t = mk(f);
    expect(() => t.mgr.start('tiny', '')).toThrow(/accept the licence/); expect(() => t.mgr.start('tiny', 'MIT')).toThrow(/accept the licence/);
    expect(() => t.mgr.start('nope', 'Apache-2.0')).toThrow(/Unknown model/);
    const nc = mk(f, registry({}, 'CC-BY-NC-4.0')); expect(() => nc.mgr.start('tiny', 'CC-BY-NC-4.0')).toThrow(/allow-list/);
    const r = registry(); r.variants[0].files[0].sha256 = null; expect(() => mk(f, r).mgr.start('tiny', 'Apache-2.0')).toThrow(/checksum/);
    expect(f.hits).toBe(0); await f.close();
  });
  it('a wrong checksum deletes the file and never installs it', async () => {
    const f = await fakeHost(); f.mode.wrong = true; const t = mk(f);
    t.mgr.start('tiny', 'Apache-2.0'); const i = await done(t.mgr);
    expect(i.status).toBe('error'); expect(i.error).toMatch(/checksum/); expect(fs.existsSync(path.join(t.dir, 'vae', 'a.safetensors'))).toBe(false); expect(fs.existsSync(path.join(t.dir, 'vae', 'a.safetensors.part'))).toBe(false);
    await f.close();
  });
  it('pause keeps the .part file and resume continues with an HTTP Range request', async () => {
    const f = await fakeHost(); f.mode.slow = true; const t = mk(f);
    t.mgr.start('tiny', 'Apache-2.0');
    await new Promise(r => setTimeout(r, 250)); t.mgr.pause('tiny'); let i = await done(t.mgr);
    expect(i.status).toBe('paused'); const partSize = fs.statSync(path.join(t.dir, 'vae', 'a.safetensors.part')).size; expect(partSize).toBeGreaterThan(0); expect(partSize).toBeLessThan(A.length);
    f.mode.slow = false; t.mgr.resume('tiny'); i = await done(t.mgr);
    expect(i.status).toBe('done'); expect(f.ranges).toContain(`bytes=${partSize}-`);
    expect(sha(fs.readFileSync(path.join(t.dir, 'vae', 'a.safetensors')))).toBe(sha(A));
    await f.close();
  });
  it('survives an app restart: running work comes back paused and resumes from the partial file', async () => {
    const f = await fakeHost(); f.mode.slow = true; const t = mk(f);
    t.mgr.start('tiny', 'Apache-2.0'); await new Promise(r => setTimeout(r, 250));
    // simulate a crash: persisted state says "downloading", the .part file stays
    t.mgr.pause('tiny'); await t.mgr.idle();
    const raw = JSON.parse(fs.readFileSync(t.state, 'utf8')); raw.items[0].status = 'downloading'; raw.items[0].files[0].status = 'downloading'; fs.writeFileSync(t.state, JSON.stringify(raw));
    f.mode.slow = false; const m2 = t.make(); expect(m2.get('tiny')!.status).toBe('paused');
    m2.resume('tiny'); const i = await done(m2); expect(i.status).toBe('done'); expect(f.ranges.some(r => r?.startsWith('bytes='))).toBe(true);
    await f.close();
  });
  it('restarts the file when the server ignores Range', async () => {
    const f = await fakeHost(); f.mode.slow = true; const t = mk(f);
    t.mgr.start('tiny', 'Apache-2.0'); await new Promise(r => setTimeout(r, 250)); t.mgr.pause('tiny'); await t.mgr.idle();
    f.mode.slow = false; f.mode.ignoreRange = true; t.mgr.resume('tiny'); const i = await done(t.mgr);
    expect(i.status).toBe('done'); expect(sha(fs.readFileSync(path.join(t.dir, 'vae', 'a.safetensors')))).toBe(sha(A));
    await f.close();
  });
  it('retries a dropped connection and resumes from what arrived', async () => {
    const f = await fakeHost(); f.mode.failFirst = true; const t = mk(f);
    t.mgr.start('tiny', 'Apache-2.0'); const i = await done(t.mgr);
    expect(i.status).toBe('done'); expect(f.ranges.some(r => r?.startsWith('bytes='))).toBe(true);
    await f.close();
  });
  it('refuses when there is not enough free disk space, with real numbers, and downloads nothing', async () => {
    const f = await fakeHost(); const t = mk(f, registry(), tmp(), { freeBytes: () => 100_000 });
    expect(() => t.mgr.start('tiny', 'Apache-2.0')).toThrow(/Needs .* GB free in .*only 0\.0 GB/); try { t.mgr.start('tiny', 'Apache-2.0'); } catch (e) { expect((e as DlError).status).toBe(507); }
    expect(f.hits).toBe(0); await f.close();
  });
  it('refuses hosts outside the allow-list, including redirects to them', async () => {
    const f = await fakeHost();
    const r = registry(); r.variants[0].files[0].url = 'https://huggingface.co/x/y/resolve/main/zzz.safetensors';
    const t = mk(f, r); t.mgr.start('tiny', 'Apache-2.0'); const i = await done(t.mgr);
    expect(i.status).toBe('error'); expect(i.error).toMatch(/outside the allowed/);
    // default host policy: plain http and foreign hosts are refused
    const strict = new DownloadManager(path.join(tmp(), 's.json'), registry(), () => tmp(), { freeBytes: () => 50e9 });
    const r2 = registry(); r2.variants[0].files[0].url = 'http://huggingface.co/x/y/resolve/main/a.safetensors';
    const s2 = new DownloadManager(path.join(tmp(), 's2.json'), r2, () => tmp(), { freeBytes: () => 50e9 }); s2.start('tiny', 'Apache-2.0'); await s2.idle(); expect(s2.get('tiny')!.error).toMatch(/outside the allowed/);
    void strict; await f.close();
  });
  it('rejects path tricks in folder names and needs a models folder', async () => {
    const f = await fakeHost(); const r = registry(); r.variants[0].files[0].folder = 'vae';
    const none = new DownloadManager(path.join(tmp(), 'n.json'), r, () => undefined, {}); expect(() => none.start('tiny', 'Apache-2.0')).toThrow(/models folder/);
    const bad = registry(); bad.variants[0].files[0].folder = '..'; expect(() => mk(f, bad).mgr.start('tiny', 'Apache-2.0')).toThrow(/Unsupported model folder/);
    await f.close();
  });
  it('already-installed files are skipped; cancel removes partial files', async () => {
    const f = await fakeHost(); f.mode.slow = true; const t = mk(f);
    fs.mkdirSync(path.join(t.dir, 'loras'), { recursive: true }); fs.writeFileSync(path.join(t.dir, 'loras', 'b.safetensors'), B);
    t.mgr.start('tiny', 'Apache-2.0'); await new Promise(r => setTimeout(r, 200)); t.mgr.cancel('tiny'); await t.mgr.idle(); await new Promise(r => setTimeout(r, 150));
    expect(t.mgr.get('tiny')).toBeUndefined(); expect(fs.existsSync(path.join(t.dir, 'vae', 'a.safetensors.part'))).toBe(false); expect(fs.existsSync(path.join(t.dir, 'loras', 'b.safetensors'))).toBe(true);
    await f.close();
  });
});

describe('downloads over HTTP', () => {
  it('shows licence info, enforces acceptance, reports progress and flips installed', async () => {
    const f = await fakeHost(); const dir = tmp(); const regFile = path.join(tmp(), 'models.json'); const reg = registry(); fs.writeFileSync(regFile, JSON.stringify({ ...reg, variants: reg.variants.map(v => ({ ...v, minVramGb: 1, recommendedVramGb: 1, minRamGb: 1, recommendedRamGb: 1, minDiskGb: 1 })) }));
    const app = await startApp({ port: 0, token: 't', dataDir: tmp(), uiDir: os.tmpdir(), comfyUrl: f.url, modelsDir: dir, registryFile: regFile, downloadHooks: { urlFor: u => f.url + (u.endsWith('a.safetensors') ? '/a' : '/b'), allowHost: u => u.hostname === '127.0.0.1', freeBytes: () => 50e9 } });
    const base = `http://127.0.0.1:${app.port}`; const call = (m: string, p: string, body?: unknown) => fetch(base + p, { method: m, headers: { authorization: 'Bearer t', origin: base, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const opts = await (await call('GET', '/api/options')).json(); const v = opts.models[0].variants[0];
    expect(v.licenseInfo.name).toBe('Apache License 2.0'); expect(v.files).toHaveLength(2); expect(v.installed).toBe(false);
    expect((await call('POST', '/api/downloads', { variantId: 'tiny', acceptedLicense: 'MIT' })).status).toBe(400);
    expect((await call('POST', '/api/downloads', { variantId: 'tiny', acceptedLicense: 'Apache-2.0', extra: 1 })).status).toBe(400);
    expect((await call('POST', '/api/downloads', { variantId: 'tiny', acceptedLicense: 'Apache-2.0' })).status).toBe(202);
    let s: any; for (let i = 0; i < 100; i++) { s = await (await call('GET', '/api/downloads')).json(); if (s.items[0]?.status === 'done') break; await new Promise(r => setTimeout(r, 50)); }
    expect(s.items[0].status).toBe('done'); expect(s.modelsDir).toBe(dir);
    expect((await (await call('GET', '/api/options')).json()).models[0].variants[0].installed).toBe(true);
    expect((await call('POST', '/api/downloads/nope/pause', {})).status).toBe(404);
    expect((await call('POST', '/api/settings', { models_dir: '/tmp/x-other' })).status).toBe(409); // fixed by the launcher
    expect((await fetch(base + '/api/downloads')).status).toBe(401);
    await app.close(); await f.close();
  });
  it('models folder can be chosen in settings when the launcher does not fix it', async () => {
    const dd = tmp(); const dir = path.join(tmp(), 'my-models');
    const saved = process.env.INFLUENCER_STUDIO_MODELS_DIR; delete process.env.INFLUENCER_STUDIO_MODELS_DIR;
    try {
      const a1 = await startApp({ port: 0, token: 't', dataDir: dd, uiDir: os.tmpdir() }); const b1 = `http://127.0.0.1:${a1.port}`;
      const c1 = (body: unknown) => fetch(b1 + '/api/settings', { method: 'POST', headers: { authorization: 'Bearer t', origin: b1, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      expect((await c1({ models_dir: 'relative/path' })).status).toBe(400); expect((await c1({ models_dir: path.parse(dir).root })).status).toBe(400);
      expect((await c1({ models_dir: dir })).status).toBe(200); expect(fs.existsSync(dir)).toBe(true); await a1.close();
      const a2 = await startApp({ port: 0, token: 't', dataDir: dd, uiDir: os.tmpdir() }); expect(a2.services.modelsDir).toBe(dir); await a2.close();
    } finally { if (saved) process.env.INFLUENCER_STUDIO_MODELS_DIR = saved; }
  });
});

describe('shipped models.json', () => {
  it('every file has a checksum, a direct Hugging Face link ending in its own name, and a known licence text', () => {
    const r = loadRegistry();
    for (const v of r.variants) { expect(r.licenses[v.license]).toBeTruthy(); for (const f of v.files) { expect(f.sha256, f.name).toMatch(/^[0-9a-f]{64}$/); expect(f.url, f.name).toMatch(/^https:\/\/huggingface\.co\/.+\/resolve\/main\/.+/); expect(f.url!.endsWith('/' + f.name) || f.url!.endsWith(f.name), f.name).toBe(true); } }
  });
});
