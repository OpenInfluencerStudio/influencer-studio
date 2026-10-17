import { z } from 'zod';
import type { HardwareProfile } from './hardware.js';
import { buildProfile } from './hardware.js';
import type { Limits, TierRow } from './tiers.js';

/** "Custom" hardware level: numbers typed in by the user, saved as a profile. An explicit user override (like the Advanced unlock): hardware-based soft locks are judged against these numbers. Hard limits (missing files, disk, ComfyUI offline, templates) are never affected. */
export const PRECISIONS = ['auto', 'bf16', 'fp16', 'fp8', 'gguf-q8', 'gguf-q6', 'gguf-q5', 'gguf-q4'] as const;
export const CustomSchema = z.object({
  enabled: z.boolean(),
  name: z.string().trim().min(1).max(40).default('My custom setup'),
  vramGb: z.number().min(1).max(1024),
  ramGb: z.number().min(4).max(4096),
  maxImagePx: z.number().int().min(256).max(16384),
  maxVideoPx: z.number().int().min(256).max(8192),
  maxVideoSeconds: z.number().min(1).max(60),
  maxBatch: z.number().int().min(1).max(64),
  maxRefs: z.number().int().min(1).max(16),
  maxSteps: z.number().int().min(1).max(200),
  precision: z.enum(PRECISIONS),
  comfyUrl: z.string().max(200).optional(),
  allowRemoteComfy: z.boolean().default(false),
  modelsDir: z.string().max(260).optional(),
  notes: z.string().max(300).default(''),
}).strict();
export type Custom = z.infer<typeof CustomSchema>;
export const CUSTOM_DEFAULT: Custom = { enabled: false, name: 'My custom setup', vramGb: 48, ramGb: 128, maxImagePx: 3072, maxVideoPx: 1280, maxVideoSeconds: 10, maxBatch: 8, maxRefs: 5, maxSteps: 60, precision: 'auto', allowRemoteComfy: false, notes: '' };
export const customFrames = (c: Custom) => Math.floor(c.maxVideoSeconds * 24) + 1;

/** Profile the checks use while Custom is on: the typed VRAM and RAM replace what was scanned. Disk stays real. */
export function customProfile(real: HardwareProfile, c: Custom, limits: Limits): HardwareProfile {
  const p = buildProfile({ gpus: [{ index: 0, name: `Custom: ${c.name}`, vramGb: c.vramGb }], ramGb: c.ramGb, freeDiskGb: real.freeDiskGb, os: real.os, source: 'fixture', notes: ['Custom hardware numbers are on. You entered them yourself; they replace the scan.'] }, limits);
  return p;
}
/** Tier row with the Custom caps. The id stays the nearest real row so recommendation logic keeps working. */
export function customTier(base: TierRow, c: Custom): TierRow & { custom: true } {
  return { ...base, name: 'Custom', label: `${c.vramGb} GB (your numbers)`, maxImagePx: c.maxImagePx, maxVideoPx: c.maxVideoPx, maxVideoFrames: customFrames(c), maxRefs: c.maxRefs, estimated: true, custom: true };
}
/** Pick the variant matching the chosen precision when one exists, else keep the recommender's choice. */
export function precisionMatch(format: string, precision: Custom['precision']): boolean {
  if (precision === 'auto') return false;
  const f = format.toLowerCase().replace(/_/g, '-');
  return f === precision || (precision.startsWith('gguf-') && f.startsWith(precision));
}
