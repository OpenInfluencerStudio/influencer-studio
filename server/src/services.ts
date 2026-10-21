import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { loadLimits, Limits } from './tiers.js';
import { loadRegistry, Registry, Variant } from './registry.js';
import { loadTemplates, fillTemplate, Template } from './workflows.js';
import { scanHardware, buildProfile, HardwareProfile, Exec } from './hardware.js';
import { bestFit, InstalledFn } from './recommend.js';
import { checkJob, CheckCtx, JobFacts, Settings } from './enforce.js';
import { ComfyClient, comfyCandidates, probeComfy } from './comfy.js';
import { CustomSchema, CUSTOM_DEFAULT, customProfile, type Custom } from './custom.js';
import { ComfyProgress, ProgressTracker } from './comfy-ws.js';
import { JobQueue, Job, Runner } from './queue.js';
import { mockImageSvg } from './mock.js';
import { EditSchema } from './edit.js';
import { VideoSchema, VIDEO_NEGATIVE } from './video.js';
import { RefStore } from './refs.js';
import type { EditRequest } from './edit.js';
import { writeJsonAtomic, readJsonSafe } from './store.js';
import { dataDir as defaultDataDir, repoRoot } from './paths.js';
import { SdkEngine, SDK_VERSION, PROXY_DEFAULT_PORTS, isLoopbackUrl, outputFileName } from './sdk-engine.js';
import { findProxyCommand, proxyHealth, ManagedProxy, type ProxyCommand } from './sdk-proxy.js';
import { managedComfyDir } from './managed-comfy.js';
import { DownloadManager, DlHooks } from './downloads.js';

export interface Config {
  dataDir?: string; comfyUrl?: string; mock?: boolean; modelsDir?: string; allowRemoteComfy?: boolean;
  /** 'sdk' (default): every job goes Comfy SDK -> comfy-api-proxy -> ComfyUI. 'direct': the app's own ComfyUI client (opt-in fallback only). */
  engine?: 'sdk' | 'direct'; proxyUrl?: string; proxyCmd?: ProxyCommand | null; proxyPort?: number;
  exec?: Exec; downloadHooks?: DlHooks; hardwareOverride?: HardwareProfile; limitsFile?: string; registryFile?: string; workflowsDir?: string;
}

export class Services {
  limits: Limits; registry: Registry; templates: Map<string, Template>;
  dataDir: string; comfy: ComfyClient; mock: boolean; modelsDir?: string;
  settings: Settings = { unlock_unsupported: false };
  custom: Custom | null = null; private allowRemote = false;
  queue: JobQueue; refs: RefStore; downloads: DownloadManager; modelsDirSource: 'config' | 'env' | 'setting' | 'none' = 'none';
  private profile?: { p: HardwareProfile; at: number };
  private comfyOnline = false; private comfyAt = 0;
  /** Where the ComfyUI address came from. 'auto' = nothing set, so the server probes 8188 then 8288 (COMFYUI_PORTS overrides). */
  comfySource: 'config' | 'env' | 'custom' | 'auto' = 'auto';
  private comfyAuto: string[] | null = null;
  engine: 'sdk' | 'direct';
  sdk: SdkEngine | null = null; sdkSource: 'managed' | 'existing' | 'none' = 'none'; sdkOnline = false; sdkNote = '';
  private proxyFixed?: string; private managedProxy?: ManagedProxy; private proxyTriedAt = 0;
  private settingsFile: string; private libraryFile: string;

  constructor(private cfg: Config = {}) {
    this.dataDir = cfg.dataDir ?? defaultDataDir();
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.limits = loadLimits(cfg.limitsFile); this.registry = loadRegistry(cfg.registryFile); this.templates = loadTemplates(cfg.workflowsDir);
    this.allowRemote = !!cfg.allowRemoteComfy;
    const fixedUrl = cfg.comfyUrl ?? (process.env.COMFYUI_URL?.trim() || undefined);
    if (fixedUrl) { this.comfySource = cfg.comfyUrl ? 'config' : 'env'; this.comfy = new ComfyClient({ baseUrl: fixedUrl, allowRemote: cfg.allowRemoteComfy }); }
    else { this.comfyAuto = comfyCandidates(process.env.COMFYUI_PORTS); this.comfy = new ComfyClient({ baseUrl: this.comfyAuto[0] }); }
    this.mock = cfg.mock ?? process.env.INFLUENCER_STUDIO_MOCK === '1';
    const eng = cfg.engine ?? process.env.INFLUENCER_STUDIO_ENGINE ?? 'sdk';
    this.engine = eng === 'direct' ? 'direct' : 'sdk';
    const pf = cfg.proxyUrl ?? (process.env.COMFY_PROXY_URL?.trim() || undefined);
    if (pf) { if (!isLoopbackUrl(pf)) throw new Error('COMFY_PROXY_URL must be on this computer (loopback).'); this.proxyFixed = new URL(pf).origin; }
    this.settingsFile = path.join(this.dataDir, 'settings.json');
    this.libraryFile = path.join(this.dataDir, 'library.json');
    // Settings live in memory after load; a file edit while running only takes effect after restart (plan 21.6c).
    const s = readJsonSafe<{ unlock_unsupported?: unknown; models_dir?: unknown; custom?: unknown }>(this.settingsFile, {});
    this.settings = { unlock_unsupported: s.unlock_unsupported === true };
    const cp = CustomSchema.safeParse((s as { custom?: unknown }).custom); if (cp.success) this.custom = cp.data;
    // A saved Custom ComfyUI address wins over auto-detect (not over an explicit launcher/env address).
    if (this.custom?.enabled && this.custom.comfyUrl && this.comfySource === 'auto') {
      const remoteOk = !!this.custom.allowRemoteComfy && this.settings.unlock_unsupported;
      try { this.comfy = new ComfyClient({ baseUrl: this.custom.comfyUrl, allowRemote: remoteOk }); this.allowRemote = remoteOk || this.allowRemote; this.comfySource = 'custom'; this.comfyAuto = null; } catch { /* invalid saved URL: keep auto-detect */ }
    }
    const fromSetting = typeof s.models_dir === 'string' && path.isAbsolute(s.models_dir) ? s.models_dir : undefined;
    this.modelsDir = cfg.modelsDir ?? process.env.INFLUENCER_STUDIO_MODELS_DIR ?? fromSetting;
    this.modelsDirSource = cfg.modelsDir ? 'config' : process.env.INFLUENCER_STUDIO_MODELS_DIR ? 'env' : fromSetting ? 'setting' : 'none';
    this.downloads = new DownloadManager(path.join(this.dataDir, 'downloads.json'), this.registry, () => this.modelsDir, cfg.downloadHooks);
    this.refs = new RefStore(path.join(this.dataDir, 'refs'));
    this.queue = new JobQueue(path.join(this.dataDir, 'jobs.json'), path.join(this.dataDir, 'outputs'), this.runner, j => this.recheck(j));
  }

  installed: InstalledFn = (v: Variant) => {
    if (!this.modelsDir) return { installed: null, missing: [] };
    const missing = v.files.filter(f => !fs.existsSync(path.join(this.modelsDir!, f.folder, f.name))).map(f => f.name);
    return { installed: missing.length === 0, missing };
  };

  async hardware(force = false): Promise<HardwareProfile> {
    if (this.cfg.hardwareOverride) return this.cfg.hardwareOverride;
    if (!force && this.profile && Date.now() - this.profile.at < 60_000) return this.profile.p;
    const p = await scanHardware(this.limits, this.dataDir, this.cfg.exec);
    this.profile = { p, at: Date.now() };
    return p;
  }
  /** UI-only preview profile ("pretend my GPU"); never used by the server's own checks. */
  pretend(tierId: string, base: HardwareProfile): HardwareProfile | null {
    const t = this.limits.tiers.find(x => x.id === tierId); if (!t) return null;
    const vram = t.id === 'T0' ? 0 : t.minVramGb;
    return buildProfile({ gpus: vram ? [{ index: 0, name: `Pretend ${t.label} GPU`, vramGb: vram }] : [], ramGb: Math.max(8, vram * 2), freeDiskGb: base.freeDiskGb ?? 500, source: 'fixture' }, this.limits);
  }
  /** The profile every check uses: the scan, or the user's Custom numbers while Custom is on. */
  async effectiveHardware(): Promise<HardwareProfile> { const real = await this.hardware(); return this.custom?.enabled ? customProfile(real, this.custom, this.limits) : real; }
  /** Validate and save the Custom profile. Remote ComfyUI needs the explicit remote flag AND the Advanced unlock. Models folder can be fixed by the launcher. */
  saveCustom(input: unknown): Custom {
    const c = CustomSchema.parse(input);
    if (c.comfyUrl) {
      const remoteOk = c.allowRemoteComfy && this.settings.unlock_unsupported;
      let client: ComfyClient;
      try { client = new ComfyClient({ baseUrl: c.comfyUrl, allowRemote: remoteOk || this.allowRemote }); } catch (e) { throw Object.assign(new Error((e as Error).message + (c.allowRemoteComfy && !this.settings.unlock_unsupported ? ' (Turn on Advanced > Unlock unsupported options first.)' : '')), { status: 400, code: 'bad_comfy_url' }); }
      if (c.enabled) { this.comfy = client; this.allowRemote = remoteOk || this.allowRemote; this.comfyAt = 0; this.comfySource = 'custom'; this.comfyAuto = null; }
    }
    if (c.modelsDir && c.enabled) this.setModelsDir(c.modelsDir);
    this.custom = c; this.persistSettings();
    return c;
  }
  customDefaults() { return CUSTOM_DEFAULT; }
  async comfyHealth(): Promise<boolean> {
    if (Date.now() - this.comfyAt > 5000) {
      let online = (await this.comfy.health()).online;
      // Auto-detect: stay on the current address while it answers; otherwise try the candidates in order (8188, then 8288).
      if (!online && this.comfyAuto) {
        const found = await probeComfy(this.comfyAuto.filter(u => u !== this.comfy.baseUrl));
        if (found) { this.comfy = new ComfyClient({ baseUrl: found }); online = true; }
      }
      this.comfyOnline = online; this.comfyAt = Date.now();
      if (this.engine === 'sdk' && !this.mock) await this.ensureSdk(online);
    }
    return this.comfyOnline;
  }
  /**
   * Make sure the Comfy SDK has a healthy comfy-api-proxy in front of the SAME ComfyUI the app checks.
   * Order: COMFY_PROXY_URL > a running proxy on 8189/8289 > a proxy the app starts itself (random token, own PID).
   * In auto-detect mode a running proxy's upstream also decides which ComfyUI is used, so a machine with two
   * ComfyUI installs uses the one its proxy fronts.
   */
  private async ensureSdk(comfyOnline: boolean) {
    const want = this.comfy.baseUrl;
    if (this.sdk) {
      const h = await this.sdk.health();
      if (h.online && (h.upstream === want || this.proxyFixed)) { this.sdkOnline = true; return; }
      if (this.managedProxy && (!h.online || h.upstream !== want)) { this.managedProxy.stop(); this.managedProxy = undefined; }
      this.sdk = null; this.sdkSource = 'none';
    }
    this.sdkOnline = false;
    const adopt = (url: string, source: 'managed' | 'existing', token?: string) => { this.sdk = new SdkEngine({ proxyUrl: url, token }); this.sdkSource = source; this.sdkOnline = true; this.sdkNote = ''; };
    if (this.proxyFixed) {
      const h = await proxyHealth(this.proxyFixed);
      if (h.online) adopt(this.proxyFixed, 'existing'); else this.sdkNote = `comfy-api-proxy is not answering at ${this.proxyFixed} (COMFY_PROXY_URL)`;
      return;
    }
    for (const port of PROXY_DEFAULT_PORTS) {
      const url = `http://127.0.0.1:${port}`; const h = await proxyHealth(url);
      if (!h.online || !h.upstream || !isLoopbackUrl(h.upstream)) continue;
      if (h.upstream === want) { adopt(url, 'existing'); return; }
      if (this.comfyAuto && !comfyOnline) { this.comfy = new ComfyClient({ baseUrl: h.upstream }); this.comfyOnline = (await this.comfy.health()).online; if (this.comfyOnline) { adopt(url, 'existing'); return; } }
      if (this.comfyAuto && h.upstream !== want && (await new ComfyClient({ baseUrl: h.upstream }).health()).online) {
        // Two ComfyUI installs are up: follow the one the running proxy fronts.
        this.comfy = new ComfyClient({ baseUrl: h.upstream }); this.comfyOnline = true; adopt(url, 'existing'); return;
      }
    }
    if (!comfyOnline && !this.comfyOnline) { this.sdkNote = 'ComfyUI is offline'; return; }
    if (Date.now() - this.proxyTriedAt < 30_000) return;
    this.proxyTriedAt = Date.now();
    const cmd = this.cfg.proxyCmd === null ? null : this.cfg.proxyCmd ?? findProxyCommand(managedComfyDir(repoRoot()));
    if (!cmd) { this.sdkNote = 'comfy-api-proxy is not installed'; return; }
    const port = this.cfg.proxyPort ?? Number(process.env.INFLUENCER_STUDIO_PROXY_PORT ?? 8191);
    const mp = new ManagedProxy(cmd, this.comfy.baseUrl, port, this.dataDir);
    if (await mp.start()) { this.managedProxy = mp; adopt(mp.url, 'managed', mp.token); }
    else this.sdkNote = 'comfy-api-proxy did not start (see comfy-api-proxy.log in the data folder)';
  }
  /** What generates the pictures, for /api/health, diagnostics and the About screen. */
  engineInfo() {
    return this.engine === 'sdk'
      ? { engine: 'comfy-sdk' as const, label: `Comfy SDK ${SDK_VERSION} (Comfy API v2 via comfy-api-proxy)`, sdkVersion: SDK_VERSION, proxyUrl: this.sdk?.proxyUrl ?? null, proxySource: this.sdkSource, proxyOnline: this.sdkOnline, note: this.sdkNote || undefined }
      : { engine: 'direct' as const, label: 'Direct ComfyUI connection (fallback, not the Comfy SDK)' };
  }
  stopEngine() { this.managedProxy?.stop(); this.managedProxy = undefined; }
  /** True when no address was set, so the server auto-detects ComfyUI (and may start its own managed copy). */
  get comfyAutoDetect() { return !!this.comfyAuto; }
  /** Add an auto-detect candidate (the app-managed ComfyUI's port). Ignored when the address is fixed. */
  addComfyCandidate(url: string) { if (this.comfyAuto && !this.comfyAuto.includes(url)) { this.comfyAuto.push(url); this.comfyAt = 0; } }
  saveSettings(next: Settings) {
    this.settings = { unlock_unsupported: next.unlock_unsupported === true };
    this.persistSettings();
  }
  private persistSettings() {
    const prev = readJsonSafe<{ unlock_changed_at?: string }>(this.settingsFile, {});
    writeJsonAtomic(this.settingsFile, { schemaVersion: 1, ...this.settings, ...(this.custom ? { custom: this.custom } : {}), ...(this.modelsDirSource === 'setting' && this.modelsDir ? { models_dir: this.modelsDir } : {}), unlock_changed_at: prev.unlock_changed_at ?? new Date().toISOString() });
  }
  /** Choose where models are installed (only when not fixed by the environment). */
  setModelsDir(dir: string) {
    if (this.modelsDirSource === 'env' || this.modelsDirSource === 'config') throw Object.assign(new Error('The models folder is fixed by the launcher (INFLUENCER_STUDIO_MODELS_DIR).'), { status: 409, code: 'models_dir_fixed' });
    const d = path.resolve(dir);
    if (!path.isAbsolute(dir) || dir.includes('\0') || d === path.parse(d).root) throw Object.assign(new Error('Enter a full folder path, not a drive root.'), { status: 400, code: 'bad_models_dir' });
    fs.mkdirSync(d, { recursive: true });
    this.modelsDir = d; this.modelsDirSource = 'setting'; this.persistSettings();
  }
  checkCtx(profile: HardwareProfile, comfyOnline: boolean): CheckCtx {
    return { profile, limits: this.limits, registry: this.registry, settings: this.settings, installed: this.installed, templates: new Map([...this.templates].map(([k, v]) => [k, v.manifest])), comfyOnline, comfyUrl: this.comfy.baseUrl, mockGenerator: this.mock, custom: this.custom, sdk: this.engine === 'sdk' ? { online: this.sdkOnline, note: this.sdkNote } : undefined };
  }
  async check(facts: JobFacts) { return checkJob(facts, this.checkCtx(await this.effectiveHardware(), await this.comfyHealth())); }
  /** Sync re-check at job start using cached hardware. */
  private recheck(j: Job) {
    if (!this.profile) return null;
    const r = checkJob({ template: j.template, variantId: j.variantId, width: j.width, height: j.height, frames: j.frames, refs: j.styleRef || j.edit || j.video ? 1 : 0, batch: j.batch, steps: j.steps }, this.checkCtx(this.custom?.enabled ? customProfile(this.profile.p, this.custom, this.limits) : this.profile.p, this.comfyOnline || this.mock));
    return r.ok ? null : (r.httpStatus === 403 ? r.soft : r.hard.length && !r.hard.every(x => x.code === 'COMFY_OFFLINE' || x.code === 'SDK_PROXY_OFFLINE') ? r.hard : null);
  }

  bestVariant(modelId: string, profile: HardwareProfile) { return bestFit(modelId, this.registry, profile, this.limits, this.installed); }

  // ---- saved character library (plan 14: saved library) ----
  library(): { id: string; name: string; character: Record<string, unknown>; seed: number; savedAt: string; refImage?: string }[] {
    return readJsonSafe<{ items: never[] }>(this.libraryFile, { items: [] }).items;
  }
  saveLibrary(items: unknown[]) { writeJsonAtomic(this.libraryFile, { schemaVersion: 1, items }); }

  private runner: Runner = async (job, ctx) => {
    const tpl = this.templates.get(job.template);
    if (!tpl) throw new Error('Template not found');
    if (job.mock) {
      for (let i = 1; i <= 5; i++) { if (ctx.cancelled()) return []; ctx.update(i * 18, 'Mock generator'); await new Promise(r => setTimeout(r, 350)); }
      const outs = [];
      for (let b = 0; b < job.batch; b++) outs.push(ctx.saveOutput(`mock_${b}.svg`, mockImageSvg({ width: job.width, height: job.height, seed: job.seed + b, label: job.label, prompt: job.prompt }), 'image/svg+xml'));
      return outs;
    }
    const values: Record<string, string | number> = { seed: job.seed, prefix: tpl.manifest.kind === 'video' ? 'video/influencer_studio' : 'influencer_studio' };
    const has = (k: string) => k in tpl.manifest.params;
    if (has('width')) { values.width = job.width; values.height = job.height; }
    if (has('batch')) values.batch = job.batch;
    if (has('length') && job.frames) values.length = job.frames;
    if (has('negative')) values.negative = VIDEO_NEGATIVE;
    if (job.steps) values.steps = job.steps;
    values.prompt = job.prompt;
    let sdkRef: { placeholder: string; bytes: Buffer; filename: string; mime: string } | undefined;
    const refId = job.styleRef ?? (job.edit as EditRequest | undefined)?.refId ?? (job.video as { refId?: string } | undefined)?.refId;
    if (refId) {
      const ref = this.refs.get(refId);
      if (!ref) throw new Error(job.edit || job.video ? 'The saved picture is no longer available. Save the character again from a new picture.' : 'The style reference image is no longer available. Remove it and add it again.');
      if (!has('image')) throw new Error('This template does not take a reference image');
      ctx.update(3, 'Sending your reference image');
      if (this.engine === 'sdk') { values.image = REF_PLACEHOLDER; sdkRef = { placeholder: REF_PLACEHOLDER, bytes: fs.readFileSync(ref.file), filename: `is_ref_${refId.replace(/-/g, '').slice(0, 24)}.${ref.info.ext}`, mime: ref.info.mime }; }
      else values.image = await this.comfy.uploadImage(`is_ref_${refId.replace(/-/g, '').slice(0, 24)}.${ref.info.ext}`, fs.readFileSync(ref.file), ref.info.mime);
      if (job.styleRef) values.prompt = STYLE_REF_PREFIX + job.prompt;
    }
    const wf = fillTemplate(tpl, values);
    if (this.engine === 'sdk') {
      if (!this.sdk) throw new Error('The Comfy SDK proxy (comfy-api-proxy) is not running' + (this.sdkNote ? `: ${this.sdkNote}` : '') + '.');
      const outs = await this.sdk.run(wf, { ref: sdkRef, cancelled: ctx.cancelled, onProgress: (p, m) => ctx.update(p, m) });
      if (ctx.cancelled()) return [];
      if (!outs.length) throw new Error('ComfyUI finished but returned no images or video');
      return outs.map((o, n) => { const f = outputFileName(o, n); return ctx.saveOutput(f.file, o.bytes, f.mime); });
    }
    ctx.update(4, 'Sending to ComfyUI');
    const clientId = crypto.randomUUID();
    const prog = new ComfyProgress(this.comfy.baseUrl, clientId, this.allowRemote);
    const wsOk = await prog.connect();
    const tracker = new ProgressTracker(wf); tracker.stepsHint = job.steps ?? tpl.manifest.params.steps?.default as number ?? 4;
    let id: string | undefined; let wsError: string | undefined; let sawWs = false;
    const unwatch = wsOk ? prog.watch(() => id, m => {
      sawWs = true;
      if (m.type === 'execution_error') { wsError = m.message; return; }
      const r = tracker.feed(m); if (r) ctx.update(r.percent, r.message);
    }) : () => {};
    try {
      id = await this.comfy.submit(wf, clientId);
      const t0 = Date.now();
      for (;;) {
        if (ctx.cancelled()) { await this.comfy.cancel(id, true); return []; }
        if (wsError) throw new Error('ComfyUI reported an error while running the job: ' + wsError);
        await new Promise(r => setTimeout(r, wsOk ? 400 : 800));
        const s = await this.comfy.poll(id);
        if (s.state === 'done') {
          const outs = [];
          let n = 0;
          for (const img of s.images) { const buf = await this.comfy.fetchImage(img); const vid = /\.mp4$/i.test(img.filename); outs.push(vid ? ctx.saveOutput(`vid_${n++}.mp4`, buf, 'video/mp4') : ctx.saveOutput(`img_${n++}.png`, buf, 'image/png')); }
          if (!outs.length) throw new Error('ComfyUI finished but returned no images or video');
          return outs;
        }
        // Without live messages (socket failed or no events yet) fall back to a coarse time-based estimate.
        if (!sawWs) ctx.update(s.state === 'running' ? 30 + Math.min(60, (Date.now() - t0) / 1000 * 6) : 8, s.state === 'running' ? 'Generating' : 'Waiting in the ComfyUI queue');
        if (Date.now() - t0 > 30 * 60_000) throw new Error('Timed out waiting for ComfyUI');
      }
    } finally { unwatch(); prog.close(); }
  };
}

const REF_PLACEHOLDER = '__influencer_studio_ref_image__';
export const STYLE_REF_PREFIX = "Use the reference photo for the person's identity, face and overall look, and create a new photo of: ";

export const JobRequestSchema = z.object({
  character: z.record(z.unknown()),
  seed: z.number().int().min(0).max(4294967295).optional(),
  variantId: z.string().regex(/^[a-z0-9._-]{1,60}$/).optional(),
  template: z.string().regex(/^[a-z0-9_]{1,40}$/).optional(),
  width: z.number().int().min(256).max(4096).multipleOf(16).optional(),
  height: z.number().int().min(256).max(4096).multipleOf(16).optional(),
  batch: z.number().int().min(1).max(4).optional(),
  steps: z.number().int().min(1).max(12).optional(),
  refs: z.number().int().min(0).max(8).optional(),
  styleRef: z.string().regex(/^[0-9a-f-]{36}$/).optional(),
  edit: EditSchema.optional(),
  video: VideoSchema.optional(),
}).strict();
