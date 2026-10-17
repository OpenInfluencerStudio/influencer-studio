import { BLOCKED_TERMS_ROT13 } from './terms.js';

export class SafetyError extends Error {
  readonly code = 'unsupported_description';
  constructor() { super("That description isn't supported in this app"); }
}

const rot13 = (s: string) => s.replace(/[a-z]/g, c => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
const EXACT = new Set<string>();
for (const list of Object.values(BLOCKED_TERMS_ROT13)) for (const t of list) { const w = rot13(t); EXACT.add(w); EXACT.add(w.replace(/([a-z])\1{2,}/g, '$1')); }

const HOMOGLYPH: Record<string, string> = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ѕ': 's', 'ј': 'j', 'α': 'a', 'ο': 'o', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ρ': 'p', 'τ': 't' };
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

/** Normalise to lowercase ascii tokens: strips accents, zero-width chars, look-alike letters, leetspeak and spaced-out letters. */
export function normaliseTokens(input: string): string[] {
  let s = input.normalize('NFKD').replace(/[\u0300-\u036f\u200b-\u200f\u2060\ufeff]/g, '').toLowerCase();
  s = [...s].map(c => HOMOGLYPH[c] ?? c).join('');
  const raw = s.replace(/[^a-z0-9@$]+/g, ' ').trim().split(' ').filter(Boolean);
  // join runs of 3+ single characters ("n u d e", "n-4-k-3-d")
  const joined: string[] = [];
  for (let i = 0; i < raw.length;) {
    let j = i;
    while (j < raw.length && raw[j].length === 1) j++;
    if (j - i >= 3) { joined.push(raw.slice(i, j).join('')); i = j; } else { joined.push(raw[i]); i++; }
  }
  // leetspeak only inside tokens that also contain letters
  return joined
    .map(w => (/[a-z]/.test(w) && /[^a-z]/.test(w) ? [...w].map(c => LEET[c] ?? c).join('') : w))
    .map(t => t.replace(/([a-z])\1{2,}/g, '$1'));
}

const PHRASES: RegExp[] = [
  /\b(no|without|remove|removed|removing|zero|not wearing|take off|taking off)\s+(any\s+|the\s+|his\s+|her\s+|their\s+|my\s+)?(clothes|clothing|shirt|top|pants|trousers|dress|outfit|underwear)\b/,
  /\bignore (all |the )?(previous|above|prior) /,
  /\b(system prompt|jailbreak|developer mode)\b/,
  /\b(look(s|ing)? like|resembl\w+|in the style of a real|based on a real)\b.*\b(person|actor|actress|singer|celebrity|politician)\b/,
];

/** Returns true when the text trips the blocklist (terms, phrase patterns, or an age under 21). */
export function isBlocked(text: string): boolean {
  const toks = normaliseTokens(text);
  for (let i = 0; i < toks.length; i++) {
    if (EXACT.has(toks[i])) return true;
    if (i + 1 < toks.length && toks[i].length <= 4 && EXACT.has(toks[i] + toks[i + 1]) && (toks[i] + toks[i + 1]).length >= 4) return true;
  }
  const flat = toks.join(' ');
  if (PHRASES.some(p => p.test(flat))) return true;
  // numeric age under 21: "17 years old", "age 17", "17yo", "aged 15"
  const plain = text.normalize('NFKD').replace(/[\u0300-\u036f\u200b-\u200f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  for (const m of plain.matchAll(/\b(?:age|aged)\s+(\d{1,2})\b|\b(\d{1,2})\s*(?:y o|yo|years? old|year old|yrs?)\b/g)) {
    const n = Number(m[1] ?? m[2]);
    if (n < 21) return true;
  }
  return false;
}

export function assertSafeText(text: string): void { if (isBlocked(text)) throw new SafetyError(); }

const NAME_RE = /^[\p{L}][\p{L} '\-]{0,29}$/u;
export function validateName(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(n)) throw new SafetyError();
  assertSafeText(n);
  return n;
}
export function validateNotes(notes: string): string {
  const n = notes.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ');
  if (n.length > 200) throw new SafetyError();
  assertSafeText(n);
  return n;
}
/** Exposed for the schema test (every fragment must itself be safe). */
export const _internal = { EXACT };
