import { describe, it, expect } from 'vitest';
import { buildThumbManifest, lookForType, RULES, referencePrompt, FRAMINGS, LOOKS } from '../src/thumbs.js';
import { CONTROLS, SIZE_OPTS, TYPE_OPTS, ALIEN_SPECIES, MONSTER_SPECIES } from '../src/compiler/schema.js';
import { assertSafeText } from '../src/safety/index.js';

const items = buildThumbManifest();
describe('thumbnail manifest', () => {
  it('is deterministic with unique keys and files, safe prompts, adult + fully clothed in every prompt', () => {
    expect(buildThumbManifest()).toEqual(items);
    expect(new Set(items.map(i => i.key)).size).toBe(items.length); expect(new Set(items.map(i => i.file)).size).toBe(items.length);
    for (const i of items) {
      expect(() => assertSafeText(i.prompt)).not.toThrow();
      expect(i.prompt.toLowerCase()).toMatch(/adult/); expect(i.prompt.toLowerCase()).toMatch(/clothed|clothes|shirt|covered/);
      expect(i.file).toMatch(/^[A-Za-z0-9_]+\/[A-Za-z0-9_]+\.webp$/); expect(i.seed).toBeGreaterThan(0);
    }
  });
  it('covers every body size for every look, every type tile and every species', () => {
    for (const look of LOOKS) for (const s of SIZE_OPTS) expect(items.some(i => i.control === 'bodySize' && i.option === s.id && i.look === look)).toBe(true);
    for (const t of ['male', 'female', 'non_binary', 'alien', 'monster']) expect(items.some(i => i.control === 'type' && i.option === t)).toBe(true);
    expect(TYPE_OPTS.find(t => t.id === 'trans_woman')).toBeTruthy(); // trans reuses the woman/man tiles, no separate images
    for (const sp of ALIEN_SPECIES) expect(items.some(i => i.control === 'species' && i.option === 'alien_' + sp.id)).toBe(true);
    for (const sp of MONSTER_SPECIES) expect(items.some(i => i.control === 'species' && i.option === 'monster_' + sp.id)).toBe(true);
  });
  it('covers every non-base option of every thumbnail control and never swatch/ethnicity controls', () => {
    for (const c of CONTROLS) {
      const has = items.some(i => i.control === c.id);
      if (RULES[c.id]) { expect(has).toBe(true); for (const o of c.options.filter(o => o.frag !== '' && o.id !== 'none')) expect(items.some(i => i.control === c.id && i.option === o.id), `${c.id}/${o.id}`).toBe(true); }
      else expect(has).toBe(false);
    }
    for (const id of ['ethnicity', 'skinTone', 'hairColor', 'eyeColor']) expect(items.some(i => i.control === id)).toBe(false);
  });
  it('uses framing-specific sizes, human-only controls never use alien/monster looks, and each gendered control has several looks', () => {
    for (const i of items) { expect(i.gen).toEqual(FRAMINGS[i.framing].gen); expect(i.out).toEqual(FRAMINGS[i.framing].out); }
    for (const i of items) if (RULES[i.control]?.humanOnly) expect(['man', 'woman', 'nonbinary']).toContain(i.look);
    expect(new Set(items.filter(i => i.control === 'hairStyle').map(i => i.look)).size).toBe(3);
    expect(new Set(items.filter(i => !i.shared && i.control === 'outfit').map(i => i.look)).size).toBe(15);
    // the library must not be all one look: every human look appears in the single-look controls too
    expect(new Set(items.filter(i => i.shared && i.mode === 'edit').map(i => i.look)).size).toBeGreaterThanOrEqual(3);
  });
  it('maps character types to looks and never defaults to a man or an alien silently', () => {
    expect(lookForType('male')).toBe('man'); expect(lookForType('trans_woman')).toBe('woman'); expect(lookForType('non_binary')).toBe('nonbinary'); expect(lookForType('monster')).toBe('monster');
    expect(referencePrompt('alien', 'face')).toContain('Starborn');
  });
});

describe('creature tiles and weak-option wording', () => {
  it('creature-look tiles exist for outfit, accessory and prop and nothing else non-type/species', () => {
    const items = buildThumbManifest().filter(i => i.look.startsWith('creature_'));
    expect(new Set(items.map(i => i.control))).toEqual(new Set(['outfit', 'accessory', 'prop']));
    expect(new Set(items.map(i => i.look)).size).toBe(10); // every creature type has its own character
    expect(items.every(i => i.mode === 't2i' && i.file.includes('__') && !i.file.endsWith('__creature.webp'))).toBe(true);
    const cat = items.find(i => i.key === 'outfit/smart_blazer/creature_cat_person')!, frog = items.find(i => i.key === 'outfit/smart_blazer/creature_frog_person')!;
    expect(cat.prompt).toMatch(/cat/); expect(frog.prompt).toMatch(/frog/); expect(cat.prompt).not.toMatch(/fox/);
    const al = buildThumbManifest().filter(i => i.look === 'alien' && ['accessory', 'prop'].includes(i.control)); expect(al.length).toBeGreaterThan(15);
  });
  it('the formerly weak options use strengthened wording', () => {
    const m = buildThumbManifest(); const by = (k: string) => m.find(i => i.key.startsWith(k))!.prompt;
    expect(by('shoes/spring_shoes')).toMatch(/coil spring/); expect(by('shoes/curly_toe_shoes')).toMatch(/spiral curl/);
    expect(by('hairStyle/flame_swirl')).toMatch(/flame/); expect(by('hairStyle/tornado_swirl')).toMatch(/spiral/); expect(by('hairStyle/wave_crest')).toMatch(/wave/);
  });
});
