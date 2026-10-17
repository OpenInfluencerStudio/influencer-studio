import { startApp } from './app.js';

const port = Number(process.env.PORT ?? 8787);
const app = await startApp({ port });
process.stdout.write(`\nInfluencer Studio is running (local only).\nOpen: ${app.url}\n`);
process.stdout.write(`ComfyUI: ${app.services.comfy.baseUrl}${app.services.mock ? '  [MOCK GENERATOR ON: placeholder images, no AI]' : ''}\n`);
const stop = () => { void app.close().then(() => process.exit(0)); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
