import type { ApiWorkflow } from './workflows.js';

export interface ComfyClientOpts { baseUrl: string; timeoutMs?: number; allowRemote?: boolean }
export interface HistoryImage { filename: string; subfolder: string; type: string }

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
export function validateComfyUrl(raw: string, allowRemote = false): string {
  const u = new URL(raw);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('ComfyUI URL must be http or https');
  if (!allowRemote && !LOOPBACK.has(u.hostname)) throw new Error('ComfyUI URL must be on this computer (loopback). Remote ComfyUI is off by default.');
  return u.origin;
}

/** Minimal ComfyUI HTTP client. Talks only to the configured URL. */
export class ComfyClient {
  readonly baseUrl: string;
  private timeout: number;
  constructor(o: ComfyClientOpts) { this.baseUrl = validateComfyUrl(o.baseUrl, o.allowRemote); this.timeout = o.timeoutMs ?? 5000; }
  private async req(path: string, init?: RequestInit, timeout = this.timeout): Promise<Response> {
    return fetch(this.baseUrl + path, { ...init, signal: AbortSignal.timeout(timeout), redirect: 'error' });
  }
  async health(): Promise<{ online: boolean; vramTotalGb?: number; vramFreeGb?: number; device?: string }> {
    try {
      const r = await this.req('/system_stats', undefined, 2000);
      if (!r.ok) return { online: false };
      const j = (await r.json()) as { devices?: { name: string; vram_total: number; vram_free: number }[] };
      const d = j.devices?.[0];
      return { online: true, device: d?.name, vramTotalGb: d ? Math.round((d.vram_total / 1024 ** 3) * 10) / 10 : undefined, vramFreeGb: d ? Math.round((d.vram_free / 1024 ** 3) * 10) / 10 : undefined };
    } catch { return { online: false }; }
  }
  async submit(workflow: ApiWorkflow, clientId: string): Promise<string> {
    const r = await this.req('/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: workflow, client_id: clientId }) }, 15000);
    const j = (await r.json().catch(() => ({}))) as { prompt_id?: string; error?: { message?: string } };
    if (!r.ok || !j.prompt_id) throw new Error('ComfyUI rejected the workflow: ' + (j.error?.message ?? r.status));
    return j.prompt_id;
  }
  /** Returns null while pending/running, or the outputs when finished. Throws on a reported error. */
  async poll(promptId: string): Promise<{ state: 'pending' | 'running' | 'done'; images: HistoryImage[] }> {
    const h = await this.req('/history/' + encodeURIComponent(promptId));
    if (h.ok) {
      const j = (await h.json()) as Record<string, { status?: { status_str?: string; messages?: unknown[] }; outputs?: Record<string, { images?: HistoryImage[] }> }>;
      const e = j[promptId];
      if (e) {
        if (e.status?.status_str === 'error') throw new Error('ComfyUI reported an error while running the job (see the ComfyUI console).');
        const images = Object.values(e.outputs ?? {}).flatMap(o => o.images ?? []);
        return { state: 'done', images };
      }
    }
    const q = await this.req('/queue');
    if (q.ok) {
      const j = (await q.json()) as { queue_running?: unknown[][] };
      if ((j.queue_running ?? []).some(x => x[1] === promptId)) return { state: 'running', images: [] };
    }
    return { state: 'pending', images: [] };
  }
  async fetchImage(img: HistoryImage): Promise<Buffer> {
    const qs = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
    const r = await this.req('/view?' + qs.toString(), undefined, 30000);
    if (!r.ok) throw new Error('Could not fetch the output image from ComfyUI');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 64 * 1024 * 1024) throw new Error('Output image too large');
    return buf;
  }
  async cancel(promptId: string, running: boolean): Promise<void> {
    try {
      if (running) await this.req('/interrupt', { method: 'POST' });
      await this.req('/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ delete: [promptId] }) });
    } catch { /* best effort */ }
  }
}
