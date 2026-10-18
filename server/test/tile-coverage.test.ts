import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pickPreview, type PreviewItem } from '../../ui/src/api.js';
import { CONTROLS, CREATURE_TYPES } from '../src/compiler/schema.js';

const dir = fileURLToPath(new URL('../../assets/previews/', import.meta.url));
const items = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')).items as PreviewItem[];
const map = new Map<string, PreviewItem[]>();
for (const i of items) { const k = i.control + '/' + i.option; map.set(k, [...(map.get(k) ?? []), i]); }
// Colour swatches and intentional text pills are drawn on purpose; "none/average/balanced/unspecified" show the plain base photo.
const BASE_OPT = new Set(['none', 'average', 'balanced', 'unspecified']);
const tiled = CONTROLS.filter(c => !['pill', 'swatch'].includes(c.ui));
const HUMAN_TYPES = ['surprise', 'male', 'female', 'non_binary', 'trans_woman', 'trans_man'];

describe('every option tile is a real photo (no emoji/gradient fallback)', () => {
  it('human types: every option of every tiled control resolves to a shipped webp', () => {
    const missing: string[] = [];
    for (const t of HUMAN_TYPES) for (const c of tiled) for (const o of c.options) {
      if (BASE_OPT.has(o.id)) continue;
      const p = pickPreview(map, c.id, o.id, t, 0);
      if (!p || !existsSync(dir + p.file)) missing.push(`${t}: ${c.id}/${o.id}`);
    }
    expect(missing).toEqual([]);
  });
  it('every hairstyle (silly ones included) has a man, woman and non-binary tile', () => {
    const hair = CONTROLS.find(c => c.id === 'hairStyle')!;
    for (const o of hair.options) for (const look of ['man', 'woman', 'nonbinary']) expect(map.get('hairStyle/' + o.id)?.some(i => i.look === look), `${o.id}/${look}`).toBe(true);
  });
  it('alien, monster and creature types: outfit, accessory and prop options resolve', () => {
    const missing: string[] = [];
    for (const t of ['alien', 'monster', ...CREATURE_TYPES]) for (const c of tiled.filter(c => ['outfit', 'accessory', 'prop'].includes(c.id))) for (const o of c.options) {
      if (BASE_OPT.has(o.id)) continue;
      const p = pickPreview(map, c.id, o.id, t, 0); if (!p || !existsSync(dir + p.file)) missing.push(`${t}: ${c.id}/${o.id}`);
    }
    expect(missing).toEqual([]);
  });
});
