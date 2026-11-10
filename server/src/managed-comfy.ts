// Optional app-managed ComfyUI ("single install").
// ComfyUI is a separate GPL-3.0 program. The installer scripts in comfyui/ download the pinned official build
// at first run; this module only finds that install, starts it as a child process on its own loopback port,
// waits for it to answer, and stops it again. It never touches any other ComfyUI and only kills its own child.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { ComfyClient } from './comfy.js';

export const MANAGED_DEFAULT_PORT = 8190;
/** Model folder names the app's models.json uses, mapped for ComfyUI's extra_model_paths.yaml. */
export const MODEL_FOLDERS: Record<string, string[]> = {
  diffusion_models: ['diffusion_models', 'unet'],
  text_encoders: ['text_encoders', 'clip'],
  vae: ['vae'],
  loras: ['loras'],
  checkpoints: ['checkpoints'],
};

export interface ManagedLayout { kind: 'portable' | 'venv'; root: string; python: string; main: string; cwd: string; version?: string }

/** Find an installed managed ComfyUI under <comfyDir>. Windows portable first, then a venv checkout (Linux, macOS, or Windows). */
export function findManagedComfy(comfyDir: string): ManagedLayout | null {
  let version: string | undefined;
  try { version = (JSON.parse(fs.readFileSync(path.join(comfyDir, 'install.json'), 'utf8')) as { version?: string }).version; } catch { /* no marker */ }
  const portable = path.join(comfyDir, 'ComfyUI_windows_portable');
  const pPy = path.join(portable, 'python_embeded', 'python.exe'); const pMain = path.join(portable, 'ComfyUI', 'main.py');
  if (fs.existsSync(pPy) && fs.existsSync(pMain)) return { kind: 'portable', root: portable, python: pPy, main: pMain, cwd: portable, version };
  const vMain = path.join(comfyDir, 'ComfyUI', 'main.py');
  for (const py of [path.join(comfyDir, 'venv', 'bin', 'python'), path.join(comfyDir, 'venv', 'Scripts', 'python.exe')]) {
    if (fs.existsSync(py) && fs.existsSync(vMain)) return { kind: 'venv', root: comfyDir, python: py, main: vMain, cwd: path.join(comfyDir, 'ComfyUI'), version };
  }
  return null;
}

const yamlPath = (p: string) => JSON.stringify(p.replace(/\\/g, '/'));
/** extra_model_paths.yaml that points ComfyUI at the app's models folder (for example C:\ComfyUI\models or the app's own models folder). */
export function extraModelPathsYaml(modelsDir: string): string {
  const lines = ['# Written by Influencer Studio. Points the app-managed ComfyUI at your models folder.', 'influencer_studio:', `  base_path: ${yamlPath(modelsDir)}`, '  is_default: true'];
  for (const [key, dirs] of Object.entries(MODEL_FOLDERS)) {
    if (dirs.length === 1) lines.push(`  ${key}: ${dirs[0]}/`);
    else { lines.push(`  ${key}: |`); for (const d of dirs) lines.push(`    ${d}/`); }
  }
  return lines.join('\n') + '\n';
}

export interface LaunchOpts { port: number; extraPathsFile?: string; cpu?: boolean; outputDir?: string }
/** Command line for the managed ComfyUI. Always loopback only, never auto-opens a browser. */
export function launchArgs(l: ManagedLayout, o: LaunchOpts): { cmd: string; args: string[]; cwd: string } {
  if (!Number.isInteger(o.port) || o.port < 1024 || o.port > 65535) throw new Error('Managed ComfyUI port must be 1024-65535');
  const args = ['-s', l.main, '--listen', '127.0.0.1', '--port', String(o.port), '--disable-auto-launch'];
  if (l.kind === 'portable') args.push('--windows-standalone-build');
  if (o.extraPathsFile) args.push('--extra-model-paths-config', o.extraPathsFile);
  if (o.outputDir) args.push('--output-directory', o.outputDir);
  if (o.cpu) args.push('--cpu');
  return { cmd: l.python, args, cwd: l.cwd };
}

export interface ManagedOpts { layout: ManagedLayout; port?: number; modelsDir?: string; dataDir: string; cpu?: boolean; startTimeoutMs?: number; log?: (s: string) => void }

/** Starts and stops one ComfyUI child process. Owns only the PID it spawned. */
export class ManagedComfy {
  readonly port: number; readonly url: string;
  private child?: ChildProcess; private exited = false;
  constructor(private o: ManagedOpts) { this.port = o.port ?? MANAGED_DEFAULT_PORT; this.url = `http://127.0.0.1:${this.port}`; }
  get pid() { return this.child?.pid; }
  get running() { return !!this.child && !this.exited; }

  async start(): Promise<boolean> {
    const client = new ComfyClient({ baseUrl: this.url, timeoutMs: 1500 });
    if ((await client.health()).online) { this.o.log?.(`Something already answers on ${this.url}; using it, not starting a second ComfyUI.`); return true; }
    let extra: string | undefined;
    if (this.o.modelsDir) { extra = path.join(this.o.dataDir, 'extra_model_paths.yaml'); fs.writeFileSync(extra, extraModelPathsYaml(this.o.modelsDir)); }
    const { cmd, args, cwd } = launchArgs(this.o.layout, { port: this.port, extraPathsFile: extra, cpu: this.o.cpu });
    const logFile = path.join(this.o.dataDir, 'comfyui.log'); const fd = fs.openSync(logFile, 'a');
    this.child = spawn(cmd, args, { cwd, stdio: ['ignore', fd, fd], windowsHide: true, env: { ...process.env, PYTHONUNBUFFERED: '1' } });
    fs.closeSync(fd);
    this.exited = false; this.child.on('exit', () => { this.exited = true; }); this.child.on('error', () => { this.exited = true; });
    this.o.log?.(`Starting the app's ComfyUI ${this.o.layout.version ?? ''} on ${this.url} (PID ${this.child.pid}, log ${logFile})`);
    const until = Date.now() + (this.o.startTimeoutMs ?? 240_000);
    while (Date.now() < until && !this.exited) {
      if ((await client.health()).online) return true;
      await new Promise(r => setTimeout(r, 750));
    }
    if (!this.exited) this.stop();
    return false;
  }

  /** Stop our own child only (and its children on Windows, via its PID tree). */
  stop() {
    const c = this.child; if (!c || this.exited || !c.pid) return;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { windowsHide: true });
    else c.kill('SIGTERM');
    this.exited = true;
  }
}

/** Where the managed ComfyUI lives: INFLUENCER_STUDIO_COMFY_DIR, else <app folder>/comfyui. */
export function managedComfyDir(appRoot: string, env = process.env): string { return env.INFLUENCER_STUDIO_COMFY_DIR ? path.resolve(env.INFLUENCER_STUDIO_COMFY_DIR) : path.join(appRoot, 'comfyui'); }

export interface AutoStartDeps {
  services: { mock?: boolean; comfyAutoDetect: boolean; comfyHealth(): Promise<boolean>; addComfyCandidate(url: string): void; modelsDir?: string; dataDir: string };
  appRoot: string; env?: NodeJS.ProcessEnv; log?: (s: string) => void; startTimeoutMs?: number;
}
/**
 * Decide whether to start the app-managed ComfyUI, and start it. Order of preference:
 * an address the user set (COMFYUI_URL / config / Custom) > an existing ComfyUI on 8188 or 8288 > the managed copy.
 * INFLUENCER_STUDIO_MANAGED_COMFY=0 turns it off. Returns the running instance or null.
 */
export async function autoStartManaged(d: AutoStartDeps): Promise<{ managed: ManagedComfy | null; reason: string; ready?: Promise<boolean> }> {
  const env = d.env ?? process.env;
  if (env.INFLUENCER_STUDIO_MANAGED_COMFY === '0') return { managed: null, reason: 'off' };
  if (d.services.mock) return { managed: null, reason: 'mock' };
  if (!d.services.comfyAutoDetect) return { managed: null, reason: 'address-fixed' };
  if (await d.services.comfyHealth()) return { managed: null, reason: 'existing-found' };
  const layout = findManagedComfy(managedComfyDir(d.appRoot, env));
  if (!layout) return { managed: null, reason: 'not-installed' };
  const port = Number(env.INFLUENCER_STUDIO_COMFY_PORT ?? MANAGED_DEFAULT_PORT);
  const managed = new ManagedComfy({ layout, port, modelsDir: d.services.modelsDir, dataDir: d.services.dataDir, cpu: env.INFLUENCER_STUDIO_COMFY_CPU === '1', startTimeoutMs: d.startTimeoutMs, log: d.log });
  d.services.addComfyCandidate(managed.url);
  const ready = managed.start().then(ok => { d.log?.(ok ? `The app's ComfyUI is ready on ${managed.url}` : `The app's ComfyUI did not start. See comfyui.log in the data folder.`); return ok; });
  return { managed, reason: 'started', ready };
}
