import os from 'node:os';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Limits, tierForVram } from './tiers.js';

const pexec = promisify(execFile);

export interface Gpu { index: number; name: string; vramGb: number; driver?: string }
export interface HardwareProfile {
  os: { platform: string; release: string; arch: string };
  gpus: Gpu[];
  selectedGpu: number;
  vramGb: number | null;
  ramGb: number;
  freeDiskGb: number | null;
  tier: string;
  tierLabel: string;
  tierEstimated: boolean;
  gpuReadable: boolean;
  notes: string[];
  scannedAt: string;
  source: 'detected' | 'override' | 'fixture';
}

export type Exec = (cmd: string, args: string[]) => Promise<string>;
const defaultExec: Exec = async (cmd, args) => (await pexec(cmd, args, { timeout: 8000, windowsHide: true })).stdout;

/** Pure parser, tested with fixtures. Output of: nvidia-smi --query-gpu=index,name,memory.total,driver_version --format=csv,noheader,nounits */
export function parseNvidiaSmi(out: string): Gpu[] {
  const gpus: Gpu[] = [];
  for (const line of out.split(/\r?\n/)) {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 3) continue;
    const mib = Number(parts[2]);
    if (!Number.isFinite(mib) || mib <= 0) continue;
    gpus.push({ index: Number(parts[0]) || gpus.length, name: parts[1], vramGb: Math.round((mib / 1024) * 10) / 10, driver: parts[3] });
  }
  return gpus;
}

export async function freeDiskGb(dir: string): Promise<number | null> {
  try {
    const s = await fs.promises.statfs(dir);
    return Math.round(((s.bavail * s.bsize) / 1024 ** 3) * 10) / 10;
  } catch { return null; }
}

export function buildProfile(input: { gpus: Gpu[]; ramGb: number; freeDiskGb: number | null; os?: HardwareProfile['os']; notes?: string[]; source?: HardwareProfile['source']; selectedGpu?: number }, limits: Limits): HardwareProfile {
  const gpus = input.gpus;
  let sel = input.selectedGpu ?? -1;
  if (!gpus.some(g => g.index === sel)) sel = gpus.length ? gpus.reduce((a, b) => (b.vramGb > a.vramGb ? b : a)).index : -1;
  const gpu = gpus.find(g => g.index === sel);
  const vram = gpu ? gpu.vramGb : null;
  const t = tierForVram(vram, limits);
  const notes = [...(input.notes ?? [])];
  if (!gpu) notes.push('No usable GPU was found. The character builder still works; generation is blocked.');
  if (gpus.length > 1) notes.push('Models are not split across GPUs in this version; the largest GPU is used.');
  if (input.freeDiskGb !== null && input.freeDiskGb < limits.warnFreeDiskGb) notes.push(`Low free disk space (${input.freeDiskGb} GB).`);
  return {
    os: input.os ?? { platform: process.platform, release: os.release(), arch: process.arch },
    gpus, selectedGpu: sel, vramGb: vram, ramGb: Math.round(input.ramGb * 10) / 10, freeDiskGb: input.freeDiskGb,
    tier: t.id, tierLabel: t.label, tierEstimated: t.estimated, gpuReadable: gpus.length > 0, notes,
    scannedAt: new Date().toISOString(), source: input.source ?? 'detected',
  };
}

export async function scanHardware(limits: Limits, dataDir: string, exec: Exec = defaultExec): Promise<HardwareProfile> {
  let gpus: Gpu[] = [];
  const notes: string[] = [];
  try {
    const out = await exec('nvidia-smi', ['--query-gpu=index,name,memory.total,driver_version', '--format=csv,noheader,nounits']);
    gpus = parseNvidiaSmi(out);
  } catch {
    notes.push('nvidia-smi was not found or failed. AMD, Apple and Intel GPUs are best-effort and not detected yet.');
  }
  return buildProfile({ gpus, ramGb: os.totalmem() / 1024 ** 3, freeDiskGb: await freeDiskGb(dataDir), notes }, limits);
}
