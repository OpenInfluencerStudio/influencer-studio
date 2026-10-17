import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_REF_BYTES = 8 * 1024 * 1024;
export const MAX_REF_PIXELS = 16_000_000;
export interface RefInfo { ext: 'png' | 'jpg' | 'webp'; mime: string; width: number; height: number }

/** Identify an image by its magic bytes and read its size from the header (no decoding). Returns null for anything else (SVG, GIF, HTML, ...). */
export function sniffImage(b: Buffer): RefInfo | null {
  if (b.length > 24 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && b.subarray(12, 16).toString('latin1') === 'IHDR')
    return { ext: 'png', mime: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i += m === 0xff ? 1 : 2; continue; }
      const len = b.readUInt16BE(i + 2);
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { ext: 'jpg', mime: 'image/jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  }
  if (b.length > 30 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') {
    const t = b.subarray(12, 16).toString('latin1');
    if (t === 'VP8X') return { ext: 'webp', mime: 'image/webp', width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (t === 'VP8 ') return { ext: 'webp', mime: 'image/webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (t === 'VP8L') { const v = b.readUInt32LE(21); return { ext: 'webp', mime: 'image/webp', width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}

/** Reference images the user adds. Stored under random ids; the original name is never used on disk or sent to ComfyUI. */
export class RefStore {
  constructor(private dir: string, private max = 60) { fs.mkdirSync(dir, { recursive: true }); }
  private files(): string[] { return fs.readdirSync(this.dir).filter(f => /^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(f)); }
  save(buf: Buffer): { id: string; info: RefInfo } {
    if (buf.length === 0 || buf.length > MAX_REF_BYTES) throw Object.assign(new Error('The image must be under 8 MB'), { code: 'ref_too_large', status: 413 });
    const info = sniffImage(buf);
    if (!info) throw Object.assign(new Error('Use a PNG, JPEG or WebP image'), { code: 'ref_bad_type', status: 415 });
    if (info.width < 64 || info.height < 64 || info.width * info.height > MAX_REF_PIXELS) throw Object.assign(new Error('The image size is not supported (min 64 px, max 16 megapixels)'), { code: 'ref_bad_size', status: 400 });
    if (this.files().length >= this.max) throw Object.assign(new Error('Too many reference images; remove some first'), { code: 'ref_full', status: 429 });
    const id = crypto.randomUUID();
    fs.writeFileSync(path.join(this.dir, `${id}.${info.ext}`), buf);
    return { id, info };
  }
  get(id: string): { file: string; info: RefInfo } | null {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const f = this.files().find(x => x.startsWith(id + '.')); if (!f) return null;
    const file = path.join(this.dir, f); const buf = fs.readFileSync(file); const info = sniffImage(buf);
    return info ? { file, info } : null;
  }
  remove(id: string): boolean { const r = this.get(id); if (!r) return false; fs.unlinkSync(r.file); return true; }
}
