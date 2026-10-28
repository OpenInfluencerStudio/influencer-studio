// Pure logic for the Image / Video mode switch and the Video input sub-modes. No DOM access except the guarded storage helpers.
export type Mode = 'image' | 'video';
export type VideoInput = 'i2v' | 'motion' | 'lipsync' | 'audio';
export const MODE_KEY = 'is_mode';
export const INPUT_KEY = 'is_video_input';
export type InputState = { id: VideoInput; label: string; available: boolean; locked: boolean; reason: string };
type Variant = { state: string; installed: boolean | null; reasons?: { text: string }[] };
type Model = { id: string; kind: string; variants: Variant[] };

const usable = (m: Model) => m.variants.some(v => v.state !== 'blocked_hard' && v.installed !== false);
const hwReason = (m: Model) => m.variants.flatMap(v => v.reasons ?? []).map(r => r.text)[0] ?? '';

/** Which video input modes can be used. Motion transfer and Lip-sync appear usable only when an installed model of that kind exists. */
export function videoInputs(models: Model[]): InputState[] {
  const find = (kind: string) => models.filter(m => m.kind === kind);
  const mk = (id: VideoInput, label: string, ms: Model[], soon: string): InputState => {
    if (!ms.length) return { id, label, available: false, locked: true, reason: soon };
    const ok = ms.find(usable);
    if (!ok) return { id, label, available: false, locked: true, reason: hwReason(ms[0]!) || 'Not available on this PC' };
    return { id, label, available: true, locked: false, reason: '' };
  };
  const i2v = mk('i2v', 'Image to video', models.filter(m => m.kind === 'video' || m.id === 'wan22-ti2v-5b'), 'Coming soon');
  const aud = find('audio').length ? { id: 'audio' as VideoInput, label: 'Audio', available: true, locked: false, reason: '' } : { id: 'audio' as VideoInput, label: 'Audio', available: false, locked: true, reason: 'Coming soon' };
  return [i2v, mk('motion', 'Motion transfer', find('motion-transfer'), 'Coming soon'), mk('lipsync', 'Lip-sync', find('lip-sync'), 'Coming soon'), aud];
}
export const parseMode = (v: unknown): Mode => (v === 'video' ? 'video' : 'image');
export const parseInput = (v: unknown): VideoInput => (v === 'motion' || v === 'lipsync' || v === 'audio' ? v : 'i2v');
export function load<T>(key: string, parse: (v: unknown) => T): T { try { return parse(localStorage.getItem(key)); } catch { return parse(null); } }
export function save(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } }
/** Arrow / Home / End navigation for a radio-style group. Returns the next index or null. */
export function navIndex(key: string, i: number, n: number): number | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') return (i + 1) % n;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (i + n - 1) % n;
  if (key === 'Home') return 0; if (key === 'End') return n - 1; return null;
}
