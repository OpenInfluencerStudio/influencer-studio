/**
 * Image-to-video jobs (Wan 2.2 TI2V-5B & LTX-2.5 22B Distilled AV): a saved picture is animated with a short motion description
 * and optional synchronized speech/dialogue & sound effects (for LTX-2.5 native audio-video generation).
 * The prompt is built ONLY from the fixed fragment table plus optional notes/speech/SFX that go through the safety filter.
 */
import { z } from 'zod';
import { CONSTRAINT_TAIL } from './compiler/schema.js';
import { assertSafeText, validateNotes } from './safety/index.js';

export const MOTIONS: { id: string; label: string; frag: string }[] = [
  { id: 'gentle', label: 'Gentle life', frag: 'breathes naturally, blinks softly and gives a small relaxed smile' },
  { id: 'head_turn', label: 'Turns head', frag: 'slowly turns their head toward the camera and smiles gently' },
  { id: 'wave', label: 'Waves hello', frag: 'waves at the camera with one hand and smiles warmly' },
  { id: 'walk', label: 'Walks forward', frag: 'walks slowly toward the camera with a relaxed, natural stride' },
  { id: 'hair_wind', label: 'Breeze in hair', frag: 'stands still while a soft breeze moves their hair' },
  { id: 'laugh', label: 'Laughs', frag: 'laughs warmly and looks happy' },
  { id: 'nod', label: 'Nods', frag: 'nods slowly as if listening and agreeing' },
  { id: 'look_around', label: 'Looks around', frag: 'looks to one side, then back at the camera with a calm expression' },
];
export const CAMERAS: { id: string; label: string; frag: string }[] = [
  { id: 'static', label: 'Steady', frag: 'steady locked-off camera' },
  { id: 'push_in', label: 'Slow push-in', frag: 'slow smooth camera push-in' },
  { id: 'pull_out', label: 'Slow pull-out', frag: 'slow smooth camera pull-back' },
  { id: 'pan', label: 'Gentle pan', frag: 'gentle slow camera pan to the right' },
];
export const DURATIONS = [1, 2, 3, 4] as const; // seconds at 24 fps -> 25, 49, 73, 97 frames (4n+1)
export const VIDEO_FPS = 24;
export const VIDEO_SIZES = [480, 640, 768, 832, 1024, 1280] as const; // long side in pixels
export const VIDEO_NEGATIVE = 'blurry, distorted, low quality, jittery, extra limbs, extra fingers, deformed face, text, watermark, nudity, revealing clothing';

const ids = (l: { id: string }[]) => l.map(x => x.id) as [string, ...string[]];
export const VideoSchema = z.object({
  refId: z.string().regex(/^[0-9a-f-]{36}$/),
  motion: z.enum(ids(MOTIONS)).default('gentle'),
  camera: z.enum(ids(CAMERAS)).default('static'),
  seconds: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(2),
  size: z.number().int().refine(n => (VIDEO_SIZES as readonly number[]).includes(n), 'unsupported size').default(640),
  note: z.string().max(200).optional(),
  speech: z.string().max(240).optional(),
  audioPrompt: z.string().max(200).optional(),
}).strict();
export type VideoRequest = z.infer<typeof VideoSchema>;

export const framesFor = (seconds: number) => seconds * VIDEO_FPS + 1;

/** Output size: keeps the picture's aspect ratio, long side = size, both sides multiples of 32 (Wan / LTX VAE requirement). */
export function videoDims(srcW: number, srcH: number, size: number): { width: number; height: number } {
  const r32 = (n: number) => Math.max(256, Math.round(n / 32) * 32);
  if (srcW >= srcH) return { width: r32(size), height: r32(size * srcH / srcW) };
  return { width: r32(size * srcW / srcH), height: r32(size) };
}

export function compileVideo(v: VideoRequest): string {
  const m = MOTIONS.find(x => x.id === v.motion)!.frag, c = CAMERAS.find(x => x.id === v.camera)!.frag;
  const note = v.note?.trim() ? ` ${validateNotes(v.note.trim())}.` : '';
  const speech = v.speech?.trim() ? ` The person speaks clearly with natural lip-sync, saying: "${validateNotes(v.speech.trim())}".` : '';
  const sfx = v.audioPrompt?.trim() ? ` Synchronized audio and sound effects: ${validateNotes(v.audioPrompt.trim())}.` : '';
  const p = `The person in the picture ${m}.${note}${speech}${sfx} ${c}. Natural realistic motion, same person, same face, same hair and same outfit throughout. ${CONSTRAINT_TAIL}`;
  assertSafeText(p);
  return p;
}
