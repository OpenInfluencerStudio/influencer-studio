/** MOCK GENERATOR: draws a clearly labelled placeholder (no AI model involved). Used only when mock mode is on. */
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function mockImageSvg(o: { width: number; height: number; seed: number; label: string; prompt: string }): Buffer {
  const hue = (o.seed * 47) % 360;
  const words = o.prompt.split(' ');
  const lines: string[] = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).length > 46) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  const text = lines.slice(0, 7).map((l, i) => `<text x="40" y="${o.height - 40 - (Math.min(lines.length, 7) - i) * 22}" fill="#cfd2d8" font-size="16" font-family="sans-serif">${esc(l)}${i === 6 && lines.length > 7 ? '…' : ''}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,18%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},50%,8%)"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<circle cx="${o.width / 2}" cy="${o.height * 0.36}" r="${o.width * 0.16}" fill="hsl(${hue},40%,35%)" opacity=".8"/>
<rect x="${o.width * 0.28}" y="${o.height * 0.5}" width="${o.width * 0.44}" height="${o.height * 0.3}" rx="${o.width * 0.12}" fill="hsl(${hue},40%,30%)" opacity=".8"/>
<rect x="24" y="24" width="${o.width - 48}" height="44" rx="10" fill="#d6ff1f"/>
<text x="40" y="53" fill="#0b0b0c" font-size="20" font-weight="700" font-family="sans-serif">MOCK GENERATOR - placeholder, not an AI image</text>
<text x="40" y="100" fill="#fff" font-size="22" font-family="sans-serif">${esc(o.label)} · seed ${o.seed}</text>${text}</svg>`;
  return Buffer.from(svg, 'utf8');
}
