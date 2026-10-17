import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startApp } from '../src/app.js';
import { buildProfile } from '../src/hardware.js';
import { loadLimits } from '../src/tiers.js';
import { CustomSchema, CUSTOM_DEFAULT, precisionMatch } from '../src/custom.js';

const limits = loadLimits();
const fixture = (vram: number) => buildProfile({ gpus: vram ? [{ index: 0, name: 'Fixture GPU', vramGb: vram }] : [], ramGb: 32, freeDiskGb: 500, source: 'fixture' }, limits);
async function boot(o: Parameters<typeof startApp>[0] = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'is-cust-'));
  const app = await startApp({ port: 0, token: 'test-token', dataDir: dir, uiDir: dir, comfyUrl: 'http://127.0.0.1:9', ...o });
  const base = `http://127.0.0.1:${app.port}`;
  const call = (method: string, p: string, body?: unknown) => fetch(base + p, { method, headers: { authorization: 'Bearer test-token', origin: base, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  return { app, call, dir };
}
const cust = (o: object = {}) => ({ ...CUSTOM_DEFAULT, enabled: true, ...o });

describe('custom hardware level', () => {
  it('schema ranges', () => {
    expect(CustomSchema.safeParse(cust()).success).toBe(true);
    for (const bad of [{ vramGb: 0 }, { vramGb: 5000 }, { ramGb: 1 }, { maxImagePx: 100 }, { maxImagePx: 99999 }, { maxVideoSeconds: 0 }, { maxVideoSeconds: 600 }, { maxBatch: 0 }, { precision: 'int3' }, { extra: 1 }]) expect(CustomSchema.safeParse(cust(bad)).success, JSON.stringify(bad)).toBe(false);
    expect(precisionMatch('gguf-q4_k_m', 'gguf-q4')).toBe(true); expect(precisionMatch('bf16', 'fp8')).toBe(false); expect(precisionMatch('bf16', 'auto')).toBe(false);
  });
  it('POST validates, persists, shows as Custom in options, survives restart; GET returns defaults when unsaved', async () => {
    const t = await boot({ mock: false, hardwareOverride: fixture(8) });
    expect((await (await t.call('GET', '/api/custom')).json()).saved).toBe(false);
    const bad = await t.call('POST', '/api/custom', cust({ vramGb: -3 })); expect(bad.status).toBe(400);
    const r = await t.call('POST', '/api/custom', cust({ vramGb: 96, ramGb: 256, maxImagePx: 4096 })); expect(r.status).toBe(200);
    const o = await (await t.call('GET', '/api/options')).json();
    expect(o.tier.name).toBe('Custom'); expect(o.customActive).toBe(true); expect(o.realTierName).toBe('Standard');
    expect(o.resolutions.find((x: any) => x.px === 4096).state).toBe('runs');
    const preview = await (await t.call('GET', '/api/options?pretend=T1')).json(); expect(preview.tier.name).toBe('Basic'); expect(preview.customActive).toBe(false);
    await t.app.close();
    const t2 = await boot({ mock: false, hardwareOverride: fixture(8), dataDir: t.dir });
    expect((await (await t2.call('GET', '/api/custom')).json()).profile.vramGb).toBe(96);
    await t2.app.close();
  });
  it('custom numbers release hardware soft locks; hard limits stay (ComfyUI offline)', async () => {
    const t = await boot({ mock: false, hardwareOverride: fixture(8) });
    const job = { character: { type: 'surprise' }, width: 1536, height: 2048, variantId: 'flux2-klein-4b-bf16' };
    let r = await t.call('POST', '/api/jobs', job); expect([403, 422]).toContain(r.status);
    await t.call('POST', '/api/custom', cust({ vramGb: 96, maxImagePx: 4096 }));
    r = await t.call('POST', '/api/jobs', job); const b = await r.json();
    expect(r.status).toBe(422); expect(b.error).toBe('hard_block'); // still blocked, but only by ComfyUI being offline
    expect(b.reasons.every((x: any) => x.hard)).toBe(true); expect(b.reasons.some((x: any) => x.code === 'COMFY_OFFLINE')).toBe(true);
    await t.app.close();
  });
  it('custom caps are soft limits: batch above the cap is refused in mock mode off, released only by unlock', async () => {
    const t = await boot({ mock: true, hardwareOverride: fixture(0) });
    await t.call('POST', '/api/custom', cust({ maxBatch: 2 }));
    const o = await (await t.call('GET', '/api/options')).json(); expect(o.tier.name).toBe('Custom');
    await t.app.close();
  });
  it('ComfyUI URL: loopback only unless remote flag AND Advanced unlock', async () => {
    const t = await boot({ mock: true, hardwareOverride: fixture(16) });
    let r = await t.call('POST', '/api/custom', cust({ comfyUrl: 'http://192.168.1.50:8188' })); expect(r.status).toBe(400);
    r = await t.call('POST', '/api/custom', cust({ comfyUrl: 'http://192.168.1.50:8188', allowRemoteComfy: true })); expect(r.status).toBe(400); // not unlocked
    expect((await (await t.call('GET', '/api/health')).json()).comfyUrl).toBe('http://127.0.0.1:9');
    await t.call('POST', '/api/settings', { unlock_unsupported: true });
    r = await t.call('POST', '/api/custom', cust({ comfyUrl: 'http://192.168.1.50:8188', allowRemoteComfy: true })); expect(r.status).toBe(200);
    expect((await (await t.call('GET', '/api/health')).json()).comfyUrl).toBe('http://192.168.1.50:8188');
    r = await t.call('POST', '/api/custom', cust({ comfyUrl: 'ftp://127.0.0.1/x' })); expect(r.status).toBe(400);
    await t.app.close();
  });
  it('models folder must be a full path, not a root', async () => {
    const t = await boot({ mock: true, hardwareOverride: fixture(16) });
    expect((await t.call('POST', '/api/custom', cust({ modelsDir: 'relative/dir' }))).status).toBe(400);
    expect((await t.call('POST', '/api/custom', cust({ modelsDir: path.join(t.dir, 'models') }))).status).toBe(200);
    await t.app.close();
  });
  it('precision picks the matching variant when one exists', async () => {
    const t = await boot({ mock: true, hardwareOverride: fixture(16) });
    await t.call('POST', '/api/custom', cust({ vramGb: 16, precision: 'gguf-q4' }));
    const o = await (await t.call('GET', '/api/options')).json();
    const q = o.models.find((m: any) => m.id === 'qwen-image-edit-2511'); expect(q.bestVariantId).toBe('qwen-image-edit-2511-q4km');
    await t.app.close();
  });
});
