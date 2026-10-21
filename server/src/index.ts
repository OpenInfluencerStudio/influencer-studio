import { startApp, RunningApp } from './app.js';
import { openBrowser } from './open.js';
import { autoStartManaged } from './managed-comfy.js';
import { repoRoot } from './paths.js';

const base = Number(process.env.PORT ?? 8787);
let app: RunningApp | undefined; let lastErr: unknown;
// If the port is taken (for example a second copy is running), try the next few instead of failing.
for (let i = 0; i < 10 && !app; i++) {
  try { app = await startApp({ port: base + i }); } catch (e) { lastErr = e; if ((e as { code?: string }).code !== 'EADDRINUSE') break; }
}
if (!app) { process.stderr.write(`Could not start: ${lastErr instanceof Error ? lastErr.message : 'unknown error'}\n`); process.exit(1); }
process.stdout.write(`\nInfluencer Studio is running (local only).\nOpen: ${app.url}\n`);
const comfyUp = await app.services.comfyHealth();
process.stdout.write(`ComfyUI: ${app.services.comfy.baseUrl} (${comfyUp ? 'online' : 'not reachable yet'}${app.services.comfySource === 'auto' ? ', auto-detected; set COMFYUI_URL to fix it' : ''})${app.services.mock ? '  [MOCK GENERATOR ON: placeholder images, no AI]' : ''}\n`);
// Optional app-managed ComfyUI (single install): only when nothing is set and no ComfyUI answers on 8188 or 8288.
const auto = await autoStartManaged({ services: app.services, appRoot: repoRoot(), log: m => process.stdout.write(m + '\n') }).catch(e => { process.stdout.write(`Managed ComfyUI: ${(e as Error).message}\n`); return { managed: null, reason: 'error' }; });
if (!comfyUp && auto.reason === 'not-installed') process.stdout.write('No ComfyUI found. Start yours, or run the "Install ComfyUI" script in this folder once.\n');
if (process.env.INFLUENCER_STUDIO_OPEN === '1') openBrowser(app.url);
const running = app;
const stop = () => { auto.managed?.stop(); void running.close().then(() => process.exit(0)); };
process.on('exit', () => auto.managed?.stop());
process.on('SIGINT', stop); process.on('SIGTERM', stop); process.on('SIGHUP', stop);
