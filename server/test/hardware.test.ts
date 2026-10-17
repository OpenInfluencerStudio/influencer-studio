import { describe, it, expect } from 'vitest';
import { parseNvidiaSmi, buildProfile, scanHardware } from '../src/hardware.js';
import { loadLimits, tierForVram } from '../src/tiers.js';
import { loadRegistry, validateRegistry } from '../src/registry.js';

const limits = loadLimits();
const gpu = (v: number, name = 'GPU') => [{ index: 0, name, vramGb: v }];

describe('tiers (plan 15.3 / 17.2)', () => {
  it('maps reported VRAM to T0..T9 with boundary tolerance', () => {
    const cases: [number | null, string][] = [[null, 'T0'], [0, 'T0'], [1, 'T1'], [6, 'T1'], [7.4, 'T1'], [7.6, 'T2'], [8, 'T2'], [11.9, 'T3'], [12, 'T3'], [15.5, 'T4'], [15.9, 'T4'], [16, 'T4'], [23.6, 'T5'], [24, 'T5'], [31.7, 'T6'], [32, 'T6'], [48, 'T7'], [64, 'T8'], [80, 'T8'], [95.6, 'T9'], [96, 'T9'], [141, 'T9']];
    for (const [v, t] of cases) expect(tierForVram(v, limits).id, String(v)).toBe(t);
  });
  it('RTX PRO 6000 (96 GB) is T9 by reported VRAM, never by name', () => {
    expect(buildProfile({ gpus: gpu(96, 'NVIDIA RTX PRO 6000 Blackwell'), ramGb: 128, freeDiskGb: 1000 }, limits).tier).toBe('T9');
    expect(buildProfile({ gpus: gpu(48, 'NVIDIA RTX PRO 6000 Blackwell'), ramGb: 128, freeDiskGb: 1000 }, limits).tier).toBe('T7');
  });
  it('limits rows are monotonic', () => {
    const t = limits.tiers; for (let i = 1; i < t.length; i++) { expect(t[i].minVramGb).toBeGreaterThan(t[i - 1].minVramGb); expect(t[i].maxImagePx).toBeGreaterThanOrEqual(t[i - 1].maxImagePx); }
  });
});

describe('hardware scan', () => {
  it('parses nvidia-smi output, picks the largest GPU, notes multi-GPU', () => {
    const out = '0, NVIDIA GeForce RTX 5060 Ti, 16311, 570.1\n1, NVIDIA GeForce RTX 3060, 12288, 570.1\n';
    const g = parseNvidiaSmi(out); expect(g.length).toBe(2); expect(g[0].vramGb).toBeCloseTo(15.9, 1);
    const p = buildProfile({ gpus: g, ramGb: 32, freeDiskGb: 600 }, limits);
    expect(p.tier).toBe('T4'); expect(p.selectedGpu).toBe(0); expect(p.notes.join(' ')).toMatch(/not split across GPUs/);
  });
  it('ignores garbage lines', () => { expect(parseNvidiaSmi('hello\n,,\nx, y, z\n')).toEqual([]); });
  it('is graceful with no GPU (nvidia-smi missing)', async () => {
    const p = await scanHardware(limits, '/tmp', async () => { throw new Error('ENOENT'); });
    expect(p.tier).toBe('T0'); expect(p.gpuReadable).toBe(false); expect(p.vramGb).toBeNull(); expect(p.gpus).toEqual([]);
    expect(p.ramGb).toBeGreaterThan(0); expect(p.os.platform).toBeTruthy();
  });
  it('is deterministic for fixed input and warns on low disk', () => {
    const a = buildProfile({ gpus: gpu(16), ramGb: 32, freeDiskGb: 3 }, limits);
    expect(a.notes.join()).toMatch(/Low free disk/);
  });
});

describe('models.json registry', () => {
  it('validates (licences, min <= recommended, safe file types)', () => {
    const r = loadRegistry(); expect(validateRegistry(r)).toEqual([]);
    for (const v of r.variants) for (const f of v.files) { expect(f.name.endsWith('.safetensors') || f.name.endsWith('.gguf')).toBe(true); expect(f.source.startsWith('https://huggingface.co/')).toBe(true); }
  });
  it('rejects a non-allow-listed licence and pickle files', () => {
    const r = loadRegistry(); const bad = JSON.parse(JSON.stringify(r));
    bad.models[0].license = 'CC-BY-NC-4.0'; bad.variants[0].files[0].name = 'x.ckpt';
    expect(validateRegistry(bad).length).toBe(2);
  });
});

describe('tier names', () => {
  it('every tier has a unique readable name, ladder in order', () => {
    const names = limits.tiers.map((t: any) => t.name);
    expect(names).toEqual(['Minimal', 'Basic', 'Standard', 'Enhanced', 'Pro', 'Elite', 'Mega', 'Ultra', 'Extreme', 'Max']);
    expect(new Set(names).size).toBe(names.length);
  });
});
