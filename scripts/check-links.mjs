// Check every link and image in the Markdown docs.  node scripts/check-links.mjs [--external]
// Relative links must point to a file or folder in the repo (and #anchors to a heading in that file).
// With --external, every http(s) link gets a HEAD request (GET if HEAD is refused). Exit code 1 if anything is broken.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const external = process.argv.includes('--external');
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.md'], { cwd: root, encoding: 'utf8' }).split('\n').filter(f => f && !f.includes('node_modules/'));
const slug = h => h.trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[`*_~]/g, '').replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /g, '-');
const anchors = f => { const t = fs.readFileSync(f, 'utf8').replace(/```[\s\S]*?```/g, ''); const seen = {}; return new Set([...t.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => { let s = slug(m[1]); if (seen[s] != null) s = s + '-' + ++seen[s]; else seen[s] = 0; return s; })); };
const links = [];
for (const f of tracked) {
  const text = fs.readFileSync(path.join(root, f), 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const found = [...text.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map(m => m[1])
    .concat([...text.matchAll(/<(?:img|a)\s[^>]*(?:src|href)="([^"]+)"/g)].map(m => m[1]))
    .concat([...text.matchAll(/(?<![("<=])\bhttps?:\/\/[^\s)<>"'`\]]+/g)].map(m => m[0].replace(/[.,;:]+$/, '')));
  for (const l of new Set(found)) links.push({ file: f, link: l });
}
const bad = []; let rel = 0, ext = new Map();
for (const { file, link } of links) {
  if (/^mailto:/.test(link)) continue;
  if (/^https?:\/\//.test(link)) { (ext.get(link) ?? ext.set(link, []).get(link)).push(file); continue; }
  rel++;
  const [p, hash] = link.split('#');
  const target = p ? path.resolve(path.dirname(path.join(root, file)), decodeURIComponent(p)) : path.join(root, file);
  if (!target.startsWith(root) || !fs.existsSync(target)) { bad.push(`${file}: missing ${link}`); continue; }
  if (hash && target.endsWith('.md') && !anchors(target).has(hash.toLowerCase())) bad.push(`${file}: missing anchor ${link}`);
}
console.log(`${tracked.length} Markdown files, ${rel} relative links/images, ${ext.size} unique external links`);
if (external) {
  for (const [url, files] of ext) {
    let status = 0;
    for (const method of ['HEAD', 'GET']) {
      try { const r = await fetch(url, { method, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (link-check)' }, signal: AbortSignal.timeout(20000) }); status = r.status; if (method === 'GET') r.body?.cancel(); } catch (e) { status = 'ERR ' + e.cause?.code; }
      if (status === 200) break;
    }
    const okish = status === 200 || (/^https:\/\/(x|twitter)\.com\//.test(url) && [200, 403].includes(status));
    console.log(okish ? 'OK  ' : 'BAD ', status, url, okish ? '' : '(' + [...new Set(files)].join(', ') + ')');
    if (!okish) bad.push(`external ${status} ${url} in ${[...new Set(files)].join(', ')}`);
  }
}
for (const b of bad) console.log('BROKEN', b);
console.log(bad.length ? `LINKS BROKEN: ${bad.length}` : 'LINKS OK'); process.exit(bad.length ? 1 : 0);
