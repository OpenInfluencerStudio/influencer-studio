/**
 * Preview thumbnail manifest (plan sections 19 and 23.5). Pure and deterministic: given the option schema it lists every thumbnail that
 * should exist, with its prompt, framing, seed and output file. A generator script turns this list into images; the UI reads the
 * result manifest (assets/previews/manifest.json) and falls back to SVG art for anything missing.
 * SFW: one synthetic ADULT per look, always fully clothed, identical scaffold, ONE attribute changed per image.
 */
import crypto from 'node:crypto';
import { CONTROLS, TYPE_OPTS, SIZE_OPTS, ALIEN_SPECIES, MONSTER_SPECIES, CLOTHING_PHRASE, type Control } from './compiler/schema.js';
import { assertSafeText } from './safety/index.js';

export type Look = 'man' | 'woman' | 'nonbinary' | 'alien' | 'monster';
export type Framing = 'face' | 'upper' | 'full';
export const LOOKS: Look[] = ['man', 'woman', 'nonbinary', 'alien', 'monster'];
export const FRAMINGS: Record<Framing, { gen: [number, number]; out: [number, number]; text: string }> = {
  face: { gen: [768, 768], out: [320, 320], text: 'close head-and-shoulders portrait photo' },
  upper: { gen: [768, 768], out: [320, 320], text: 'waist-up portrait photo' },
  full: { gen: [576, 768], out: [240, 320], text: 'three-quarter-length photo from the knees up, whole torso and both arms visible' },
};
const LOOK_SUBJECT: Record<Look, string> = {
  man: 'an adult man in his late twenties, short dark brown hair, brown eyes, light-medium skin',
  woman: 'an adult woman in her late twenties, shoulder-length straight brown hair, brown eyes, light-medium skin',
  nonbinary: 'an adult non-binary person in their mid-thirties with a calm, androgynous look, balanced soft-angular features, faint smile lines, chin-length wavy auburn hair with a side part, hazel eyes, light-medium skin',
  alien: 'an adult-appearing friendly humanoid alien, Starborn species with pale luminous skin, faint constellation freckles and large dark eyes, short silver hair',
  monster: 'an adult-appearing friendly humanoid fantasy creature, Hollowhorn species with small curved horns, fur-trimmed ears and warm eyes, short brown hair',
};
const REF_OUTFIT = 'a plain bright pure-white cotton crew-neck t-shirt';
/** Thumbnail-only wording where the app fragment is too weak to show the option (the app prompt itself is unchanged). */
const THUMB_FRAG: Record<string, string> = { 'hairStyle/bald': 'a completely shaved, smooth bald head with no hair at all on the head, ears fully visible' };
export const REF_TAIL = 'plain mid-grey studio background, soft even light, sharp focus, natural look. Adult, fully clothed, modest everyday clothing.';
export const EDIT_SCAFFOLD = 'Edit the reference photo: keep the same person, same face, same pose, same framing, same grey background and same lighting. Change only this: {fragment}. Everything else must stay exactly the same, including the bright white t-shirt, which stays pure white unless the change is about clothing. Adult, fully clothed, modest everyday clothing.';

/** Frozen reference prompt per look and framing (text-to-image, fixed seed). */
export function referencePrompt(look: Look, framing: Framing): string {
  const legs = framing === 'full' ? ', plain dark blue trousers' : '';
  return `${FRAMINGS[framing].text} of ${LOOK_SUBJECT[look]}, neutral relaxed expression, ${REF_OUTFIT}${legs}, ${REF_TAIL}`;
}

/** Seeds: one per look and framing, recorded in the manifest. */
export const seedFor = (look: Look, framing: Framing) => 1000 * (LOOKS.indexOf(look) + 1) + 100 * (['face', 'upper', 'full'].indexOf(framing) + 1) + 1;

interface CtlRule { framing: Framing; looks: Look[] | 'rotate'; mode?: 'edit' | 'text'; loose?: boolean; humanOnly?: boolean }
/** Which controls get generated thumbnails. Swatch controls (skin, hair and eye colour) and ethnicity are never generated (plan 19.8, 19.3). */
export const RULES: Record<string, CtlRule> = {
  hairStyle: { framing: 'face', looks: ['man', 'woman', 'nonbinary'] },
  facialHair: { framing: 'face', looks: ['man', 'nonbinary'], humanOnly: true },
  headShape: { framing: 'face', looks: 'rotate', humanOnly: true },
  eyeShape: { framing: 'face', looks: 'rotate', humanOnly: true },
  features: { framing: 'face', looks: 'rotate', humanOnly: true },
  distinctive: { framing: 'face', looks: 'rotate', humanOnly: true },
  expression: { framing: 'face', looks: 'rotate' },
  neck: { framing: 'upper', looks: 'rotate', humanOnly: true, loose: true },
  accessory: { framing: 'upper', looks: 'rotate' },
  prop: { framing: 'upper', looks: 'rotate' },
  lighting: { framing: 'upper', looks: 'rotate' },
  background: { framing: 'upper', looks: 'rotate' },
  renderStyle: { framing: 'upper', looks: 'rotate' },
  outfit: { framing: 'full', looks: ['man', 'woman', 'nonbinary', 'alien', 'monster'] },
  height: { framing: 'full', looks: 'rotate', loose: true },
  proportions: { framing: 'full', looks: 'rotate', loose: true },
};
const HUMAN_LOOKS: Look[] = ['man', 'woman', 'nonbinary'];

export interface ThumbItem {
  key: string; control: string; option: string; look: Look; /** one image shown for every character type */ shared: boolean; framing: Framing; mode: 'edit' | 't2i';
  prompt: string; fragment: string; fragmentHash: string; seed: number; file: string; gen: [number, number]; out: [number, number]; loose?: boolean; group: string;
}
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

/** Body-size prompt used for thumbnails and the re-test (stronger silhouette wording than the app fragment; see re-test result in build-log). */
export const SIZE_THUMB_FRAG: Record<string, string> = Object.fromEntries(SIZE_OPTS.map(o => [o.id, o.frag])); // same wording as the app, so the thumbnail shows what the prompt asks for
const SIZE_OUTFIT = 'a loose, plain light grey long-sleeved shirt, plain dark grey straight trousers and plain black shoes, well-fitted and fully covered';
export function sizeThumbPrompt(look: Look, size: string, seed?: number): string {
  void seed;
  return `${FRAMINGS.full.text} of ${LOOK_SUBJECT[look]}, ${SIZE_THUMB_FRAG[size]}, neutral relaxed expression, standing straight, arms relaxed at sides, wearing ${SIZE_OUTFIT}, ${REF_TAIL}`;
}

/** Single-look controls rotate over the three human looks, so the grid mixes people but every control stays consistent. Alien/monster get their own tiles (type, species, body size, outfit). */
function rotateLook(controlId: string): Look {
  return HUMAN_LOOKS[CONTROLS.findIndex(c => c.id === controlId) % 3];
}

function isBase(c: Control, o: { id: string; frag: string }): boolean {
  return o.frag === '' || o.id === 'none' || o.id === (c.default as string) && (o.id === 'average' || o.id === 'balanced');
}

export function buildThumbManifest(): ThumbItem[] {
  const out: ThumbItem[] = [];
  const add = (it: Omit<ThumbItem, 'fragmentHash' | 'gen' | 'out' | 'key'>) => {
    assertSafeText(it.prompt); // the same safety layer the app uses
    out.push({ ...it, key: `${it.control}/${it.option}/${it.look}`, fragmentHash: hash(it.fragment), gen: FRAMINGS[it.framing].gen, out: FRAMINGS[it.framing].out });
  };
  // 1) Option tiles (single-attribute edits of the frozen reference)
  for (const c of CONTROLS) {
    const rule = RULES[c.id]; if (!rule) continue;
    const looks: Look[] = rule.looks === 'rotate' ? [rotateLook(c.id)] : rule.looks;
    for (const look of looks) {
      for (const o of c.options) {
        if (isBase(c, o)) continue;
        const multi = looks.length > 1;
        add({ control: c.id, option: o.id, look, shared: !multi, framing: rule.framing, mode: 'edit', fragment: o.frag, prompt: EDIT_SCAFFOLD.replace('{fragment}', THUMB_FRAG[`${c.id}/${o.id}`] ?? o.frag),
          seed: seedFor(look, rule.framing), file: `${c.id}/${o.id}${multi ? '__' + look : ''}.webp`, loose: rule.loose, group: c.id });
      }
    }
  }
  // 2) Type tiles (text-to-image, waist-up)
  const typeLook: Record<string, Look> = { male: 'man', female: 'woman', non_binary: 'nonbinary', alien: 'alien', monster: 'monster' };
  for (const [tid, look] of Object.entries(typeLook)) {
    const t = TYPE_OPTS.find(x => x.id === tid)!;
    add({ control: 'type', option: tid, look, shared: true, framing: 'upper', mode: 't2i', fragment: t.phrase, prompt: referencePrompt(look, 'upper'), seed: seedFor(look, 'upper'), file: `type/${tid}.webp`, group: 'type' });
  }
  // 3) Species tiles (text-to-image, head and shoulders)
  for (const [kind, list] of [['alien', ALIEN_SPECIES], ['monster', MONSTER_SPECIES]] as const) for (const sp of list) {
    const fr: Framing = sp.id === 'gloomwing' ? 'upper' : 'face';
    add({ control: 'species', option: `${kind}_${sp.id}`, look: kind, shared: true, framing: fr, mode: 't2i', fragment: sp.frag,
      prompt: `${FRAMINGS[fr].text} of an adult-appearing friendly humanoid ${kind === 'alien' ? 'alien' : 'fantasy creature'}, ${sp.frag}, neutral relaxed expression, ${REF_OUTFIT}, ${REF_TAIL}`,
      seed: seedFor(kind, fr) + 7 * (list.indexOf(sp) + 1), file: `species/${kind}_${sp.id}.webp`, group: 'species' });
  }
  // 4) Body-size tiles: 6 sizes x 5 looks (Trans woman/man reuse the Woman/Man images: same compiled descriptor)
  for (const look of LOOKS) for (const s of SIZE_OPTS) {
    add({ control: 'bodySize', option: s.id, look, shared: false, framing: 'full', mode: 't2i', fragment: SIZE_THUMB_FRAG[s.id], prompt: sizeThumbPrompt(look, s.id),
      seed: seedFor(look, 'full'), file: `bodySize/${s.id}__${look}.webp`, group: 'bodySize' });
  }
  return out;
}

/** Look to show for a selected character type (gendered pickers fall back to the first look the control has). */
export function lookForType(type: string): Look {
  switch (type) { case 'male': case 'trans_man': return 'man'; case 'female': case 'trans_woman': return 'woman'; case 'non_binary': return 'nonbinary'; case 'alien': return 'alien'; case 'monster': return 'monster'; default: return 'woman'; }
}
export { CLOTHING_PHRASE };
