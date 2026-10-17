import { describe, it, expect } from 'vitest';
import http from 'node:http';
import type net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { startApp } from '../src/app.js';
import { sniffImage } from '../src/refs.js';
import { buildProfile } from '../src/hardware.js';
import { loadLimits } from '../src/tiers.js';

function png(w: number, h: number): Buffer {
  const crc = (b: Buffer) => { let c, x = ~0; for (const v of b) { c = (x ^ v) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; x = (x >>> 8) ^ c; } return ~x >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: Math.min(h, 4) }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}
function headerOnly(w: number, h: number): Buffer { const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from('IHDR'), ihdr, Buffer.alloc(30)]); }
const limits = loadLimits();
const hw = buildProfile({ gpus: [{ index: 0, name: 'Fixture', vramGb: 16 }], ramGb: 64, freeDiskGb: 500, source: 'fixture' }, limits);

async function fake() {
  const seen: { uploads: string[]; prompts: any[] } = { uploads: [], prompts: [] };
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url!, 'http://x'); res.setHeader('content-type', 'application/json');
    if (u.pathname === '/system_stats') return res.end(JSON.stringify({ devices: [{ name: 'f', vram_total: 17179869184, vram_free: 8e9 }] }));
    if (u.pathname === '/upload/image') { let n = 0; const c: Buffer[] = []; req.on('data', d => { n += d.length; c.push(d); }); req.on('end', () => { const body = Buffer.concat(c).toString('latin1'); seen.uploads.push(/filename="([^"]+)"/.exec(body)?.[1] ?? ''); res.end(JSON.stringify({ name: seen.uploads.at(-1), subfolder: '', type: 'input' })); }); return; }
    if (u.pathname === '/prompt') { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { seen.prompts.push(JSON.parse(b)); res.end(JSON.stringify({ prompt_id: 'p1' })); }); return; }
    if (u.pathname === '/history/p1') return res.end(JSON.stringify({ p1: { status: { status_str: 'success' }, outputs: { '19': { images: [{ filename: 'a.png', subfolder: '', type: 'output' }] } } } }));
    if (u.pathname === '/queue') return res.end('{"queue_running":[]}');
    if (u.pathname === '/view') { res.setHeader('content-type', 'image/png'); return res.end(png(64, 64)); }
    res.statusCode = 404; res.end();
  });
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', r));
  return { seen, url: `http://127.0.0.1:${(srv.address() as net.AddressInfo).port}`, close: () => new Promise(r => { srv.closeAllConnections(); srv.close(r); }) };
}

describe('sniffImage', () => {
  it('reads png size, rejects svg/gif/html/empty', () => {
    expect(sniffImage(png(300, 200))).toMatchObject({ ext: 'png', width: 300, height: 200 });
    for (const s of ['<svg xmlns="http://www.w3.org/2000/svg"/>', 'GIF89a......................', '<html><script>x</script></html>', '']) expect(sniffImage(Buffer.from(s))).toBeNull();
    expect(sniffImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 1, 0, 2, 0, 3]), Buffer.alloc(30)]))).toMatchObject({ ext: 'jpg', width: 512, height: 256 });
  });
});

describe('style reference over HTTP', () => {
  it('validates uploads, routes to the edit template, uploads to ComfyUI with a random name, derives refs on the server', async () => {
    const fc = await fake();
    const app = await startApp({ port: 0, token: 't', dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'is-ref-')), uiDir: os.tmpdir(), comfyUrl: fc.url, hardwareOverride: hw });
    const base = `http://127.0.0.1:${app.port}`;
    const call = (m: string, p: string, body?: BodyInit, ct = 'application/json') => fetch(base + p, { method: m, headers: { authorization: 'Bearer t', origin: base, ...(body !== undefined ? { 'content-type': ct } : {}) }, body });
    // bad uploads
    expect((await call('POST', '/api/refs', '<svg onload=alert(1)/>', 'image/png')).status).toBe(415);
    expect((await call('POST', '/api/refs', '<svg/>', 'image/svg+xml')).status).toBe(415);
    expect((await call('POST', '/api/refs', new Uint8Array(9 * 1024 * 1024), 'image/png')).status).toBe(413);
    expect((await call('POST', '/api/refs', new Uint8Array(png(20, 20)), 'image/png')).status).toBe(400); // too small
    expect((await call('POST', '/api/refs', new Uint8Array(headerOnly(20000, 20000)), 'image/png')).status).toBe(400); // pixel bomb header
    expect((await fetch(base + '/api/refs', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'image/png' }, body: new Uint8Array(png(256, 256)) })).status).toBe(403); // no Origin
    // good upload
    const up = await call('POST', '/api/refs', new Uint8Array(png(256, 384)), 'image/png'); expect(up.status).toBe(201);
    const ref = await up.json(); expect(ref.width).toBe(256);
    const got = await call('GET', '/api/refs/' + ref.id); expect(got.headers.get('content-type')).toBe('image/png'); expect(got.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await call('GET', '/api/refs/..%2f..%2fx')).status).toBe(404);
    // unknown ref id, template swap
    expect((await call('POST', '/api/jobs', JSON.stringify({ character: {}, styleRef: '00000000-0000-0000-0000-000000000000' }))).status).toBe(400);
    expect((await call('POST', '/api/jobs', JSON.stringify({ character: {}, styleRef: ref.id, template: 'klein_t2i' }))).status).toBe(400);
    // real job with a reference
    const r = await call('POST', '/api/jobs', JSON.stringify({ character: { type: 'female' }, seed: 5, styleRef: ref.id, refs: 0 })); expect(r.status).toBe(202);
    const j = await r.json(); expect(j.template).toBe('klein_edit');
    for (let i = 0; i < 80; i++) { const x = await (await call('GET', '/api/jobs/' + j.id)).json(); if (x.status === 'done') break; if (x.status === 'failed') throw new Error(x.error); await new Promise(r => setTimeout(r, 100)); }
    expect(fc.seen.uploads).toHaveLength(1); expect(fc.seen.uploads[0]).toMatch(/^is_ref_[0-9a-f]{24}\.png$/);
    const wf = fc.seen.prompts[0].prompt; expect(wf['4'].inputs.image).toBe(fc.seen.uploads[0]);
    expect(wf['8'].inputs.text).toMatch(/^Use the reference photo/); expect(wf['8'].inputs.text).toContain('fully clothed');
    expect(Object.keys(wf)).toHaveLength(19);
    // delete
    expect(((await (await call('DELETE', '/api/refs/' + ref.id)).json()).ok)).toBe(true);
    expect((await call('GET', '/api/refs/' + ref.id)).status).toBe(404);
    await app.close(); await fc.close();
  });
});
