/**
 * Character schema: every selectable option, its UI label and its prompt fragment.
 * The compiler works from option IDS only; labels are for display (plan 23.4 rule 4).
 * All fragments are SFW, adult, non-demeaning and describe clothed characters.
 */
export interface Opt { id: string; label: string; frag: string; silly?: boolean }
export type UiKind = 'type' | 'species' | 'size' | 'hair' | 'outfit' | 'pill' | 'swatch' | 'body' | 'head' | 'neck' | 'eye' | 'face' | 'acc';
export interface Control {
  id: CharacterKey; title: string; ui: UiKind; multi?: boolean; maxSelected?: number;
  /** which kinds of character the control applies to */
  applies: 'all' | 'human'; options: Opt[]; default: string | string[]; open?: boolean;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const mk = (rows: [string, string?][]): Opt[] => rows.map(([label, frag]) => ({ id: slug(label), label, frag: frag ?? label.toLowerCase() }));

export type CharacterKey =
  | 'type' | 'species' | 'bodySize' | 'age' | 'ethnicity' | 'skinTone' | 'hairStyle' | 'hairColor' | 'outfit' | 'height' | 'proportions'
  | 'prop' | 'shoes' | 'silliness' | 'headShape' | 'neck' | 'eyeShape' | 'eyeColor' | 'features' | 'facialHair' | 'distinctive' | 'accessory' | 'expression' | 'lighting' | 'background' | 'renderStyle';

export const TYPE_OPTS: (Opt & { human: boolean; phrase: string })[] = [
  { id: 'surprise', label: 'Surprise me', frag: '', human: true, phrase: '' },
  { id: 'male', label: 'Man', frag: '', human: true, phrase: 'adult man' },
  { id: 'female', label: 'Woman', frag: '', human: true, phrase: 'adult woman' },
  { id: 'non_binary', label: 'Non-binary', frag: '', human: true, phrase: 'adult non-binary person with an androgynous look' },
  { id: 'trans_woman', label: 'Trans woman', frag: '', human: true, phrase: 'adult woman' },
  { id: 'trans_man', label: 'Trans man', frag: '', human: true, phrase: 'adult man' },
  { id: 'alien', label: 'Alien', frag: '', human: false, phrase: 'adult-appearing humanoid alien' },
  { id: 'monster', label: 'Monster', frag: '', human: false, phrase: 'adult-appearing friendly humanoid fantasy creature' },
  // Playful anthropomorphic characters (plan 28). Adult, clothed, standing, calm; shown only as characters, never as a joke about real groups.
  { id: 'cat_person', label: 'Cat person', frag: '', human: false, phrase: 'adult-appearing friendly anthropomorphic cat character' },
  { id: 'dog_person', label: 'Dog person', frag: '', human: false, phrase: 'adult-appearing friendly anthropomorphic dog character' },
  { id: 'fox_person', label: 'Fox person', frag: '', human: false, phrase: 'adult-appearing friendly anthropomorphic fox character' },
  { id: 'frog_person', label: 'Frog person', frag: '', human: false, phrase: 'adult-appearing friendly anthropomorphic frog character' },
  { id: 'insect_person', label: 'Insect person', frag: '', human: false, phrase: 'adult-appearing friendly anthropomorphic insect character' },
  { id: 'bird_person', label: 'Bird person', frag: '', human: false, phrase: 'adult-appearing friendly anthropomorphic bird character' },
  { id: 'rodent_person', label: 'Rodent person', frag: '', human: false, phrase: 'adult-appearing friendly anthropomorphic rodent character' },
  { id: 'reptile_person', label: 'Reptile person', frag: '', human: false, phrase: 'adult-appearing friendly anthropomorphic reptile character' },
  { id: 'robot', label: 'Robot', frag: '', human: false, phrase: 'adult-appearing friendly retro humanoid robot character' },
  { id: 'plush_person', label: 'Plush toy person', frag: '', human: false, phrase: 'adult-appearing friendly stitched plush-toy character' },
];
/** Playful character types (plan 28), used by the silliness slider when Surprise is on. */
export const CREATURE_TYPES = ['cat_person', 'dog_person', 'fox_person', 'frog_person', 'insect_person', 'bird_person', 'rodent_person', 'reptile_person', 'robot', 'plush_person'];
export const HUMAN_TYPES = TYPE_OPTS.filter(t => t.human && t.id !== 'surprise').map(t => t.id);

export const ALIEN_SPECIES: Opt[] = [
  { id: 'starborn', label: 'Starborn', frag: 'Starborn species with pale luminous skin, faint constellation freckles and large dark eyes' },
  { id: 'verdant', label: 'Verdant', frag: 'Verdant species with leaf-green skin, vine-like hair and plant-fibre textures' },
  { id: 'aquan', label: 'Aquan', frag: 'Aquan species with blue-teal skin, small fin-like ear ridges and pearly eyes' },
  { id: 'ember', label: 'Ember', frag: 'Ember species with warm copper skin and soft glowing amber markings' },
  { id: 'lumen', label: 'Lumen', frag: 'Lumen species with smooth silver skin, faint glowing patterns and crystal-like hair' },
  { id: 'dusk', label: 'Dusk', frag: 'Dusk species with violet-grey skin, simple large eyes and soft antennae' },
];
export const MONSTER_SPECIES: Opt[] = [
  { id: 'stonekin', label: 'Stonekin', frag: 'Stonekin species with grey stone-textured skin and a broad build' },
  { id: 'hollowhorn', label: 'Hollowhorn', frag: 'Hollowhorn species with small curved horns, fur-trimmed ears and warm eyes' },
  { id: 'wolfkin', label: 'Wolfkin', frag: 'Wolfkin species with wolf-like ears, a softened muzzle and fur on the face and hands' },
  { id: 'drakekin', label: 'Drakekin', frag: 'Drakekin species with fine scales, small horns and friendly gold eyes' },
  { id: 'gloomwing', label: 'Gloomwing', frag: 'Gloomwing species with soft pale-grey skin, large dark eyes, feathery moth antennae and large dusty-grey moth wings spread behind the shoulders, clothing fitted around the wings' },
  { id: 'boarkin', label: 'Boarkin', frag: 'Boarkin species with a broad flat boar-style nose, two short ivory tusks curving up from the lower jaw, large floppy tufted ears, coarse dark bristly hair and sturdy friendly features' },
];
export const INSECT_SPECIES: Opt[] = [
  { id: 'beetle', label: 'Beetle', frag: 'beetle features with a glossy shell-like collar, small antennae and round dark eyes' },
  { id: 'moth', label: 'Moth', frag: 'moth features with feathery antennae, soft fuzzy cheeks and large dark eyes' },
  { id: 'dragonfly', label: 'Dragonfly', frag: 'dragonfly features with large compound-style eyes, thin antennae and delicate translucent wings behind the shoulders' },
];
export const BIRD_SPECIES: Opt[] = [
  { id: 'owl', label: 'Owl', frag: 'owl features with a round feathered face, big round amber eyes and a small beak' },
  { id: 'parrot', label: 'Parrot', frag: 'parrot features with bright red and blue feathers, a curved beak and a feathered crest' },
  { id: 'toucan', label: 'Toucan', frag: 'toucan features with black feathers, a large colourful beak and a white chest' },
];
export const SPECIES_BY_TYPE: Record<string, Opt[]> = { alien: ALIEN_SPECIES, monster: MONSTER_SPECIES, insect_person: INSECT_SPECIES, bird_person: BIRD_SPECIES };
export const CREATURE_FRAG: Record<string, string> = {
  cat_person: 'a cat character with pointed furry ears, whiskers, a small nose and soft fur', dog_person: 'a dog character with floppy furry ears, a friendly snout and soft fur',
  fox_person: 'a fox character with pointed ears, a narrow snout, a bushy tail and russet fur', frog_person: 'a frog character with smooth green skin, wide-set round eyes and a wide friendly mouth',
  rodent_person: 'a mouse-like character with round ears, small whiskers, a tiny pink nose and soft fur', reptile_person: 'a lizard character with fine scales, a gentle snout and bright eyes',
  robot: 'a retro robot character with a metal head, round lens eyes, antenna and a panelled body', plush_person: 'a plush toy character with visible stitching, button eyes and soft fabric',
};

/** Six body sizes. Ids are internal and never shown; labels are respectful and relabelable (plan 23.2). */
export const SIZE_OPTS: Opt[] = [
  { id: 'ultra_fat', label: 'Very large', frag: 'a very large, very round and full figure with a very broad torso, very wide waist and hips, a rounded face and full arms' },
  { id: 'fat', label: 'Larger', frag: 'a large, full and rounded figure with a broad torso, wide waist and a fuller face' },
  { id: 'medium', label: 'Medium', frag: 'an average build with a balanced torso' },
  { id: 'thin', label: 'Slim', frag: 'a slim figure with a narrow torso, narrow waist and slim arms' },
  { id: 'skinny', label: 'Very slim', frag: 'a very slim, slight figure with narrow shoulders, a very narrow torso, thin arms and a slender face' },
  { id: 'stick_thin', label: 'Extra slim', frag: 'an extra slim, very slender figure with very narrow shoulders, a very narrow torso, very thin arms and legs and a slender face' },
];
export const SIZE_ORDER = SIZE_OPTS.map(s => s.id);

export const AGE_BANDS: { id: string; label: string; age: number; frag: string }[] = [
  { id: 'young_adult', label: 'Young adult (21–29)', age: 25, frag: 'in their mid twenties' },
  { id: 'adult', label: 'Adult (30–45)', age: 38, frag: 'in their late thirties' },
  { id: 'mature', label: 'Mature (46–65)', age: 55, frag: 'in their mid fifties' },
  { id: 'senior', label: 'Senior (65+)', age: 68, frag: 'in their late sixties' },
];
export const MIN_AGE = 21;
export function ageFragment(age: number): string {
  if (age <= 24) return 'in their early twenties';
  if (age <= 29) return 'in their late twenties';
  if (age <= 34) return 'in their early thirties';
  if (age <= 39) return 'in their late thirties';
  if (age <= 49) return 'in their forties';
  if (age <= 59) return 'in their fifties';
  if (age <= 69) return 'in their sixties';
  return 'in their seventies';
}

export const CONTROLS: Control[] = [
  { id: 'ethnicity', title: 'Ethnicity', ui: 'pill', applies: 'human', default: 'unspecified', options: mk([
    ['Unspecified', ''], ['African', 'African features'], ['East Asian', 'East Asian features'], ['South Asian', 'South Asian features'],
    ['Middle Eastern', 'Middle Eastern features'], ['European', 'European features'], ['Latin American', 'Latin American features'], ['Mixed', 'mixed heritage features']]) },
  { id: 'skinTone', title: 'Skin color', ui: 'swatch', applies: 'human', default: 'sand', options: mk([
    ['Porcelain', 'porcelain skin tone'], ['Light', 'light skin tone'], ['Sand', 'light olive skin tone'], ['Tan', 'tan skin tone'],
    ['Bronze', 'bronze skin tone'], ['Brown', 'brown skin tone'], ['Deep', 'deep brown skin tone'], ['Ebony', 'very deep dark skin tone']]) },
  { id: 'hairStyle', title: 'Hairstyle', ui: 'hair', applies: 'all', default: 'short_crop', options: mk([
    ['Short crop', 'short cropped hair'], ['Buzz cut', 'a buzz cut'], ['Bald', 'a shaved bald head'], ['Bob', 'a chin-length bob'], ['Long wavy', 'long wavy hair'],
    ['Curly', 'curly hair'], ['Braids', 'braided hair'], ['Afro', 'a natural afro'], ['Mohawk', 'a mohawk'], ['Pigtails', 'pigtails'], ['Top bun', 'a high top bun'],
    ['Ponytail', 'a ponytail'], ['Bowl cut', 'a bowl cut'], ['Slicked back', 'slicked-back hair'], ['Mullet', 'a mullet'], ['Pompadour', 'a pompadour'],
    ['Stair-step cut', 'hair cut in dramatic stair-step layers'], ['Giant pompadour', 'a towering exaggerated pompadour'], ['Mohawk tower', 'a very tall mohawk standing up like a tower'],
    ['Bubble afro', 'a huge round bubble-shaped afro'], ['Beehive', 'a tall beehive hairdo'], ['Space buns', 'two big space buns'], ['Spiral horns hair', 'hair styled into two spiralled horn shapes'],
    ['Unicorn horn hair', 'hair twisted into a single tall unicorn-horn spike'], ['Cotton-candy cloud', 'a huge fluffy cloud of hair like cotton candy'], ['Mushroom cap', 'a big round mushroom-cap haircut'],
    ['Long braid', 'one extremely long braid reaching the floor'], ['Rainbow mohawk', 'a bright rainbow-coloured mohawk'], ['Shaved pattern', 'short hair with a neat geometric shaved pattern'],
    ['Samurai top-knot', 'a tidy top-knot with shaved sides'], ['Antenna hair', 'two playful curled antenna-like hair tufts'], ['Waterfall curls', 'a cascade of very long ringlet curls'], ['Flame swirl', 'hair swept up into a stylised flame-shaped swirl'],
    ['Tornado swirl', 'hair spun up into a tall tornado-shaped swirl'], ['Pancake bun stack', 'a tall stack of three round buns on top of the head'], ['Lightning bolt part', 'short hair with a bold lightning-bolt shaped shaved pattern'],
    ['Hair crown braid', 'a huge braided crown of hair rising above the head'], ['Fountain ponytail', 'a high ponytail fountaining up and falling around the head'], ['Double mohawk', 'two parallel tall mohawk ridges'],
    ['Half-and-half', 'hair split in two very different styles, long and wavy on one side and short and spiky on the other'], ['Giant curl spring', 'long hair in huge spring-like corkscrew curls'],
    ['Star-shaped cut', 'short hair shaved and shaped into a bold star pattern'], ['Wave crest', 'hair swept up into a giant ocean-wave crest'], ['Hair cloud with pins', 'a big fluffy hair cloud held with many colourful hair pins'],
    ['Pointy spikes', 'hair in a ring of tall pointy spikes like a crown']]) },
  { id: 'hairColor', title: 'Hair color', ui: 'swatch', applies: 'all', default: 'dark_brown', options: mk([
    ['Black', 'black'], ['Dark brown', 'dark brown'], ['Brown', 'brown'], ['Auburn', 'auburn'], ['Ginger', 'ginger'], ['Blonde', 'blonde'],
    ['Platinum', 'platinum blonde'], ['Grey', 'grey'], ['Silver', 'silver'], ['Teal', 'teal'], ['Pink', 'pink'], ['Blue', 'blue']]) },
  { id: 'outfit', title: 'Outfit', ui: 'outfit', applies: 'all', default: 'white_tee_jeans', options: mk([
    ['White tee & jeans', 'a plain white t-shirt and blue jeans'], ['Hoodie & joggers', 'a loose hoodie and joggers'], ['Smart blazer', 'a smart blazer over a shirt with trousers'],
    ['Summer dress', 'a knee-length summer dress'], ['Sport set', 'a long-sleeved sports top and full-length sports trousers'],
    ['Denim jacket', 'a denim jacket over a t-shirt with trousers'], ['Knit & trousers', 'a chunky knit sweater and trousers'], ['Techwear', 'a techwear jacket and cargo trousers'],
    ['Inflatable dino', 'a full-body inflatable green dinosaur costume'], ['Giant chef hat', 'a chef uniform with an enormous tall chef hat and apron'], ['Clown-style suit', 'a baggy polka-dot suit with an oversized bow tie'],
    ['Superhero cape', 'a bright superhero costume with a long flowing cape, fully covered'], ['Wizard robe', 'a long star-covered wizard robe and pointed hat'], ['Pirate coat', 'a long pirate captain coat with a tricorn hat'],
    ['Mascot suit', 'a fluffy full-body sports mascot costume'], ['Glitter tracksuit', 'a sparkly glitter tracksuit'], ['Flower jacket', 'a jacket completely covered in colourful flowers'],
    ['Giant bow-tie suit', 'a tailored suit with a giant bow tie'], ['Knight armour', 'a shiny full suit of costume knight armour'], ['Space suit', 'a chunky retro space suit with a round helmet under the arm'],
    ['Banana costume', 'a full-body banana costume'], ['Duck rain gear', 'a yellow raincoat with a duck-shaped hood and rubber boots'], ['Patchwork coat', 'a long colourful patchwork coat'],
    ['Athletic leggings', 'full-length opaque stretchy athletic leggings with a long loose sports top that covers the hips'], ['Cycling shorts kit', 'knee-length stretchy athletic cycling shorts with a loose long-sleeved cycling jersey that covers the waist'],
    ['Ruffle top', 'an oversized ruffled blouse with big layered ruffles and plain trousers'], ['Puffy sleeve top', 'a top with enormous puffy balloon sleeves and plain trousers'], ['Mismatched top', 'a novelty top with two completely different mismatched sleeves and plain trousers'],
    ['Giant collar shirt', 'a shirt with a gigantic oversized pointed collar and plain trousers'], ['Neon windbreaker', 'a bright neon windbreaker over a plain long-sleeved top with trousers'],
    ['Novelty sweater', 'an oversized novelty knitted sweater with a bold abstract pattern and no writing, with trousers'], ['Tiered ruffle dress', 'a long dress with many layers of colourful ruffles'],
    ['Oversized puffer', 'an enormous oversized puffer jacket in a bright colour with trousers'], ['Patterned jumpsuit', 'a loose long-sleeved jumpsuit in a loud geometric pattern, fully covered']]) },
  { id: 'height', title: 'Height', ui: 'body', applies: 'all', default: 'average', options: mk([['Short', 'short in height'], ['Average', ''], ['Tall', 'tall']]) },
  { id: 'proportions', title: 'Proportions', ui: 'body', applies: 'all', default: 'balanced', options: mk([
    ['Balanced', ''], ['Long legs', 'long legs'], ['Long torso', 'a long torso'], ['Broad shoulders', 'broad shoulders'], ['Narrow shoulders', 'narrow shoulders'],
    ['Giant head', 'a cartoon giant head on a small body'], ['Tiny head', 'a comically tiny head on a large body'], ['Very long neck', 'a comically long neck'], ['Huge hands', 'cartoonishly huge hands'],
    ['Tiny hands', 'cartoonishly tiny hands'], ['Very long legs', 'comically long legs'], ['Stubby legs', 'short stubby legs'], ['Huge eyes', 'huge cartoon eyes'], ['Wide grin face', 'a very wide cartoon grin'],
    ['Tall and narrow', 'a very tall, narrow stylised shape'], ['Short and round', 'a short, round stylised shape']]) },
  { id: 'headShape', title: 'Head shape', ui: 'head', applies: 'human', default: 'oval', options: mk([
    ['Oval', 'an oval face'], ['Round', 'a round face'], ['Square', 'a square face'], ['Heart', 'a heart-shaped face'], ['Long', 'a long face'],
    ['Diamond', 'a diamond-shaped face'], ['Rectangle', 'a rectangular face'], ['Triangle', 'a triangular face'], ['Wide', 'a wide face'], ['Narrow', 'a narrow face']]) },
  { id: 'neck', title: 'Neck', ui: 'neck', applies: 'human', default: 'average', options: mk([['Short', 'a short neck'], ['Average', ''], ['Long', 'a long neck'], ['Strong', 'a strong neck']]) },
  { id: 'eyeShape', title: 'Eye shape', ui: 'eye', applies: 'human', default: 'almond', options: mk([
    ['Almond', 'almond-shaped eyes'], ['Round', 'round eyes'], ['Hooded', 'hooded eyes'], ['Wide', 'wide-set eyes'], ['Narrow', 'narrow eyes'], ['Upturned', 'upturned eyes'], ['Downturned', 'downturned eyes']]) },
  { id: 'eyeColor', title: 'Eye color', ui: 'swatch', applies: 'human', default: 'brown', options: mk([
    ['Brown', 'brown eyes'], ['Dark brown', 'dark brown eyes'], ['Hazel', 'hazel eyes'], ['Amber', 'amber eyes'], ['Green', 'green eyes'], ['Blue', 'blue eyes'], ['Grey', 'grey eyes'], ['Violet', 'violet eyes']]) },
  { id: 'features', title: 'Features', ui: 'face', multi: true, maxSelected: 3, applies: 'human', default: [], options: mk([
    ['Light freckles', 'light freckles'], ['Dimples', 'dimples'], ['Thick brows', 'thick eyebrows'], ['Thin brows', 'thin eyebrows'], ['Round ears', 'round ears'],
    ['Pointed ears', 'pointed ears in a fantasy style'], ['Rosy cheeks', 'rosy cheeks'], ['Beauty mark', 'a small beauty mark'], ['Laugh lines', 'laugh lines'], ['High cheekbones', 'high cheekbones']]) },
  { id: 'facialHair', title: 'Facial hair', ui: 'face', applies: 'human', default: 'none', options: mk([
    ['None', ''], ['Stubble', 'light stubble'], ['Short beard', 'a short beard'], ['Full beard', 'a full beard'], ['Moustache', 'a moustache'],
    ['Goatee', 'a goatee'], ['Mutton chops', 'mutton chops'], ['Soul patch', 'a soul patch']]) },
  { id: 'distinctive', title: 'Distinctive features', ui: 'face', applies: 'human', default: 'none', options: mk([
    ['None', ''], ['Small scar', 'a small scar on the cheek'], ['Birthmark', 'a birthmark'], ['Vitiligo patches', 'vitiligo patches'],
    ['Different-coloured eyes', 'one blue eye and one brown eye'], ['Face gems', 'small decorative face gems']]) },
  { id: 'accessory', title: 'Accessories', ui: 'acc', applies: 'all', default: 'none', options: mk([
    ['None', ''], ['Round glasses', 'round glasses'], ['Sunglasses', 'sunglasses'], ['Headphones', 'over-ear headphones'], ['Cap', 'a baseball cap'],
    ['Earrings', 'small earrings'], ['Necklace', 'a simple necklace'], ['Scarf', 'a scarf']]) },
  { id: 'expression', title: 'Expression', ui: 'pill', applies: 'all', default: 'soft_smile', options: mk([
    ['Neutral', 'a neutral expression'], ['Soft smile', 'a soft smile'], ['Big grin', 'a big friendly grin'], ['Laughing', 'laughing'], ['Surprised', 'a surprised look'], ['Thinking', 'a thoughtful look']]) },
  { id: 'lighting', title: 'Lighting', ui: 'pill', applies: 'all', default: 'soft_daylight', options: mk([
    ['Soft daylight', 'soft daylight'], ['Golden hour', 'warm golden hour light'], ['Studio softbox', 'studio softbox lighting'], ['Neon night', 'neon night lighting'], ['Ring light', 'ring-light lighting']]) },
  { id: 'background', title: 'Background', ui: 'pill', applies: 'all', default: 'studio', options: mk([
    ['Studio', 'a clean studio backdrop'], ['City street', 'a city street'], ['Cafe', 'a cosy cafe'], ['Park', 'a sunny park'], ['Home setup', 'a creator desk setup at home'],
    ['Candy land', 'a candy-land set with giant lollipops'], ['Mushroom forest', 'a forest of giant colourful mushrooms'], ['Retro arcade', 'a bright retro arcade'], ['Cloud kingdom', 'a soft cloud kingdom in the sky'],
    ['Disco room', 'a disco room with a mirror ball'], ['Comic dots', 'a comic-book halftone dot backdrop'], ['Paper craft set', 'a handmade paper-craft set']]) },
  { id: 'renderStyle', title: 'Style', ui: 'pill', applies: 'all', default: 'photo', options: mk([
    ['Photo', 'studio portrait photo'], ['Film still', 'cinematic film still'], ['3D animated', '3D animated style'], ['Illustration', 'clean digital illustration'],
    ['Cartoon', 'bold colourful cartoon style'], ['Claymation', 'handmade claymation style'], ['Comic book', 'comic-book illustration style'], ['Sticker', 'glossy die-cut sticker style'],
    ['3D toy', 'glossy 3D vinyl toy style'], ['Watercolour', 'soft watercolour painting style']]) },
  { id: 'prop', title: 'Props', ui: 'acc', applies: 'all', default: 'none', options: mk([
    ['None', ''], ['Oversized sunglasses', 'holding a pair of comically oversized sunglasses'], ['Giant lollipop', 'holding a giant swirly lollipop'], ['Rubber chicken', 'holding a rubber chicken'],
    ['Tiny umbrella', 'holding a tiny umbrella'], ['Balloon bunch', 'holding a big bunch of colourful balloons'], ['Trumpet', 'holding a shiny trumpet'], ['Skateboard', 'holding a skateboard under one arm'],
    ['Teapot', 'holding a large teapot'], ['Cardboard crown', 'wearing a cardboard crown'], ['Bubbles', 'surrounded by floating soap bubbles'], ['Pet frog', 'with a small pet frog on one shoulder'],
    ['Stack of books', 'carrying a tall stack of books'], ['Giant donut', 'holding a giant donut'], ['Megaphone', 'holding a toy megaphone']]) },
  { id: 'shoes', title: 'Shoes', ui: 'acc', applies: 'all', default: 'none', options: mk([
    ['None', ''], ['Clown-length shoes', 'extremely long exaggerated clown-length shoes, twice the length of the feet'], ['Curly-toe shoes', 'pointed shoes with long upward-curling toes'], ['Platform boots', 'very tall chunky platform boots'],
    ['Giant sneakers', 'comically oversized bright sneakers'], ['Rocket boots', 'chunky retro-futuristic boots with fins'], ['Duck-foot shoes', 'wide flat duck-foot shaped shoes'], ['Striped boots', 'tall boots with bold rainbow stripes'],
    ['Spring shoes', 'shoes with big coiled springs under the soles']]) },
];
/** Options added by plan 28: only drawn when the slider is above Realistic. */
const SILLY_FROM: Record<string, string> = { hairStyle: 'stair_step_cut', outfit: 'inflatable_dino', proportions: 'giant_head', background: 'candy_land', renderStyle: 'cartoon', prop: 'oversized_sunglasses', shoes: 'clown_length_shoes' };
for (const c of CONTROLS) { const from = SILLY_FROM[c.id]; if (!from) continue; const i = c.options.findIndex(o => o.id === from); for (const o of c.options.slice(i)) o.silly = true; }
export const CONTROL_BY_ID = new Map(CONTROLS.map(c => [c.id, c]));

export const CLOTHING_PHRASE = 'wearing well-fitted, modest everyday clothing, fully covered';
export const CONSTRAINT_TAIL = 'Adult, fully clothed in well-fitted modest everyday clothing, friendly and tasteful.';
export const NEGATIVE_PROMPT = 'nudity, revealing clothing, tight clothing, child, minor, young child, deformed, extra fingers, watermark, text, logo';

export const PRESETS: { id: string; label: string; patch: Record<string, string | string[] | number>; silly?: boolean }[] = [
  { id: 'everyday', label: 'Everyday creator', patch: { outfit: 'white_tee_jeans', expression: 'soft_smile', background: 'home_setup' } },
  { id: 'tech', label: 'Tech reviewer', patch: { outfit: 'hoodie_joggers', accessory: 'round_glasses', background: 'home_setup', lighting: 'ring_light' } },
  { id: 'fitness', label: 'Fitness coach', patch: { outfit: 'sport_set', expression: 'big_grin', background: 'park' } },
  { id: 'travel', label: 'Travel vlogger', patch: { outfit: 'denim_jacket', accessory: 'cap', background: 'city_street', lighting: 'golden_hour' } },
  { id: 'smart', label: 'Smart presenter', patch: { outfit: 'smart_blazer', lighting: 'studio_softbox', background: 'studio' } },
  { id: 'night', label: 'Night owl', patch: { outfit: 'techwear', lighting: 'neon_night', background: 'city_street' } },
  // Silly preset pack (plan 28.3): one click fills the builder; everything stays editable. Fictional characters only.
  { id: 'sir_pompadour', label: 'Sir Pompadour', silly: true, patch: { type: 'male', hairStyle: 'giant_pompadour', outfit: 'smart_blazer', prop: 'oversized_sunglasses', silliness: 3 } },
  { id: 'captain_frog', label: 'Captain Frog', silly: true, patch: { type: 'frog_person', outfit: 'pirate_coat', prop: 'pet_frog', silliness: 3 } },
  { id: 'disco_moth', label: 'Disco Moth', silly: true, patch: { type: 'insect_person', species: 'moth', outfit: 'glitter_tracksuit', background: 'disco_room', silliness: 3 } },
  { id: 'mushroom_hermit', label: 'Mushroom Hat Hermit', silly: true, patch: { type: 'female', hairStyle: 'mushroom_cap', background: 'mushroom_forest', renderStyle: 'claymation', silliness: 3 } },
  { id: 'cloud_chef', label: 'Cloud Hair Chef', silly: true, patch: { type: 'female', hairStyle: 'cotton_candy_cloud', outfit: 'giant_chef_hat', prop: 'giant_donut', silliness: 3 } },
  { id: 'space_parrot', label: 'Space Parrot', silly: true, patch: { type: 'bird_person', species: 'parrot', outfit: 'space_suit', background: 'cloud_kingdom', silliness: 3 } },
  { id: 'hamster_wizard', label: 'Hamster Wizard', silly: true, patch: { type: 'rodent_person', outfit: 'wizard_robe', prop: 'teapot', silliness: 3 } },
  { id: 'dino_dave', label: 'Inflatable Dino Dave', silly: true, patch: { type: 'male', outfit: 'inflatable_dino', expression: 'big_grin', background: 'retro_arcade', silliness: 4 } },
  { id: 'stair_step_steve', label: 'Stair-Step Steve', silly: true, patch: { type: 'male', hairStyle: 'stair_step_cut', outfit: 'denim_jacket', proportions: 'giant_head', silliness: 3 } },
  { id: 'bubble_afro', label: 'Bubble Afro Star', silly: true, patch: { type: 'female', hairStyle: 'bubble_afro', outfit: 'glitter_tracksuit', prop: 'bubbles', silliness: 3 } },
  { id: 'owl_professor', label: 'Owl Professor', silly: true, patch: { type: 'bird_person', species: 'owl', outfit: 'knit_trousers', accessory: 'round_glasses', prop: 'stack_of_books', silliness: 2 } },
  { id: 'banana_detective', label: 'Banana Detective', silly: true, patch: { type: 'non_binary', outfit: 'banana_costume', accessory: 'sunglasses', silliness: 4 } },
  { id: 'robot_barista', label: 'Robot Barista', silly: true, patch: { type: 'robot', outfit: 'giant_chef_hat', background: 'cafe', prop: 'teapot', silliness: 3 } },
  { id: 'mascot_marvin', label: 'Mascot Marvin', silly: true, patch: { type: 'male', outfit: 'mascot_suit', expression: 'laughing', renderStyle: '3d_toy', silliness: 4 } },
  { id: 'unicorn_hair', label: 'Unicorn Hair Hero', silly: true, patch: { type: 'female', hairStyle: 'unicorn_horn_hair', outfit: 'superhero_cape', silliness: 3 } },
  { id: 'rainbow_mohawk', label: 'Rainbow Mohawk Mike', silly: true, patch: { type: 'male', hairStyle: 'rainbow_mohawk', outfit: 'flower_jacket', silliness: 3 } },
  { id: 'cat_cafe', label: 'Cat Cafe Owner', silly: true, patch: { type: 'cat_person', outfit: 'knit_trousers', background: 'cafe', prop: 'teapot', silliness: 2 } },
  { id: 'knight_duck', label: 'Duck Knight', silly: true, patch: { type: 'bird_person', species: 'toucan', outfit: 'knight_armour', prop: 'cardboard_crown', silliness: 4 } },
  { id: 'paper_baker', label: 'Paper-Craft Baker', silly: true, patch: { type: 'female', outfit: 'giant_chef_hat', background: 'paper_craft_set', renderStyle: 'cartoon', silliness: 3 } },
  { id: 'plush_pal', label: 'Plush Pal', silly: true, patch: { type: 'plush_person', outfit: 'hoodie_joggers', expression: 'big_grin', silliness: 3 } },
  { id: 'fox_trumpeter', label: 'Fox Trumpeter', silly: true, patch: { type: 'fox_person', outfit: 'smart_blazer', prop: 'trumpet', background: 'disco_room', silliness: 3 } },
  { id: 'duck_rain', label: 'Rainy-Day Duck Hood', silly: true, patch: { type: 'non_binary', outfit: 'duck_rain_gear', prop: 'tiny_umbrella', silliness: 3 } },
  { id: 'balloon_wizard', label: 'Balloon Wizard', silly: true, patch: { type: 'male', outfit: 'wizard_robe', prop: 'balloon_bunch', hairStyle: 'long_braid', silliness: 3 } },
  { id: 'long_shoe_larry', label: 'Long-Shoe Larry', silly: true, patch: { type: 'male', shoes: 'clown_length_shoes', outfit: 'clown_style_suit', hairStyle: 'rainbow_mohawk', silliness: 4 } },
  { id: 'curly_toe_queen', label: 'Curly-Toe Queen', silly: true, patch: { type: 'female', shoes: 'curly_toe_shoes', outfit: 'tiered_ruffle_dress', hairStyle: 'hair_crown_braid', silliness: 3 } },
  { id: 'platform_pete', label: 'Platform Pete', silly: true, patch: { type: 'male', shoes: 'platform_boots', outfit: 'neon_windbreaker', hairStyle: 'tornado_swirl', silliness: 3 } },
  { id: 'cycling_clara', label: 'Cycling Clara', silly: true, patch: { type: 'female', outfit: 'cycling_shorts_kit', hairStyle: 'fountain_ponytail', shoes: 'giant_sneakers', background: 'park', silliness: 2 } },
  { id: 'legging_lou', label: 'Legging Lou', silly: true, patch: { type: 'non_binary', outfit: 'athletic_leggings', hairStyle: 'double_mohawk', shoes: 'striped_boots', silliness: 3 } },
  { id: 'ruffle_rosa', label: 'Ruffle Rosa', silly: true, patch: { type: 'female', outfit: 'ruffle_top', hairStyle: 'giant_curl_spring', silliness: 3 } },
  { id: 'puffy_percy', label: 'Puffy Percy', silly: true, patch: { type: 'male', outfit: 'puffy_sleeve_top', hairStyle: 'pancake_bun_stack', silliness: 3 } },
  { id: 'mismatch_max', label: 'Mismatch Max', silly: true, patch: { type: 'male', outfit: 'mismatched_top', hairStyle: 'half_and_half', silliness: 3 } },
  { id: 'collar_connie', label: 'Giant-Collar Connie', silly: true, patch: { type: 'female', outfit: 'giant_collar_shirt', hairStyle: 'wave_crest', silliness: 3 } },
  { id: 'spring_steps', label: 'Spring-Step Sam', silly: true, patch: { type: 'non_binary', shoes: 'spring_shoes', outfit: 'oversized_puffer', hairStyle: 'pointy_spikes', silliness: 4 } },
  { id: 'space_buns', label: 'Space Buns Skater', silly: true, patch: { type: 'female', hairStyle: 'space_buns', outfit: 'sport_set', prop: 'skateboard', silliness: 2 } },
];

/** Realism <-> Ridiculous slider (plan 28.2): 5 fixed levels. A compiler input, never free text. */
export const SILLINESS: { id: number; label: string; frag: string }[] = [
  { id: 0, label: 'Realistic', frag: '' },
  { id: 1, label: 'Slightly stylised', frag: 'slightly stylised, with gently exaggerated features' },
  { id: 2, label: 'Playful', frag: 'playful and quirky, with clearly exaggerated styling' },
  { id: 3, label: 'Silly', frag: 'comic and silly, with exaggerated cartoon proportions and bold colours' },
  { id: 4, label: 'Ridiculous', frag: 'completely over-the-top, absurd and comical, with wildly exaggerated cartoon proportions and very bold colours' },
];
