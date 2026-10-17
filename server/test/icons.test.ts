import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startApp } from '../src/app.js';

const pub = path.resolve(__dirname, '../../ui/public');
const FILES: [string, string][] = [['/icon.svg', 'image/svg+xml'], ['/favicon.ico', 'image/x-icon'], ['/icon-16.png', 'image/png'], ['/icon-32.png', 'image/png'], ['/apple-touch-icon.png', 'image/png'], ['/icon-192.png', 'image/png'], ['/icon-512.png', 'image/png'], ['/icon-512-maskable.png', 'image/png'], ['/site.webmanifest', 'application/manifest+json']];
describe('app icon and web manifest', () => {
  it('are served with the right type, a day of caching and nosniff, without a token', async () => {
    const app = await startApp({ port: 0, token: 'test-token', dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'is-ic-')), uiDir: pub, comfyUrl: 'http://127.0.0.1:9' });
    try {
      for (const [p, type] of FILES) {
        const r = await fetch(`http://127.0.0.1:${app.port}${p}`); expect(r.status, p).toBe(200); expect(r.headers.get('content-type'), p).toBe(type);
        expect(r.headers.get('cache-control'), p).toBe('public, max-age=86400'); expect(r.headers.get('x-content-type-options')).toBe('nosniff'); expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(100);
      }
    } finally { await app.close(); }
  });
  it('PNG sizes are exact and the manifest is valid with theme colour', () => {
    const dim = (f: string) => { const b = fs.readFileSync(path.join(pub, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    expect(dim('icon-16.png')).toEqual([16, 16]); expect(dim('icon-32.png')).toEqual([32, 32]); expect(dim('apple-touch-icon.png')).toEqual([180, 180]); expect(dim('icon-192.png')).toEqual([192, 192]); expect(dim('icon-512.png')).toEqual([512, 512]);
    const ico = fs.readFileSync(path.join(pub, 'favicon.ico')); expect(ico.readUInt16LE(0)).toBe(0); expect(ico.readUInt16LE(2)).toBe(1); expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(2);
    const m = JSON.parse(fs.readFileSync(path.join(pub, 'site.webmanifest'), 'utf8')); expect(m.name).toBe('Influencer Studio'); expect(m.theme_color).toBe('#0b0b0c'); expect(m.icons.length).toBeGreaterThanOrEqual(3);
    for (const i of m.icons) expect(fs.existsSync(path.join(pub, i.src)), i.src).toBe(true);
  });
  it('index.html has title, theme colour, icons and manifest links', () => {
    const h = fs.readFileSync(path.resolve(__dirname, '../../ui/index.html'), 'utf8');
    for (const s of ['<title>Influencer Studio</title>', 'name="theme-color"', 'rel="icon"', 'rel="apple-touch-icon"', 'rel="manifest"', 'favicon.ico']) expect(h).toContain(s);
  });
  it('the logo is original and plain: lime on near-black, no external references', () => {
    const svg = fs.readFileSync(path.join(pub, 'icon.svg'), 'utf8'); expect(svg).toContain('#d6ff1f'); expect(svg).toContain('#0b0b0c'); expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)|<image|<script/);
  });
});
