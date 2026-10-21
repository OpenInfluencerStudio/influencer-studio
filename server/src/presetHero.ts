// Hero images for the preset cards. Each preset is compiled through the real prompt compiler and a fixed, vivid colour direction is appended.
// Regular presets get a man, a woman and a non-binary version (the card follows the builder's character type); silly presets keep their own type.
import { compileCharacter, applyPreset, CharacterSchema } from './compiler/index.js';
import { PRESETS, CONTROLS, SILLINESS, CREATURE_TYPES as CT } from './compiler/schema.js';

export type HeroLook = 'man' | 'woman' | 'nonbinary';
const TYPE_FOR_LOOK: Record<HeroLook, string> = { man: 'male', woman: 'female', nonbinary: 'non_binary' };
/** Hero images are realistic photos even for silly presets: the stylisation wording (render style, silliness level) is replaced by a photo direction. */
const STYLE_FRAGS = [...(CONTROLS.find(c => c.id === 'renderStyle')?.options.map(o => o.frag) ?? []), ...SILLINESS.map(l => l.frag).filter(Boolean)];
export function realistic(prompt: string, creature: boolean): string {
  let s = prompt; for (const f of STYLE_FRAGS) s = s.split(f + ', ').join('').split(f).join('');
  s = s.replace(/^[\s,]+/, '');
  const lead = creature ? 'photorealistic cinematic DSLR photograph of a lifelike character with real fur, feather or skin texture and real fabric clothing, natural light and depth of field,' : 'photorealistic DSLR photograph of a real adult person, natural skin texture, real fabric clothing and real costume pieces where described, 85mm lens, natural depth of field,';
  return `${lead} ${s}`;
}
const TAIL = 'vivid saturated colours, bold colourful styling, bright even lighting, crisp sharp photo, three-quarter length view, standing, friendly confident expression';

/** Extra colour/scene direction per preset so every card is distinct and vivid. */
export const HERO_COLOUR: Record<string, string> = {
  everyday: 'a bright sunflower-yellow t-shirt (not white) and bright blue jeans, in a cosy colourful living room with a teal sofa and plants',
  tech: 'a bright orange hoodie and teal joggers, glowing monitors with colourful screens behind, soft purple and blue light',
  fitness: 'a bright coral and electric blue sport set, green park with sunshine, energetic smile',
  travel: 'a bright red denim jacket over a sunny yellow t-shirt and blue jeans, golden sunset light over a colourful old-town street with painted buildings',
  smart: 'a vivid emerald-green blazer over a white shirt, a deep magenta studio backdrop, polished look',
  night: 'a glossy electric-purple techwear jacket with glowing cyan trim and bright teal cargo trousers, neon signs in magenta and cyan on a rainy city street at night',
  sir_pompadour: 'an enormous glossy pompadour, a bright purple blazer, big round oversized sunglasses, bold pink backdrop',
  captain_frog: 'a green frog character in a red and gold pirate coat with a tricorn hat, holding a teapot, bright blue sea backdrop',
  disco_moth: 'a fluffy moth character with big feathery antennae in a sparkling gold glitter tracksuit, colourful disco lights and a mirror ball',
  mushroom_hermit: 'a huge red mushroom-cap hairstyle with white spots, cosy knitted green cardigan, bright mossy forest with tiny glowing mushrooms',
  cloud_chef: 'a huge pink cotton-candy cloud of hair, a very tall white chef hat, holding a giant pink donut, bright mint kitchen',
  space_parrot: 'a bright red and blue macaw parrot character in a shiny orange space suit with a clear bubble helmet, pastel cloud kingdom sky',
  hamster_wizard: 'a round-faced hamster character in a deep purple wizard robe with gold stars and a pointy hat, holding a teapot, warm candlelit library',
  stair_step_steve: 'a clearly adult man in his late thirties with light stubble and smile lines, hair cut in clear stair steps like a staircase, a bright turquoise denim jacket over a red t-shirt, bright yellow backdrop',
  bubble_afro: 'a huge round voluminous afro with shiny rainbow soap bubbles floating around it, a bright rainbow-striped tracksuit in red, yellow, green and blue, bright teal backdrop',
  owl_professor: 'a wise brown owl character in a mustard knit waistcoat and round glasses, holding a tall stack of colourful books, cosy library',
  banana_detective: 'a full-body bright yellow banana costume with peel flaps hanging over the shoulders and the face showing through the front, dark sunglasses, a small detective hat, bright blue backdrop',
  robot_barista: 'a friendly shiny red and silver robot with a very tall white chef hat holding a teapot in a bright colourful cafe',
  mascot_marvin: 'a big furry blue sports-team mascot costume with a huge smiling head, laughing, confetti, bright red backdrop',
  unicorn_hair: 'a long rainbow-coloured mane of hair with a sparkly unicorn horn, a flowing purple superhero cape with a star emblem, bright sky',
  rainbow_mohawk: 'a tall rainbow-coloured mohawk, a bright floral jacket in pink and orange, cheerful laugh, sunny backdrop',
  cat_cafe: 'a ginger cat character in a green knit cardigan serving tea from a teapot, a warm colourful cafe with plants',
  knight_duck: 'a bright orange toucan character in shiny silver knight armour with a cardboard crown, a colourful castle courtyard',
  paper_baker: 'a very tall white chef hat, a bright pink apron, a colourful cut-paper craft set with paper stars and clouds',
  plush_pal: 'a soft fluffy plush toy character with button eyes in a bright purple hoodie, pastel pink backdrop with stars',
  fox_trumpeter: 'a russet fox character in a bright blue blazer playing a shiny trumpet, colourful disco lights',
  duck_rain: 'a bright yellow duck-themed rain hood with a beak and a yellow raincoat, holding a tiny red umbrella, wet colourful street',
  balloon_wizard: 'a long purple wizard robe with gold stars, a long braid, holding a big bunch of colourful balloons, bright blue sky',
  long_shoe_larry: 'enormously long bright red clown shoes clearly visible, a baggy polka-dot clown-style suit, rainbow mohawk, full-length view, circus backdrop',
  curly_toe_queen: 'bright golden shoes with long toes that curl up into big spirals, the shoes clearly visible, a tiered ruffle dress in magenta, a braided crown hairstyle, full-length view from head to feet, royal blue backdrop',
  platform_pete: 'very tall chunky rainbow platform boots clearly visible, a neon green and hot-pink windbreaker over a bright yellow t-shirt, bright pink trousers, a tall swirling tornado-shaped hairstyle, full-length view from head to feet, bright turquoise backdrop',
  cycling_clara: 'a bright yellow and blue cycling kit, oversized giant sneakers, a fountain ponytail, standing in a sunny park, full-length view',
  legging_lou: 'bright orange and purple striped opaque leggings with a long loose lime-green tunic top covering the hips, two parallel tall mohawk ridges dyed bright blue clearly visible, rainbow-striped boots, full-length view, bright orange backdrop',
  ruffle_rosa: 'a huge ruffled pink top and a giant spring of curly hair, bright teal backdrop',
  puffy_percy: 'a bright orange shirt with huge balloon-like puffy sleeves, green trousers, a tall stack of three round pancake-shaped buns of hair on top of the head, lime green backdrop',
  mismatch_max: 'a top with one red sleeve and one blue sleeve, hair half bright pink and half bright blue, yellow backdrop',
  collar_connie: 'a shirt with an enormous oversized pointed collar that reaches past the shoulders in bright teal, hair styled into a tall curling ocean-wave crest, coral backdrop',
  spring_steps: 'chunky sneakers mounted on big shiny metal coil springs under the soles, the springs clearly visible, an oversized bright orange puffer jacket and bright blue trousers, pointy spiky hair, full-length view from head to feet, bright blue backdrop',
  space_buns: 'two big space buns, a bright pink and yellow sport set, holding a skateboard, sunny skate park',
};

export interface HeroJob { id: string; look: HeroLook | null; file: string; seed: number; prompt: string; negative: string; width: number; height: number }
const seedOf = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) % 900000 + 100000; };

export function presetHeroJobs(): HeroJob[] {
  const jobs: HeroJob[] = [];
  for (const p of PRESETS) {
    const looks: (HeroLook | null)[] = p.silly ? [null] : ['man', 'woman', 'nonbinary'];
    for (const look of looks) {
      const base = CharacterSchema.parse({ type: look ? TYPE_FOR_LOOK[look] : 'surprise', bodySize: 'medium', age: 30 });
      const ch = applyPreset(base, p.id); const seed = seedOf(p.id + (look ?? ''));
      const c = compileCharacter(ch, seed);
      jobs.push({ id: p.id, look, file: `presets/${p.id}${look ? '__' + look : ''}.webp`, seed, prompt: `${realistic(c.positive, !!c.resolved && CT.includes(c.resolved.type))} ${HERO_COLOUR[p.id]}, ${TAIL}.`, negative: c.negative, width: 768, height: 1024 });
    }
  }
  return jobs;
}

// ---- generic example preview (shown in the big panel until the user presses Preview): colourful, well-lit, per type and body size ----
import { CREATURE_TYPES, SIZE_OPTS } from './compiler/schema.js';
const EX_TAIL = 'full-length view, standing, friendly relaxed smile, soft warm peach and sky-blue gradient studio backdrop, bright flattering light, vivid saturated colours, crisp sharp photo';
const EX_COLOUR: Record<string, string> = {
  man: 'a mustard-yellow jacket over a teal t-shirt and dark navy trousers',
  woman: 'a coral cardigan over a cobalt-blue top and cream trousers',
  nonbinary: 'a lilac hoodie over a mint-green top and burnt-orange trousers',
  alien: 'a bright teal jumpsuit with orange trim',
  monster: 'a bright orange hoodie with a yellow stripe and blue trousers',
  creature: 'a bright magenta hoodie and teal joggers',
};
const EX_TYPE: Record<string, string> = { man: 'male', woman: 'female', nonbinary: 'non_binary', alien: 'alien', monster: 'monster' };
export interface ExampleJob { look: string; size: string; file: string; seed: number; prompt: string; width: number; height: number }
export function exampleJobs(): ExampleJob[] {
  const jobs: ExampleJob[] = [];
  const add = (look: string, type: string, size: string, colour: string) => {
    const seed = seedOf('example' + look + size);
    const c = compileCharacter(CharacterSchema.parse({ type, bodySize: size, age: 30, outfit: 'denim_jacket', expression: 'big_grin' }), seed);
    jobs.push({ look, size, file: `presets/example_${look}_${size}.webp`, seed, prompt: `${c.positive} ${colour}, ${EX_TAIL}.`, width: 768, height: 1024 });
  };
  for (const [look, type] of Object.entries(EX_TYPE)) for (const s of SIZE_OPTS) add(look, type, s.id, EX_COLOUR[look]);
  for (const t of CREATURE_TYPES) add('creature_' + t, t, 'medium', EX_COLOUR.creature);
  return jobs;
}
