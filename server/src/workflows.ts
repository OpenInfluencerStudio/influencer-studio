import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { repoRoot } from './paths.js';

const ParamSchema = z.object({
  node: z.string().regex(/^[0-9]+$/), input: z.string().regex(/^[A-Za-z0-9_]+$/), type: z.enum(['string', 'int', 'float']),
  min: z.number().optional(), max: z.number().optional(), multipleOf: z.number().optional(), maxLength: z.number().optional(),
  pattern: z.string().optional(), default: z.union([z.string(), z.number()]).optional(), axis: z.enum(['width', 'height']).optional(),
}).strict();
export const ManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/), label: z.string(), mode: z.string(), kind: z.enum(['image', 'video']),
  variantIds: z.array(z.string()).min(1), allowedClassTypes: z.array(z.string()).min(1), params: z.record(ParamSchema),
}).strict();
export type TemplateManifest = z.infer<typeof ManifestSchema>;
export type ApiWorkflow = Record<string, { class_type: string; inputs: Record<string, unknown> }>;
export interface Template { manifest: TemplateManifest; workflow: ApiWorkflow }

export function loadTemplates(dir = path.join(repoRoot(), 'workflows')): Map<string, Template> {
  const out = new Map<string, Template>();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.manifest.json')) continue;
    const manifest = ManifestSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    const wfFile = path.join(dir, manifest.id + '.json');
    const workflow = JSON.parse(fs.readFileSync(wfFile, 'utf8')) as ApiWorkflow;
    // Sandbox: every node class must be on the manifest allow-list; every param slot must exist.
    for (const [id, n] of Object.entries(workflow)) if (!manifest.allowedClassTypes.includes(n.class_type)) throw new Error(`template ${manifest.id}: node ${id} class ${n.class_type} not allowed`);
    for (const [name, p] of Object.entries(manifest.params)) if (!workflow[p.node] || !(p.input in workflow[p.node].inputs)) throw new Error(`template ${manifest.id}: param ${name} points to a missing slot`);
    out.set(manifest.id, { manifest, workflow });
  }
  return out;
}

/** Fill named slots only. Unknown params and out-of-range values are rejected; nothing else in the graph can change. */
export function fillTemplate(t: Template, values: Record<string, string | number>): ApiWorkflow {
  const wf: ApiWorkflow = JSON.parse(JSON.stringify(t.workflow));
  for (const k of Object.keys(values)) if (!(k in t.manifest.params)) throw new Error(`Unknown parameter "${k}"`);
  for (const [name, p] of Object.entries(t.manifest.params)) {
    let v = values[name] ?? p.default;
    if (v === undefined) continue; // keep the template's own value
    if (p.type === 'float') {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Parameter ${name} must be a number`);
      if ((p.min !== undefined && v < p.min) || (p.max !== undefined && v > p.max)) throw new Error(`Parameter ${name} out of range`);
    } else if (p.type === 'int') {
      if (typeof v !== 'number' || !Number.isInteger(v)) throw new Error(`Parameter ${name} must be an integer`);
      if ((p.min !== undefined && v < p.min) || (p.max !== undefined && v > p.max)) throw new Error(`Parameter ${name} out of range`);
      if (p.multipleOf && v % p.multipleOf !== 0) throw new Error(`Parameter ${name} must be a multiple of ${p.multipleOf}`);
    } else {
      if (typeof v !== 'string') throw new Error(`Parameter ${name} must be text`);
      if (p.maxLength && v.length > p.maxLength) throw new Error(`Parameter ${name} too long`);
      if (p.pattern && !new RegExp(p.pattern).test(v)) throw new Error(`Parameter ${name} has an invalid format`);
    }
    wf[p.node].inputs[p.input] = v;
  }
  return wf;
}
