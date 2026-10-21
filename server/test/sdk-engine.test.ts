import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { loopbackFetch, isLoopbackUrl, progressMessage, findPlaceholder, outputFileName, SdkEngine, SDK_VERSION, PROXY_DEFAULT_PORTS } from '../src/sdk-engine.js';
import { findProxyCommand, proxyArgs, ManagedProxy } from '../src/sdk-proxy.js';
import { checkJob } from '../src/enforce.js';
import { Services } from '../src/services.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'is-sdk-'));
const touch = (f: string, body = '') => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
async function freePort(): Promise<number> { const s = net.createServer(); await new Promise<void>(r => s.listen(0, '127.0.0.1', r)); const p = (s.address() as net.AddressInfo).port; await new Promise(r => s.close(r)); return p; }
const savedEnv = { ...process.env };
afterEach(() => { for (const k of ['COMFY_BASE_URL', 'COMFY_API_KEY', 'COMFY_PROXY_URL', 'INFLUENCER_STUDIO_PROXY_CMD']) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; } });

describe('Comfy SDK engine: local only, keyless', () => {
  it('the SDK version is pinned in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.dependencies['@comfyorg/sdk']).toBe(SDK_VERSION);
    expect(PROXY_DEFAULT_PORTS).toEqual([8189, 8289]);
  });
  it('the fetch guard refuses Comfy Cloud, the Router and anything off this computer', async () => {
    const calls: string[] = []; const f = loopbackFetch((async (u: string) => { calls.push(String(u)); return new Response('ok'); }) as never);
    for (const u of ['https://cloud.comfy.org/api/v2/jobs', 'https://api.comfy.org/v2/models', 'http://192.168.1.5:8189/api/v2/health', 'file:///etc/passwd']) await expect(f(u)).rejects.toThrow(/Blocked/);
    expect(calls).toEqual([]);
    await f('http://127.0.0.1:8189/api/v2/health'); await f(new URL('http://localhost:8189/x'));
    expect(calls.length).toBe(2);
    expect(isLoopbackUrl('http://[::1]:8189')).toBe(true); expect(isLoopbackUrl('https://cloud.comfy.org')).toBe(false);
  });
  it('the engine pins COMFY_BASE_URL to the local proxy and drops any Comfy Cloud key', () => {
    process.env.COMFY_API_KEY = 'comfyui-should-never-be-sent'; process.env.COMFY_BASE_URL = 'https://cloud.comfy.org';
    const e = new SdkEngine({ proxyUrl: 'http://127.0.0.1:8189/' });
    expect(e.proxyUrl).toBe('http://127.0.0.1:8189');
    expect(process.env.COMFY_BASE_URL).toBe('http://127.0.0.1:8189'); expect(process.env.COMFY_API_KEY).toBeUndefined();
    expect(() => new SdkEngine({ proxyUrl: 'https://cloud.comfy.org' })).toThrow(/loopback/);
  });
  it('progress snapshots become the app wording', () => {
    expect(progressMessage({ value: 0.5, step: 2, steps: 4 })).toEqual({ percent: 50, message: 'Drawing, step 2 of 4' });
    expect(progressMessage({ value: 0, currentNodeClass: 'UNETLoader' }).message).toBe('Loading models');
    expect(progressMessage({ value: 0.1, currentNodeClass: 'CLIPTextEncode' }).message).toBe('Reading your prompt');
    expect(progressMessage({ value: 2 }).percent).toBe(95); expect(progressMessage({}).percent).toBe(5);
  });
  it('finds the reference-image slot and names outputs by type', () => {
    const wf = { '1': { class_type: 'LoadImage', inputs: { image: '__ref__' } }, '2': { class_type: 'X', inputs: { a: 1, b: '__ref__' } }, '3': { class_type: 'Y', inputs: {} } } as never;
    expect(findPlaceholder(wf, '__ref__')).toEqual([['1', 'image'], ['2', 'b']]);
    expect(outputFileName({ type: 'image', contentType: 'image/png', name: 'a.png' }, 0)).toEqual({ file: 'img_0.png', mime: 'image/png' });
    expect(outputFileName({ type: 'video', contentType: 'video/mp4', name: 'v.mp4' }, 1)).toEqual({ file: 'vid_1.mp4', mime: 'video/mp4' });
    expect(outputFileName({ type: 'file', contentType: 'application/octet-stream', name: 'x.mp4' }, 2).file).toBe('vid_2.mp4');
  });
});

describe('comfy-api-proxy discovery and launch', () => {
  it('finds the proxy: env override, app venv, Windows portable lib, then PATH', () => {
    const d = tmp(); expect(findProxyCommand(d, { PATH: '' })).toBeNull();
    const bin = path.join(tmp(), 'comfy-api-proxy'); touch(bin);
    expect(findProxyCommand(d, { PATH: path.dirname(bin) })?.source).toBe(process.platform === 'win32' ? undefined : 'path');
    touch(path.join(d, 'ComfyUI_windows_portable', 'python_embeded', 'python.exe')); touch(path.join(d, 'ComfyUI_windows_portable', 'ComfyUI', 'main.py')); touch(path.join(d, 'proxy-lib', 'comfy_api_proxy', '__init__.py'));
    const port = findProxyCommand(d, { PATH: '' })!; expect(port.source).toBe('app-portable'); expect(port.pre.join(' ')).toContain('comfy_api_proxy.cli');
    touch(path.join(d, 'proxy-venv', 'bin', 'comfy-api-proxy'));
    expect(findProxyCommand(d, { PATH: '' })?.source).toBe('app-venv');
    expect(findProxyCommand(d, { INFLUENCER_STUDIO_PROXY_CMD: bin })).toEqual({ cmd: bin, pre: [], source: 'env' });
    expect(findProxyCommand(d, { INFLUENCER_STUDIO_PROXY_CMD: path.join(d, 'missing') })).toBeNull();
  });
  it('launch line: loopback, own port, a token, pointed at the chosen ComfyUI', () => {
    const a = proxyArgs({ cmd: 'p', pre: [], source: 'path' }, { comfyUrl: 'http://127.0.0.1:8288', port: 8191, token: 'tok' });
    expect(a).toEqual(['run', '--comfyui', 'http://127.0.0.1:8288', '--host', '127.0.0.1', '--port', '8191', '--token', 'tok']);
    expect(() => proxyArgs({ cmd: 'p', pre: [], source: 'path' }, { comfyUrl: 'x', port: 22, token: 't' })).toThrow();
    expect(new ManagedProxy({ cmd: 'p', pre: [], source: 'path' }, 'http://127.0.0.1:8188', 8191, tmp()).token.length).toBeGreaterThan(20);
  });
});

describe('SDK path is the default and is enforced', () => {
  it('Services default to the SDK engine unless direct is chosen explicitly', () => {
    expect(new Services({ dataDir: tmp(), engine: 'sdk' }).engineInfo()).toMatchObject({ engine: 'comfy-sdk', sdkVersion: SDK_VERSION });
    expect(new Services({ dataDir: tmp(), engine: 'direct' }).engineInfo().engine).toBe('direct');
    expect(() => new Services({ dataDir: tmp(), engine: 'sdk', proxyUrl: 'https://cloud.comfy.org' })).toThrow(/loopback/);
  });
  it('with ComfyUI up but no proxy, jobs get a clear hard block (never a silent fallback to direct)', async () => {
    const svc = new Services({ dataDir: tmp(), engine: 'sdk', proxyCmd: null, comfyUrl: 'http://127.0.0.1:' + await freePort() });
    const ctx = svc.checkCtx((await import('../src/hardware.js')).buildProfile({ gpus: [{ index: 0, name: 'g', vramGb: 16 }], ramGb: 64, freeDiskGb: 500, source: 'fixture' }, svc.limits), true);
    const r = checkJob({ template: 'klein_t2i', variantId: svc.registry.variants[0].id, width: 1024, height: 1024, refs: 0 }, ctx);
    expect(r.hard.map(h => h.code)).toContain('SDK_PROXY_OFFLINE');
    expect(svc.engineInfo()).toMatchObject({ proxyOnline: false });
  });
});

// Real end to end, only when a ComfyUI and comfy-api-proxy are available on this machine:
//   IS_E2E_COMFY=http://127.0.0.1:8195 IS_E2E_PROXY_BIN=/path/to/comfy-api-proxy npx vitest run test/sdk-engine.test.ts
const E2E_COMFY = process.env.IS_E2E_COMFY; const E2E_BIN = process.env.IS_E2E_PROXY_BIN;
describe.runIf(!!E2E_COMFY && !!E2E_BIN)('real Comfy SDK -> comfy-api-proxy -> ComfyUI (model-free workflow)', () => {
  it('the app starts its own proxy, uploads a reference image as an SDK asset, runs, downloads the output, stops the proxy', async () => {
    const svc = new Services({ dataDir: tmp(), engine: 'sdk', comfyUrl: E2E_COMFY, proxyCmd: { cmd: E2E_BIN!, pre: [], source: 'env' }, proxyPort: await freePort() });
    expect(await svc.comfyHealth()).toBe(true);
    const info = svc.engineInfo() as { proxyOnline: boolean; proxySource: string; proxyUrl: string };
    expect(info).toMatchObject({ proxyOnline: true, proxySource: 'managed' });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const msgs: string[] = [];
    const outs = await svc.sdk!.run({ '1': { class_type: 'LoadImage', inputs: { image: '__ref__' } }, '2': { class_type: 'ImageInvert', inputs: { image: ['1', 0] } }, '3': { class_type: 'SaveImage', inputs: { filename_prefix: 'is_e2e', images: ['2', 0] } } } as never,
      { ref: { placeholder: '__ref__', bytes: png, filename: 'ref.png', mime: 'image/png' }, onProgress: (_p, m) => msgs.push(m) });
    expect(outs.length).toBe(1); expect(outs[0].type).toBe('image'); expect(outs[0].bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(msgs).toContain('Sending to ComfyUI (Comfy SDK)');
    // the managed proxy requires its token: an unauthenticated caller is refused
    expect((await fetch(info.proxyUrl + '/api/v2/jobs', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })).status).toBe(401);
    svc.stopEngine();
    await new Promise(r => setTimeout(r, 500));
    expect((await fetch(info.proxyUrl + '/api/v2/health').catch(() => null))?.ok ?? false).toBe(false);
  }, 60000);
});
