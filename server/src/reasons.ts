/** Single source of truth for lock reason copy (plan 21.5). Real numbers always shown. */
export type ReasonCode =
  | 'VRAM_LOW' | 'RAM_LOW' | 'RES_CAP' | 'FRAMES_CAP' | 'REFS_CAP' | 'CUSTOM_CAP' | 'DISK_LOW_SOFT'
  | 'NO_GPU' | 'FILE_MISSING' | 'DISK_LOW' | 'COMFY_OFFLINE' | 'SDK_PROXY_OFFLINE' | 'TEMPLATE_NOT_ALLOWED' | 'UNKNOWN_VARIANT' | 'MODE_UNSUPPORTED';
export interface Reason { code: ReasonCode; hard: boolean; text: string }

const HARD: ReasonCode[] = ['NO_GPU', 'FILE_MISSING', 'DISK_LOW', 'COMFY_OFFLINE', 'SDK_PROXY_OFFLINE', 'TEMPLATE_NOT_ALLOWED', 'UNKNOWN_VARIANT', 'MODE_UNSUPPORTED'];
export function reason(code: ReasonCode, text: string): Reason { return { code, hard: HARD.includes(code), text }; }

export const R = {
  vram: (need: number, have: number | null) => reason('VRAM_LOW', `Needs ${need} GB VRAM (you have ${have ?? 0} GB)`),
  ram: (need: number, have: number) => reason('RAM_LOW', `Needs ${need} GB RAM (you have ${have} GB)`),
  res: (px: number, cap: number, tier: string) => reason('RES_CAP', `${px} px is above the ${cap} px limit for your hardware level (${tier})`),
  custom: (t: string) => reason('CUSTOM_CAP', `Your Custom setting: ${t}`),
  frames: (n: number, cap: number, tier: string) => reason('FRAMES_CAP', `${n} frames is above the ${cap} frame limit for hardware level ${tier}`),
  refs: (n: number, cap: number, tier: string) => reason('REFS_CAP', `${n} reference images is above the limit of ${cap} for hardware level ${tier}`),
  noGpu: () => reason('NO_GPU', 'No usable GPU was found, so generation is not available. The builder still works.'),
  file: (name: string) => reason('FILE_MISSING', `Model file missing: ${name}. Install it from the Models screen.`),
  disk: (have: number, min: number) => reason('DISK_LOW', `Only ${have} GB free disk (minimum ${min} GB)`),
  diskSoft: (have: number, need: number) => reason('DISK_LOW_SOFT', `Needs ${need} GB free disk (you have ${have} GB)`),
  comfy: (url: string) => reason('COMFY_OFFLINE', `ComfyUI is not reachable at ${url}`),
  sdkProxy: (note?: string) => reason('SDK_PROXY_OFFLINE', `The Comfy SDK path is not ready${note ? ` (${note})` : ''}. Run the ComfyUI installer in the app folder once, or start comfy-api-proxy yourself.`),
  template: (id: string) => reason('TEMPLATE_NOT_ALLOWED', `Template "${id}" is not one of the bundled templates`),
  variant: (id: string) => reason('UNKNOWN_VARIANT', `Unknown model variant "${id}"`),
  mode: (m: string) => reason('MODE_UNSUPPORTED', `Mode "${m}" is not available in this version`),
};
