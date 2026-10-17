import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { repoRoot } from './paths.js';

const TierRow = z.object({
  id: z.string().regex(/^T[0-9]$/), name: z.string().min(1).max(20), minVramGb: z.number(), label: z.string(),
  maxImagePx: z.number(), maxVideoPx: z.number(), maxVideoFrames: z.number(), maxRefs: z.number(), estimated: z.boolean(),
}).strict();
export const LimitsSchema = z.object({
  schemaVersion: z.literal(1), note: z.string(), tiers: z.array(TierRow).min(2),
  tolerance_gb: z.number(), minFreeDiskGbHard: z.number(), warnFreeDiskGb: z.number(), ramHeadroom: z.number(),
}).strict();
export type Limits = z.infer<typeof LimitsSchema>;
export type TierRow = z.infer<typeof TierRow>;

export function loadLimits(file = path.join(repoRoot(), 'data', 'limits.json')): Limits {
  return LimitsSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

/** Tier from REPORTED VRAM, rounded down to the nearest boundary with a small tolerance (plan 15.3 / 17.2). */
export function tierForVram(vramGb: number | null, limits: Limits): TierRow {
  const rows = limits.tiers;
  if (vramGb === null || vramGb <= 0) return rows[0];
  let pick = rows[1];
  for (const r of rows) if (r.id !== 'T0' && vramGb + limits.tolerance_gb >= r.minVramGb) pick = r;
  return pick;
}
