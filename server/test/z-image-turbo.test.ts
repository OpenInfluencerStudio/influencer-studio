import { describe, it, expect } from 'vitest';
import http from 'node:http';
import type net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRegistry } from '../src/registry.js';
import { loadTemplates, fillTemplate } from '../src/workflows.js';
import { buildProfile } from '../src/hardware.js';
import { loadLimits } from '../src/tiers.js';
import { startApp } from '../src/app.js';

const limits = loadLimits();
const fixture = (vram: number) => buildProfile({ gpus: [{ index: 0, name: 'Fixture GPU', vramGb: vram }], ramGb: 64, freeDiskGb: 500, source: 'fixture' }, limits);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'is-zit-'));
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ioAAAAASUVORK5CYII=', 'base64');

describe('Z-Image-Turbo 6B (Apache-2.0)', () => {
  it('shares the exact same qwen_3_4b.safetensors text encoder (SHA-256 + byte size) as FLUX.2 klein 4B so it is never downloaded twice', () => {
    const reg = loadRegistry();
    const m = reg.models.find(x => x.id === 'z-image-turbo-6b');
    expect(m).toBeDefined();
    expect(m!.license).toBe('Apache-2.0');
    expect(m!.kind).toBe('image');

    const klein = reg.variants.find(v => v.id === 'flux2-klein-4b-bf16')!;
    const zit = reg.variants.find(v => v.id === 'z-image-turbo-6b-bf16')!;
    expect(zit).toBeDefined();
    expect(zit.license).toBe('Apache-2.0');
    expect(zit.minVramGb).toBe(12);
    expect(zit.recommendedVramGb).toBe(16);
    expect(zit.template).toBe('z_image_turbo_t2i');

    const kleinEnc = klein.files.find(f => f.name === 'qwen_3_4b.safetensors')!;
    const zitEnc = zit.files.find(f => f.name === 'qwen_3_4b.safetensors')!;
    expect(zitEnc.sha256).toBe('6c671498573ac2f7a5501502ccce8d2b08ea6ca2f661c458e708f36b36edfc5a');
    expect(zitEnc.sha256).toBe(kleinEnc.sha256);
    expect(zitEnc.sizeBytes).toBe(kleinEnc.sizeBytes);
    expect(zitEnc.folder).toBe(kleinEnc.folder);
  });

  it('compiles z_image_turbo_t2i workflow with lumina2 CLIPLoader, ModelSamplingAuraFlow, and 8-step res_multistep KSampler', () => {
    const tpls = loadTemplates();
    const tpl = tpls.get('z_image_turbo_t2i')!;
    expect(tpl).toBeDefined();
    expect(tpl.manifest.variantIds).toContain('z-image-turbo-6b-bf16');
    const wf = fillTemplate(tpl, {
      prompt: 'adult woman in a tailored coat, studio portrait',
      width: 768,
      height: 1024,
      batch: 1,
      seed: 12345,
    });
    expect(wf['1'].inputs.unet_name).toBe('z_image_turbo_bf16.safetensors');
    expect(wf['2'].inputs.clip_name).toBe('qwen_3_4b.safetensors');
    expect(wf['2'].inputs.type).toBe('lumina2');
    expect(wf['3'].inputs.vae_name).toBe('ae.safetensors');
    expect(wf['4'].inputs.text).toBe('adult woman in a tailored coat, studio portrait');
    expect(wf['6'].inputs.width).toBe(768);
    expect(wf['6'].inputs.height).toBe(1024);
    expect(wf['7'].class_type).toBe('ModelSamplingAuraFlow');
    expect(wf['8'].inputs.steps).toBe(8);
    expect(wf['8'].inputs.sampler_name).toBe('res_multistep');
    expect(wf['8'].inputs.seed).toBe(12345);
  });

  it('routes HTTP image jobs with variantId z-image-turbo-6b-bf16 to z_image_turbo_t2i and enforces VRAM tier', async () => {
    const submitted: any[] = [];
    const srv = http.createServer(async (req, res) => {
      if (req.url === '/system_stats') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ devices: [{ name: 'Fake GPU', vram_total: 24 * 1024 ** 3, vram_free: 22 * 1024 ** 3 }] }));
      }
      if (req.url === '/prompt' && req.method === 'POST') {
        const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
        submitted.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ prompt_id: 'p-zit-1' }));
      }
      if (req.url?.startsWith('/history/')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ 'p-zit-1': { status: { status_str: 'success' }, outputs: { '10': { images: [{ filename: 'zit.png', subfolder: '', type: 'output' }] } } } }));
      }
      if (req.url?.startsWith('/view')) {
        res.writeHead(200, { 'content-type': 'image/png' });
        return res.end(PNG_1X1);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
    await new Promise<void>(r => srv.listen(0, '127.0.0.1', r));
    const comfyUrl = `http://127.0.0.1:${(srv.address() as net.AddressInfo).port}`;

    const app = await startApp({
      port: 0, token: 't', dataDir: tmp(), uiDir: os.tmpdir(), comfyUrl, engine: 'direct',
      hardwareOverride: fixture(24),
    });
    const base = `http://127.0.0.1:${app.port}`;
    const call = (m: string, p: string, b?: unknown) => fetch(base + p, { method: m, headers: { authorization: 'Bearer t', origin: base, ...(b ? { 'content-type': 'application/json' } : {}) }, body: b ? JSON.stringify(b) : undefined });

    const r = await call('POST', '/api/jobs', { character: { age: 28 }, variantId: 'z-image-turbo-6b-bf16', width: 768, height: 1024, seed: 777 });
    expect(r.status).toBe(202);
    const j0 = await r.json();
    expect(j0.template).toBe('z_image_turbo_t2i');
    expect(j0.variantId).toBe('z-image-turbo-6b-bf16');

    for (let i = 0; i < 40; i++) {
      const jr = await (await call('GET', `/api/jobs/${j0.id}`)).json();
      if (jr.status === 'done') break;
      await new Promise(r => setTimeout(r, 50));
    }
    expect(submitted.length).toBe(1);
    expect(submitted[0].prompt['1'].inputs.unet_name).toBe('z_image_turbo_bf16.safetensors');
    expect(submitted[0].prompt['8'].inputs.steps).toBe(8);

    await app.close();
    await new Promise<void>(r => { srv.closeAllConnections(); srv.close(() => r()); });
  });
});
