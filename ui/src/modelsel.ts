// Pure logic for choosing which installed model is used per kind (image, image-edit, video). Radio-like per kind, but a kind can also be switched off.
export const SEL_KEY = 'is_models';
type V = { id: string; state: string; installed: boolean | null; reasons?: { text: string }[] };
export type M = { id: string; name?: string; kind: string; bestVariantId: string | null; variants: V[] };
export type Gate = { selectable: boolean; locked: boolean; reason: string };

const bestOf = (m: M) => m.variants.find(v => v.id === m.bestVariantId) ?? m.variants[0]!;
/** Can this row be toggled right now? Hard blocks never; soft locks only with the Advanced unlock. */
export function gate(m: M, unlocked: boolean): Gate {
  const v = bestOf(m); const why = (v.reasons ?? []).map(r => r.text).join('; ');
  if (v.state === 'blocked_hard') return { selectable: false, locked: true, reason: why || 'Not available on this PC' };
  if (v.state === 'locked_soft') return unlocked ? { selectable: true, locked: true, reason: why } : { selectable: false, locked: true, reason: (why || 'Needs more VRAM or RAM than this PC has') + '. Turn on Advanced and unlock unsupported options to use it.' };
  return { selectable: true, locked: false, reason: '' };
}
/** The recommended model of each kind: the first one the hardware recommends, else the first that fits. */
export function defaults(models: M[]): string[] {
  const out: string[] = [];
  for (const k of new Set(models.map(m => m.kind))) {
    const of = models.filter(m => m.kind === k && m.bestVariantId);
    const pick = of.find(m => bestOf(m).state === 'recommended') ?? of.find(m => ['runs', 'slow'].includes(bestOf(m).state));
    if (pick) out.push(pick.id);
  }
  return out;
}
/** Stored choice (null = never touched) resolved against what the hardware allows now. */
export function effective(models: M[], stored: string[] | null, unlocked: boolean): string[] {
  return (stored ?? defaults(models)).filter(id => { const m = models.find(x => x.id === id); return !!m && gate(m, unlocked).selectable; });
}
/** Toggle one model. Turning one on turns the other models of the same kind off. Returns null when the row cannot be toggled. */
export function toggle(models: M[], current: string[], id: string, unlocked: boolean): string[] | null {
  const m = models.find(x => x.id === id); if (!m || !gate(m, unlocked).selectable) return null;
  if (current.includes(id)) return current.filter(x => x !== id);
  return [...current.filter(x => models.find(y => y.id === x)?.kind !== m.kind), id];
}
export type Pick = { variantId?: string; modelName?: string; blocked?: string };
/** Which variant a job of this kind must use. blocked = the user switched this kind off. */
export function pick(models: M[], stored: string[] | null, unlocked: boolean, kind: string): Pick {
  const eff = effective(models, stored, unlocked);
  const m = models.find(x => x.kind === kind && eff.includes(x.id));
  if (m) return { variantId: bestOf(m).id, modelName: m.name };
  const any = models.filter(x => x.kind === kind);
  if (stored !== null && any.some(x => gate(x, unlocked).selectable)) return { blocked: `No ${kind === 'image-edit' ? 'image edit' : kind} model is selected. Tick one on the Hardware screen.` };
  return {};
}
export const parseSel = (v: unknown): string[] | null => { try { const a = JSON.parse(String(v)); return Array.isArray(a) && a.every(x => typeof x === 'string') ? a.slice(0, 20) : null; } catch { return null; } };
