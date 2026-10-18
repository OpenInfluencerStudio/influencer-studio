// Thin client for the local server. The session token comes from the launch URL fragment (#t=...) and is kept in sessionStorage.
const KEY = 'is_token';
export function initToken(): string | null {
  const m = location.hash.match(/[#&]t=([A-Za-z0-9_-]+)/);
  if (m) { sessionStorage.setItem(KEY, m[1]); history.replaceState(null, '', location.pathname + location.search); }
  return sessionStorage.getItem(KEY);
}
export class ApiError extends Error { constructor(public status: number, public body: any) { super(body?.message ?? 'Request failed'); } }
export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method, headers: { authorization: 'Bearer ' + sessionStorage.getItem(KEY), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, j);
  return j as T;
}
/** Server-sent events over fetch (EventSource cannot send the auth header). Reconnects with backoff; pauses rendering while the tab is hidden. */
export function subscribe(onJob: (j: any) => void): () => void {
  let stop = false; let delay = 500; let ctl: AbortController | null = null;
  const run = async () => {
    while (!stop) {
      try {
        ctl = new AbortController();
        const r = await fetch('/api/events', { headers: { authorization: 'Bearer ' + sessionStorage.getItem(KEY) }, signal: ctl.signal });
        if (!r.ok || !r.body) throw new Error('sse');
        delay = 500;
        const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
        for (;;) {
          const { value, done } = await rd.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let i; while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
            const d = chunk.split('\n').find(l => l.startsWith('data: '));
            if (d && chunk.includes('event: job')) { try { onJob(JSON.parse(d.slice(6))); } catch { /* ignore */ } }
          }
        }
      } catch { /* retry */ }
      if (stop) return;
      await new Promise(r => setTimeout(r, delay + Math.random() * 250)); delay = Math.min(delay * 2, 8000);
    }
  };
  void run();
  return () => { stop = true; ctl?.abort(); };
}
export async function fetchBlobUrl(path: string): Promise<string> {
  const r = await fetch(path, { headers: { authorization: 'Bearer ' + sessionStorage.getItem(KEY) } });
  if (!r.ok) throw new Error('image');
  return URL.createObjectURL(await r.blob());
}
/** Upload a style reference image (PNG, JPEG or WebP, up to 8 MB). The server validates it again by content. */
export async function uploadRef(file: File): Promise<{ id: string; width: number; height: number }> {
  const r = await fetch('/api/refs', { method: 'POST', headers: { authorization: 'Bearer ' + sessionStorage.getItem(KEY), 'content-type': file.type }, body: file });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, j);
  return j;
}

// ---- preview thumbnails (generated webp files served from /previews, with SVG art as the fallback) ----
export type PreviewItem = { control: string; option: string; look: string; shared: boolean; file: string; framing: 'face' | 'upper' | 'full'; w: number; h: number };
let previews: Promise<Map<string, PreviewItem[]>> | null = null;
export function loadPreviews(): Promise<Map<string, PreviewItem[]>> {
  previews ??= fetch('/previews/manifest.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] }))
    .then((m: { items?: PreviewItem[] }) => { const map = new Map<string, PreviewItem[]>(); for (const i of m.items ?? []) { const k = i.control + '/' + i.option; map.set(k, [...(map.get(k) ?? []), i]); } return map; });
  return previews;
}
export const LOOK_FOR_TYPE: Record<string, string> = { male: 'man', trans_man: 'man', female: 'woman', trans_woman: 'woman', non_binary: 'nonbinary', alien: 'alien', monster: 'monster', cat_person: 'creature', dog_person: 'creature', fox_person: 'creature', frog_person: 'creature', insect_person: 'creature', bird_person: 'creature', rodent_person: 'creature', reptile_person: 'creature', robot: 'creature', plush_person: 'creature' };
/** Pick the thumbnail for a control option and the current character type. Returns null when none exists (caller draws the SVG fallback). */
export function pickPreview(map: Map<string, PreviewItem[]>, control: string, option: string, type: string, index: number): PreviewItem | null {
  const items = map.get(control + '/' + option); if (!items?.length) return null;
  const want = LOOK_FOR_TYPE[type];
  const exact = want ? items.find(i => i.look === want) : undefined; if (exact) return exact;
  const shared = items.find(i => i.shared); if (shared) return shared;
  if (items.length === 1) return items[0];
  if (want && want !== 'creature') return null;
  // "Surprise me": vary the person across the grid instead of always showing one look.
  const humans = items.filter(i => ['man', 'woman', 'nonbinary'].includes(i.look)); const pool = humans.length ? humans : items;
  return pool[index % pool.length];
}
