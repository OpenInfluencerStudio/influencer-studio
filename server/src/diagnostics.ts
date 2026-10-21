/** Version stamp and the built-in diagnostics report. The report is built for people to paste into a GitHub issue, so it never contains
 *  private paths, user names, tokens or prompts. Nothing here is sent anywhere: the app only shows it and lets the user copy it. */
import os from 'node:os';

export const VERSION = '0.2.0-prelaunch';
export const CHANNEL = 'prelaunch';
export const ISSUES_URL = 'https://github.com/OpenInfluencerStudio/influencer-studio/issues/new';

export interface DiagModel { id: string; label: string; variants: { label: string; state: string; installed: boolean; sizeGb: number; license: string }[] }
export interface Diagnostics {
  version: string; channel: string; issuesUrl: string; generatedAt: string;
  runtime: { node: string; platform: string; arch: string; mock: boolean; engine?: string };
  hardware: { os: string; gpus: { name: string; vramGb: number; driver?: string }[]; ramGb: number; freeDiskGb: number | null; tier: string; tierLabel: string; realTier: string; customActive: boolean; notes: string[] };
  comfy: { online: boolean; address: 'loopback' | 'non-loopback'; device?: string; vramTotalGb?: number; vramFreeGb?: number };
  models: DiagModel[]; modelsFolder: 'configured' | 'not set'; report?: string;
}

/** Replace anything that identifies the user or their folders. Longest paths first so nested folders collapse to the right label. */
export function redact(text: string, paths: { value: string | undefined | null; label: string }[] = []): string {
  const all = [...paths, { value: os.homedir(), label: '<home>' }, { value: process.cwd(), label: '<app folder>' }, { value: safeUser(), label: '<user>' }]
    .filter(p => p.value && p.value.length > 2).sort((a, b) => (b.value!.length - a.value!.length));
  let out = text;
  for (const p of all) {
    const v = p.value!; const variants = new Set([v, v.replace(/\\/g, '/'), v.replace(/\//g, '\\')]);
    for (const x of variants) out = out.split(x).join(p.label);
  }
  out = out.replace(/[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\s]+/g, '<home>').replace(/\/(?:home|Users)\/[^/\s]+/g, '<home>');
  out = out.replace(/#t=[A-Za-z0-9_-]{20,}/g, '#t=<token>');
  return out;
}
function safeUser(): string { try { return os.userInfo().username; } catch { return ''; } }

export function makeReport(d: Diagnostics, paths: { value: string | undefined | null; label: string }[] = []): string {
  const g = d.hardware.gpus.map(x => `${x.name} (${x.vramGb} GB${x.driver ? ', driver ' + x.driver : ''})`).join('; ') || 'none found';
  const lines = [
    `Influencer Studio ${d.version} (${d.channel})`, `Generated: ${d.generatedAt}`, '',
    `System: ${d.hardware.os}, Node ${d.runtime.node}`, `GPU: ${g}`, `RAM: ${d.hardware.ramGb} GB, free disk: ${d.hardware.freeDiskGb ?? 'unknown'} GB`,
    `Hardware level: ${d.hardware.tier} (${d.hardware.tierLabel})${d.hardware.customActive ? ` [Custom profile active, detected: ${d.hardware.realTier}]` : ''}`,
    `Generator: ${d.runtime.mock ? 'mock (placeholder images)' : 'ComfyUI'}; ComfyUI ${d.comfy.online ? 'online' : 'offline'} (${d.comfy.address})${d.comfy.device ? ', device ' + d.comfy.device : ''}${d.comfy.vramTotalGb ? `, VRAM ${d.comfy.vramFreeGb ?? '?'} / ${d.comfy.vramTotalGb} GB free` : ''}`,
    ...(d.runtime.engine && !d.runtime.mock ? [`Engine: ${d.runtime.engine}`] : []),
    `Models folder: ${d.modelsFolder}`, '', 'Models:',
    ...d.models.flatMap(m => m.variants.map(v => `- ${m.label} / ${v.label}: ${v.installed ? 'installed' : 'not installed'}, ${v.state}, ${v.sizeGb} GB, ${v.license}`)),
  ];
  if (d.hardware.notes.length) lines.push('', 'Notes:', ...d.hardware.notes.map(n => '- ' + n));
  return redact(lines.join('\n'), paths);
}
