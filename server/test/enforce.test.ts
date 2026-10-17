import { describe, it, expect } from 'vitest';
import { loadLimits } from '../src/tiers.js';
import { loadRegistry } from '../src/registry.js';
import { loadTemplates, fillTemplate } from '../src/workflows.js';
import { buildProfile } from '../src/hardware.js';
import { checkJob, CheckCtx, JobFacts } from '../src/enforce.js';
import { bestFit, variantState } from '../src/recommend.js';

const limits = loadLimits(); const registry = loadRegistry(); const templates = loadTemplates();
const manifests = new Map([...templates].map(([k, v]) => [k, v.manifest]));
const prof = (vram: number | null, ram = 32, disk: number | null = 500) => buildProfile({ gpus: vram ? [{ index: 0, name: 'Test GPU', vramGb: vram }] : [], ramGb: ram, freeDiskGb: disk, source: 'fixture' }, limits);
const ctx = (p: ReturnType<typeof prof>, o: Partial<CheckCtx> = {}): CheckCtx => ({ profile: p, limits, registry, settings: { unlock_unsupported: false }, installed: () => ({ installed: true, missing: [] }), templates: manifests, comfyOnline: true, comfyUrl: 'http://127.0.0.1:8288', mockGenerator: false, ...o });
const job = (o: Partial<JobFacts> = {}): JobFacts => ({ template: 'klein_t2i', variantId: 'flux2-klein-4b-bf16', width: 768, height: 1024, refs: 0, ...o });
const unlock = { unlock_unsupported: true };

describe('checkJob enforcement matrix (plan 21.5/21.6)', () => {
  it('fits: 16 GB runs a 1024 job', () => expect(checkJob(job(), ctx(prof(16))).httpStatus).toBe(200));
  it('soft over (VRAM): 6 GB is locked, then allowed once unlocked and tagged', () => {
    const off = checkJob(job(), ctx(prof(6))); expect(off.httpStatus).toBe(403); expect(off.code).toBe('locked_by_hardware');
    expect(off.soft[0].text).toBe('Needs 8 GB VRAM (you have 6 GB)');
    const on = checkJob(job(), ctx(prof(6), { settings: unlock })); expect(on.ok).toBe(true); expect(on.soft.length).toBeGreaterThan(0);
  });
  it('soft over (resolution cap) with real numbers', () => {
    const r = checkJob(job({ width: 3072, height: 4096 }), ctx(prof(16)));
    expect(r.httpStatus).toBe(403); expect(r.soft.map(x => x.text).join()).toMatch(/4096 px is above the 1536 px limit/);
    expect(checkJob(job({ width: 3072, height: 4096 }), ctx(prof(16), { settings: unlock })).ok).toBe(true);
    expect(checkJob(job({ width: 3072, height: 4096 }), ctx(prof(96))).ok).toBe(true);
  });
  it('RAM-limited 16 GB card: soft lock', () => {
    const r = checkJob(job({ variantId: 'qwen-image-edit-2511-q4km', template: 'klein_t2i' }), ctx(prof(16, 16)));
    expect(r.ok).toBe(false);
  });
  it('hard blocks stay blocked even with the setting ON (plan 21.6.5)', () => {
    const c = (p: Partial<CheckCtx>, p2 = prof(16)) => checkJob(job(), ctx(p2, { settings: unlock, ...p }));
    expect(c({}, prof(null)).httpStatus).toBe(422);                                    // no GPU
    expect(c({ installed: () => ({ installed: false, missing: ['flux-2-klein-4b.safetensors'] }) }).hard[0].code).toBe('FILE_MISSING');
    expect(c({}, prof(16, 32, 0.5)).hard[0].code).toBe('DISK_LOW');
    expect(c({ comfyOnline: false }).hard[0].code).toBe('COMFY_OFFLINE');
    expect(checkJob(job({ template: 'heavy' }), ctx(prof(16), { settings: unlock })).hard[0].code).toBe('TEMPLATE_NOT_ALLOWED');
    expect(checkJob(job({ variantId: 'nope' }), ctx(prof(16), { settings: unlock })).hard[0].code).toBe('UNKNOWN_VARIANT');
  });
  it('mock generator skips GPU checks so the builder can be demoed without a GPU, nothing else', () => {
    expect(checkJob(job(), ctx(prof(null), { mockGenerator: true, comfyOnline: false })).ok).toBe(true);
    expect(checkJob(job({ template: 'heavy' }), ctx(prof(null), { mockGenerator: true })).httpStatus).toBe(422);
  });
  it('variant not belonging to the template is refused (template swap bypass)', () => {
    expect(checkJob(job({ variantId: 'wan22-ti2v-5b-fp16' }), ctx(prof(96))).hard[0].code).toBe('TEMPLATE_NOT_ALLOWED');
  });
});

describe('recommender states and best fit', () => {
  const inst = () => ({ installed: true, missing: [] as string[] });
  const v = registry.variants.find(x => x.id === 'flux2-klein-4b-bf16')!;
  it('boundaries 7.9/8, 11.9/12', () => {
    expect(variantState(v, prof(7.4), limits, inst).state).toBe('locked_soft');
    expect(variantState(v, prof(7.6), limits, inst).state).toBe('slow');   // within tolerance, below recommended
    expect(variantState(v, prof(12, 32), limits, inst).state).toBe('runs');
  });
  it('best fit marks Recommended; locked models have no best fit', () => {
    expect(bestFit('flux2-klein-4b', registry, prof(16), limits, inst).variantId).toBe('flux2-klein-4b-bf16');
    expect(bestFit('flux2-klein-4b', registry, prof(16), limits, inst).states[0].state).toBe('recommended');
    expect(bestFit('qwen-image-edit-2511', registry, prof(8), limits, inst).variantId).toBeNull();
    expect(bestFit('qwen-image-edit-2511', registry, prof(8), limits, inst).states[0].reasons[0].text).toBe('Needs 12 GB VRAM (you have 8 GB)');
  });
  it('RAM and disk demote or lock with numbers', () => {
    expect(variantState(v, prof(16, 8), limits, inst).reasons[0].text).toBe('Needs 16 GB RAM (you have 8 GB)');
    expect(variantState(v, prof(16, 32, 10), limits, inst).reasons[0].text).toBe('Needs 20 GB free disk (you have 10 GB)');
  });
});

describe('template sandbox', () => {
  const t = templates.get('klein_t2i')!;
  it('fills only named slots', () => {
    const wf = fillTemplate(t, { prompt: 'hello', width: 768, height: 1024, seed: 5 });
    expect(wf['4'].inputs.text).toBe('hello'); expect(wf['6'].inputs.width).toBe(768); expect(wf['7'].inputs.seed).toBe(5);
    expect(wf['1'].inputs.unet_name).toBe('flux-2-klein-4b.safetensors');
    expect(t.workflow['4'].inputs.text).not.toBe('hello'); // template not mutated
  });
  it('rejects unknown params, bad types, out of range, bad multiples, long text, bad prefix', () => {
    for (const bad of [{ unet_name: 'x' }, { width: '768' }, { width: 99999 }, { width: 770 }, { seed: -1 }, { prompt: 'x'.repeat(2001) }, { prefix: '../etc' }, { batch: 9 }])
      expect(() => fillTemplate(t, bad as never), JSON.stringify(bad)).toThrow();
  });
});
