export type Hw = { id: string; name: string; vram: number; ram: number; tier: string };
export const HW: Hw[] = [
  { id: 'pro', name: 'NVIDIA RTX PRO 6000', vram: 96, ram: 128, tier: 'T9' },
  { id: 'mid', name: 'NVIDIA RTX 4080', vram: 16, ram: 32, tier: 'T4' },
  { id: 'weak', name: 'On-board graphics (shared)', vram: 1, ram: 8, tier: 'T0' },
];
export type Model = { id: string; name: string; kind: string; need: number; size: number; lic: string; quant: string };
export const MODELS: Model[] = [
  { id: 'klein', name: 'FLUX.2 klein 4B', kind: 'Image', need: 8, size: 8.2, lic: 'Apache-2.0', quant: 'bf16' },
  { id: 'qwen', name: 'Qwen-Image-Edit-2511', kind: 'Image edit', need: 12, size: 13.1, lic: 'Apache-2.0', quant: 'Q4_K_M GGUF' },
  { id: 'wan', name: 'Wan 2.2 TI2V-5B', kind: 'Video', need: 12, size: 10.4, lic: 'Apache-2.0', quant: 'fp16' },
  { id: 'animate', name: 'Wan 2.2 Animate', kind: 'Motion transfer', need: 20, size: 17.5, lic: 'Apache-2.0', quant: 'Q4_K_M GGUF' },
  { id: 'inf', name: 'InfiniteTalk', kind: 'Lip-sync', need: 24, size: 19.0, lic: 'Apache-2.0', quant: 'Q4_K_M GGUF' },
];
export const RES = [
  { r: '512 px', need: 1 }, { r: '768 px', need: 8 }, { r: '1024 px', need: 12 },
  { r: '1536 px', need: 24 }, { r: '2048 px', need: 48 }, { r: '4K upscale', need: 80 },
];
export const TYPES = ['Neutral / random', 'Human', 'Alien', 'Monster'];
export const SPECIES: Record<string, string[]> = {
  Alien: ['Grey-skinned', 'Blue humanoid', 'Insectoid', 'Crystalline', 'Tall elder'],
  Monster: ['Friendly troll', 'Gentle ogre', 'Fuzzy beast', 'Scaled drake', 'Stone golem'],
};
export const SIZES = ['Ultra large', 'Large', 'Medium', 'Slim', 'Very slim', 'Extra slim'];
export const GENDERS = [['Neutral / random', '◌'], ['Female', '♀'], ['Male', '♂'], ['Non-binary', '⚲'], ['Trans woman', '⚧'], ['Trans man', '⚧']];
export type Sec = { id: string; title: string; icon: string; kind: 'gender' | 'type' | 'species' | 'size' | 'hair' | 'outfit' | 'pill' | 'swatch' | 'body' | 'head' | 'neck' | 'eye' | 'face' | 'acc'; opts: string[]; open?: boolean };
export const SECS: Sec[] = [
  { id: 'type', title: 'Character type', icon: '✦', kind: 'type', opts: TYPES, open: true },
  { id: 'species', title: 'Species', icon: '✧', kind: 'species', opts: [], open: true },
  { id: 'gender', title: 'Gender', icon: '⚥', kind: 'gender', opts: GENDERS.map(g => g[0]), open: true },
  { id: 'size', title: 'Body size', icon: '◍', kind: 'size', opts: SIZES, open: true },
  { id: 'hair', title: 'Hairstyle', icon: '❀', kind: 'hair', opts: ['Short crop', 'Buzz cut', 'Bald', 'Bob', 'Long wavy', 'Curly', 'Braids', 'Afro', 'Mohawk', 'Pigtails', 'Top bun', 'Ponytail', 'Bowl cut', 'Slicked back', 'Mullet', 'Pompadour'], open: true },
  { id: 'hairc', title: 'Hair color', icon: '◐', kind: 'swatch', opts: ['Black', 'Dark brown', 'Brown', 'Auburn', 'Ginger', 'Blonde', 'Platinum', 'Grey', 'Silver', 'Teal', 'Pink', 'Blue'] },
  { id: 'outfit', title: 'Outfit', icon: '▣', kind: 'outfit', opts: ['White tee & jeans', 'Hoodie & joggers', 'Smart blazer', 'Summer dress', 'Sport set', 'Denim jacket', 'Knit & trousers', 'Techwear'] },
  { id: 'ethn', title: 'Ethnicity', icon: '◎', kind: 'pill', opts: ['African', 'East Asian', 'South Asian', 'Middle Eastern', 'European', 'Latin American', 'Mixed'] },
  { id: 'age', title: 'Age', icon: '◔', kind: 'pill', opts: ['Young adult (18–29)', 'Adult (30–45)', 'Mature (46–65)', 'Senior (65+)'] },
  { id: 'skin', title: 'Skin color', icon: '●', kind: 'swatch', opts: ['Porcelain', 'Light', 'Sand', 'Tan', 'Bronze', 'Brown', 'Deep', 'Ebony'] },
  { id: 'height', title: 'Height', icon: '↕', kind: 'body', opts: ['Short', 'Average', 'Tall'] },
  { id: 'prop', title: 'Proportions', icon: '◫', kind: 'body', opts: ['Balanced', 'Long legs', 'Long torso', 'Broad shoulders', 'Narrow shoulders'] },
  { id: 'head', title: 'Head shape', icon: '◯', kind: 'head', opts: ['Oval', 'Round', 'Square', 'Heart', 'Long', 'Diamond', 'Rectangle', 'Triangle', 'Wide', 'Narrow'] },
  { id: 'neck', title: 'Neck', icon: '▯', kind: 'neck', opts: ['Short', 'Average', 'Long', 'Strong'] },
  { id: 'eyes', title: 'Eye shape', icon: '◉', kind: 'eye', opts: ['Almond', 'Round', 'Hooded', 'Wide', 'Narrow', 'Upturned', 'Downturned'] },
  { id: 'eyec', title: 'Eye color', icon: '◉', kind: 'swatch', opts: ['Brown', 'Dark brown', 'Hazel', 'Amber', 'Green', 'Blue', 'Grey', 'Violet'] },
  { id: 'feat', title: 'Features', icon: '✺', kind: 'face', opts: ['Light freckles', 'Dimples', 'Thick brows', 'Thin brows', 'Round ears', 'Pointed ears', 'Rosy cheeks', 'Beauty mark', 'Laugh lines', 'High cheekbones'] },
  { id: 'fh', title: 'Facial hair', icon: '≋', kind: 'face', opts: ['None', 'Stubble', 'Short beard', 'Full beard', 'Moustache', 'Goatee', 'Mutton chops', 'Soul patch'] },
  { id: 'dist', title: 'Distinctive features', icon: '❖', kind: 'face', opts: ['None', 'Small scar', 'Birthmark', 'Vitiligo patches', 'Different-coloured eyes', 'Face gems'] },
  { id: 'acc', title: 'Accessories', icon: '◈', kind: 'acc', opts: ['None', 'Round glasses', 'Sunglasses', 'Headphones', 'Cap', 'Earrings', 'Necklace', 'Scarf'] },
];
export const PRESETS = ['Everyday creator', 'Tech reviewer', 'Fitness coach', 'Travel vlogger', 'Fantasy guide', 'Space explorer'];
