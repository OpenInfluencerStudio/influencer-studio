import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { findManagedComfy, launchArgs, extraModelPathsYaml, ManagedComfy, autoStartManaged, managedComfyDir, MANAGED_DEFAULT_PORT, type ManagedLayout } from '../src/managed-comfy.js';
import { Services } from '../src/services.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'is-managed-'));
const touch = (f: string) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, ''); };
async function freePort(): Promise<number> { const s = net.createServer(); await new Promise<void>(r => s.listen(0, '127.0.0.1', r)); const p = (s.address() as net.AddressInfo).port; await new Promise(r => s.close(r)); return p; }
/** A stand-in "python": node runs this script, which parses --port like ComfyUI and answers /system_stats. */
function fakeComfyScript(dir: string): string {
  const f = path.join(dir, 'main.py');
  fs.writeFileSync(f, `const a=process.argv; const port=Number(a[a.indexOf('--port')+1]); if (a[a.indexOf('--listen')+1]!=='127.0.0.1') process.exit(3);
require('node:http').createServer((q,s)=>{ if(q.url==='/system_stats'){s.setHeader('content-type','application/json');return s.end('{"devices":[]}');} s.statusCode=404;s.end(); }).listen(port,'127.0.0.1');`);
  return f;
}
/** A stand-in python executable: drops ComfyUI's "-s" flag and runs the script with node. */
function fakePython(dir: string): string { const f = path.join(dir, 'python'); fs.writeFileSync(f, `#!/bin/sh\nshift\nexec "${process.execPath}" "$@"\n`, { mode: 0o755 }); return f; }
const posix = process.platform !== 'win32';
const running: ManagedComfy[] = [];
const saved = { ...process.env };
afterEach(() => { for (const m of running.splice(0)) m.stop(); for (const k of ['COMFYUI_URL', 'COMFYUI_PORTS', 'INFLUENCER_STUDIO_MANAGED_COMFY']) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe('app-managed ComfyUI (single install prototype)', () => {
  it('finds a Windows portable install, then a venv checkout, else nothing', () => {
    const d = tmp(); expect(findManagedComfy(d)).toBeNull();
    touch(path.join(d, 'ComfyUI', 'main.py')); touch(path.join(d, 'venv', 'bin', 'python'));
    fs.writeFileSync(path.join(d, 'install.json'), JSON.stringify({ version: 'v0.42.1' }));
    expect(findManagedComfy(d)).toMatchObject({ kind: 'venv', version: 'v0.42.1', cwd: path.join(d, 'ComfyUI') });
    touch(path.join(d, 'ComfyUI_windows_portable', 'python_embeded', 'python.exe')); touch(path.join(d, 'ComfyUI_windows_portable', 'ComfyUI', 'main.py'));
    expect(findManagedComfy(d)?.kind).toBe('portable');
  });
  it('launch line is loopback only, own port, no browser; portable adds the standalone flag', () => {
    const l: ManagedLayout = { kind: 'portable', root: 'R', python: 'R/python_embeded/python.exe', main: 'R/ComfyUI/main.py', cwd: 'R' };
    const { cmd, args } = launchArgs(l, { port: 8190, extraPathsFile: 'X/extra.yaml' });
    expect(cmd).toBe(l.python);
    expect(args.join(' ')).toBe('-s R/ComfyUI/main.py --listen 127.0.0.1 --port 8190 --disable-auto-launch --windows-standalone-build --extra-model-paths-config X/extra.yaml');
    expect(args).not.toContain('0.0.0.0');
    expect(() => launchArgs(l, { port: 80 })).toThrow();
    expect(launchArgs({ ...l, kind: 'venv' }, { port: 8190, cpu: true }).args).toEqual(expect.arrayContaining(['--cpu']));
    expect(MANAGED_DEFAULT_PORT).not.toBe(8188); expect(MANAGED_DEFAULT_PORT).not.toBe(8288);
  });
  it('extra_model_paths.yaml maps the app models folder (Windows paths become forward slashes)', () => {
    const y = extraModelPathsYaml('C:\\ComfyUI\\models');
    expect(y).toContain('base_path: "C:/ComfyUI/models"'); expect(y).toContain('is_default: true');
    for (const f of ['diffusion_models', 'unet', 'text_encoders', 'vae', 'loras']) expect(y).toContain(`${f}/`);
  });
  it('INFLUENCER_STUDIO_COMFY_DIR overrides <app>/comfyui', () => {
    expect(managedComfyDir('/app', {})).toBe(path.join('/app', 'comfyui'));
    expect(managedComfyDir('/app', { INFLUENCER_STUDIO_COMFY_DIR: '/x/comfy' })).toBe(path.resolve('/x/comfy'));
  });
  it.runIf(posix)('starts its own child, waits until healthy, and stops only that PID', async () => {
    const d = tmp(); const port = await freePort();
    const m = new ManagedComfy({ layout: { kind: 'venv', root: d, python: fakePython(d), main: fakeComfyScript(d), cwd: d }, port, dataDir: d, modelsDir: path.join(d, 'models'), startTimeoutMs: 15000 });
    running.push(m);
    expect(await m.start()).toBe(true); expect(m.running).toBe(true); expect(m.pid).toBeGreaterThan(0);
    expect(fs.readFileSync(path.join(d, 'extra_model_paths.yaml'), 'utf8')).toContain('influencer_studio:');
    m.stop(); expect(m.running).toBe(false);
  });
  it.runIf(posix)('a failing ComfyUI reports false instead of hanging', async () => {
    const d = tmp(); const bad = path.join(d, 'main.py'); fs.writeFileSync(bad, 'process.exit(2)');
    const m = new ManagedComfy({ layout: { kind: 'venv', root: d, python: fakePython(d), main: bad, cwd: d }, port: await freePort(), dataDir: d, startTimeoutMs: 10000 });
    expect(await m.start()).toBe(false);
  });
  it.runIf(posix)('auto-start order: off switch, fixed address, existing ComfyUI, not installed, then start', async () => {
    const appRoot = tmp(); delete process.env.COMFYUI_URL; process.env.COMFYUI_PORTS = String(await freePort());
    const svc = new Services({ dataDir: tmp() });
    expect((await autoStartManaged({ services: svc, appRoot, env: { INFLUENCER_STUDIO_MANAGED_COMFY: '0' } })).reason).toBe('off');
    expect((await autoStartManaged({ services: new Services({ dataDir: tmp(), comfyUrl: 'http://127.0.0.1:8288' }), appRoot, env: {} })).reason).toBe('address-fixed');
    expect((await autoStartManaged({ services: new Services({ dataDir: tmp(), mock: true }), appRoot, env: {} })).reason).toBe('mock');
    expect((await autoStartManaged({ services: svc, appRoot, env: {} })).reason).toBe('not-installed');
    // install a fake managed ComfyUI under <app>/comfyui and let auto-start bring it up on its own port
    const cd = path.join(appRoot, 'comfyui'); const script = fakeComfyScript(tmp());
    touch(path.join(cd, 'ComfyUI', 'main.py')); fs.mkdirSync(path.join(cd, 'venv', 'bin'), { recursive: true }); fs.copyFileSync(fakePython(tmp()), path.join(cd, 'venv', 'bin', 'python')); fs.chmodSync(path.join(cd, 'venv', 'bin', 'python'), 0o755);
    fs.copyFileSync(script, path.join(cd, 'ComfyUI', 'main.py'));
    const port = await freePort();
    const r = await autoStartManaged({ services: svc, appRoot, env: { INFLUENCER_STUDIO_COMFY_PORT: String(port) }, startTimeoutMs: 15000 });
    expect(r.reason).toBe('started'); running.push(r.managed!);
    expect(await r.ready).toBe(true);
    expect(await svc.comfyHealth()).toBe(true); expect(svc.comfy.baseUrl).toBe(`http://127.0.0.1:${port}`);
    // with that ComfyUI now answering, a second auto-start uses it instead of starting another
    expect((await autoStartManaged({ services: svc, appRoot, env: { INFLUENCER_STUDIO_COMFY_PORT: String(port) } })).reason).toBe('existing-found');
  }, 30000);
});
