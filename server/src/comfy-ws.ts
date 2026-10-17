import WebSocket from 'ws';
import { validateComfyUrl } from './comfy.js';
import type { ApiWorkflow } from './workflows.js';

/** Events we care about from ComfyUI's /ws feed (already filtered to one prompt). */
export type ProgressMsg =
  | { type: 'execution_start' }
  | { type: 'execution_cached'; nodes: string[] }
  | { type: 'executing'; node: string | null }
  | { type: 'progress'; node?: string; value: number; max: number }
  | { type: 'executed'; node: string }
  | { type: 'execution_success' }
  | { type: 'execution_error'; message: string };

const LABELS: Record<string, string> = {
  UNETLoader: 'Loading the model', UnetLoaderGGUF: 'Loading the model', CheckpointLoaderSimple: 'Loading the model', CLIPLoader: 'Loading the text encoder',
  VAELoader: 'Loading the decoder', CLIPTextEncode: 'Reading your prompt', TextEncodeQwenImageEditPlus: 'Reading your prompt and picture', LoraLoaderModelOnly: 'Loading the style add-on', ModelSamplingAuraFlow: 'Preparing', CFGNorm: 'Preparing', KSampler: 'Drawing', SamplerCustomAdvanced: 'Drawing', LoadImage: 'Reading your reference image', VAEEncode: 'Reading your reference image', ReferenceLatent: 'Preparing', VAEDecode: 'Decoding the image', SaveImage: 'Saving',
  EmptyFlux2LatentImage: 'Preparing', ConditioningZeroOut: 'Preparing',
};

const WEIGHT: Record<string, number> = { KSampler: 8, SamplerCustomAdvanced: 8, UNETLoader: 2, UnetLoaderGGUF: 2, CheckpointLoaderSimple: 2, CLIPLoader: 2, VAEDecode: 1.5 };

/** Pure progress model: feed ComfyUI messages, read percent (5..98) and a plain-language step. Testable without a socket.
 *  A node counts as finished when the next one starts (ComfyUI only sends "executed" for output nodes). */
export class ProgressTracker {
  private done = new Set<string>(); private cached = new Set<string>();
  private current: string | null = null; private frac = 0; stepsHint = 0;
  constructor(private wf: ApiWorkflow) {}
  private w(n: string): number { return WEIGHT[this.wf[n]?.class_type ?? ''] ?? 1; }
  feed(m: ProgressMsg): { percent: number; message: string } | null {
    switch (m.type) {
      case 'execution_cached': m.nodes.forEach(n => this.cached.add(n)); break;
      case 'executing':
        if (m.node === null) return { percent: 98, message: 'Fetching the result' };
        if (this.current && this.current !== m.node) this.done.add(this.current);
        this.current = m.node; this.frac = 0; break;
      case 'progress': if (m.max > 0) { this.frac = Math.min(1, m.value / m.max); if (m.node) this.current = m.node; } break;
      case 'executed': this.done.add(m.node); this.frac = 0; break;
      default: return null;
    }
    let total = 0, fin = 0;
    for (const n of Object.keys(this.wf)) { if (this.cached.has(n)) continue; total += this.w(n); if (this.done.has(n)) fin += this.w(n); }
    const cur = this.current && !this.done.has(this.current) && !this.cached.has(this.current) ? this.w(this.current) * this.frac : 0;
    const pct = 5 + ((fin + cur) / Math.max(1, total)) * 90;
    const cls = this.current ? this.wf[this.current]?.class_type : undefined;
    let message = cls ? (LABELS[cls] ?? 'Working') : 'Starting';
    if ((cls === 'KSampler' || cls === 'SamplerCustomAdvanced') && this.frac > 0) message = `Drawing, step ${Math.max(1, Math.round(this.frac * (this.stepsHint || 1)))} of ${this.stepsHint || '?'}`;
    return { percent: Math.min(97, Math.round(pct)), message };
  }
}

/** One WebSocket to ComfyUI /ws. Loopback only (same rule as the HTTP client). Falls back silently: callers keep HTTP polling as the source of truth. */
export class ComfyProgress {
  private ws?: WebSocket; private listeners = new Set<(promptId: string | undefined, m: ProgressMsg) => void>();
  readonly clientId: string; private origin: string;
  constructor(baseUrl: string, clientId: string, allowRemote = false) { this.origin = validateComfyUrl(baseUrl, allowRemote); this.clientId = clientId; }
  connect(timeoutMs = 2500): Promise<boolean> {
    return new Promise(resolve => {
      let settled = false;
      const fin = (ok: boolean) => { if (!settled) { settled = true; resolve(ok); } };
      try {
        const ws = new WebSocket(this.origin.replace(/^http/, 'ws') + '/ws?clientId=' + encodeURIComponent(this.clientId), { handshakeTimeout: timeoutMs, maxPayload: 32 * 1024 * 1024 });
        this.ws = ws;
        ws.on('open', () => fin(true));
        ws.on('error', () => fin(false));
        ws.on('close', () => fin(false));
        ws.on('message', (data, isBinary) => { if (!isBinary) this.onText(data.toString()); });
      } catch { fin(false); }
      setTimeout(() => fin(false), timeoutMs + 200);
    });
  }
  get connected(): boolean { return this.ws?.readyState === WebSocket.OPEN; }
  /** Exposed for tests and for the socket handler. */
  onText(text: string): void {
    let j: { type?: string; data?: Record<string, unknown> };
    try { j = JSON.parse(text); } catch { return; }
    const d = j.data ?? {}; const pid = typeof d.prompt_id === 'string' ? d.prompt_id : undefined;
    let m: ProgressMsg | null = null;
    switch (j.type) {
      case 'execution_start': m = { type: 'execution_start' }; break;
      case 'execution_cached': m = { type: 'execution_cached', nodes: Array.isArray(d.nodes) ? d.nodes.map(String) : [] }; break;
      case 'executing': m = { type: 'executing', node: d.node == null ? null : String(d.node) }; break;
      case 'progress': if (typeof d.value === 'number' && typeof d.max === 'number') m = { type: 'progress', node: d.node == null ? undefined : String(d.node), value: d.value, max: d.max }; break;
      case 'executed': m = { type: 'executed', node: String(d.node) }; break;
      case 'execution_success': m = { type: 'execution_success' }; break;
      case 'execution_error': m = { type: 'execution_error', message: String(d.exception_message ?? 'error').slice(0, 300) }; break;
    }
    if (m) for (const l of this.listeners) l(pid, m);
  }
  /** Receive messages for one prompt id. Messages with no prompt id are accepted (older ComfyUI). */
  watch(getPromptId: () => string | undefined, cb: (m: ProgressMsg) => void): () => void {
    const l = (pid: string | undefined, m: ProgressMsg) => { const want = getPromptId(); if (!pid || !want || pid === want) cb(m); };
    this.listeners.add(l); return () => this.listeners.delete(l);
  }
  close(): void { try { this.ws?.close(); } catch { /* ignore */ } this.listeners.clear(); }
}
