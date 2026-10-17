import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { Services, JobRequestSchema, Config } from './services.js';
import { CharacterSchema, compileCharacter, randomise, applyPreset, SafetyError } from './compiler/index.js';
import { CONTROLS, TYPE_OPTS, SPECIES_BY_TYPE, SIZE_OPTS, AGE_BANDS, PRESETS } from './compiler/schema.js';
import { repoRoot } from './paths.js';
import { MAX_REF_BYTES } from './refs.js';
import { SILLINESS } from './compiler/schema.js';
import { customTier, precisionMatch } from './custom.js';
import { compileEdit, templateForEdit, POSES, AZIMUTHS, ELEVATIONS, DISTANCES } from './edit.js';
import { R } from './reasons.js';
import { DlError } from './downloads.js';
import { compileVideo, framesFor, videoDims, MOTIONS, CAMERAS, DURATIONS, VIDEO_SIZES } from './video.js';
import type { Job } from './queue.js';

const MAX_BODY = 256 * 1024;
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
// style-src 'unsafe-inline' is required today for the style attributes the Preact UI sets (colour swatches, widths); scripts stay strict.

export interface AppOpts extends Config { token?: string; port?: number; uiDir?: string; previewsDir?: string }
export interface RunningApp { server: http.Server; token: string; port: number; services: Services; close: () => Promise<void>; url: string }

class HttpError extends Error { constructor(public status: number, public code: string, message: string, public extra?: unknown) { super(message); } }

function send(res: http.ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': data.length, 'cache-control': 'no-store', ...extra });
  res.end(data);
}
async function readJson(req: http.IncomingMessage): Promise<unknown> {
  if (!(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'bad_content_type', 'JSON body required');
  const chunks: Buffer[] = []; let n = 0;
  for await (const c of req) { n += (c as Buffer).length; if (n > MAX_BODY) throw new HttpError(413, 'too_large', 'Request too large'); chunks.push(c as Buffer); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new HttpError(400, 'bad_json', 'Invalid JSON'); }
}
async function readImageBody(req: http.IncomingMessage): Promise<Buffer> {
  if (!/^image\/(png|jpeg|webp)$/.test(req.headers['content-type'] ?? '')) throw new HttpError(415, 'ref_bad_type', 'Use a PNG, JPEG or WebP image');
  const chunks: Buffer[] = []; let n = 0;
  let over = false;
  for await (const c of req) {
    n += (c as Buffer).length;
    if (n > 64 * 1024 * 1024) { req.destroy(); break; } // refuse to drain more than 64 MB
    if (n > MAX_REF_BYTES) over = true; else chunks.push(c as Buffer); // keep reading (and discarding) so the connection stays usable
  }
  if (over) throw new HttpError(413, 'ref_too_large', 'The image must be under 8 MB');
  return Buffer.concat(chunks);
}
const tEq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export async function startApp(opts: AppOpts = {}): Promise<RunningApp> {
  const services = new Services(opts);
  const token = opts.token ?? process.env.INFLUENCER_STUDIO_TOKEN ?? crypto.randomBytes(32).toString('base64url');
  const uiDir = opts.uiDir ?? path.join(repoRoot(), 'ui', 'dist');
  const previewsDir = opts.previewsDir ?? process.env.INFLUENCER_STUDIO_PREVIEWS ?? path.join(repoRoot(), 'assets', 'previews');
  const sseClients = new Set<http.ServerResponse>();
  let port = 0;
  const submitTimes: number[] = [];

  services.queue.on('job', (j: Job) => { const line = `event: job\ndata: ${JSON.stringify(publicJob(j))}\n\n`; for (const c of sseClients) c.write(line); });

  const allowedHosts = () => new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  const dl = <T>(f: () => T): T => { try { return f(); } catch (e) { if (e instanceof DlError) throw new HttpError(e.status, e.code, e.message); throw e; } };

  async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    const m = req.method ?? 'GET';
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ') || !tEq(auth.slice(7), token)) throw new HttpError(401, 'unauthorized', 'Missing or wrong session token');
    if (m !== 'GET' && m !== 'HEAD') {
      const origin = req.headers.origin; const sfs = req.headers['sec-fetch-site'];
      if (!origin || !allowedHosts().has(origin.replace(/^https?:\/\//, '')) || !origin.startsWith('http://')) throw new HttpError(403, 'bad_origin', 'Cross-origin or missing Origin');
      if (sfs && sfs !== 'same-origin') throw new HttpError(403, 'bad_origin', 'Cross-site request refused');
    }
    const p = url.pathname;
    if (m === 'GET' && p === '/api/health') return send(res, 200, { ok: true, version: '0.1.0', mock: services.mock, comfyUrl: services.comfy.baseUrl, comfyOnline: await services.comfyHealth() });
    if (m === 'GET' && p === '/api/hardware') return send(res, 200, await services.hardware(url.searchParams.get('refresh') === '1'));
    if (m === 'GET' && p === '/api/options') return send(res, 200, await optionsPayload(services, url.searchParams.get('pretend')));
    if (m === 'GET' && p === '/api/settings') return send(res, 200, services.settings);
    if (m === 'POST' && p === '/api/settings') {
      const b = z.object({ unlock_unsupported: z.boolean().optional(), models_dir: z.string().min(3).max(260).optional() }).strict().parse(await readJson(req));
      if (b.models_dir !== undefined) { try { services.setModelsDir(b.models_dir); } catch (e) { const x = e as { status?: number; code?: string; message: string }; throw new HttpError(x.status ?? 400, x.code ?? 'bad_models_dir', x.message); } }
      if (b.unlock_unsupported !== undefined) services.saveSettings({ unlock_unsupported: b.unlock_unsupported });
      return send(res, 200, services.settings);
    }
    if (m === 'GET' && p === '/api/custom') return send(res, 200, { profile: services.custom ?? services.customDefaults(), saved: !!services.custom });
    if (m === 'POST' && p === '/api/custom') {
      try { return send(res, 200, { profile: services.saveCustom(await readJson(req)), saved: true }); }
      catch (e) { if (e instanceof z.ZodError) throw new HttpError(400, 'bad_custom', 'Check the numbers: ' + e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')); const x = e as { status?: number; code?: string; message: string }; if (x.status) throw new HttpError(x.status, x.code ?? 'bad_custom', x.message); throw e; }
    }
    if (m === 'GET' && p === '/api/downloads') return send(res, 200, { modelsDir: services.modelsDir ?? null, modelsDirSource: services.modelsDirSource, items: services.downloads.list() });
    if (m === 'POST' && p === '/api/downloads') {
      const b = z.object({ variantId: z.string().regex(/^[a-z0-9._-]{1,60}$/), acceptedLicense: z.string().max(40) }).strict().parse(await readJson(req));
      return dl(() => send(res, 202, services.downloads.start(b.variantId, b.acceptedLicense)));
    }
    let dm: RegExpMatchArray | null;
    if (m === 'POST' && (dm = p.match(/^\/api\/downloads\/([a-z0-9._-]{1,60})\/(pause|resume|cancel)$/))) {
      const [, id, act] = dm;
      return dl(() => { if (act === 'resume') return send(res, 202, services.downloads.resume(id)); const r = act === 'pause' ? services.downloads.pause(id) : services.downloads.cancel(id) && true; if (!r) throw new HttpError(404, 'not_found', 'No such download'); return send(res, 200, { ok: true }); });
    }
    if (m === 'GET' && p === '/api/schema') return send(res, 200, schemaPayload(services));
    if (m === 'POST' && p === '/api/compile') {
      const b = z.object({ character: z.record(z.unknown()), seed: z.number().int().min(0).max(4294967295).default(0) }).strict().parse(await readJson(req));
      return send(res, 200, compileCharacter(b.character, b.seed));
    }
    if (m === 'POST' && p === '/api/randomise') {
      const b = z.object({ character: z.record(z.unknown()), locks: z.array(z.string().max(30)).max(40).default([]), seed: z.number().int().min(0).max(4294967295), mode: z.enum(['silly', 'realistic', 'quirky', 'chaos']).default('realistic') }).strict().parse(await readJson(req));
      return send(res, 200, randomise(CharacterSchema.parse(b.character), new Set(b.locks), b.seed, b.mode));
    }
    if (m === 'POST' && p === '/api/preset') {
      const b = z.object({ character: z.record(z.unknown()), preset: z.string().max(30) }).strict().parse(await readJson(req));
      return send(res, 200, applyPreset(CharacterSchema.parse(b.character), b.preset));
    }
    if (m === 'GET' && p === '/api/jobs') return send(res, 200, services.queue.list().map(publicJob));
    if (m === 'POST' && p === '/api/jobs') return createJob(await readJson(req), res);
    let mm: RegExpMatchArray | null;
    if (m === 'GET' && (mm = p.match(/^\/api\/jobs\/([0-9a-f-]{36})$/))) { const j = services.queue.get(mm[1]); if (!j) throw new HttpError(404, 'not_found', 'No such job'); return send(res, 200, publicJob(j)); }
    if (m === 'POST' && (mm = p.match(/^\/api\/jobs\/([0-9a-f-]{36})\/cancel$/))) { const j = services.queue.cancel(mm[1]); if (!j) throw new HttpError(404, 'not_found', 'No such job'); return send(res, 200, publicJob(j)); }
    if (m === 'POST' && (mm = p.match(/^\/api\/jobs\/([0-9a-f-]{36})\/retry$/))) {
      const j = services.queue.get(mm[1]); if (!j) throw new HttpError(404, 'not_found', 'No such job');
      if (!['failed', 'interrupted', 'cancelled'].includes(j.status)) throw new HttpError(409, 'not_retryable', 'Job is not finished');
      // A retry goes through the full check again (new job).
      return createJob({ character: j.character, seed: j.seed, variantId: j.variantId, ...(j.styleRef || j.edit || j.video ? {} : { template: j.template }), ...(j.styleRef ? { styleRef: j.styleRef } : {}), ...(j.edit ? { edit: j.edit } : {}), ...(j.video ? { video: j.video } : {}), width: j.width, height: j.height, batch: j.batch, ...(j.steps ? { steps: j.steps } : {}) }, res);
    }
    if (m === 'GET' && (mm = p.match(/^\/api\/outputs\/([0-9a-f-]{36})\/([0-3])$/))) {
      const o = services.queue.outputPath(mm[1], Number(mm[2])); if (!o) throw new HttpError(404, 'not_found', 'No such output');
      res.writeHead(200, { 'content-type': o.mime, 'cache-control': 'private, max-age=3600', 'content-disposition': 'inline', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'", 'x-content-type-options': 'nosniff' });
      return void fs.createReadStream(o.file).pipe(res);
    }
    if (m === 'GET' && p === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(': connected\n\n'); sseClients.add(res);
      const ka = setInterval(() => res.write(': ka\n\n'), 25_000);
      req.on('close', () => { clearInterval(ka); sseClients.delete(res); });
      return;
    }
    if (m === 'POST' && p === '/api/refs') {
      try { const { id, info } = services.refs.save(await readImageBody(req)); return send(res, 201, { id, width: info.width, height: info.height, mime: info.mime }); }
      catch (e) { if (e instanceof HttpError) throw e; const x = e as { code?: string; status?: number; message: string }; if (x.status) throw new HttpError(x.status, x.code ?? 'bad_ref', x.message); throw e; }
    }
    if (m === 'GET' && (mm = p.match(/^\/api\/refs\/([0-9a-f-]{36})$/))) {
      const r = services.refs.get(mm[1]); if (!r) throw new HttpError(404, 'not_found', 'No such reference image');
      res.writeHead(200, { 'content-type': r.info.mime, 'cache-control': 'private, max-age=3600', 'content-disposition': 'inline', 'content-security-policy': "default-src 'none'", 'x-content-type-options': 'nosniff' });
      return void fs.createReadStream(r.file).pipe(res);
    }
    if (m === 'DELETE' && (mm = p.match(/^\/api\/refs\/([0-9a-f-]{36})$/))) return send(res, 200, { ok: services.refs.remove(mm[1]) });
    if (m === 'GET' && p === '/api/characters') return send(res, 200, services.library());
    if (m === 'POST' && p === '/api/characters') {
      const b = z.object({ name: z.string().max(60), character: z.record(z.unknown()), seed: z.number().int().min(0).max(4294967295).default(0), refImage: z.string().regex(/^[0-9a-f-]{36}$/).optional() }).strict().parse(await readJson(req));
      compileCharacter({ ...b.character, name: b.name }, b.seed);
      if (b.refImage && !services.refs.get(b.refImage)) throw new HttpError(400, 'bad_ref', 'The reference image was not found'); // full validation + safety check before saving
      const items = services.library(); if (items.length >= 500) throw new HttpError(429, 'library_full', 'Library is full');
      const item = { id: crypto.randomUUID(), name: b.name.trim(), character: CharacterSchema.parse(b.character), seed: b.seed, savedAt: new Date().toISOString(), ...(b.refImage ? { refImage: b.refImage } : {}) };
      services.saveLibrary([item, ...items]); return send(res, 201, item);
    }
    if (m === 'DELETE' && (mm = p.match(/^\/api\/characters\/([0-9a-f-]{36})$/))) {
      const all = services.library(); const gone = all.find(x => x.id === mm![1]); const rest = all.filter(x => x.id !== mm![1]);
      services.saveLibrary(rest);
      if (gone?.refImage && !rest.some(x => x.refImage === gone.refImage)) services.refs.remove(gone.refImage); // the picture goes with the character unless another one shares it
      return send(res, 200, { ok: true });
    }
    if (m === 'POST' && p === '/api/refs/from-job') {
      const b = z.object({ jobId: z.string().regex(/^[0-9a-f-]{36}$/), index: z.number().int().min(0).max(3) }).strict().parse(await readJson(req));
      const o = services.queue.outputPath(b.jobId, b.index); if (!o || o.mime !== 'image/png') throw new HttpError(404, 'not_found', 'No such image result');
      try { const { id, info } = services.refs.saveFromFile(o.file); return send(res, 201, { id, width: info.width, height: info.height, mime: info.mime }); }
      catch (e) { const x = e as { code?: string; status?: number; message: string }; if (x.status) throw new HttpError(x.status, x.code ?? 'bad_ref', x.message); throw e; }
    }
    throw new HttpError(404, 'not_found', 'Unknown route');
  }

  async function createJob(raw: unknown, res: http.ServerResponse) {
    const now = Date.now();
    while (submitTimes.length && now - submitTimes[0] > 60_000) submitTimes.shift();
    if (submitTimes.length >= 10) { res.setHeader('retry-after', '10'); throw new HttpError(429, 'rate_limited', 'Too many jobs, wait a moment', { retryAfter: 10 }); }
    const b = JobRequestSchema.parse(raw);
    const seed = b.seed ?? Math.floor(Math.random() * 4294967295);
    const character = CharacterSchema.parse(b.character);
    const compiled = compileCharacter(character, seed);
    const profile = await services.hardware();
    if (b.styleRef && !services.refs.get(b.styleRef)) throw new HttpError(400, 'bad_ref', 'The style reference image was not found. Add it again.');
    if (b.video && (b.edit || b.styleRef || b.template)) throw new HttpError(400, 'bad_params', 'A video job cannot be combined with an edit, a style reference or a template');
    const vref = b.video ? services.refs.get(b.video.refId) : null;
    if (b.video && !vref) throw new HttpError(400, 'bad_ref', 'The picture to animate was not found. Save the character from a picture first.');
    if (b.edit && (b.styleRef || b.template)) throw new HttpError(400, 'bad_params', 'An edit job cannot be combined with a style reference or a template');
    if (b.edit && !services.refs.get(b.edit.refId)) throw new HttpError(400, 'bad_ref', 'The saved character image was not found. Save the character from a picture first.');
    const template = b.video ? 'wan22_i2v' : b.edit ? templateForEdit(b.edit) : b.styleRef ? 'klein_edit' : (b.template ?? 'klein_t2i');
    if (b.styleRef && b.template && b.template !== 'klein_edit') throw new HttpError(400, 'bad_params', 'A style reference needs the image edit template');
    let editPrompt: string | undefined; let frames: number | undefined;
    if (b.edit) { try { editPrompt = compileEdit(b.edit); } catch (e) { if (e instanceof SafetyError) throw e; throw new HttpError(400, 'bad_params', (e as Error).message); } }
    const tpl = services.templates.get(template);
    const variantId = b.variantId ?? (tpl ? tpl.manifest.variantIds[0] : '');
    let width = b.width ?? 768, height = b.height ?? 1024;
    if (b.video && vref) { ({ width, height } = videoDims(vref.info.width, vref.info.height, b.video.size)); frames = framesFor(b.video.seconds); try { editPrompt = compileVideo(b.video); } catch (e) { if (e instanceof SafetyError) throw e; throw new HttpError(400, 'bad_params', (e as Error).message); } }
     // the edit template takes its size from the reference (about 1 megapixel)
    void profile;
    const verdict = await services.check({ template, variantId, width, height, frames, refs: b.styleRef || b.edit || b.video ? 1 : 0, batch: b.batch, steps: b.steps }); // reference count is derived on the server, never taken from the request
    if (!verdict.ok) {
      throw new HttpError(verdict.httpStatus, verdict.code, verdict.code === 'locked_by_hardware' ? 'Locked on this PC. Turn on Advanced > Unlock unsupported options to try anyway.' : 'This job cannot run on this PC.', { reasons: [...verdict.hard, ...verdict.soft] });
    }
    // Dry-run the template fill so bad parameters fail now, not mid-queue.
    if (tpl) { try { const { fillTemplate } = await import('./workflows.js'); fillTemplate(tpl, { prompt: editPrompt ?? compiled.positive, seed, ...('width' in tpl.manifest.params ? { width, height, ...('batch' in tpl.manifest.params ? { batch: b.batch ?? 1 } : {}) } : {}), ...(frames && 'length' in tpl.manifest.params ? { length: frames } : {}), ...(b.steps ? { steps: b.steps } : {}) }); } catch (e) { throw new HttpError(400, 'bad_params', (e as Error).message); } }
    submitTimes.push(now);
    const job = services.queue.enqueue({
      template, variantId, prompt: editPrompt ?? compiled.positive, negative: compiled.negative, seed, width, height, batch: b.batch ?? 1, steps: b.steps,
      character: character as Record<string, unknown>, label: `${compiled.resolved.type}${compiled.resolved.species ? ' / ' + compiled.resolved.species : ''} / ${compiled.resolved.bodySize}`,
      styleRef: b.styleRef, edit: b.edit as Record<string, unknown> | undefined, video: b.video as Record<string, unknown> | undefined, frames, mock: services.mock, unsupported: verdict.soft.length > 0, softReasons: verdict.soft,
    });
    send(res, 202, publicJob(job));
  }

  const server = http.createServer(async (req, res) => {
    const headers = { 'content-security-policy': CSP, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'cross-origin-resource-policy': 'same-origin', 'x-frame-options': 'DENY' };
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    try {
      // DNS-rebinding defence: only loopback Host values.
      if (!allowedHosts().has(req.headers.host ?? '')) throw new HttpError(403, 'bad_host', 'Bad Host header');
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method', 'Method not allowed');
      if (url.pathname.startsWith('/previews/')) return serveStatic(res, previewsDir, url.pathname.slice('/previews'.length), 'public, max-age=3600');
      return serveStatic(res, uiDir, url.pathname);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.code, message: e.message, ...(e.extra as object ?? {}) });
      if (e instanceof SafetyError) return send(res, 422, { error: e.code, message: e.message });
      if (e instanceof z.ZodError) {
        // Age under 21 and unknown fields land here; never echo free text back.
        return send(res, 400, { error: 'invalid_request', message: 'Invalid request', issues: e.issues.map(i => ({ path: i.path.join('.'), code: i.code })) });
      }
      if ((e as { status?: number }).status === 429) return send(res, 429, { error: 'queue_full', message: (e as Error).message });
      process.stderr.write('server error: ' + (e instanceof Error ? e.message : 'unknown') + '\n');
      return send(res, 500, { error: 'internal', message: 'Something went wrong' });
    }
  });
  server.requestTimeout = 60_000; server.headersTimeout = 15_000;

  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(opts.port ?? 0, '127.0.0.1', resolve); });
  port = (server.address() as { port: number }).port;
  services.queue.start();
  return {
    server, token, port, services, url: `http://127.0.0.1:${port}/#t=${token}`,
    close: () => new Promise<void>(r => { for (const c of sseClients) c.end(); server.closeAllConnections(); server.close(() => r()); }),
  };
}

function publicJob(j: Job) {
  const { softReasons, outputs, ...rest } = j;
  return { ...rest, softReasons, outputs: outputs.map((o, i) => ({ index: i, mime: o.mime })) };
}

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.ico': 'image/x-icon' };
function serveStatic(res: http.ServerResponse, root: string, pathname: string, cache?: string) {
  let rel: string;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, { error: 'bad_path' }); }
  if (rel.includes('\0') || rel.includes('\\')) return send(res, 400, { error: 'bad_path' });
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = path.resolve(root, '.' + rel);
  if (!full.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    if (!cache && !fs.existsSync(path.join(root, 'index.html'))) return send(res, 503, { error: 'ui_missing', message: 'UI is not built. Run: npm run build' });
    return send(res, 404, { error: 'not_found' });
  }
  const real = fs.realpathSync(full);
  if (!real.startsWith(fs.realpathSync(root) + path.sep)) return send(res, 403, { error: 'forbidden' });
  res.writeHead(200, { 'content-type': MIME[path.extname(full)] ?? 'application/octet-stream', 'cache-control': cache && !rel.endsWith('.json') ? cache : rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
  fs.createReadStream(full).pipe(res);
}

const RES_PX = [512, 768, 1024, 1536, 2048, 3072, 4096];
async function optionsPayload(s: Services, pretend: string | null) {
  const real = await s.hardware();
  const useCustom = !pretend && !!s.custom?.enabled;
  const profile = pretend ? s.pretend(pretend, real) ?? real : await s.effectiveHardware();
  const baseT = s.limits.tiers.find(x => x.id === profile.tier)!;
  const t = useCustom ? customTier(baseT, s.custom!) : baseT;
  const models = s.registry.models.map(m => {
    const fit = s.bestVariant(m.id, profile);
    const pv = useCustom ? s.registry.variants.find(v => v.modelId === m.id && precisionMatch(v.format, s.custom!.precision)) : undefined;
    return { ...m, bestVariantId: pv && fit.variantId ? pv.id : fit.variantId, variants: s.registry.variants.filter(v => v.modelId === m.id).map(v => {
      const st = fit.states.find(x => x.variantId === v.id)!;
      return { id: v.id, label: v.label, format: v.format, sizeGb: v.sizeGb, license: v.license, minVramGb: v.minVramGb, recommendedVramGb: v.recommendedVramGb, minRamGb: v.minRamGb, est: v.est, template: v.template,
        state: st.state, reasons: st.reasons, installed: st.installed, sources: [...new Set(v.files.map(f => f.source))], licenseInfo: s.registry.licenses[v.license] ?? null, files: v.files.map(f => ({ name: f.name, folder: f.folder, sizeBytes: f.sizeBytes })),
        downloadable: v.files.every(f => f.sha256 !== null) };
    }) };
  });
  const resolutions = RES_PX.map(px => {
    const locked = !s.mock && (profile.tier === 'T0' || px > t.maxImagePx);
    return { px, width: Math.round((px * 0.75) / 16) * 16, height: px, state: locked ? 'locked_soft' : 'runs', reason: locked ? (profile.tier === 'T0' ? R.noGpu().text : R.res(px, t.maxImagePx, t.name).text) : null };
  });
  return { profile, pretend: pretend ?? null, custom: s.custom ?? null, customActive: useCustom, realTier: real.tier, realTierName: s.limits.tiers.find(x => x.id === real.tier)!.name, tier: { id: t.id, name: t.name, label: t.label, maxImagePx: t.maxImagePx, maxVideoPx: t.maxVideoPx, maxVideoFrames: t.maxVideoFrames, estimated: t.estimated }, models, resolutions, settings: s.settings, comfyOnline: await s.comfyHealth(), mock: s.mock,
    summary: profile.tier === 'T0' ? 'This computer cannot run local generation models. Generation is locked; you can still explore the character builder.' : `Your PC: ${profile.gpus.find(g => g.index === profile.selectedGpu)?.name ?? 'GPU'}, ${profile.vramGb} GB VRAM, ${profile.ramGb} GB RAM. We enabled what runs well and locked the rest.` };
}
function schemaPayload(s: Services) {
  return {
    types: TYPE_OPTS.map(t => ({ id: t.id, label: t.label, human: t.human })),
    species: Object.fromEntries(Object.entries(SPECIES_BY_TYPE).map(([k, v]) => [k, v.map(o => ({ id: o.id, label: o.label }))])),
    sizes: SIZE_OPTS.map(o => ({ id: o.id, label: o.label })),
    ageBands: AGE_BANDS.map(a => ({ id: a.id, label: a.label, age: a.age })),
    controls: CONTROLS.map(c => ({ id: c.id, title: c.title, ui: c.ui, multi: !!c.multi, maxSelected: c.maxSelected ?? 1, applies: c.applies, default: c.default, options: c.options.map(o => ({ id: o.id, label: o.label, ...(o.silly ? { silly: true } : {}) })) })),
    silliness: SILLINESS.map(({ id, label }) => ({ id, label })),
    presets: PRESETS.map(p => ({ id: p.id, label: p.label, silly: !!p.silly })),
    edit: { poses: POSES.map(({ id, label }) => ({ id, label })), azimuths: AZIMUTHS.map(({ id, label }) => ({ id, label })), elevations: ELEVATIONS.map(({ id, label }) => ({ id, label })), distances: DISTANCES.map(({ id, label }) => ({ id, label })) },
    video: { motions: MOTIONS.map(({ id, label }) => ({ id, label })), cameras: CAMERAS.map(({ id, label }) => ({ id, label })), seconds: DURATIONS, sizes: VIDEO_SIZES },
    templates: [...s.templates.values()].map(t => ({ id: t.manifest.id, label: t.manifest.label, mode: t.manifest.mode, kind: t.manifest.kind })),
  };
}
