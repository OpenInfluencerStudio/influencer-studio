/**
 * "Same character" jobs (plan section 12): a saved reference image of the character is edited by Qwen-Image-Edit-2511.
 *  - scene: new outfit / background / lighting / pose / expression, identity kept
 *  - angle: new camera angle (azimuth x elevation x distance) with the Multiple-Angles LoRA
 * Prompts are built ONLY from the fixed fragment tables below plus an optional note that goes through the safety filter.
 */
import { z } from 'zod';
import { CONTROL_BY_ID, CONSTRAINT_TAIL } from './compiler/schema.js';
import { assertSafeText, validateNotes } from './safety/index.js';

export const POSES: { id: string; label: string; frag: string }[] = [
  { id: 'standing', label: 'Standing relaxed', frag: 'standing relaxed, arms at the sides' },
  { id: 'arms_crossed', label: 'Arms crossed', frag: 'standing with arms folded' },
  { id: 'hands_pockets', label: 'Hands in pockets', frag: 'standing with hands in pockets' },
  { id: 'walking', label: 'Walking', frag: 'walking towards the camera' },
  { id: 'sitting', label: 'Sitting', frag: 'sitting down on a chair' },
  { id: 'waving', label: 'Waving', frag: 'waving at the camera with one hand' },
  { id: 'leaning', label: 'Leaning on a wall', frag: 'leaning casually against a wall' },
];
export const AZIMUTHS: { id: string; label: string; frag: string }[] = [
  { id: 'front', label: 'Front', frag: 'front view' },
  { id: 'front_right', label: 'Front-right', frag: 'front-right quarter view' },
  { id: 'right', label: 'Right side', frag: 'right side view' },
  { id: 'back_right', label: 'Back-right', frag: 'back-right quarter view' },
  { id: 'back', label: 'Back', frag: 'back view' },
  { id: 'back_left', label: 'Back-left', frag: 'back-left quarter view' },
  { id: 'left', label: 'Left side', frag: 'left side view' },
  { id: 'front_left', label: 'Front-left', frag: 'front-left quarter view' },
];
export const ELEVATIONS: { id: string; label: string; frag: string }[] = [
  { id: 'low', label: 'Low angle', frag: 'low-angle shot' },
  { id: 'eye', label: 'Eye level', frag: 'eye-level shot' },
  { id: 'high', label: 'High angle', frag: 'high-angle shot' },
];
export const DISTANCES: { id: string; label: string; frag: string }[] = [
  { id: 'close', label: 'Close-up', frag: 'close-up' },
  { id: 'medium', label: 'Medium shot', frag: 'medium shot' },
  { id: 'wide', label: 'Wide shot', frag: 'wide shot' },
];
const ids = (l: { id: string }[]) => l.map(x => x.id) as [string, ...string[]];
const optId = (controlId: string) => z.enum(CONTROL_BY_ID.get(controlId as never)!.options.map(o => o.id) as [string, ...string[]]);
const uuid = z.string().regex(/^[0-9a-f-]{36}$/);

export const EditSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scene'), refId: uuid, outfit: optId('outfit').optional(), background: optId('background').optional(), lighting: optId('lighting').optional(),
    pose: z.enum(ids(POSES)).optional(), expression: optId('expression').optional(), note: z.string().max(200).optional() }).strict(),
  z.object({ kind: z.literal('angle'), refId: uuid, azimuth: z.enum(ids(AZIMUTHS)), elevation: z.enum(ids(ELEVATIONS)).default('eye'), distance: z.enum(ids(DISTANCES)).default('medium') }).strict(),
]);
export type EditRequest = z.infer<typeof EditSchema>;

const frag = (controlId: string, id: string) => CONTROL_BY_ID.get(controlId as never)!.options.find(o => o.id === id)!.frag;
const find = (l: { id: string; frag: string }[], id: string) => l.find(x => x.id === id)!.frag;

export function templateForEdit(e: EditRequest): 'qwen_edit' | 'qwen_angles' { return e.kind === 'scene' ? 'qwen_edit' : 'qwen_angles'; }

/** Build the Qwen prompt for an edit job. Throws SafetyError for blocked notes; throws Error when a scene edit changes nothing. */
export function compileEdit(e: EditRequest): string {
  let p: string;
  if (e.kind === 'angle') {
    p = `<sks> ${find(AZIMUTHS, e.azimuth)} ${find(ELEVATIONS, e.elevation)} ${find(DISTANCES, e.distance)}. Same person, same face, same hair and same outfit. ${CONSTRAINT_TAIL}`;
  } else {
    const ch: string[] = [];
    if (e.outfit) ch.push(`now wearing ${frag('outfit', e.outfit)}`);
    if (e.background) ch.push(`now in ${frag('background', e.background)}`);
    if (e.lighting) ch.push(`lit with ${frag('lighting', e.lighting)}`);
    if (e.pose) ch.push(`${find(POSES, e.pose)}`);
    if (e.expression) ch.push(`with ${frag('expression', e.expression)}`);
    if (e.note?.trim()) ch.push(validateNotes(e.note.trim()));
    if (!ch.length) throw new Error('Choose at least one thing to change');
    p = `Keep exactly the same person: same face, same hair, same skin tone, same age and same body build. Change only this: the person is ${ch.join(', ')}. ${CONSTRAINT_TAIL}`;
  }
  assertSafeText(p);
  return p;
}
