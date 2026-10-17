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
import { ComfyClient } from './comfy.js';
import { JobQueue, Job, Runner } from './queue.js';
import { mockImageSvg } from './mock.js';
import { writeJsonAtomic, readJsonSafe } from './store.js';
import { dataDir as defaultDataDir } from './paths.js';

export interface Config {
  dataDir?: string; comfyUrl?: string; mock?: boolean; modelsDir?: string; allowRemoteComfy?: boolean;
  exec?: Exec; hardwareOverride?: HardwareProfile; limitsFile?: string; registryFile?: string; workflowsDir?: string;
}

export class Services {
  limits: Limits; registry: Registry; templates: Map<string, Template>;
  dataDir: string; comfy: ComfyClient; mock: boolean; modelsDir?: string;
  settings: Settings = { unlock_unsupported: false };
  queue: JobQueue;
  private profile?: { p: HardwareProfile; at: number };
  private comfyOnline = false; private comfyAt = 0;
  private settingsFile: string; private libraryFile: string;

  constructor(private cfg: Config = {}) {
    this.dataDir = cfg.dataDir ?? defaultDataDir();
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.limits = loadLimits(cfg.limitsFile); this.registry = loadRegistry(cfg.registryFile); this.templates = loadTemplates(cfg.workflowsDir);
    this.comfy = new ComfyClient({ baseUrl: cfg.comfyUrl ?? process.env.COMFYUI_URL ?? 'http://127.0.0.1:8288', allowRemote: cfg.allowRemoteComfy });
    this.mock = cfg.mock ?? process.env.INFLUENCER_STUDIO_MOCK === '1';
    this.modelsDir = cfg.modelsDir ?? process.env.INFLUENCER_STUDIO_MODELS_DIR;
    this.settingsFile = path.join(this.dataDir, 'settings.json');
    this.libraryFile = path.join(this.dataDir, 'library.json');
    // Settings live in memory after load; a file edit while running only takes effect after restart (plan 21.6c).
    const s = readJsonSafe<{ unlock_unsupported?: unknown }>(this.settingsFile, {});
    this.settings = { unlock_unsupported: s.unlock_unsupported === true };
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
  async comfyHealth(): Promise<boolean> {
    if (Date.now() - this.comfyAt > 5000) { this.comfyOnline = (await this.comfy.health()).online; this.comfyAt = Date.now(); }
    return this.comfyOnline;
  }
  saveSettings(next: Settings) {
    this.settings = { unlock_unsupported: next.unlock_unsupported === true };
    writeJsonAtomic(this.settingsFile, { schemaVersion: 1, ...this.settings, unlock_changed_at: new Date().toISOString() });
  }
  checkCtx(profile: HardwareProfile, comfyOnline: boolean): CheckCtx {
    return { profile, limits: this.limits, registry: this.registry, settings: this.settings, installed: this.installed, templates: new Map([...this.templates].map(([k, v]) => [k, v.manifest])), comfyOnline, comfyUrl: this.comfy.baseUrl, mockGenerator: this.mock };
  }
  async check(facts: JobFacts) { return checkJob(facts, this.checkCtx(await this.hardware(), await this.comfyHealth())); }
  /** Sync re-check at job start using cached hardware. */
  private recheck(j: Job) {
    if (!this.profile) return null;
    const r = checkJob({ template: j.template, variantId: j.variantId, width: j.width, height: j.height, refs: 0 }, this.checkCtx(this.profile.p, this.comfyOnline || this.mock));
    return r.ok ? null : (r.httpStatus === 403 ? r.soft : r.hard.length && !r.hard.every(x => x.code === 'COMFY_OFFLINE') ? r.hard : null);
  }

  bestVariant(modelId: string, profile: HardwareProfile) { return bestFit(modelId, this.registry, profile, this.limits, this.installed); }

  // ---- saved character library (plan 14: saved library) ----
  library(): { id: string; name: string; character: Record<string, unknown>; seed: number; savedAt: string }[] {
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
    const values: Record<string, string | number> = { prompt: job.prompt, width: job.width, height: job.height, seed: job.seed, batch: job.batch, prefix: 'influencer_studio' };
    if (job.steps) values.steps = job.steps;
    const wf = fillTemplate(tpl, values);
    ctx.update(4, 'Sending to ComfyUI');
    const id = await this.comfy.submit(wf, crypto.randomUUID());
    const t0 = Date.now();
    for (;;) {
      if (ctx.cancelled()) { await this.comfy.cancel(id, true); return []; }
      await new Promise(r => setTimeout(r, 800));
      const s = await this.comfy.poll(id);
      if (s.state === 'done') {
        const outs = [];
        let n = 0;
        for (const img of s.images) { const buf = await this.comfy.fetchImage(img); outs.push(ctx.saveOutput(`img_${n++}.png`, buf, 'image/png')); }
        if (!outs.length) throw new Error('ComfyUI finished but returned no images');
        return outs;
      }
      ctx.update(s.state === 'running' ? 30 + Math.min(60, (Date.now() - t0) / 1000 * 6) : 8, s.state === 'running' ? 'Generating' : 'Waiting in the ComfyUI queue');
      if (Date.now() - t0 > 30 * 60_000) throw new Error('Timed out waiting for ComfyUI');
    }
  };
}

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
}).strict();
