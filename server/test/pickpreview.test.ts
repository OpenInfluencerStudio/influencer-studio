import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pickPreview, LOOK_FOR_TYPE, type PreviewItem } from '../../ui/src/api.js';

const m = JSON.parse(readFileSync(fileURLToPath(new URL('../../assets/previews/manifest.json', import.meta.url)), 'utf8')).items as PreviewItem[];
const map = new Map<string, PreviewItem[]>();
for (const i of m) { const k = i.control + '/' + i.option; map.set(k, [...(map.get(k) ?? []), i]); }
const HUMAN = ['surprise', 'male', 'female', 'non_binary', 'trans_woman', 'trans_man'];
const CONTROLS = ['outfit', 'accessory', 'prop', 'shoes', 'proportions', 'bodySize', 'hairStyle', 'height'];

describe('tile mapping per type', () => {
  it('human types and Surprise me never get a creature, alien or monster tile', () => {
    for (const t of HUMAN) for (const [k] of map) {
      const [c, o] = k.split('/'); if (!CONTROLS.includes(c)) continue;
      for (let idx = 0; idx < 4; idx++) { const p = pickPreview(map, c, o, t, idx); if (p) expect(['man', 'woman', 'nonbinary'], `${t} ${k} -> ${p.file}`).toContain(p.look); }
    }
  });
  it('each creature type, alien and monster get their own tiles where they exist', () => {
    for (const [t, look] of Object.entries(LOOK_FOR_TYPE)) {
      if (!look.startsWith('creature_') && look !== 'alien' && look !== 'monster') continue;
      for (const [k, items] of map) {
        const [c] = k.split('/'); if (!['outfit', 'accessory', 'prop'].includes(c)) continue;
        const own = items.find(i => i.look === look); if (!own) continue;
        expect(pickPreview(map, c, k.split('/')[1], t, 0)?.file, `${t} ${k}`).toBe(own.file);
      }
    }
  });
  it('every creature type has outfit tiles of its own', () => {
    for (const look of Object.values(LOOK_FOR_TYPE).filter(l => l.startsWith('creature_'))) expect(m.filter(i => i.control === 'outfit' && i.look === look).length, look).toBeGreaterThan(20);
  });
});
