/**
 * Character schema: every selectable option, its UI label and its prompt fragment.
 * The compiler works from option IDS only; labels are for display (plan 23.4 rule 4).
 * All fragments are SFW, adult, non-demeaning and describe clothed characters.
 */
export interface Opt { id: string; label: string; frag: string }
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
  | 'headShape' | 'neck' | 'eyeShape' | 'eyeColor' | 'features' | 'facialHair' | 'distinctive' | 'accessory' | 'expression' | 'lighting' | 'background' | 'renderStyle';

export const TYPE_OPTS: (Opt & { human: boolean; phrase: string })[] = [
  { id: 'surprise', label: 'Surprise me', frag: '', human: true, phrase: '' },
  { id: 'male', label: 'Man', frag: '', human: true, phrase: 'adult man' },
  { id: 'female', label: 'Woman', frag: '', human: true, phrase: 'adult woman' },
  { id: 'non_binary', label: 'Non-binary', frag: '', human: true, phrase: 'adult non-binary person with an androgynous look' },
  { id: 'trans_woman', label: 'Trans woman', frag: '', human: true, phrase: 'adult woman' },
  { id: 'trans_man', label: 'Trans man', frag: '', human: true, phrase: 'adult man' },
  { id: 'alien', label: 'Alien', frag: '', human: false, phrase: 'adult-appearing humanoid alien' },
  { id: 'monster', label: 'Monster', frag: '', human: false, phrase: 'adult-appearing friendly humanoid fantasy creature' },
];
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
export const SPECIES_BY_TYPE: Record<string, Opt[]> = { alien: ALIEN_SPECIES, monster: MONSTER_SPECIES };

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
    ['Ponytail', 'a ponytail'], ['Bowl cut', 'a bowl cut'], ['Slicked back', 'slicked-back hair'], ['Mullet', 'a mullet'], ['Pompadour', 'a pompadour']]) },
  { id: 'hairColor', title: 'Hair color', ui: 'swatch', applies: 'all', default: 'dark_brown', options: mk([
    ['Black', 'black'], ['Dark brown', 'dark brown'], ['Brown', 'brown'], ['Auburn', 'auburn'], ['Ginger', 'ginger'], ['Blonde', 'blonde'],
    ['Platinum', 'platinum blonde'], ['Grey', 'grey'], ['Silver', 'silver'], ['Teal', 'teal'], ['Pink', 'pink'], ['Blue', 'blue']]) },
  { id: 'outfit', title: 'Outfit', ui: 'outfit', applies: 'all', default: 'white_tee_jeans', options: mk([
    ['White tee & jeans', 'a plain white t-shirt and blue jeans'], ['Hoodie & joggers', 'a loose hoodie and joggers'], ['Smart blazer', 'a smart blazer over a shirt with trousers'],
    ['Summer dress', 'a knee-length summer dress'], ['Sport set', 'a long-sleeved sports top and full-length sports trousers'],
    ['Denim jacket', 'a denim jacket over a t-shirt with trousers'], ['Knit & trousers', 'a chunky knit sweater and trousers'], ['Techwear', 'a techwear jacket and cargo trousers']]) },
  { id: 'height', title: 'Height', ui: 'body', applies: 'all', default: 'average', options: mk([['Short', 'short in height'], ['Average', ''], ['Tall', 'tall']]) },
  { id: 'proportions', title: 'Proportions', ui: 'body', applies: 'all', default: 'balanced', options: mk([
    ['Balanced', ''], ['Long legs', 'long legs'], ['Long torso', 'a long torso'], ['Broad shoulders', 'broad shoulders'], ['Narrow shoulders', 'narrow shoulders']]) },
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
    ['Studio', 'a clean studio backdrop'], ['City street', 'a city street'], ['Cafe', 'a cosy cafe'], ['Park', 'a sunny park'], ['Home setup', 'a creator desk setup at home']]) },
  { id: 'renderStyle', title: 'Style', ui: 'pill', applies: 'all', default: 'photo', options: mk([
    ['Photo', 'studio portrait photo'], ['Film still', 'cinematic film still'], ['3D animated', '3D animated style'], ['Illustration', 'clean digital illustration']]) },
];
export const CONTROL_BY_ID = new Map(CONTROLS.map(c => [c.id, c]));

export const CLOTHING_PHRASE = 'wearing well-fitted, modest everyday clothing, fully covered';
export const CONSTRAINT_TAIL = 'Adult, fully clothed in well-fitted modest everyday clothing, friendly and tasteful.';
export const NEGATIVE_PROMPT = 'nudity, revealing clothing, tight clothing, child, minor, young child, deformed, extra fingers, watermark, text, logo';

export const PRESETS: { id: string; label: string; patch: Record<string, string | string[]> }[] = [
  { id: 'everyday', label: 'Everyday creator', patch: { outfit: 'white_tee_jeans', expression: 'soft_smile', background: 'home_setup' } },
  { id: 'tech', label: 'Tech reviewer', patch: { outfit: 'hoodie_joggers', accessory: 'round_glasses', background: 'home_setup', lighting: 'ring_light' } },
  { id: 'fitness', label: 'Fitness coach', patch: { outfit: 'sport_set', expression: 'big_grin', background: 'park' } },
  { id: 'travel', label: 'Travel vlogger', patch: { outfit: 'denim_jacket', accessory: 'cap', background: 'city_street', lighting: 'golden_hour' } },
  { id: 'smart', label: 'Smart presenter', patch: { outfit: 'smart_blazer', lighting: 'studio_softbox', background: 'studio' } },
  { id: 'night', label: 'Night owl', patch: { outfit: 'techwear', lighting: 'neon_night', background: 'city_street' } },
];
