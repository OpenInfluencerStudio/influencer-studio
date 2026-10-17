import { startApp, RunningApp } from './app.js';
import { openBrowser } from './open.js';

const base = Number(process.env.PORT ?? 8787);
let app: RunningApp | undefined; let lastErr: unknown;
// If the port is taken (for example a second copy is running), try the next few instead of failing.
for (let i = 0; i < 10 && !app; i++) {
  try { app = await startApp({ port: base + i }); } catch (e) { lastErr = e; if ((e as { code?: string }).code !== 'EADDRINUSE') break; }
}
if (!app) { process.stderr.write(`Could not start: ${lastErr instanceof Error ? lastErr.message : 'unknown error'}\n`); process.exit(1); }
process.stdout.write(`\nInfluencer Studio is running (local only).\nOpen: ${app.url}\n`);
process.stdout.write(`ComfyUI: ${app.services.comfy.baseUrl}${app.services.mock ? '  [MOCK GENERATOR ON: placeholder images, no AI]' : ''}\n`);
if (process.env.INFLUENCER_STUDIO_OPEN === '1') openBrowser(app.url);
const running = app;
const stop = () => { void running.close().then(() => process.exit(0)); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
