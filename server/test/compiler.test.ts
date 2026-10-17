import { describe, it, expect } from 'vitest';
import { compileCharacter, randomise, CharacterSchema, rng, resolveType, applyPreset } from '../src/compiler/index.js';
import { TYPE_OPTS, SIZE_OPTS, SIZE_ORDER, ALIEN_SPECIES, MONSTER_SPECIES, CONTROLS, HUMAN_TYPES, PRESETS, SPECIES_BY_TYPE, AGE_BANDS } from '../src/compiler/schema.js';
import { isBlocked } from '../src/safety/index.js';

const humanTypes = TYPE_OPTS.filter(t => t.human && t.id !== 'surprise').map(t => t.id);
function snapshots() {
  const out: Record<string, unknown> = {};
  for (const t of humanTypes) for (const s of SIZE_ORDER) out[`${t}/${s}`] = compileCharacter({ type: t, bodySize: s }, 0);
  for (const s of SIZE_ORDER) out[`surprise/${s}@seed12345`] = compileCharacter({ type: 'surprise', bodySize: s }, 12345);
  for (const sp of ALIEN_SPECIES) for (const s of SIZE_ORDER) out[`alien/${sp.id}/${s}`] = compileCharacter({ type: 'alien', species: sp.id, bodySize: s }, 0);
  for (const sp of MONSTER_SPECIES) for (const s of SIZE_ORDER) out[`monster/${sp.id}/${s}`] = compileCharacter({ type: 'monster', species: sp.id, bodySize: s }, 0);
  return out;
}

describe('golden prompt snapshots (plan 23.6)', () => {
  it('covers every type x size, species x size, plus a fixed Surprise-me seed', async () => {
    const s = snapshots();
    expect(Object.keys(s).length).toBe(30 + 6 + 36 + 36);
    await expect(JSON.stringify(s, null, 2) + '\n').toMatchFileSnapshot('./__golden__/prompts.json');
  });
});

const REQUIRED_CLOTHING = /fully covered/;
function assertInvariants(c: ReturnType<typeof compileCharacter>) {
  expect(c.positive).toMatch(/\badult/);
  expect(c.positive).toMatch(REQUIRED_CLOTHING);
  expect(c.positive).toMatch(/fully clothed/);
  expect(c.resolved.age).toBeGreaterThanOrEqual(21);
  expect(isBlocked(c.positive)).toBe(false);
}

describe('invariants', () => {
  it('hold for every snapshot', () => { for (const v of Object.values(snapshots())) assertInvariants(v as never); });
  it('hold for 10,000 randomised characters in all modes', () => {
    const r = rng(7);
    for (let i = 0; i < 10000; i++) {
      const mode = (['realistic', 'quirky', 'chaos'] as const)[i % 3];
      const ch = randomise(CharacterSchema.parse({}), new Set(), Math.floor(r() * 4294967295), mode);
      assertInvariants(compileCharacter(ch, i));
    }
  });
  it('every fragment in the schema passes the blocklist and no label differs the ids', () => {
    const frags = [...CONTROLS.flatMap(c => c.options.map(o => o.frag)), ...SIZE_OPTS.map(o => o.frag), ...ALIEN_SPECIES.map(o => o.frag), ...MONSTER_SPECIES.map(o => o.frag), ...TYPE_OPTS.map(t => t.phrase), ...AGE_BANDS.map(a => a.frag)];
    for (const f of frags) expect(isBlocked(f), f).toBe(false);
    const labels = [...CONTROLS.flatMap(c => c.options.map(o => o.label)), ...SIZE_OPTS.map(o => o.label), ...TYPE_OPTS.map(t => t.label)];
    for (const l of labels) expect(isBlocked(l), l).toBe(false);
  });
  it('size labels are on the approved respectful list and ids are internal', () => {
    expect(SIZE_OPTS.map(s => s.label)).toEqual(['Very large', 'Larger', 'Medium', 'Slim', 'Very slim', 'Extra slim']);
    expect(SIZE_ORDER).toEqual(['ultra_fat', 'fat', 'medium', 'thin', 'skinny', 'stick_thin']);
    for (const s of SIZE_OPTS) { expect(s.frag).not.toMatch(/\b(fat|skinny|stick|ultra)\b/i); expect(s.label).not.toBe(s.id); }
  });
  it('relabelling cannot change compiled prompts (compiler uses ids only)', () => {
    const before = compileCharacter({ type: 'female', bodySize: 'fat' }, 1).positive;
    const o = SIZE_OPTS.find(s => s.id === 'fat')!; const old = o.label; o.label = 'Renamed';
    try { expect(compileCharacter({ type: 'female', bodySize: 'fat' }, 1).positive).toBe(before); } finally { o.label = old; }
  });
});

describe('type and size rules', () => {
  it('default Type is Surprise me, never pre-selected as female', () => {
    expect(CharacterSchema.parse({}).type).toBe('surprise');
    expect(CharacterSchema.parse({}).bodySize).toBe('medium');
  });
  it('Surprise me resolves to every human type across seeds, not always female', () => {
    const seen = new Set<string>(); for (let s = 0; s < 200; s++) seen.add(resolveType(CharacterSchema.parse({}), s));
    expect([...seen].sort()).toEqual([...HUMAN_TYPES].sort());
  });
  it('randomise covers all types roughly evenly (each at least 8 percent of 1,000 draws)', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) { const t = randomise(CharacterSchema.parse({}), new Set(), i).type; counts[t] = (counts[t] ?? 0) + 1; }
    for (const t of [...HUMAN_TYPES, 'alien', 'monster']) expect(counts[t] / 1000, t).toBeGreaterThanOrEqual(0.08);
    expect(counts.female / 1000).toBeLessThan(0.3);
  });
  it('locks are respected by randomise', () => {
    const base = CharacterSchema.parse({ type: 'male', bodySize: 'fat', hairColor: 'pink' });
    for (let i = 0; i < 50; i++) { const r = randomise(base, new Set(['type', 'bodySize', 'hairColor']), i); expect([r.type, r.bodySize, r.hairColor]).toEqual(['male', 'fat', 'pink']); }
  });
  it('non-human types hide human-only controls and keep clothing', () => {
    const c = compileCharacter({ type: 'alien', species: 'aquan', skinTone: 'ebony', ethnicity: 'african', eyeColor: 'blue' }, 0).positive;
    expect(c).toContain('Aquan species'); expect(c).not.toMatch(/skin tone|African|blue eyes/);
    expect(c).toMatch(/adult-appearing humanoid alien/);
    expect(compileCharacter({ type: 'monster', species: 'gloomwing' }, 0).positive).toContain('clothing fitted around the wings');
  });
  it('species must match the type and come from the table', () => {
    expect(() => compileCharacter({ type: 'alien', species: 'stonekin' })).toThrow();
    expect(() => compileCharacter({ type: 'male', species: 'aquan' })).toThrow();
    expect(() => compileCharacter({ type: 'alien', species: 'made_up' })).toThrow();
    expect(Object.keys(SPECIES_BY_TYPE)).toEqual(['alien', 'monster']);
  });
  it('trans types compile to plain adult descriptors with no body-focused terms', () => {
    expect(compileCharacter({ type: 'trans_woman' }, 0).positive).toMatch(/an? adult woman/);
    expect(compileCharacter({ type: 'trans_man' }, 0).positive).toMatch(/an? adult man/);
    expect(compileCharacter({ type: 'trans_woman' }, 0).positive).not.toMatch(/trans/);
  });
  it('size descriptors are only from the fragment table; unknown options are refused', () => {
    expect(() => compileCharacter({ bodySize: 'huge' as never })).toThrow();
    expect(() => compileCharacter({ outfit: 'nothing' })).toThrow();
  });
  it('every preset applies and compiles', () => { for (const p of PRESETS) assertInvariants(compileCharacter(applyPreset(CharacterSchema.parse({}), p.id), 3)); });
  it('is deterministic', () => { expect(compileCharacter({ type: 'surprise' }, 99)).toEqual(compileCharacter({ type: 'surprise' }, 99)); });
});

describe('adults only and free text', () => {
  it('rejects ages under 21 and unknown fields', () => {
    expect(() => compileCharacter({ age: 17 })).toThrow();
    expect(() => compileCharacter({ age: 20 })).toThrow();
    expect(() => compileCharacter({ age: 21.5 })).toThrow();
    expect(() => compileCharacter({ clothing: 'none' } as never)).toThrow();
    expect(() => compileCharacter({ age: 21 })).not.toThrow();
  });
  it('appended notes cannot negate the constraints, which are re-asserted last', () => {
    const p = compileCharacter({ notes: 'holding a coffee cup', name: 'Mira' }, 0).positive;
    expect(p).toContain('Extra detail: holding a coffee cup');
    expect(p.endsWith('friendly and tasteful.')).toBe(true);
    expect(() => compileCharacter({ notes: 'wearing no clothes' })).toThrow();
    expect(() => compileCharacter({ notes: 'without any clothing' })).toThrow();
    expect(() => compileCharacter({ name: 'Mira<script>' })).toThrow();
  });
});
