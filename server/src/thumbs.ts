/**
 * Preview thumbnail manifest (plan sections 19 and 23.5). Pure and deterministic: given the option schema it lists every thumbnail that
 * should exist, with its prompt, framing, seed and output file. A generator script turns this list into images; the UI reads the
 * result manifest (assets/previews/manifest.json) and falls back to SVG art for anything missing.
 * SFW: one synthetic ADULT per look, always fully clothed, identical scaffold, ONE attribute changed per image.
 */
import crypto from 'node:crypto';
import { CONTROLS, TYPE_OPTS, SIZE_OPTS, ALIEN_SPECIES, MONSTER_SPECIES, INSECT_SPECIES, BIRD_SPECIES, CREATURE_TYPES, CREATURE_FRAG, CLOTHING_PHRASE, type Control } from './compiler/schema.js';
import { assertSafeText } from './safety/index.js';

export type Look = 'man' | 'woman' | 'nonbinary' | 'alien' | 'monster' | 'creature';
export type RefLook = Exclude<Look, 'creature'>;
export type Framing = 'face' | 'upper' | 'full' | 'eyes';
export const LOOKS: Exclude<Look, 'creature'>[] = ['man', 'woman', 'nonbinary', 'alien', 'monster']; // the five reference looks (creature tiles are one-off text-to-image)
export const FRAMINGS: Record<Framing, { gen: [number, number]; out: [number, number]; text: string }> = {
  face: { gen: [768, 768], out: [320, 320], text: 'close head-and-shoulders portrait photo' },
  upper: { gen: [768, 768], out: [320, 320], text: 'waist-up portrait photo' },
  full: { gen: [576, 768], out: [240, 320], text: 'three-quarter-length photo from the knees up, whole torso and both arms visible' },
  eyes: { gen: [768, 512], out: [320, 214], text: 'extreme close-up photo of the eyes and eyebrows' },
};
const LOOK_SUBJECT: Record<Exclude<Look, 'creature'>, string> = {
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
export function referencePrompt(look: Exclude<Look, 'creature'>, framing: Framing): string {
  const legs = framing === 'full' ? ', plain dark blue trousers' : '';
  return `${FRAMINGS[framing].text} of ${LOOK_SUBJECT[look]}, neutral relaxed expression, ${REF_OUTFIT}${legs}, ${REF_TAIL}`;
}

/** Seeds: one per look and framing, recorded in the manifest. */
export const seedFor = (look: Exclude<Look, 'creature'>, framing: Framing) => 1000 * (LOOKS.indexOf(look) + 1) + 100 * (['face', 'upper', 'full', 'eyes'].indexOf(framing) + 1) + 1;

interface CtlRule { framing: Framing; looks: RefLook[] | 'rotate'; mode?: 'edit' | 'text'; loose?: boolean; humanOnly?: boolean }
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
  shoes: { framing: 'full', looks: 'rotate' },
  lighting: { framing: 'upper', looks: 'rotate' },
  background: { framing: 'upper', looks: 'rotate' },
  renderStyle: { framing: 'upper', looks: 'rotate' },
  outfit: { framing: 'full', looks: ['man', 'woman', 'nonbinary', 'alien', 'monster'] },
  height: { framing: 'full', looks: 'rotate', loose: true },
  proportions: { framing: 'full', looks: 'rotate', loose: true },
};
const HUMAN_LOOKS: RefLook[] = ['man', 'woman', 'nonbinary'];

/** Controls (and single options) a text edit of a reference cannot show: these are generated from a stronger text-to-image prompt with a tighter crop (plan 28 / overnight run). */
export const TEXT_CONTROLS = new Set(['headShape', 'eyeShape', 'neck', 'height', 'shoes']);
export const TEXT_OPTIONS = new Set(['features/dimples', 'features/round_ears', 'features/high_cheekbones', 'features/rosy_cheeks', 'features/laugh_lines', 'distinctive/different_coloured_eyes', 'outfit/athletic_leggings', 'outfit/cycling_shorts_kit', 'proportions/long_legs', 'proportions/long_torso', 'proportions/broad_shoulders', 'proportions/narrow_shoulders']);
/** Stronger wording per option for the text-to-image thumbnails (thumbnail only; the app prompt is unchanged). */
export const SPECIES_STRONG: Record<string, string> = { insect_person_moth: 'a human face with two large feathery moth antennae on the forehead, soft pale fuzzy skin, large dark eyes, small pale-grey moth wings visible behind the shoulders; still clearly a human adult, not an animal' };
export const STRONG: Record<string, string> = {
  'outfit/inflatable_dino': 'a loose, baggy, oversized green inflatable dinosaur costume worn over a plain long-sleeved shirt and trousers, with a big hood, spikes down the back and a tail, fully covering the body',
  'outfit/cycling_shorts_kit': 'a long-sleeved navy cycling jersey and knee-length dark navy cycling shorts that reach to just above the knee, with plain ankle socks',
  'prop/skateboard': 'holding a full-size colourful skateboard upright in front of the body with both hands, the whole deck and wheels clearly visible',
  'prop/pet_frog': 'a clearly visible large green frog sitting on one shoulder right next to the face',
  'shoes/clown_length_shoes': 'enormous clown shoes about three times longer than normal feet, very long flat red shoes pointing forward',
  'shoes/curly_toe_shoes': 'elf-style shoes with long toes that curl up and back in a spiral at the tips, bright gold',
  'shoes/platform_boots': 'extremely tall chunky platform boots with soles about fifteen centimetres thick',
  'shoes/giant_sneakers': 'comically oversized bright neon green and orange sneakers, each as big as a loaf of bread',
  'shoes/rocket_boots': 'chunky retro-futuristic silver boots with big red rocket fins on the sides and jets at the heels',
  'shoes/duck_foot_shoes': 'wide flat bright orange shoes shaped like duck feet with webbed toes',
  'shoes/striped_boots': 'tall boots covered in bold rainbow stripes',
  'shoes/spring_shoes': 'shoes with big metal coil springs attached under the soles',
  'headShape/oval': 'a clearly oval face, about one and a half times as tall as it is wide, with a softly rounded chin', 'headShape/round': 'a clearly round, full face as wide as it is tall, with a soft round chin and full cheeks',
  'headShape/square': 'a clearly square face with a strong flat square jawline and a wide forehead', 'headShape/heart': 'a clearly heart-shaped face with a wide forehead, high cheekbones and a narrow pointed chin',
  'headShape/long': 'a clearly long, narrow face that is much taller than it is wide', 'headShape/diamond': 'a clearly diamond-shaped face with wide cheekbones and a narrow forehead and chin',
  'headShape/rectangle': 'a clearly rectangular face, long with straight vertical sides and a flat jaw', 'headShape/triangle': 'a clearly triangular face with a narrow forehead and a wide jaw',
  'headShape/wide': 'a clearly wide face, much broader than usual across the cheeks', 'headShape/narrow': 'a clearly narrow face, slim across the cheeks and jaw',
  'neck/short': 'a very short neck so the head sits low between the shoulders', 'neck/long': 'a very long, slender neck', 'neck/strong': 'a thick, strong, muscular neck',
  'eyeShape/almond': 'almond-shaped eyes tapering gently at both corners', 'eyeShape/round': 'big round open eyes with the whites visible around the iris', 'eyeShape/hooded': 'hooded eyes with a heavy upper eyelid fold covering the lid crease',
  'eyeShape/wide': 'eyes set wide apart with a broad space between them', 'eyeShape/narrow': 'narrow slit-like eyes', 'eyeShape/upturned': 'eyes whose outer corners tilt clearly upward', 'eyeShape/downturned': 'eyes whose outer corners tilt clearly downward',
  'height/short': 'a short person whose head only reaches about two thirds of the way up the door', 'height/tall': 'a very tall person whose head nearly reaches the top of the door frame',
  'proportions/long_legs': 'very long legs, legs making up well over half of the total body height', 'proportions/long_torso': 'a very long torso with comparatively short legs', 'proportions/broad_shoulders': 'very broad, wide shoulders',
  'proportions/narrow_shoulders': 'very narrow, sloping shoulders',
  'features/dimples': 'deep, clearly visible dimples in both cheeks while smiling broadly', 'features/round_ears': 'round ears clearly visible, hair tucked behind the ears', 'features/high_cheekbones': 'very high, prominent cheekbones with light catching them',
  'features/rosy_cheeks': 'bright rosy pink cheeks', 'features/laugh_lines': 'deep smile lines around the eyes and mouth while laughing', 'distinctive/different_coloured_eyes': 'one bright blue eye and one dark brown eye, both clearly visible',
};
export interface ThumbItem {
  key: string; control: string; option: string; look: Look; /** one image shown for every character type */ shared: boolean; framing: Framing; mode: 'edit' | 't2i';
  prompt: string; fragment: string; fragmentHash: string; seed: number; file: string; gen: [number, number]; out: [number, number]; loose?: boolean; group: string;
}
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

/** Body-size prompt used for thumbnails and the re-test (stronger silhouette wording than the app fragment; see re-test result in build-log). */
export const SIZE_THUMB_FRAG: Record<string, string> = Object.fromEntries(SIZE_OPTS.map(o => [o.id, o.frag])); // same wording as the app, so the thumbnail shows what the prompt asks for
const SIZE_OUTFIT = 'a loose, plain light grey long-sleeved shirt, plain dark grey straight trousers and plain black shoes, well-fitted and fully covered';
export function sizeThumbPrompt(look: Exclude<Look, 'creature'>, size: string, seed?: number): string {
  void seed;
  return `${FRAMINGS.full.text} of ${LOOK_SUBJECT[look]}, ${SIZE_THUMB_FRAG[size]}, neutral relaxed expression, standing straight, arms relaxed at sides, wearing ${SIZE_OUTFIT}, ${REF_TAIL}`;
}

/** Single-look controls rotate over the three human looks, so the grid mixes people but every control stays consistent. Alien/monster get their own tiles (type, species, body size, outfit). */
function rotateLook(controlId: string): Exclude<Look, 'creature'> {
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
    const looks: RefLook[] = rule.looks === 'rotate' ? [rotateLook(c.id)] : rule.looks;
    for (const look of looks) {
      for (const o of c.options) {
        if (isBase(c, o)) continue;
        if (TEXT_CONTROLS.has(c.id) || TEXT_OPTIONS.has(`${c.id}/${o.id}`) || c.id === 'proportions' || (c.id === 'hairStyle' && o.id === 'bald' && look !== 'man')) continue; // generated as text-to-image below
        const multi = looks.length > 1;
        add({ control: c.id, option: o.id, look, shared: !multi, framing: rule.framing, mode: 'edit', fragment: o.frag, prompt: EDIT_SCAFFOLD.replace('{fragment}', THUMB_FRAG[`${c.id}/${o.id}`] ?? STRONG[`${c.id}/${o.id}`] ?? o.frag),
          seed: seedFor(look, rule.framing), file: `${c.id}/${o.id}${multi ? '__' + look : ''}.webp`, loose: rule.loose, group: c.id });
      }
    }
  }
  // 1b) Text-to-image tiles: stronger prompts and tighter crops for what an edit cannot show (head shape, eyes, neck, height, proportions, a few features, bald on Woman/Non-binary, cartoon proportions)
  const textAdd = (c: Control, o: { id: string; frag: string; silly?: boolean }, look: Exclude<Look, 'creature'>, framing: Framing, tail: string, seedOff: number, multi = false, suffix = '') => {
    add({ control: c.id, option: o.id, look, shared: !multi, framing, mode: 't2i', fragment: o.frag, prompt: tail, seed: seedFor(look, framing) + seedOff, file: `${c.id}/${o.id}${multi ? '__' + look : ''}${suffix}.webp`, loose: false, group: c.id });
  };
  for (const c of CONTROLS) {
    for (const [oi, o] of c.options.entries()) {
      if (isBase(c, o) && !(c.id === 'headShape' || c.id === 'eyeShape')) continue;
      const k = `${c.id}/${o.id}`; const strong = STRONG[k] ?? o.frag;
      if (TEXT_CONTROLS.has(c.id) || TEXT_OPTIONS.has(k)) {
        if (isBase(c, o) && !STRONG[k]) continue;
        const look = rotateLook(c.id); const subj = LOOK_SUBJECT[look];
        const hairBack = 'hair pulled back and tied up';
        let framing: Framing; let prompt: string;
        if (c.id === 'eyeShape') { framing = 'eyes'; prompt = `${FRAMINGS.eyes.text} of ${subj}, ${strong}, both eyes sharp and clearly visible, front view, neutral relaxed expression, ${REF_TAIL}`; }
        else if (c.id === 'headShape') { framing = 'face'; prompt = `${FRAMINGS.face.text} of ${subj}, ${hairBack} so the whole face outline is visible, ${strong}, front view, neutral relaxed expression, ${REF_OUTFIT}, ${REF_TAIL}`; }
        else if (c.id === 'neck') { framing = 'upper'; prompt = `${FRAMINGS.upper.text} of ${subj}, ${hairBack}, ${strong}, the whole neck and shoulders clearly visible above the t-shirt collar, front view, neutral relaxed expression, ${REF_OUTFIT}, ${REF_TAIL}`; }
        else if (c.id === 'height') { framing = 'full'; prompt = `full-length photo of ${subj}, standing straight next to a plain standard interior door, ${strong}, neutral relaxed expression, ${REF_OUTFIT}, plain dark blue trousers, plain black shoes, ${REF_TAIL.replace('plain mid-grey studio background, ', 'plain light-grey wall, ')}`; }
        else if (c.id === 'shoes') { framing = 'full'; prompt = `close-up photo of the lower legs and feet of a person from the knees down, standing on a plain light-grey studio floor, wearing plain dark blue trousers, ${strong}, both shoes large, centred, and fully in focus, plain mid-grey studio background, soft even light, sharp focus. Adult, fully clothed, modest everyday clothing.`; }
        else if (c.id === 'outfit') { framing = 'full'; prompt = `full-length photo from head to toe of ${subj}, standing straight, wearing ${strong}, plain black shoes, neutral relaxed expression, ${REF_TAIL}`; }
        else if (c.id === 'proportions') { framing = 'full'; prompt = `${FRAMINGS.full.text} of ${subj}, ${strong}, standing straight, arms relaxed, neutral relaxed expression, ${REF_OUTFIT}, plain dark blue trousers, ${REF_TAIL}`; }
        else { framing = 'face'; prompt = `${FRAMINGS.face.text} of ${subj}, ${strong}, neutral relaxed expression, ${REF_OUTFIT}, ${REF_TAIL}`; }
        textAdd(c, o, look, framing, prompt, 11 + oi, false);
        continue;
      }
      if (c.id === 'proportions' && o.silly) {
        const look = 'woman' as const;
        textAdd(c, o, look, 'full', `three-quarter-length 3D animated cartoon character, a friendly adult woman character with ${o.frag}, bold simple colours, standing straight, arms relaxed, smiling, plain light-blue t-shirt and plain dark trousers, plain mid-grey studio background, soft even light, sharp focus. Adult, fully clothed, modest everyday clothing.`, 23 + oi, false);
      }
    }
  }
  // bald on Woman and Non-binary (the edit kept side hair): text-to-image with explicit wording
  for (const look of ['woman', 'nonbinary'] as const) textAdd(CONTROLS.find(x => x.id === 'hairStyle')!, { id: 'bald', frag: 'a shaved bald head' }, look, 'face', `${FRAMINGS.face.text} of ${LOOK_SUBJECT[look].replace(/,[^,]*hair[^,]*,/, ',')}, completely bald with a smooth shaved head and no hair at all on the head, ears fully visible, neutral relaxed expression, ${REF_OUTFIT}, ${REF_TAIL}`, 5, true);
  // 2) Type tiles (text-to-image, waist-up)
  const typeLook: Record<string, RefLook> = { male: 'man', female: 'woman', non_binary: 'nonbinary', alien: 'alien', monster: 'monster' };
  for (const [tid, look] of Object.entries(typeLook)) {
    const t = TYPE_OPTS.find(x => x.id === tid)!;
    add({ control: 'type', option: tid, look, shared: true, framing: 'upper', mode: 't2i', fragment: t.phrase, prompt: referencePrompt(look, 'upper'), seed: seedFor(look, 'upper'), file: `type/${tid}.webp`, group: 'type' });
  }
  // 2b) Playful creature types (text-to-image, waist-up, one adult clothed character each; shared by every body size)
  const CLOTHES: Record<string, string> = {};
  for (const t of TYPE_OPTS.filter(x => CREATURE_TYPES.includes(x.id))) {
    const fr = CREATURE_FRAG[t.id] ?? '';
    add({ control: 'type', option: t.id, look: 'creature', shared: true, framing: 'upper', mode: 't2i', fragment: t.phrase, prompt: `${FRAMINGS.upper.text} of ${t.phrase}, ${fr}, calm friendly expression, ${CLOTHES[t.id] ?? 'a plain bright pure-white cotton crew-neck t-shirt'}, plain mid-grey studio background, soft even light, sharp focus. Adult, fully clothed, modest everyday clothing.`, seed: 7000 + CREATURE_TYPES.indexOf(t.id) * 13, file: `type/${t.id}.webp`, group: 'type' });
  }
  for (const [tid, list] of [['insect_person', INSECT_SPECIES], ['bird_person', BIRD_SPECIES]] as const) for (const sp of list) {
    const t = TYPE_OPTS.find(x => x.id === tid)!;
    add({ control: 'species', option: `${tid}_${sp.id}`, look: 'creature', shared: true, framing: 'upper', mode: 't2i', fragment: sp.frag, prompt: `${FRAMINGS.upper.text} of ${t.phrase}, ${SPECIES_STRONG[`${tid}_${sp.id}`] ?? sp.frag}, calm friendly expression, a plain bright pure-white cotton crew-neck t-shirt, plain mid-grey studio background, soft even light, sharp focus. Adult, fully clothed, modest everyday clothing.`, seed: 7500 + list.indexOf(sp) * 17 + (tid === 'bird_person' ? 3 : 0), file: `species/${tid}_${sp.id}.webp`, group: 'species' });
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
