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
