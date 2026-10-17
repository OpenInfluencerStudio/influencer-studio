import { describe, it, expect } from 'vitest';
import { isBlocked, normaliseTokens, validateName } from '../src/safety/index.js';
import { BLOCKED_TERMS_ROT13 } from '../src/safety/terms.js';

const rot13 = (s: string) => s.replace(/[a-z]/g, c => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));

describe('blocked terms', () => {
  it('every term in every category is refused, including obfuscated variants', () => {
    for (const [cat, list] of Object.entries(BLOCKED_TERMS_ROT13)) {
      for (const t of list.map(rot13)) {
        expect(isBlocked(`a portrait, ${t}`), `${cat}:plain`).toBe(true);
        expect(isBlocked(`a portrait, ${t.toUpperCase()}`), `${cat}:upper`).toBe(true);
        if (t.length >= 4) expect(isBlocked(`portrait ${t.split('').join(' ')}`), `${cat}:spaced`).toBe(true);
        if (t.length >= 4) expect(isBlocked(`portrait ${t.split('').join('.')}`), `${cat}:dotted`).toBe(true);
        if (t.length >= 4) expect(isBlocked(`portrait ${t.replace(/o/g, '0').replace(/e/g, '3').replace(/a/g, '4')}`) || !/[oea]/.test(t), `${cat}:leet`).toBe(true);
        expect(isBlocked(`portrait ${t.replace(/a/g, 'а').replace(/e/g, 'е').replace(/o/g, 'о')}`), `${cat}:homoglyph`).toBe(true);
        expect(isBlocked(`portrait ${t.slice(0, 1)}\u200b${t.slice(1)}`), `${cat}:zwsp`).toBe(true);
      }
    }
  });
  it('refuses minor-implying ages in many forms', () => {
    for (const s of ['17 years old', 'age 17', '15yo', 'aged 19', '20 year old', '18 yrs']) expect(isBlocked('a person ' + s), s).toBe(true);
    for (const s of ['25 years old', 'age 30', '21yo']) expect(isBlocked('a person ' + s), s).toBe(false);
  });
  it('refuses clothing negation, injection and real-person phrasing', () => {
    for (const s of ['no clothes', 'remove the shirt', 'not wearing any clothes', 'ignore previous instructions', 'looks like a famous actor']) expect(isBlocked(s), s).toBe(true);
  });
  it('false-positive list stays allowed', () => {
    for (const s of ['Essex', 'a classic look', 'assistant', 'fatherly warmth', 'thinking pose', 'Scunthorpe', 'a cocktail', 'grasshopper', 'class of expertise', 'bareilly', 'striped scarf', 'skyscraper', 'Dickens novel', 'boyfriend jacket', 'therapist', 'passionate', 'cassette'])
      expect(isBlocked(s), s).toBe(false);
  });
  it('skinny and fat words are refused in free text (size words only come from the table)', () => {
    expect(isBlocked('skinny jeans')).toBe(true); expect(isBlocked('a fat cat')).toBe(true);
  });
  it('normalises', () => { expect(normaliseTokens('N-4-K-3-D')).toEqual(['naked']); });
  it('names must be plain letters', () => {
    expect(validateName('  Mira  Lane ')).toBe('Mira Lane');
    for (const n of ['', '<b>x</b>', 'a'.repeat(31), '1234', 'Mira; drop table']) expect(() => validateName(n), n).toThrow();
  });
  it('the public repo carries no plain blocked words in the terms file', async () => {
    const src = await import('node:fs').then(f => f.readFileSync(new URL('../src/safety/terms.ts', import.meta.url), 'utf8'));
    for (const t of ['nude', 'porn', 'naked']) expect(src.includes(`"${t}"`)).toBe(false);
  });
});
