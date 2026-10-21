import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { comfyCandidates, probeComfy, DEFAULT_COMFY_PORTS } from '../src/comfy.js';
import { Services } from '../src/services.js';
import { CUSTOM_DEFAULT } from '../src/custom.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'is-probe-'));
const servers: http.Server[] = [];
async function fakeComfy(): Promise<{ url: string; port: number }> {
  const srv = http.createServer((req, res) => {
    if (req.url === '/system_stats') { res.setHeader('content-type', 'application/json'); return res.end('{"devices":[]}'); }
    res.statusCode = 404; res.end();
  });
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', r)); servers.push(srv);
  const port = (srv.address() as net.AddressInfo).port; return { url: `http://127.0.0.1:${port}`, port };
}
async function deadPort(): Promise<number> {
  const s = net.createServer(); await new Promise<void>(r => s.listen(0, '127.0.0.1', r));
  const p = (s.address() as net.AddressInfo).port; await new Promise(r => s.close(r)); return p;
}
const saved = { url: process.env.COMFYUI_URL, ports: process.env.COMFYUI_PORTS };
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise(r => { s.closeAllConnections(); s.close(r); });
  if (saved.url === undefined) delete process.env.COMFYUI_URL; else process.env.COMFYUI_URL = saved.url;
  if (saved.ports === undefined) delete process.env.COMFYUI_PORTS; else process.env.COMFYUI_PORTS = saved.ports;
});

describe('ComfyUI auto-detect (stock 8188 first, then 8288)', () => {
  it('default candidates are 8188 then 8288, loopback only', () => {
    expect(DEFAULT_COMFY_PORTS).toEqual([8188, 8288]);
    expect(comfyCandidates()).toEqual(['http://127.0.0.1:8188', 'http://127.0.0.1:8288']);
    expect(comfyCandidates('')).toEqual(['http://127.0.0.1:8188', 'http://127.0.0.1:8288']);
  });
  it('COMFYUI_PORTS overrides the order and ignores junk', () => {
    expect(comfyCandidates('8288, 8188')).toEqual(['http://127.0.0.1:8288', 'http://127.0.0.1:8188']);
    expect(comfyCandidates('abc,70000,-1,8288,8288')).toEqual(['http://127.0.0.1:8288']);
    expect(comfyCandidates('nope')).toEqual(['http://127.0.0.1:8188', 'http://127.0.0.1:8288']);
  });
  it('probe returns the first candidate that answers, in order', async () => {
    const a = await fakeComfy(); const b = await fakeComfy(); const dead = await deadPort();
    expect(await probeComfy([`http://127.0.0.1:${dead}`, b.url, a.url])).toBe(b.url);
    expect(await probeComfy([a.url, b.url])).toBe(a.url);
    expect(await probeComfy([`http://127.0.0.1:${dead}`])).toBeNull();
    expect(await probeComfy(['http://192.168.1.50:8188'])).toBeNull(); // remote is never probed
  });
  it('with nothing set, the server starts on the first candidate and switches to the one that is up', async () => {
    delete process.env.COMFYUI_URL; const dead = await deadPort(); const live = await fakeComfy();
    process.env.COMFYUI_PORTS = `${dead},${live.port}`;
    const s = new Services({ dataDir: tmp() });
    expect(s.comfySource).toBe('auto');
    expect(s.comfy.baseUrl).toBe(`http://127.0.0.1:${dead}`);
    expect(await s.comfyHealth()).toBe(true);
    expect(s.comfy.baseUrl).toBe(live.url);
  });
  it('prefers the earlier port when both are up (stock 8188 wins over 8288)', async () => {
    delete process.env.COMFYUI_URL; const first = await fakeComfy(); const second = await fakeComfy();
    process.env.COMFYUI_PORTS = `${first.port},${second.port}`;
    const s = new Services({ dataDir: tmp() });
    expect(await s.comfyHealth()).toBe(true); expect(s.comfy.baseUrl).toBe(first.url);
  });
  it('COMFYUI_URL pins the address and turns auto-detect off (<your-pc>: Comfy-Studio on 8288)', async () => {
    const dead = await deadPort(); const live = await fakeComfy();
    process.env.COMFYUI_URL = `http://127.0.0.1:${dead}`; process.env.COMFYUI_PORTS = `${live.port}`;
    const s = new Services({ dataDir: tmp() });
    expect(s.comfySource).toBe('env');
    expect(await s.comfyHealth()).toBe(false); expect(s.comfy.baseUrl).toBe(`http://127.0.0.1:${dead}`);
  });
  it('config comfyUrl wins over the environment', () => {
    process.env.COMFYUI_URL = 'http://127.0.0.1:8188';
    const s = new Services({ dataDir: tmp(), comfyUrl: 'http://127.0.0.1:8288' });
    expect(s.comfySource).toBe('config'); expect(s.comfy.baseUrl).toBe('http://127.0.0.1:8288');
  });
  it('a saved Custom address is used on restart instead of auto-detect', () => {
    delete process.env.COMFYUI_URL; const dir = tmp();
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ schemaVersion: 1, unlock_unsupported: false, custom: { ...CUSTOM_DEFAULT, enabled: true, comfyUrl: 'http://127.0.0.1:8288' } }));
    const s = new Services({ dataDir: dir });
    expect(s.custom?.enabled).toBe(true);
    expect(s.comfySource).toBe('custom'); expect(s.comfy.baseUrl).toBe('http://127.0.0.1:8288');
  });
  it('a saved remote Custom address without the Advanced unlock is ignored (stays on auto-detect)', () => {
    delete process.env.COMFYUI_URL; const dir = tmp();
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ schemaVersion: 1, unlock_unsupported: false, custom: { ...CUSTOM_DEFAULT, enabled: true, comfyUrl: 'http://192.168.1.50:8188', allowRemoteComfy: true } }));
    const s = new Services({ dataDir: dir });
    expect(s.comfySource).toBe('auto'); expect(s.comfy.baseUrl).toBe('http://127.0.0.1:8188');
  });
});
