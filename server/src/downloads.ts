/**
 * In-app model downloads (plan section 20).
 * - Only files listed in models.json whose licence is on the allow-list and whose sha256 is known.
 * - Licence is shown first; the request must name the exact licence id that was shown.
 * - HTTPS only, hosts limited to Hugging Face (redirects re-checked at every hop), nothing is executed.
 * - Resumable with HTTP Range into "<name>.part"; checksum is verified before the file is moved into place.
 * - State is persisted so a restart leaves the download paused, ready to resume.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { writeJsonAtomic, readJsonSafe } from './store.js';
import type { Registry, Variant } from './registry.js';

export type FileStatus = 'pending' | 'downloading' | 'verifying' | 'done' | 'error';
export type ItemStatus = 'downloading' | 'paused' | 'verifying' | 'done' | 'error';
export interface FileState { name: string; folder: string; sizeBytes: number; got: number; status: FileStatus }
export interface DlItem { variantId: string; status: ItemStatus; files: FileState[]; acceptedLicense: string; startedAt: string; updatedAt: string; error?: string; speedBps?: number; message?: string }

export class DlError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }

const FOLDERS = new Set(['diffusion_models', 'text_encoders', 'vae', 'loras', 'unet', 'checkpoints', 'clip']);
const HOST_OK = (h: string) => h === 'huggingface.co' || h.endsWith('.huggingface.co') || h === 'hf.co' || h.endsWith('.hf.co');
const DISK_MARGIN = 512 * 1024 * 1024;

export interface DlHooks {
  /** test only: map a registry file to another URL */ urlFor?: (url: string) => string;
  /** test only: allow other hosts / http */ allowHost?: (u: URL) => boolean;
  /** test only: pretend free space in bytes */ freeBytes?: (dir: string) => number;
  /** test only: wait between network retries */ retryDelayMs?: number;
}

export function freeBytesOf(dir: string): number {
  let d = path.resolve(dir);
  while (!fs.existsSync(d)) { const up = path.dirname(d); if (up === d) break; d = up; }
  const s = fs.statfsSync(d); return Number(s.bavail) * Number(s.bsize);
}

export class DownloadManager extends EventEmitter {
  private items: DlItem[] = [];
  private ctl = new Map<string, AbortController>();
  private paused = new Set<string>();
  private active: string | null = null;
  private lastSave = 0;
  private speed: { t: number; b: number }[] = [];

  constructor(private file: string, private registry: Registry, private modelsDir: () => string | undefined, private hooks: DlHooks = {}) {
    super();
    const p = readJsonSafe<{ items?: DlItem[] }>(file, {});
    this.items = Array.isArray(p.items) ? p.items : [];
    // A restart interrupts any running transfer; the .part file stays and Resume continues from it.
    for (const i of this.items) if (i.status === 'downloading' || i.status === 'verifying') { i.status = 'paused'; i.message = 'The app restarted. Press Resume to continue.'; for (const f of i.files) if (f.status === 'downloading' || f.status === 'verifying') f.status = 'pending'; }
    this.save(true);
  }
  list(): DlItem[] { return this.items.map(i => ({ ...i, files: i.files.map(f => ({ ...f })) })); }
  get(id: string): DlItem | undefined { return this.items.find(i => i.variantId === id); }
  private save(force = false) {
    const now = Date.now(); if (!force && now - this.lastSave < 800) return; this.lastSave = now;
    writeJsonAtomic(this.file, { schemaVersion: 1, items: this.items }, false);
  }
  private touch(i: DlItem, force = false) { i.updatedAt = new Date().toISOString(); this.save(force); this.emit('change', i); }

  private variant(id: string): Variant { const v = this.registry.variants.find(x => x.id === id); if (!v) throw new DlError(404, 'unknown_variant', 'Unknown model'); return v; }
  private dir(): string {
    const d = this.modelsDir();
    if (!d) throw new DlError(409, 'no_models_dir', 'Choose a models folder first (Models screen > Advanced).');
    return path.resolve(d);
  }
  private target(v: Variant, f: Variant['files'][number]): string {
    if (!FOLDERS.has(f.folder)) throw new DlError(400, 'bad_folder', 'Unsupported model folder');
    const root = this.dir(); const full = path.resolve(root, f.folder, f.name);
    if (!full.startsWith(path.join(root, f.folder) + path.sep)) throw new DlError(400, 'bad_path', 'Bad file path');
    void v; return full;
  }

  /** Validate and begin (or restart) a download. Throws DlError with a user-readable message. */
  start(variantId: string, acceptedLicense: string): DlItem {
    const v = this.variant(variantId);
    if (!this.registry.licenseAllowList.includes(v.license)) throw new DlError(403, 'licence_not_allowed', `Licence ${v.license} is not on this app's allow-list.`);
    if (acceptedLicense !== v.license) throw new DlError(400, 'licence_not_accepted', 'Read and accept the licence before downloading.');
    if (v.files.some(f => !f.sha256)) throw new DlError(409, 'no_checksum', 'This model has no verified checksum yet, so it cannot be downloaded.');
    if (v.files.some(f => !f.url && !this.hooks.urlFor)) throw new DlError(409, 'no_source', 'This model has no direct download link.');
    if (this.active && this.active !== variantId) throw new DlError(409, 'busy', 'Another download is in progress. Pause or cancel it first.');
    const existing = this.get(variantId);
    if (existing && (existing.status === 'downloading' || existing.status === 'verifying')) return existing;
    if (this.active === variantId) throw new DlError(409, 'busy', 'The download is still stopping. Try again in a moment.');
    // Disk space: what is still missing, plus a margin.
    const need = v.files.reduce((n, f) => {
      const t = this.target(v, f);
      if (fs.existsSync(t) && fs.statSync(t).size === f.sizeBytes) return n;
      const part = fs.existsSync(t + '.part') ? Math.min(fs.statSync(t + '.part').size, f.sizeBytes) : 0;
      return n + f.sizeBytes - part;
    }, 0) + DISK_MARGIN;
    const free = (this.hooks.freeBytes ?? freeBytesOf)(this.dir());
    if (free < need) throw new DlError(507, 'disk_full', `Needs ${(need / 1e9).toFixed(1)} GB free in ${this.dir()}, but only ${(free / 1e9).toFixed(1)} GB is available.`);
    const now = new Date().toISOString();
    const item: DlItem = { variantId, status: 'downloading', acceptedLicense, startedAt: existing?.startedAt ?? now, updatedAt: now, files: v.files.map(f => ({ name: f.name, folder: f.folder, sizeBytes: f.sizeBytes, got: 0, status: 'pending' as FileStatus })) };
    this.items = [...this.items.filter(i => i.variantId !== variantId), item];
    this.paused.delete(variantId); this.active = variantId; this.speed = [];
    this.touch(item, true);
    void this.drive(item, v);
    return item;
  }
  pause(variantId: string): DlItem | undefined {
    const i = this.get(variantId); if (!i) return undefined;
    if (i.status === 'downloading') { this.paused.add(variantId); this.ctl.get(variantId)?.abort(); }
    return i;
  }
  resume(variantId: string): DlItem {
    const i = this.get(variantId); if (!i) throw new DlError(404, 'not_found', 'No such download');
    if (i.status !== 'paused' && i.status !== 'error') return i;
    return this.start(variantId, i.acceptedLicense);
  }
  cancel(variantId: string): boolean {
    const i = this.get(variantId); if (!i) return false;
    this.paused.add(variantId); this.ctl.get(variantId)?.abort();
    const v = this.registry.variants.find(x => x.id === variantId);
    const wipe = () => { if (v) for (const f of v.files) { try { const t = this.target(v, f) + '.part'; if (fs.existsSync(t)) fs.unlinkSync(t); } catch { /* ignore */ } } this.items = this.items.filter(x => x.variantId !== variantId); this.save(true); this.emit('change', i); };
    if (this.active === variantId) { const t = setInterval(() => { if (this.active !== variantId) { clearInterval(t); wipe(); } }, 50); } else wipe();
    return true;
  }
  /** Which files of a variant are on disk with the right size (used for the installed check). */
  async idle(): Promise<void> { while (this.active) await new Promise(r => setTimeout(r, 25)); }

  private async drive(item: DlItem, v: Variant) {
    const ac = new AbortController(); this.ctl.set(item.variantId, ac);
    try {
      for (let k = 0; k < v.files.length; k++) {
        const spec = v.files[k]; const st = item.files[k];
        if (st.status === 'done') continue;
        await this.oneFile(item, st, spec, ac.signal);
        if (this.paused.has(item.variantId)) throw new DOMException('paused', 'AbortError');
      }
      item.status = 'done'; item.message = undefined; item.speedBps = 0; item.error = undefined;
    } catch (e) {
      if (this.paused.has(item.variantId) || (e as { name?: string }).name === 'AbortError') { item.status = 'paused'; item.message = 'Paused'; for (const f of item.files) if (f.status === 'downloading') f.status = 'pending'; }
      else { item.status = 'error'; item.error = e instanceof DlError || e instanceof Error ? e.message : 'Download failed'; for (const f of item.files) if (f.status === 'downloading' || f.status === 'verifying') f.status = f.status === 'verifying' ? 'error' : 'pending'; }
    } finally {
      this.ctl.delete(item.variantId); if (this.active === item.variantId) this.active = null; this.touch(item, true);
    }
  }

  private async open(url0: string, start: number, signal: AbortSignal): Promise<Response> {
    let url = this.hooks.urlFor ? this.hooks.urlFor(url0) : url0;
    for (let hop = 0; hop < 6; hop++) {
      const u = new URL(url);
      const okHost = this.hooks.allowHost ? this.hooks.allowHost(u) : (u.protocol === 'https:' && HOST_OK(u.hostname));
      if (!okHost) throw new DlError(403, 'host_not_allowed', 'The download link points outside the allowed model hosts, so it was refused.');
      const r = await fetch(url, { redirect: 'manual', signal, headers: { ...(start > 0 ? { range: `bytes=${start}-` } : {}), 'accept-encoding': 'identity', 'user-agent': 'InfluencerStudio/0.1' } });
      if (r.status >= 300 && r.status < 400) { const loc = r.headers.get('location'); if (!loc) throw new DlError(502, 'bad_redirect', 'Bad redirect from the model host'); url = new URL(loc, url).toString(); await r.body?.cancel(); continue; }
      return r;
    }
    throw new DlError(502, 'too_many_redirects', 'Too many redirects from the model host');
  }

  private async oneFile(item: DlItem, st: FileState, spec: Variant['files'][number], signal: AbortSignal) {
    const v = this.variant(item.variantId); const final = this.target(v, spec); const part = final + '.part';
    fs.mkdirSync(path.dirname(final), { recursive: true });
    if (fs.existsSync(final) && fs.statSync(final).size === spec.sizeBytes) { st.got = spec.sizeBytes; st.status = 'done'; this.touch(item); return; }
    let retries = 0;
    for (;;) {
      let start = fs.existsSync(part) ? fs.statSync(part).size : 0;
      if (start > spec.sizeBytes) { fs.unlinkSync(part); start = 0; }
      st.got = start; st.status = 'downloading'; item.status = 'downloading'; item.message = undefined; this.touch(item, true);
      try {
        if (start < spec.sizeBytes) {
          const r = await this.open(spec.url ?? spec.source, start, signal);
          if (r.status === 416) { fs.unlinkSync(part); start = 0; await r.body?.cancel(); continue; }
          if (r.status !== 200 && r.status !== 206) throw new DlError(502, 'http_' + r.status, `The model host answered ${r.status}.`);
          if (r.status === 206) { const cr = r.headers.get('content-range') ?? ''; if (!cr.startsWith(`bytes ${start}-`)) throw new DlError(502, 'bad_range', 'The model host sent the wrong part of the file.'); }
          else start = 0; // the server ignored Range: start the file again
          const ws = fs.createWriteStream(part, { flags: start > 0 ? 'a' : 'w' });
          let got = start;
          try {
            const rd = r.body!.getReader();
            for (;;) {
              const { value, done } = await rd.read(); if (done) break;
              if (got + value.length > spec.sizeBytes) throw new DlError(502, 'too_big', 'The file is larger than expected, so it was refused.');
              if (!ws.write(value)) await new Promise<void>(res => ws.once('drain', () => res()));
              got += value.length; st.got = got; this.sample(item, value.length); this.touch(item);
            }
          } finally { await new Promise<void>(res => ws.end(() => res())); }
        }
        // verify
        const size = fs.statSync(part).size;
        if (size !== spec.sizeBytes) throw new DlError(502, 'short_file', 'The download ended early.');
        st.status = 'verifying'; item.status = 'verifying'; item.message = `Checking ${spec.name}`; this.touch(item, true);
        const hash = await sha256File(part, signal);
        if (hash !== spec.sha256) { fs.unlinkSync(part); st.got = 0; throw Object.assign(new DlError(422, 'checksum_mismatch', `The checksum of ${spec.name} did not match, so the file was deleted. Try again.`), { fatal: true }); }
        fs.renameSync(part, final); st.status = 'done'; st.got = spec.sizeBytes; item.status = 'downloading'; this.touch(item, true); return;
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError' || signal.aborted) throw e;
        if ((e as { fatal?: boolean }).fatal || e instanceof DlError || (e as { code?: string }).code === 'ENOSPC') throw e;
        if (++retries > 3) throw new DlError(503, 'network', 'The connection to the model host was lost. Press Resume to continue where it stopped.');
        item.message = `Connection problem, retrying (${retries}/3)`; this.touch(item, true);
        await new Promise(r => setTimeout(r, this.hooks.retryDelayMs ?? 1500 * retries));
      }
    }
  }
  private sample(item: DlItem, n: number) {
    const now = Date.now(); this.speed.push({ t: now, b: n });
    while (this.speed.length && now - this.speed[0].t > 4000) this.speed.shift();
    const span = Math.max(1, now - this.speed[0].t); item.speedBps = Math.round(this.speed.reduce((a, s) => a + s.b, 0) / (span / 1000));
  }
}

export async function sha256File(file: string, signal?: AbortSignal): Promise<string> {
  const h = crypto.createHash('sha256');
  for await (const c of fs.createReadStream(file, { highWaterMark: 4 * 1024 * 1024 })) { h.update(c as Buffer); if (signal?.aborted) throw new DOMException('aborted', 'AbortError'); }
  return h.digest('hex');
}
