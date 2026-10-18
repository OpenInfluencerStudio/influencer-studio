import { z } from 'zod';
import {
  CONTROLS, CONTROL_BY_ID, TYPE_OPTS, SPECIES_BY_TYPE, SIZE_OPTS, SIZE_ORDER, HUMAN_TYPES, MIN_AGE, ageFragment,
  CLOTHING_PHRASE, CONSTRAINT_TAIL, NEGATIVE_PROMPT, PRESETS, SILLINESS, CREATURE_TYPES, CREATURE_FRAG, type Control,
} from './schema.js';
import { SafetyError, validateName, validateNotes, assertSafeText } from '../safety/index.js';

const typeIds = TYPE_OPTS.map(t => t.id) as [string, ...string[]];
const id = z.string().regex(/^[a-z0-9_]{1,40}$/);

/** Strict request schema: unknown fields rejected, ranges enforced. Age below 21 is a hard validation error. */
export const CharacterSchema = z.object({
  type: z.enum(typeIds).default('surprise'),
  species: id.optional(),
  bodySize: z.enum(SIZE_ORDER as [string, ...string[]]).default('medium'),
  age: z.number().int().min(MIN_AGE).max(80).default(30),
  name: z.string().max(60).optional(),
  notes: z.string().max(400).optional(),
  ethnicity: id.optional(), skinTone: id.optional(), hairStyle: id.optional(), hairColor: id.optional(), outfit: id.optional(),
  height: id.optional(), proportions: id.optional(), headShape: id.optional(), neck: id.optional(), eyeShape: id.optional(), eyeColor: id.optional(),
  features: z.array(id).max(3).optional(), facialHair: id.optional(), distinctive: id.optional(), accessory: id.optional(),
  expression: id.optional(), lighting: id.optional(), background: id.optional(), renderStyle: id.optional(),
  prop: id.optional(), shoes: id.optional(), silliness: z.number().int().min(0).max(4).default(0),
}).strict();
export type CharacterInput = z.input<typeof CharacterSchema>;
export type Character = z.output<typeof CharacterSchema>;

export interface Compiled { positive: string; negative: string; resolved: { type: string; species: string | null; bodySize: string; age: number }; }

/** Small seedable PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T,>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length)];

export function resolveType(c: Character, seed: number): string {
  if (c.type !== 'surprise') return c.type;
  const r = rng(seed ^ 0x9e3779b9);
  // Above Realistic, Surprise sometimes picks a playful creature type (never at level 0, so older results do not change).
  if (c.silliness > 0 && r() < 0.12 * c.silliness) return pick(r, CREATURE_TYPES);
  return pick(r, HUMAN_TYPES);
}

function optFrag(ctl: Control, optId: string | undefined): string {
  const value = optId ?? (ctl.default as string);
  const o = ctl.options.find(x => x.id === value);
  if (!o) throw new SafetyError(); // unknown option id: only the fragment table is accepted
  return o.frag;
}
const article = (s: string) => (/^[aeiou]/i.test(s) ? 'an' : 'a');

/** Compile a validated character to the model prompt. Pure and deterministic for (character, seed). */
export function compileCharacter(input: CharacterInput, seed = 0): Compiled {
  const c = CharacterSchema.parse(input);
  const type = resolveType(c, seed);
  const typeOpt = TYPE_OPTS.find(t => t.id === type)!;
  const isHuman = typeOpt.human;
  const speciesList = SPECIES_BY_TYPE[type];
  let speciesFrag = '';
  let speciesId: string | null = null;
  if (speciesList) {
    const sp = speciesList.find(s => s.id === (c.species ?? speciesList[0].id));
    if (!sp) throw new SafetyError();
    speciesFrag = sp.frag; speciesId = sp.id;
  } else if (c.species) throw new SafetyError();
  const size = SIZE_OPTS.find(s => s.id === c.bodySize)!;
  const name = c.name ? validateName(c.name) : '';
  const notes = c.notes ? validateNotes(c.notes) : '';

  const f = (key: string, only?: 'human') => {
    const ctl = CONTROL_BY_ID.get(key as never)!;
    if ((ctl.applies === 'human' || only === 'human') && !isHuman) return '';
    return optFrag(ctl, (c as Record<string, unknown>)[key] as string | undefined);
  };
  const featureFrags: string[] = [];
  if (isHuman) {
    const ctl = CONTROL_BY_ID.get('features')!;
    for (const fid of c.features ?? []) { const o = ctl.options.find(x => x.id === fid); if (!o) throw new SafetyError(); featureFrags.push(o.frag); }
  }
  const hairColor = f('hairColor'), hairStyle = f('hairStyle');
  const hairPhrase = hairStyle.includes('bald') || !isHuman ? hairStyle : `${hairStyle} in ${hairColor}`;
  const parts: (string | false)[] = [
    c.renderStyle === undefined && c.silliness >= 3 ? CONTROL_BY_ID.get('renderStyle')!.options.find(o => o.id === '3d_toy')!.frag : f('renderStyle'),
    SILLINESS[c.silliness]!.frag,
    `${article(typeOpt.phrase)} ${typeOpt.phrase} ${ageFragment(c.age)}`,
    size.frag,
    CREATURE_FRAG[type] ?? '',
    speciesFrag,
    isHuman && f('ethnicity'),
    isHuman && f('skinTone'),
    f('height'), f('proportions'),
    isHuman && f('headShape'), isHuman && f('neck'), isHuman && f('eyeShape'), isHuman && f('eyeColor'),
    hairPhrase,
    isHuman && f('facialHair'),
    ...featureFrags,
    isHuman && f('distinctive'),
    f('accessory'), f('prop'), f('shoes'),
    `${CLOTHING_PHRASE}: ${f('outfit')}`,
    f('expression'), f('lighting'), f('background'),
  ];
  let positive = parts.filter(Boolean).join(', ');
  if (name) positive += `. Character name: ${name}`;
  if (notes) positive += `. Extra detail: ${notes}`;
  // Constraints are re-asserted last so appended text cannot negate them (plan 14.7 rule 7).
  positive += `. ${CONSTRAINT_TAIL}`;
  return { positive, negative: isHuman ? NEGATIVE_PROMPT + ', frog, lizard, reptile, amphibian, scales, green skin, bulging eyes, slit pupils' : NEGATIVE_PROMPT, resolved: { type, species: speciesId, bodySize: c.bodySize, age: c.age } };
}

/** Randomise with locks; draws only from allowed sets (plan 14.7 rule 8). */
export function randomise(base: Character, locks: Set<string>, seed: number, mode: 'realistic' | 'quirky' | 'chaos' | 'silly' = 'realistic'): Character {
  const r = rng(seed);
  const out: Record<string, unknown> = { ...base };
  const lock = (k: string) => locks.has(k);
  if (!lock('type')) {
    // Human types and non-human types are drawn evenly so results are never always one type.
    out.type = pick(r, mode === 'silly' ? [...HUMAN_TYPES, 'alien', 'monster', ...CREATURE_TYPES] : [...HUMAN_TYPES, 'alien', 'monster']);
    delete out.species;
  }
  const t = out.type as string;
  if (SPECIES_BY_TYPE[t]) { if (!lock('species') || !out.species) out.species = pick(r, SPECIES_BY_TYPE[t]).id; } else delete out.species;
  if (!lock('bodySize')) out.bodySize = pick(r, mode === 'realistic' ? SIZE_ORDER.slice(1, 5) : SIZE_ORDER);
  if (!lock('silliness') && mode === 'silly') out.silliness = 2 + Math.floor(r() * 3);
  if (!lock('age')) out.age = 21 + Math.floor(r() * 50);
  for (const ctl of CONTROLS) {
    if (lock(ctl.id)) continue;
    const opts = mode === 'silly' ? ctl.options : ctl.options.filter(o => !o.silly);
    if (ctl.multi) { const n = Math.floor(r() * (mode === 'realistic' ? 2 : 4)); out[ctl.id] = [...new Set(Array.from({ length: n }, () => pick(r, opts).id))].slice(0, ctl.maxSelected ?? 3); }
    else out[ctl.id] = pick(r, opts).id;
  }
  return CharacterSchema.parse(out);
}

export function applyPreset(base: Character, presetId: string): Character {
  const p = PRESETS.find(x => x.id === presetId);
  if (!p) throw new SafetyError();
  return CharacterSchema.parse({ ...base, ...p.patch });
}
export { assertSafeText, SafetyError };
