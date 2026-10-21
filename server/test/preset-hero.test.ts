import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { presetHeroJobs, exampleJobs } from '../src/presetHero.js';
import { PRESETS, CREATURE_TYPES } from '../src/compiler/schema.js';
import { isBlocked } from '../src/safety/index.js';
import { presetImage, examplePreview, type PreviewItem } from '../../ui/src/api.js';

const dir = fileURLToPath(new URL('../../assets/previews/', import.meta.url));
const items = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')).items as PreviewItem[];
const map = new Map<string, PreviewItem[]>(); for (const i of items) { const k = i.control + '/' + i.option; map.set(k, [...(map.get(k) ?? []), i]); }
const jobs = presetHeroJobs();

describe('preset hero images', () => {
  it('6 regular presets x 3 looks + every silly preset have a shipped image', () => {
    expect(PRESETS.filter(p => !p.silly).length).toBe(6);
    expect(PRESETS.filter(p => p.silly).length).toBe(33);
    expect(jobs.length).toBe(6 * 3 + 33);
    for (const j of jobs) expect(existsSync(dir + j.file), j.file).toBe(true);
    for (const p of PRESETS) expect(map.get('preset/' + p.id)?.length, p.id).toBe(p.silly ? 1 : 3);
  });
  it('hero prompts are realistic photos, colourful, safe, adult and fully clothed', () => {
    for (const j of jobs) {
      expect(j.prompt, j.file).toMatch(/^photorealistic/);
      expect(j.prompt, j.file).not.toMatch(/cartoon style|3D vinyl toy|claymation style|comic-book|sticker style|watercolour painting|exaggerated cartoon proportions/i);
      expect(j.prompt, j.file).toMatch(/adult/); expect(j.prompt, j.file).toMatch(/fully clothed|fully covered/);
      expect(j.prompt, j.file).not.toMatch(/\bgr[ae]y (t-shirt|shirt|clothing|hoodie|top|sweater|jumper|trousers)\b/i);
      expect(isBlocked(j.prompt), j.file).toBeFalsy();
    }
  });
  it('human presets have no frog, lizard or reptile wording', () => {
    for (const p of PRESETS) {
      if (CREATURE_TYPES.includes(p.patch.type as string) || ['alien', 'monster'].includes(p.patch.type as string)) continue;
      for (const j of jobs.filter(x => x.id === p.id)) expect(j.prompt, j.file).not.toMatch(/\b(frogs?|lizard|reptil\w*|amphib\w*|scales|scaly|green skin)\b/i);
    }
  });
  it('preset card image follows the builder look; silly presets use their single image', () => {
    expect(presetImage(map, 'everyday', 'female')?.file).toBe('presets/everyday__woman.webp');
    expect(presetImage(map, 'everyday', 'non_binary')?.file).toBe('presets/everyday__nonbinary.webp');
    expect(presetImage(map, 'everyday', 'surprise')?.file).toBe('presets/everyday__man.webp');
    expect(presetImage(map, 'captain_frog', 'male')?.file).toBe('presets/captain_frog.webp');
  });
  it('colourful example preview exists for every human look and size, alien, monster and each creature type', () => {
    for (const e of exampleJobs()) expect(existsSync(dir + e.file), e.file).toBe(true);
    for (const t of ['surprise', 'male', 'female', 'non_binary', 'trans_woman', 'trans_man', 'alien', 'monster', ...CREATURE_TYPES]) for (const s of ['skinny', 'medium', 'fat'])
      expect(examplePreview(map, s, t), `${t}/${s}`).not.toBeNull();
    expect(examplePreview(map, 'medium', 'frog_person')?.look).toBe('creature_frog_person');
    expect(examplePreview(map, 'medium', 'male')?.look).toBe('man');
  });
});
