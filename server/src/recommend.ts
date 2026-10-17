import type { HardwareProfile } from './hardware.js';
import type { Limits } from './tiers.js';
import type { Registry, Variant } from './registry.js';
import { R, Reason } from './reasons.js';

export type OptionState = 'recommended' | 'runs' | 'slow' | 'locked_soft' | 'blocked_hard';
export interface VariantState { variantId: string; state: OptionState; reasons: Reason[]; installed: boolean | null }

export type InstalledFn = (v: Variant) => { installed: boolean | null; missing: string[] };

/** Pure: state of one variant on one profile (plan 21.2). */
export function variantState(v: Variant, p: HardwareProfile, limits: Limits, inst: InstalledFn): VariantState {
  const reasons: Reason[] = [];
  const gi = inst(v);
  if (!p.gpuReadable && p.source !== 'override') {
    // Unknown GPU is not a hard block when judged from a fixture without any GPU; T0 = impossible (plan 21.1).
    reasons.push(R.noGpu());
  }
  if (p.gpuReadable || p.source === 'override') {
    const vram = p.vramGb ?? 0;
    if (vram + limits.tolerance_gb < v.minVramGb) reasons.push(R.vram(v.minVramGb, p.vramGb));
  }
  if (p.ramGb < v.minRamGb * limits.ramHeadroom) reasons.push(R.ram(v.minRamGb, p.ramGb));
  if (p.freeDiskGb !== null && p.freeDiskGb < v.minDiskGb && p.freeDiskGb >= limits.minFreeDiskGbHard) reasons.push(R.diskSoft(p.freeDiskGb, v.minDiskGb));
  if (p.freeDiskGb !== null && p.freeDiskGb < limits.minFreeDiskGbHard) reasons.push(R.disk(p.freeDiskGb, limits.minFreeDiskGbHard));
  if (gi.installed === false) for (const m of gi.missing) reasons.push(R.file(m));
  const hard = reasons.some(r => r.hard);
  const soft = reasons.some(r => !r.hard);
  let state: OptionState;
  if (hard) state = 'blocked_hard';
  else if (soft) state = 'locked_soft';
  else {
    const vram = p.vramGb ?? 0;
    const roomy = vram >= v.recommendedVramGb && p.ramGb >= v.recommendedRamGb * limits.ramHeadroom;
    state = roomy ? 'runs' : 'slow';
  }
  return { variantId: v.id, state, reasons, installed: gi.installed };
}

/** Best-fit per model (plan 21.4): highest qualityRank that meets recommended; else highest meeting minimums (slow). Installed preferred within one rank. */
export function bestFit(modelId: string, reg: Registry, p: HardwareProfile, limits: Limits, inst: InstalledFn): { variantId: string | null; states: VariantState[] } {
  const vs = reg.variants.filter(v => v.modelId === modelId);
  const states = vs.map(v => variantState(v, p, limits, inst));
  const usable = vs.map((v, i) => ({ v, s: states[i] })).filter(x => x.s.state === 'runs' || x.s.state === 'slow' || (x.s.state === 'blocked_hard' && x.s.reasons.every(r => r.code === 'FILE_MISSING')));
  const pool = usable.filter(x => x.s.state !== 'blocked_hard');
  const best = (pool.length ? pool : []).sort((a, b) => {
    const ra = a.s.state === 'runs' ? 1 : 0, rb = b.s.state === 'runs' ? 1 : 0;
    if (ra !== rb) return rb - ra;
    if (b.v.qualityRank !== a.v.qualityRank) return b.v.qualityRank - a.v.qualityRank;
    return a.v.sizeGb - b.v.sizeGb;
  })[0];
  // mark recommended
  if (best) { const st = states.find(s => s.variantId === best.v.id)!; if (st.state === 'runs') st.state = 'recommended'; }
  return { variantId: best ? best.v.id : null, states };
}
