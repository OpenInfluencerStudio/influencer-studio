import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startApp } from '../src/app.js';
import { VERSION, ISSUES_URL, redact } from '../src/diagnostics.js';

const root = path.resolve(__dirname, '../..');
async function boot() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'is-dg-')); const modelsDir = path.join(dataDir, 'my-private-models');
  fs.mkdirSync(modelsDir, { recursive: true });
  const app = await startApp({ port: 0, token: 'test-token', dataDir, uiDir: path.join(root, 'ui/public'), comfyUrl: 'http://127.0.0.1:9', mock: true, modelsDir });
  const get = (p: string) => fetch(`http://127.0.0.1:${app.port}${p}`, { headers: { authorization: 'Bearer test-token' } });
  return { app, get, dataDir, modelsDir };
}
describe('version stamp and diagnostics', () => {
  it('version is one value across package.json files, health, options and the report', async () => {
    expect(VERSION).toBe('0.2.0-prelaunch');
    for (const f of ['package.json', 'server/package.json']) expect(JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')).version).toBe(VERSION);
    const { app, get } = await boot();
    try {
      expect((await (await get('/api/health')).json()).version).toBe(VERSION);
      expect((await (await get('/api/options')).json()).version).toBe(VERSION);
      const d = await (await get('/api/diagnostics')).json();
      expect(d.version).toBe(VERSION); expect(d.issuesUrl).toBe(ISSUES_URL); expect(d.report).toContain(VERSION);
      expect(d.hardware.tier).toBeTruthy(); expect(Array.isArray(d.models)).toBe(true); expect(d.models.length).toBeGreaterThan(0);
      expect(d.comfy.address).toBe('loopback');
    } finally { await app.close(); }
  });
  it('diagnostics need the token', async () => {
    const { app } = await boot();
    try { expect((await fetch(`http://127.0.0.1:${app.port}/api/diagnostics`)).status).toBe(401); } finally { await app.close(); }
  });
  it('the report never contains private paths, user names or tokens', async () => {
    const { app, get, dataDir, modelsDir } = await boot();
    try {
      const d = await (await get('/api/diagnostics')).json(); const r: string = d.report;
      for (const secret of [dataDir, modelsDir, os.homedir(), process.cwd(), 'my-private-models', 'test-token']) expect(r.includes(secret), secret).toBe(false);
      expect(JSON.stringify(d).includes('my-private-models')).toBe(false);
      expect(d.modelsFolder).toBe('configured');
    } finally { await app.close(); }
  });
  it('redact collapses home folders on both OS styles and strips session tokens', () => {
    expect(redact('C:\\Users\\Alice\\AppData\\x and /home/bob/models and http://127.0.0.1:1/#t=abcdefghijklmnopqrstuvwxyz0123')).toBe('<home>\\AppData\\x and <home>/models and http://127.0.0.1:1/#t=<token>');
  });
});
