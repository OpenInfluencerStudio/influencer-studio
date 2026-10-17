import { describe, it, expect } from 'vitest';
import { videoInputs, parseMode, parseInput, navIndex } from '../../ui/src/modes';
const wan = (state = 'runs', installed: boolean | null = true) => ({ id: 'wan22-ti2v-5b', kind: 'video', variants: [{ state, installed, reasons: state === 'blocked_hard' ? [{ text: 'Needs a GPU' }] : [] }] });
describe('mode logic', () => {
  it('defaults and parses', () => { expect(parseMode(null)).toBe('image'); expect(parseMode('video')).toBe('video'); expect(parseMode('x')).toBe('image'); expect(parseInput('lipsync')).toBe('lipsync'); expect(parseInput('zzz')).toBe('i2v'); });
  it('i2v available when wan usable', () => { const i = videoInputs([wan()]); expect(i[0]).toMatchObject({ id: 'i2v', available: true }); });
  it('motion and lipsync coming soon without models', () => { const i = videoInputs([wan()]); expect(i[1]).toMatchObject({ available: false, locked: true, reason: 'Coming soon' }); expect(i[2]).toMatchObject({ available: false, reason: 'Coming soon' }); });
  it('motion becomes available when an installed model supports it', () => { const i = videoInputs([wan(), { id: 'a', kind: 'motion-transfer', variants: [{ state: 'runs', installed: true }] }]); expect(i[1]!.available).toBe(true); });
  it('hardware lock gives a reason', () => { const i = videoInputs([wan('blocked_hard')]); expect(i[0]).toMatchObject({ available: false, reason: 'Needs a GPU' }); });
  it('audio always coming soon', () => { expect(videoInputs([wan()])[3]).toMatchObject({ id: 'audio', available: false, reason: 'Coming soon' }); });
  it('keyboard nav wraps', () => { expect(navIndex('ArrowRight', 1, 2)).toBe(0); expect(navIndex('ArrowLeft', 0, 4)).toBe(3); expect(navIndex('End', 0, 4)).toBe(3); expect(navIndex('a', 0, 4)).toBeNull(); });
});
