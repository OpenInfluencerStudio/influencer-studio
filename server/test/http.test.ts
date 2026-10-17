import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startApp, RunningApp } from '../src/app.js';
import { buildProfile } from '../src/hardware.js';
import { loadLimits } from '../src/tiers.js';

const limits = loadLimits();
const fixture = (vram: number | null, disk = 500) => buildProfile({ gpus: vram ? [{ index: 0, name: 'Fixture GPU', vramGb: vram }] : [], ramGb: 64, freeDiskGb: disk, source: 'fixture' }, limits);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'is-test-'));

async function boot(o: Parameters<typeof startApp>[0] = {}) {
  const app = await startApp({ port: 0, token: 'test-token', dataDir: tmp(), uiDir: tmp(), comfyUrl: 'http://127.0.0.1:9', ...o });
  const base = `http://127.0.0.1:${app.port}`;
  const call = (method: string, p: string, body?: unknown, h: Record<string, string> = {}) => fetch(base + p, {
    method, headers: { authorization: 'Bearer test-token', origin: base, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...h }, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { app, base, call };
}

/** A tiny fake ComfyUI so the real client path is exercised end to end. */
async function fakeComfy() {
  const prompts: any[] = [];
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url!, 'http://x');
    if (u.pathname === '/system_stats') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ devices: [{ name: 'fake', vram_total: 17179869184, vram_free: 8e9 }] })); }
    if (u.pathname === '/prompt' && req.method === 'POST') { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { prompts.push(JSON.parse(b)); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ prompt_id: 'p1' })); }); return; }
    if (u.pathname === '/history/p1') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ p1: { status: { status_str: 'success' }, outputs: { '9': { images: [{ filename: 'a.png', subfolder: '', type: 'output' }] } } } })); }
    if (u.pathname === '/queue') { res.setHeader('content-type', 'application/json'); return res.end('{"queue_running":[]}'); }
    if (u.pathname === '/view') { res.setHeader('content-type', 'image/png'); return res.end(png); }
    res.statusCode = 404; res.end();
  });
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', r));
  return { prompts, url: `http://127.0.0.1:${(srv.address() as net.AddressInfo).port}`, close: () => new Promise(r => { srv.closeAllConnections(); srv.close(r); }) };
}
async function waitJob(call: Function, id: string, ok = ['done', 'failed', 'cancelled']) {
  for (let i = 0; i < 100; i++) { const j = await (await call('GET', '/api/jobs/' + id)).json(); if (ok.includes(j.status)) return j; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('timeout');
}

describe('security', () => {
  let t: Awaited<ReturnType<typeof boot>>;
  beforeAll(async () => { t = await boot({ mock: true, hardwareOverride: fixture(16) }); });
  afterAll(() => t.app.close());
  it('binds to loopback only', () => { expect((t.app.server.address() as net.AddressInfo).address).toBe('127.0.0.1'); });
  it('rejects missing and wrong token', async () => {
    expect((await fetch(t.base + '/api/health')).status).toBe(401);
    expect((await fetch(t.base + '/api/health', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
    expect((await fetch(t.base + '/api/health', { headers: { authorization: 'Bearer test-tokeX' } })).status).toBe(401);
    expect((await t.call('GET', '/api/health')).status).toBe(200);
  });
  it('rejects foreign or missing Origin and cross-site on state changes, with no state change', async () => {
    const body = { unlock_unsupported: true };
    expect((await t.call('POST', '/api/settings', body, { origin: 'http://evil.example' })).status).toBe(403);
    expect((await t.call('POST', '/api/settings', body, { origin: 'https://127.0.0.1:' + t.app.port })).status).toBe(403);
    const r = await fetch(t.base + '/api/settings', { method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect(r.status).toBe(403);
    expect((await t.call('POST', '/api/settings', body, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect(await (await t.call('GET', '/api/settings')).json()).toEqual({ unlock_unsupported: false });
  });
  it('rejects wrong Host header (DNS rebinding)', async () => {
    const status = await new Promise<number>(res => { const r = http.request({ host: '127.0.0.1', port: t.app.port, path: '/api/health', headers: { host: 'evil.example', authorization: 'Bearer test-token' } }, x => { x.resume(); res(x.statusCode!); }); r.end(); });
    expect(status).toBe(403);
  });
  it('sets security headers and strict CSP', async () => {
    const r = await t.call('GET', '/api/health'); const csp = r.headers.get('content-security-policy')!;
    expect(csp).toContain("default-src 'self'"); expect(csp).toContain("script-src 'self'"); expect(csp).toContain("frame-ancestors 'none'"); expect(csp).not.toMatch(/script-src[^;]*unsafe/);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff'); expect(r.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('rejects non-JSON, oversize and malformed bodies and unknown fields', async () => {
    expect((await t.call('POST', '/api/compile', undefined, { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await fetch(t.base + '/api/compile', { method: 'POST', headers: { authorization: 'Bearer test-token', origin: t.base, 'content-type': 'application/json' }, body: '{bad' })).status).toBe(400);
    expect((await t.call('POST', '/api/compile', { character: { pad: 'x'.repeat(300_000) } })).status).toBe(413);
    expect((await t.call('POST', '/api/settings', { unlock_unsupported: true, extra: 1 })).status).toBe(400);
    expect((await t.call('POST', '/api/settings', { unlock_unsupported: 'yes' })).status).toBe(400);
  });
  it('static server blocks path traversal', async () => {
    for (const p of ['/../models.json', '/%2e%2e/models.json', '/..%2fmodels.json', '/%00', '/a\\..\\b']) {
      const r = await fetch(t.base + p); expect([400, 403, 404, 503]).toContain(r.status);
      expect(await r.text()).not.toContain('schemaVersion');
    }
  });
  it('returns neutral refusal for blocked text without echoing it', async () => {
    const r = await t.call('POST', '/api/compile', { character: { notes: 'wearing no clothes' } });
    expect(r.status).toBe(422); const j = await r.json(); expect(JSON.stringify(j)).not.toMatch(/clothes/); expect(j.message).toBe("That description isn't supported in this app");
  });
  it('rejects age under 21 and crafted JSON server side', async () => {
    for (const ch of [{ age: 17 }, { age: 20 }, { clothing: 'none' }, { type: 'child' }, { bodySize: 'x' }, { features: ['a', 'b', 'c', 'd'] }])
      expect([400, 422], JSON.stringify(ch)).toContain((await t.call('POST', '/api/jobs', { character: ch })).status);
  });
});

describe('job flow with mock generator', () => {
  it('compiles, queues, reports via SSE, saves outputs and survives restart', async () => {
    const dir = tmp();
    let t = await boot({ mock: true, dataDir: dir, hardwareOverride: fixture(null) });
    const events: string[] = [];
    const ev = await fetch(t.base + '/api/events', { headers: { authorization: 'Bearer test-token' } });
    const reader = ev.body!.getReader(); const dec = new TextDecoder();
    void (async () => { for (;;) { const { value, done } = await reader.read(); if (done) break; events.push(dec.decode(value)); } })();
    const r = await t.call('POST', '/api/jobs', { character: { type: 'alien', species: 'aquan', bodySize: 'fat' }, seed: 5, batch: 2 });
    expect(r.status).toBe(202); const job = await r.json();
    expect(job.mock).toBe(true); expect(job.prompt).toContain('Aquan species'); expect(job.prompt).toMatch(/fully clothed/);
    const done = await waitJob(t.call, job.id);
    expect(done.status).toBe('done'); expect(done.outputs.length).toBe(2);
    const img = await t.call('GET', `/api/outputs/${job.id}/0`);
    expect(img.headers.get('content-type')).toBe('image/svg+xml'); expect(await img.text()).toContain('MOCK GENERATOR');
    expect((await fetch(t.base + `/api/outputs/${job.id}/0`)).status).toBe(401);
    expect(events.join('')).toContain('event: job'); expect(events.join('')).toContain('"status":"done"');
    await t.app.close();
    t = await boot({ mock: true, dataDir: dir, hardwareOverride: fixture(null) });
    const list = await (await t.call('GET', '/api/jobs')).json();
    expect(list.find((j: any) => j.id === job.id).status).toBe('done');
    await t.app.close();
  });
  it('rate limits bursts with 429 and Retry-After, then stays responsive', async () => {
    const t = await boot({ mock: true, hardwareOverride: fixture(16) });
    const codes: number[] = []; let ra: string | null = null;
    for (let i = 0; i < 12; i++) { const r = await t.call('POST', '/api/jobs', { character: {}, seed: i }); codes.push(r.status); if (r.status === 429) ra = r.headers.get('retry-after'); }
    expect(codes.filter(c => c === 202).length).toBe(10); expect(codes.slice(10)).toEqual([429, 429]); expect(ra).toBe('10');
    expect((await t.call('GET', '/api/health')).status).toBe(200);
    await t.app.close();
  });
  it('cancel works on a queued job', async () => {
    const t = await boot({ mock: true, hardwareOverride: fixture(16) });
    const a = await (await t.call('POST', '/api/jobs', { character: {}, seed: 1 })).json();
    const b = await (await t.call('POST', '/api/jobs', { character: {}, seed: 2 })).json();
    const c = await (await t.call('POST', `/api/jobs/${b.id}/cancel`, {})).json(); expect(c.status).toBe('cancelled');
    expect((await waitJob(t.call, a.id)).status).toBe('done');
    await t.app.close();
  });
});

describe('server-side enforcement over HTTP (no GPU needed; fake ComfyUI)', () => {
  it('locked by hardware, unlock via settings only, forged flags rejected, hard blocks never released', async () => {
    const fc = await fakeComfy();
    const t = await boot({ comfyUrl: fc.url, hardwareOverride: fixture(6), dataDir: tmp() });
    const job = { character: {}, seed: 1 };
    // (a) locked variant with setting off
    let r = await t.call('POST', '/api/jobs', job); expect(r.status).toBe(403);
    let j = await r.json(); expect(j.error).toBe('locked_by_hardware'); expect(j.reasons[0].text).toBe('Needs 8 GB VRAM (you have 6 GB)');
    // (b) forged flags in the job body are rejected, not honoured
    for (const f of ['unlock_unsupported', 'force', 'allowUnsupported']) { r = await t.call('POST', '/api/jobs', { ...job, [f]: true }); expect(r.status).toBe(400); }
    // (d) oversize
    expect((await t.call('POST', '/api/jobs', { ...job, width: 16384, height: 16384 })).status).toBe(400);
    // (e) swapped template / variant
    expect((await t.call('POST', '/api/jobs', { ...job, template: '../../etc/passwd' })).status).toBe(400);
    expect((await t.call('POST', '/api/jobs', { ...job, template: 'wan22_i2v' })).status).toBe(422);
    expect((await t.call('GET', '/api/jobs')).status).toBe(200);
    expect((await (await t.call('GET', '/api/jobs')).json()).length).toBe(0); // nothing queued by any bypass attempt
    // unlock through the real settings route
    expect((await t.call('POST', '/api/settings', { unlock_unsupported: true })).status).toBe(200);
    r = await t.call('POST', '/api/jobs', job); expect(r.status).toBe(202); j = await r.json(); expect(j.unsupported).toBe(true);
    const done = await waitJob(t.call, j.id); expect(done.status).toBe('done');
    expect(fc.prompts.length).toBe(1);
    expect(fc.prompts[0].prompt['4'].inputs.text).toContain('fully clothed');
    expect((await fetch(t.base + `/api/outputs/${j.id}/0`, { headers: { authorization: 'Bearer test-token' } })).headers.get('content-type')).toBe('image/png');
    await t.app.close(); await fc.close();
    // hard block with the setting on: no GPU
    const fc2 = await fakeComfy(); const dir = (t.app.services as any).dataDir;
    const t2 = await boot({ comfyUrl: fc2.url, hardwareOverride: fixture(null), dataDir: dir });
    expect((await t2.call('GET', '/api/settings')).status).toBe(200);
    r = await t2.call('POST', '/api/jobs', job); expect(r.status).toBe(422); expect((await r.json()).error).toBe('hard_block');
    await t2.app.close(); await fc2.close();
  });
  it('settings persist across restart, default off on fresh install, and unknown file edits only apply after restart', async () => {
    const dir = tmp();
    let t = await boot({ mock: true, dataDir: dir, hardwareOverride: fixture(16) });
    expect((await (await t.call('GET', '/api/settings')).json()).unlock_unsupported).toBe(false);
    await t.call('POST', '/api/settings', { unlock_unsupported: true });
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ unlock_unsupported: false }));
    expect((await (await t.call('GET', '/api/settings')).json()).unlock_unsupported).toBe(true); // in-memory copy wins
    await t.app.close();
    t = await boot({ mock: true, dataDir: dir, hardwareOverride: fixture(16) });
    expect((await (await t.call('GET', '/api/settings')).json()).unlock_unsupported).toBe(false); // file edit applies after restart
    await t.app.close();
  });
  it('options endpoint shows lock reasons per tier and pretend profiles only affect the preview', async () => {
    const t = await boot({ mock: false, hardwareOverride: fixture(16) });
    const real = await (await t.call('GET', '/api/options')).json();
    expect(real.tier.id).toBe('T4'); expect(real.resolutions.find((x: any) => x.px === 2048).state).toBe('locked_soft');
    const weak = await (await t.call('GET', '/api/options?pretend=T1')).json();
    expect(weak.tier.id).toBe('T1'); expect(weak.realTier).toBe('T4');
    const qwen = weak.models.find((m: any) => m.id === 'qwen-image-edit-2511').variants[0];
    expect(qwen.state).toBe('locked_soft'); expect(qwen.reasons[0].text).toMatch(/Needs 12 GB VRAM \(you have 1 GB\)/);
    await t.app.close();
  });
  it('ComfyUI URL must be loopback', async () => {
    await expect(boot({ comfyUrl: 'http://example.com:8288' })).rejects.toThrow(/loopback/);
  });
});
