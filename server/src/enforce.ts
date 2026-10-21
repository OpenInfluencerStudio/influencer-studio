import type { HardwareProfile } from './hardware.js';
import type { Limits } from './tiers.js';
import type { Registry } from './registry.js';
import { R, Reason } from './reasons.js';
import { variantState, InstalledFn } from './recommend.js';
import type { TemplateManifest } from './workflows.js';
import { customTier, type Custom } from './custom.js';

export interface JobFacts {
  template: string; variantId: string; width: number; height: number; frames?: number; refs: number; batch?: number; steps?: number;
}
export interface Settings { unlock_unsupported: boolean }
export interface CheckResult { ok: boolean; hard: Reason[]; soft: Reason[]; httpStatus: 200 | 403 | 422; code: 'ok' | 'locked_by_hardware' | 'hard_block' }

export interface CheckCtx {
  profile: HardwareProfile; limits: Limits; registry: Registry; settings: Settings; installed: InstalledFn;
  templates: Map<string, TemplateManifest>; comfyOnline: boolean; comfyUrl: string; mockGenerator: boolean; custom?: Custom | null;
  /** Set when jobs go through the Comfy SDK: the local comfy-api-proxy must be up too. */
  sdk?: { online: boolean; note?: string };
}

/** Server-side per-job check on the RESOLVED job facts, independent of the UI (plan 21.5). Pure. */
export function checkJob(job: JobFacts, c: CheckCtx): CheckResult {
  const hard: Reason[] = [];
  const soft: Reason[] = [];
  const tpl = c.templates.get(job.template);
  if (!tpl) hard.push(R.template(job.template));
  const variant = c.registry.variants.find(v => v.id === job.variantId);
  if (!variant) hard.push(R.variant(job.variantId));
  else if (tpl && !tpl.variantIds.includes(variant.id)) hard.push(R.template(job.template));
  if (!c.mockGenerator && !c.comfyOnline) hard.push(R.comfy(c.comfyUrl));
  else if (!c.mockGenerator && c.sdk && !c.sdk.online) hard.push(R.sdkProxy(c.sdk.note));
  if (variant) {
    if (!c.mockGenerator) {
      const vs = variantState(variant, c.profile, c.limits, c.installed);
      for (const r of vs.reasons) (r.hard ? hard : soft).push(r);
    } else if (!c.profile.gpuReadable) {
      /* mock generator: builder/testing without GPU is allowed */
    }
  }
  const baseTier = c.limits.tiers.find(t => t.id === c.profile.tier)!;
  const tier = c.custom?.enabled ? customTier(baseTier, c.custom) : baseTier;
  const longSide = Math.max(job.width, job.height);
  const isVideo = tpl?.kind === 'video';
  const pxCap = isVideo ? tier.maxVideoPx : tier.maxImagePx;
  if (!c.mockGenerator && longSide > pxCap && tier.id !== 'T0') soft.push(R.res(longSide, pxCap, tier.name));
  if (isVideo && job.frames !== undefined && job.frames > tier.maxVideoFrames && tier.id !== 'T0') soft.push(R.frames(job.frames, tier.maxVideoFrames, tier.name));
  if (job.refs > tier.maxRefs && tier.id !== 'T0' && !c.mockGenerator) soft.push(R.refs(job.refs, tier.maxRefs, tier.name));
  if (c.custom?.enabled && !c.mockGenerator) {
    if (job.batch !== undefined && job.batch > c.custom.maxBatch) soft.push(R.custom(`batch of ${job.batch} is above your Custom limit of ${c.custom.maxBatch}`));
    if (job.steps !== undefined && job.steps > c.custom.maxSteps) soft.push(R.custom(`${job.steps} steps is above your Custom limit of ${c.custom.maxSteps}`));
  }
  // Hard limits are never released by the setting.
  if (hard.length) return { ok: false, hard, soft, httpStatus: 422, code: 'hard_block' };
  if (soft.length && !c.settings.unlock_unsupported) return { ok: false, hard, soft, httpStatus: 403, code: 'locked_by_hardware' };
  return { ok: true, hard, soft, httpStatus: 200, code: 'ok' };
}
