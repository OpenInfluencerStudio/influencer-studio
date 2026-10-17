import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

/** Repo root: works from src/ (tsx, vitest) and dist/ (built). */
export function repoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'models.json')) && fs.existsSync(path.join(dir, 'workflows'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('Could not locate the Influencer Studio root folder');
}
export function dataDir(): string {
  return process.env.INFLUENCER_STUDIO_DATA ? path.resolve(process.env.INFLUENCER_STUDIO_DATA) : path.join(repoRoot(), '.runtime');
}
