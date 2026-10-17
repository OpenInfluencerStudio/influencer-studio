import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { repoRoot } from './paths.js';

const FileSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9._-]+$/), folder: z.string().regex(/^[a-z_]+$/), sizeBytes: z.number().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(), source: z.string().url().startsWith('https://huggingface.co/'),
}).strict();
const VariantSchema = z.object({
  id: z.string(), modelId: z.string(), label: z.string(), format: z.string(), sizeGb: z.number().positive(), license: z.string(),
  qualityRank: z.number(), minVramGb: z.number(), recommendedVramGb: z.number(), minRamGb: z.number(), recommendedRamGb: z.number(),
  minDiskGb: z.number(), template: z.string(), templates: z.array(z.string()).optional(), measured: z.record(z.unknown()).optional(), est: z.boolean(), files: z.array(FileSchema).min(1), requiresNodes: z.array(z.string()).optional(),
}).strict();
const ModelSchema = z.object({
  id: z.string(), name: z.string(), kind: z.enum(['image', 'image-edit', 'video', 'audio']), modes: z.array(z.string()), license: z.string(), sfw: z.literal(true),
}).strict();
export const RegistrySchema = z.object({
  schemaVersion: z.literal(2), note: z.string(), licenseAllowList: z.array(z.string()),
  models: z.array(ModelSchema), variants: z.array(VariantSchema), loras: z.array(z.unknown()),
}).strict();
export type Registry = z.infer<typeof RegistrySchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Model = z.infer<typeof ModelSchema>;

/** Validation also run in CI: licence allow-list, min <= recommended, known model ids. */
export function validateRegistry(r: Registry): string[] {
  const errs: string[] = [];
  const ids = new Set(r.models.map(m => m.id));
  for (const m of r.models) if (!r.licenseAllowList.includes(m.license)) errs.push(`model ${m.id}: licence ${m.license} not allowed`);
  for (const v of r.variants) {
    if (!ids.has(v.modelId)) errs.push(`variant ${v.id}: unknown model ${v.modelId}`);
    if (!r.licenseAllowList.includes(v.license)) errs.push(`variant ${v.id}: licence ${v.license} not allowed`);
    if (v.minVramGb > v.recommendedVramGb) errs.push(`variant ${v.id}: min vram above recommended`);
    if (v.minRamGb > v.recommendedRamGb) errs.push(`variant ${v.id}: min ram above recommended`);
    for (const f of v.files) if (/\.(ckpt|pt|pth|bin|pkl)$/i.test(f.name)) errs.push(`variant ${v.id}: unsafe file type ${f.name}`);
  }
  return errs;
}

export function loadRegistry(file = path.join(repoRoot(), 'models.json')): Registry {
  const r = RegistrySchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
  const errs = validateRegistry(r);
  if (errs.length) throw new Error('models.json invalid: ' + errs.join('; '));
  return r;
}
