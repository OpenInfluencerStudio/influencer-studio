import { describe, it, expect } from 'vitest';
import { gate, defaults, effective, toggle, pick, parseSel } from '../../ui/src/modelsel';
const m = (id: string, kind: string, state = 'recommended', reasons: string[] = []) => ({ id, name: id, kind, bestVariantId: id + '-v', variants: [{ id: id + '-v', state, installed: true, reasons: reasons.map(text => ({ text })) }] });
const all = () => [m('klein', 'image'), m('qwen', 'image-edit', 'runs'), m('wan', 'video', 'locked_soft', ['Needs 24 GB VRAM'])];
describe('model selection', () => {
  it('recommended preselected, locked not', () => { expect(defaults(all())).toEqual(['klein', 'qwen']); });
  it('locked needs unlock and shows reason', () => {
    expect(gate(all()[2]!, false)).toMatchObject({ selectable: false, locked: true }); expect(gate(all()[2]!, false).reason).toContain('Needs 24 GB VRAM'); expect(gate(all()[2]!, false).reason).toContain('Advanced');
    expect(gate(all()[2]!, true).selectable).toBe(true);
  });
  it('hard block never selectable', () => { expect(gate(m('x', 'image', 'blocked_hard', ['Needs a GPU']), true)).toMatchObject({ selectable: false, reason: 'Needs a GPU' }); });
  it('toggle on/off, locked returns null', () => {
    const ms = all(); expect(toggle(ms, ['klein'], 'klein', false)).toEqual([]); expect(toggle(ms, [], 'klein', false)).toEqual(['klein']);
    expect(toggle(ms, ['klein'], 'wan', false)).toBeNull(); expect(toggle(ms, ['klein'], 'wan', true)).toEqual(['klein', 'wan']);
  });
  it('radio-like per kind', () => { const ms = [m('a', 'image'), m('b', 'image', 'runs')]; expect(toggle(ms, ['a'], 'b', false)).toEqual(['b']); });
  it('effective drops locked choices', () => { expect(effective(all(), ['klein', 'wan'], false)).toEqual(['klein']); expect(effective(all(), ['klein', 'wan'], true)).toEqual(['klein', 'wan']); });
  it('pick drives the variant used', () => {
    expect(pick(all(), null, false, 'image')).toEqual({ variantId: 'klein-v', modelName: 'klein' });
    expect(pick(all(), ['qwen'], false, 'image').blocked).toContain('No image model');
    expect(pick(all(), null, false, 'video')).toEqual({});
    expect(pick(all(), ['klein', 'wan'], true, 'video').variantId).toBe('wan-v');
  });
  it('parseSel is defensive', () => { expect(parseSel(null)).toBeNull(); expect(parseSel('{"a":1}')).toBeNull(); expect(parseSel('["a"]')).toEqual(['a']); expect(parseSel('[1]')).toBeNull(); });
});
