import { describe, it, expect } from 'vitest';
import { compileCharacter, randomise } from '../src/compiler/index.js';
import { CONTROLS, HUMAN_TYPES, PRESETS } from '../src/compiler/schema.js';
import { buildThumbManifest } from '../src/thumbs.js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CREATURE_WORDS = /\b(frogs?|toad|lizards?|reptil\w*|amphibi\w*|dino\w*|dragon|scales?|scaly|snout|creature|anthropomorphic|alien|monster|robot|plush|insect|antenna\w*|feather\w*|beak|whiskers?|fur|paws?|tail|cat|dog|fox|mouse|rodent|bird|species)\b/i;
const HUMAN_PRESETS = PRESETS.filter(p => ['male', 'female', 'non_binary', 'trans_woman', 'trans_man', undefined].includes(p.patch.type as string));

describe('human side is free of frog/lizard/creature traits', () => {
  it('default selection prompt has no creature words (many seeds, default and Surprise me)', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const input of [{}, { type: 'surprise' }, { type: 'surprise', bodySize: 'medium', age: 38 }]) {
        const { positive } = compileCharacter(input as never, seed);
        expect(positive, `seed ${seed}`).not.toMatch(CREATURE_WORDS);
      }
    }
  });
  it('every human type compiles clean at Realistic', () => {
    for (const t of HUMAN_TYPES) for (let seed = 0; seed < 30; seed++) expect(compileCharacter({ type: t } as never, seed).positive, `${t}/${seed}`).not.toMatch(CREATURE_WORDS);
  });
  it('randomising a human type never yields a creature type or reptile outfit/prop', () => {
    for (const t of HUMAN_TYPES) for (let seed = 1; seed < 40; seed++) {
      const c = randomise({ type: t } as never, new Set(['type']), seed, 'silly') as Record<string, unknown>;
      expect(c.type).toBe(t);
      expect(compileCharacter(c as never, seed).positive, `${t}/${seed}`).not.toMatch(/\b(frog|lizard|reptil\w*|dino\w*|scales?)\b/i);
    }
  });
  it('no option offered to human types mentions frog, lizard, reptile or dinosaur', () => {
    for (const c of CONTROLS) for (const o of c.options) expect(`${o.id} ${o.label} ${o.frag}`, `${c.id}/${o.id}`).not.toMatch(/\b(frog|toad|lizard|reptil\w*|dino\w*|gecko|iguana)\b/i);
  });
  it('human presets contain no frog/reptile content', () => {
    for (const p of HUMAN_PRESETS) expect(JSON.stringify(p), p.id).not.toMatch(/frog|lizard|reptil|dino/i);
  });
  it('human tiles are never a creature file and use human looks only', () => {
    const items = buildThumbManifest();
    for (const i of items) {
      if (['man', 'woman', 'nonbinary'].includes(i.look)) expect(i.file, i.file).not.toMatch(/__(creature|frog|reptile|cat|dog|fox|insect|bird|rodent|plush|robot)/);
      if (i.shared && !i.file.startsWith('species/') && !i.file.startsWith('type/')) expect(['man', 'woman', 'nonbinary'], i.file).toContain(i.look);
      expect(`${i.option} ${i.prompt}`, i.file).not.toMatch(/inflatable_dino|pet_frog/);
    }
  });
  it('shipped human tile files and manifest agree and contain no dino/frog tile', () => {
    const dir = fileURLToPath(new URL('../../assets/previews/', import.meta.url));
    if (!existsSync(dir + 'manifest.json')) return;
    const m = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')).items as { file: string; option: string; look: string }[];
    for (const i of m) {
      expect(existsSync(dir + i.file), i.file).toBe(true);
      if (['man', 'woman', 'nonbinary'].includes(i.look)) expect(i.option).not.toMatch(/dino|frog|lizard|reptile/);
    }
  });
});

describe('human negative prompt', () => {
  it('human types add a negative for frog/lizard traits, creature types do not', () => {
    expect(compileCharacter({ type: 'male' } as never, 1).negative).toMatch(/frog.*lizard.*reptile/);
    expect(compileCharacter({ type: 'frog_person' } as never, 1).negative).not.toMatch(/frog/);
  });
});
