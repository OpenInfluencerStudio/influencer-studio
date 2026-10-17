import fs from 'node:fs';
import path from 'node:path';

/** Atomic JSON write: temp file + fsync + rename, with a rolling backup (plan 18.4). */
export function writeJsonAtomic(file: string, data: unknown, keepBackup = true): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, JSON.stringify(data, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (keepBackup && fs.existsSync(file)) { try { fs.copyFileSync(file, file + '.bak'); } catch { /* ignore */ } }
  fs.renameSync(tmp, file);
}
export function readJsonSafe<T>(file: string, fallback: T): T {
  for (const f of [file, file + '.bak']) {
    try { return JSON.parse(fs.readFileSync(f, 'utf8')) as T; } catch { /* try backup */ }
  }
  return fallback;
}
