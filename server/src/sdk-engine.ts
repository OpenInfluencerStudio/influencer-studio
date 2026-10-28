// Generation through the Comfy Developer Platform: the official Comfy SDK (@comfyorg/sdk, MIT) talks Comfy API v2
// to comfy-api-proxy (MIT), which runs in front of the user's own local ComfyUI. Fully local and keyless:
// every SDK request goes through a fetch guard that refuses anything that is not loopback, so the SDK can never
// reach Comfy Cloud, the Comfy Router or a partner API. Open weights only, no partner nodes.
import { Comfy } from "@comfyorg/sdk";
import type { ApiWorkflow } from "./workflows.js";

export const SDK_VERSION = "0.5.0";
export const PROXY_DEFAULT_PORTS = [8189, 8289];
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export function isLoopbackUrl(raw: string): boolean { try { const u = new URL(raw); return (u.protocol === "http:" || u.protocol === "https:") && LOOPBACK.has(u.hostname); } catch { return false; } }

/** fetch that only ever reaches this computer. Anything else throws before a socket is opened. */
export function loopbackFetch(base: typeof fetch = fetch): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isLoopbackUrl(raw)) return Promise.reject(new Error(`Blocked: the Comfy SDK may only talk to this computer, not ${(() => { try { return new URL(raw).origin; } catch { return "an invalid address"; } })()}`));
    return base(input as RequestInfo, { ...init, redirect: "error" });
  }) as typeof fetch;
}

export interface SdkOutput { name: string; type: string; contentType: string; bytes: Buffer }
export interface SdkRef { placeholder: string; bytes: Buffer; filename: string; mime: string }
export interface SdkRunOpts { ref?: SdkRef; onProgress?: (percent: number, message: string) => void; cancelled?: () => boolean; timeoutMs?: number; stepsHint?: number }
export interface SdkProgressInput { value?: number | null; step?: number | null; steps?: number | null; currentNode?: string | null; currentNodeClass?: string | null; nodesDone?: number | null; nodesTotal?: number | null }

const NODE_MSG: [RegExp, string][] = [[/Loader|LoadImage|UNET|CLIP(Loader|Vision)|VAELoader|Lora/i, "Loading models"], [/TextEncode|Conditioning/i, "Reading your prompt"], [/Sampler|Scheduler|Guider/i, "Drawing"], [/VAEDecode|Decode/i, "Finishing the picture"], [/Save|Video|Preview/i, "Saving"]];
/** Turn an SDK progress snapshot into the app's percent and plain-words message. */
export function progressMessage(p: SdkProgressInput, graph?: ApiWorkflow): { percent: number; message: string } {
  const cls = p.currentNodeClass || (p.currentNode && graph ? graph[p.currentNode]?.class_type : "") || "";
  const graphTotal = graph ? Object.keys(graph).length : 0;
  const totalNodes = Math.max(p.nodesTotal ?? 0, graphTotal);
  const isSampling = !!(p.step && p.steps && (p.steps > 1 || /Sampler|Scheduler|Guider/i.test(cls)));
  let rawVal: number;
  if (isSampling && graphTotal > 1) {
    rawVal = 0.15 + 0.72 * (p.step! / p.steps!);
  } else if (graphTotal > 1 && p.nodesTotal != null && p.nodesTotal > 0 && p.nodesTotal < graphTotal) {
    rawVal = ((p.nodesDone ?? 0) + (p.step && p.steps ? p.step / p.steps : 0)) / graphTotal;
  } else if (typeof p.value === "number" && isFinite(p.value) && p.value > 0) {
    rawVal = p.value;
  } else if (p.step && p.steps && p.steps > 0) {
    rawVal = p.step / p.steps;
  } else if (p.nodesDone != null && totalNodes > 0) {
    rawVal = p.nodesDone / totalNodes;
  } else {
    rawVal = 0;
  }
  const v = Math.max(0, Math.min(1, rawVal));
  const percent = Math.round(5 + v * 90);
  if (isSampling) return { percent, message: `Drawing, step ${p.step} of ${p.steps}` };
  for (const [re, msg] of NODE_MSG) if (re.test(cls)) return { percent, message: msg };
  if (graphTotal > 1 && p.nodesDone != null && p.nodesTotal != null && p.nodesTotal > 0 && p.nodesDone >= p.nodesTotal) {
    return { percent: Math.max(percent, 90), message: "Finishing the picture" };
  }
  if (p.nodesDone != null && totalNodes > 0) return { percent, message: `Working (${p.nodesDone} of ${totalNodes})` };
  return { percent, message: "Generating" };
}

/** Every [nodeId, input] whose value is exactly the placeholder (where the reference image goes). */
export function findPlaceholder(wf: ApiWorkflow, placeholder: string): [string, string][] {
  const hits: [string, string][] = [];
  for (const [id, node] of Object.entries(wf)) for (const [k, v] of Object.entries((node as { inputs?: Record<string, unknown> }).inputs ?? {})) if (v === placeholder) hits.push([id, k]);
  return hits;
}

export function outputFileName(o: { type: string; contentType: string; name: string }, n: number): { file: string; mime: string } {
  const isVideo = o.type === "video" || /^video\//.test(o.contentType) || /\.(mp4|webm|mov)$/i.test(o.name);
  if (isVideo) return { file: `vid_${n}.mp4`, mime: "video/mp4" };
  if (/webp/i.test(o.contentType)) return { file: `img_${n}.webp`, mime: "image/webp" };
  return { file: `img_${n}.png`, mime: "image/png" };
}

export interface SdkEngineOpts { proxyUrl: string; token?: string; timeoutMs?: number; fetch?: typeof fetch }

export class SdkEngine {
  readonly proxyUrl: string; private client: Comfy;
  constructor(private o: SdkEngineOpts) {
    if (!isLoopbackUrl(o.proxyUrl)) throw new Error("The Comfy API proxy must be on this computer (loopback).");
    this.proxyUrl = new URL(o.proxyUrl).origin;
    // The SDK reads its target from COMFY_BASE_URL and a key from COMFY_API_KEY. Pin the target to the local proxy,
    // and never let a Comfy Cloud key from the user's environment ride along (we use no cloud, router or partner nodes).
    process.env.COMFY_BASE_URL = this.proxyUrl; delete process.env.COMFY_API_KEY;
    this.client = new Comfy({ fetch: loopbackFetch(o.fetch), clientInfo: "influencer-studio", timeoutMs: o.timeoutMs ?? 30_000, ...(o.token ? { apiKey: o.token } : {}) });
  }

  /** The proxy's own health route: { online, upstream } (upstream = the ComfyUI it fronts). */
  async health(): Promise<{ online: boolean; upstream?: string }> {
    try {
      const r = await loopbackFetch(this.o.fetch)(this.proxyUrl + "/api/v2/health", { signal: AbortSignal.timeout(2000), headers: this.o.token ? { authorization: `Bearer ${this.o.token}` } : {} });
      if (!r.ok) return { online: false };
      const j = await r.json() as { status?: string; upstream?: string };
      return { online: j.status === "healthy", upstream: j.upstream };
    } catch { return { online: false }; }
  }

  /** Submit one filled workflow through the SDK, follow its events, and return the saved outputs. */
  async run(graph: ApiWorkflow, opts: SdkRunOpts = {}): Promise<SdkOutput[]> {
    const wf = this.client.workflows.fromJson(structuredClone(graph) as never);
    if (opts.ref) {
      const at = findPlaceholder(graph, opts.ref.placeholder);
      if (!at.length) throw new Error("This template has no slot for the reference image");
      const asset = this.client.assets.fromBytes(new Uint8Array(opts.ref.bytes), { filename: opts.ref.filename, contentType: opts.ref.mime } as never);
      for (const [id, k] of at) wf.setInput(id, k, asset);
      opts.onProgress?.(3, "Sending your reference image");
    }
    const ac = new AbortController();
    const deadline = Date.now() + (opts.timeoutMs ?? 30 * 60_000);
    opts.onProgress?.(4, "Sending to ComfyUI (Comfy SDK)");
    const job = await this.client.submit(wf, { signal: ac.signal });
    let cancelled = false;
    const tick = setInterval(() => {
      if ((opts.cancelled?.() || Date.now() > deadline) && !ac.signal.aborted) { cancelled = !!opts.cancelled?.(); ac.abort(); void job.cancel().catch(() => {}); }
    }, 400);
    try {
      try {
        for await (const ev of job.events(ac.signal) as AsyncIterable<{ kind: string; status?: string; queuePosition?: number | null; value?: unknown; step?: number | null; steps?: number | null; currentNode?: string | null; currentNodeClass?: string | null; nodesDone?: number | null; nodesTotal?: number | null }>) {
          if (ev.kind === "progress") {
            const snap = (ev.value && typeof ev.value === "object" ? ev.value : ev) as SdkProgressInput;
            const p = progressMessage(snap, graph);
            opts.onProgress?.(p.percent, p.message);
          } else if (ev.kind === "outputReady") {
            opts.onProgress?.(96, "Fetching the result");
          } else if (ev.kind === "statusChange" && ev.status) {
            if (ev.status === "queued") opts.onProgress?.(4, ev.queuePosition ? `In queue (#${ev.queuePosition})` : "Queued in ComfyUI");
            else if (ev.status === "running") opts.onProgress?.(6, "Running in ComfyUI (Comfy SDK)");
            else if (["succeeded", "failed", "canceled", "expired"].includes(ev.status)) break;
          }
        }
      } catch (e) { if (!ac.signal.aborted) throw e; }
      if (cancelled) return [];
      if (ac.signal.aborted) throw new Error("Timed out waiting for ComfyUI");
      try { await job.wait(undefined, ac.signal); } catch (e) { throw new Error("ComfyUI reported an error while running the job: " + (e as Error).message); }
      if (job.status !== "succeeded") throw new Error("ComfyUI reported an error while running the job" + (job.error ? ": " + ((job.error as { message?: string }).message ?? JSON.stringify(job.error)) : " (see the ComfyUI console)."));
      const outs: SdkOutput[] = [];
      for (const o of job.outputs as unknown as { name: string; type: string; contentType: string; toBytes(): Promise<Uint8Array> }[]) {
        if (o.type !== "image" && o.type !== "video") continue;
        const bytes = Buffer.from(await o.toBytes());
        if (bytes.length > 512 * 1024 * 1024) throw new Error("Output too large");
        outs.push({ name: o.name, type: o.type, contentType: o.contentType, bytes });
      }
      return outs;
    } finally { clearInterval(tick); }
  }
}
