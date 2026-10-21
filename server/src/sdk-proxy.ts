// Finds, starts and stops comfy-api-proxy (MIT, Comfy Org): the local Comfy API v2 server the Comfy SDK talks to.
// It runs on loopback in front of the user's ComfyUI. When the app starts it, it adds a random bearer token so
// nothing else on the computer can use it. The app only ever stops the proxy PID it started.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { findManagedComfy } from './managed-comfy.js';

export interface ProxyCommand { cmd: string; pre: string[]; source: 'env' | 'app-venv' | 'app-portable' | 'path' }

const exists = (f: string) => { try { return fs.statSync(f).isFile(); } catch { return false; } };
function onPath(name: string, env: NodeJS.ProcessEnv): string | null {
  const exts = process.platform === 'win32' ? (env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';').map(e => e.toLowerCase()) : [''];
  for (const dir of (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean)) for (const e of exts) { const f = path.join(dir, name + e); if (exists(f)) return f; }
  return null;
}

/** Where to run comfy-api-proxy from, in order: INFLUENCER_STUDIO_PROXY_CMD, the app's own install in <comfyDir>, then PATH. */
export function findProxyCommand(comfyDir: string, env: NodeJS.ProcessEnv = process.env): ProxyCommand | null {
  if (env.INFLUENCER_STUDIO_PROXY_CMD) return exists(env.INFLUENCER_STUDIO_PROXY_CMD) ? { cmd: env.INFLUENCER_STUDIO_PROXY_CMD, pre: [], source: 'env' } : null;
  for (const f of [path.join(comfyDir, 'proxy-venv', 'bin', 'comfy-api-proxy'), path.join(comfyDir, 'proxy-venv', 'Scripts', 'comfy-api-proxy.exe')]) if (exists(f)) return { cmd: f, pre: [], source: 'app-venv' };
  // Windows portable: installed with pip --target into <comfyDir>/proxy-lib and run by the portable's own Python.
  // The embedded Python ignores PYTHONPATH, so the folder is put on sys.path explicitly; ComfyUI's own packages are untouched.
  const lib = path.join(comfyDir, 'proxy-lib'); const m = findManagedComfy(comfyDir);
  if (m?.kind === 'portable' && fs.existsSync(path.join(lib, 'comfy_api_proxy'))) {
    return { cmd: m.python, pre: ['-s', '-c', `import sys; sys.path.insert(0, ${JSON.stringify(lib)}); sys.argv[0] = 'comfy-api-proxy'; from comfy_api_proxy.cli import main; sys.exit(main())`], source: 'app-portable' };
  }
  const p = onPath('comfy-api-proxy', env); return p ? { cmd: p, pre: [], source: 'path' } : null;
}

export function proxyArgs(c: ProxyCommand, o: { comfyUrl: string; port: number; token: string }): string[] {
  if (!Number.isInteger(o.port) || o.port < 1024 || o.port > 65535) throw new Error('Proxy port must be 1024-65535');
  return [...c.pre, 'run', '--comfyui', o.comfyUrl, '--host', '127.0.0.1', '--port', String(o.port), '--token', o.token];
}

export async function proxyHealth(url: string, token?: string): Promise<{ online: boolean; upstream?: string }> {
  try {
    const r = await fetch(url + '/api/v2/health', { signal: AbortSignal.timeout(2000), redirect: 'error', headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!r.ok) return { online: false };
    const j = await r.json() as { status?: string; upstream?: string };
    return { online: j.status === 'healthy', upstream: j.upstream?.replace(/\/+$/, '') };
  } catch { return { online: false }; }
}

/** One comfy-api-proxy child process in front of one ComfyUI address. */
export class ManagedProxy {
  readonly url: string; readonly token = crypto.randomBytes(24).toString('base64url');
  private child?: ChildProcess; private exited = true;
  constructor(private c: ProxyCommand, readonly comfyUrl: string, readonly port: number, private logDir: string) { this.url = `http://127.0.0.1:${port}`; }
  get pid() { return this.child?.pid; }
  get running() { return !!this.child && !this.exited; }
  async start(timeoutMs = 30_000): Promise<boolean> {
    const fd = fs.openSync(path.join(this.logDir, 'comfy-api-proxy.log'), 'a');
    const env: NodeJS.ProcessEnv = { ...process.env, PYTHONUNBUFFERED: '1' }; delete env.COMFY_API_KEY;
    this.child = spawn(this.c.cmd, proxyArgs(this.c, { comfyUrl: this.comfyUrl, port: this.port, token: this.token }), { stdio: ['ignore', fd, fd], windowsHide: true, env });
    fs.closeSync(fd); this.exited = false;
    this.child.on('exit', () => { this.exited = true; }); this.child.on('error', () => { this.exited = true; });
    const until = Date.now() + timeoutMs;
    while (Date.now() < until && !this.exited) { if ((await proxyHealth(this.url, this.token)).online) return true; await new Promise(r => setTimeout(r, 300)); }
    this.stop(); return false;
  }
  stop() {
    const ch = this.child; if (!ch || this.exited || !ch.pid) return;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(ch.pid), '/T', '/F'], { windowsHide: true }); else ch.kill('SIGTERM');
    this.exited = true;
  }
}
