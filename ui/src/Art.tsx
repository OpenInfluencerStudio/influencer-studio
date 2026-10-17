// Generated placeholder illustrations (SVG only; abstract, original art, no real people, no remote assets).
import { useEffect, useRef, useState } from 'preact/hooks';
export function hue(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

export const SKIN: Record<string, string> = { Porcelain: '#f6ddcc', Light: '#efc9a8', Sand: '#e0ac82', Tan: '#c68a5e', Bronze: '#a56a43', Brown: '#7d4e32', Deep: '#573522', Ebony: '#3b2418' };
export const HAIRC: Record<string, string> = { Black: '#1c1a1d', 'Dark brown': '#3b271c', Brown: '#6a4630', Auburn: '#8d3b22', Ginger: '#c0561f', Blonde: '#dcb764', Platinum: '#ece3cf', Grey: '#9a9aa0', Silver: '#cfd2da', Teal: '#1fa3a0', Pink: '#e86aa8', Blue: '#3d6be0' };
export const EYEC: Record<string, string> = { Brown: '#6b4226', 'Dark brown': '#32190d', Hazel: '#8a6a2f', Amber: '#c4872a', Green: '#3f8a4f', Blue: '#3d7fd0', Grey: '#8b95a3', Violet: '#7c4fc2' };
export const OUTFITC: Record<string, string> = { 'White tee & jeans': '#f8f8f8', 'Hoodie & joggers': '#7a7f8c', 'Smart blazer': '#2d3a55', 'Summer dress': '#e8a33a', 'Sport set': '#2aa7a0', 'Denim jacket': '#4f79b5', 'Knit & trousers': '#a2593d', 'Techwear': '#33363d' };

type Shape = { rx: number; ry: number; jaw: number };
const HEAD: Record<string, Shape> = {
  Oval: { rx: 19, ry: 24, jaw: 0 }, Round: { rx: 22, ry: 23, jaw: 0 }, Square: { rx: 21, ry: 22, jaw: 1 }, Heart: { rx: 21, ry: 24, jaw: -1 }, Long: { rx: 17, ry: 28, jaw: 0 },
  Diamond: { rx: 19, ry: 25, jaw: -1 }, Rectangle: { rx: 19, ry: 27, jaw: 1 }, Triangle: { rx: 20, ry: 24, jaw: 1 }, Wide: { rx: 24, ry: 22, jaw: 0 }, Narrow: { rx: 16, ry: 25, jaw: 0 },
};
function hair(style: string, c: string, rx: number) {
  const cap = <path d={`M${50 - rx - 1} 46 Q${50 - rx - 2} 19 50 19 Q${50 + rx + 2} 19 ${50 + rx + 1} 46 Q${58} 33 50 33 Q42 33 ${50 - rx - 1} 46Z`} fill={c} />;
  const side = <path d={`M${50 - rx - 1} 46 Q${50 - rx - 2} 19 50 19 Q${50 + rx + 2} 19 ${50 + rx + 1} 46 Q${50 + rx - 6} 31 ${50 + rx - 18} 31 Q${50 - rx + 8} 32 ${50 - rx - 1} 46Z`} fill={c} />;
  let back: any = null, front: any = cap;
  switch (style) {
    case 'Bald': front = null; break;
    case 'Buzz cut': front = <g opacity=".45">{cap}</g>; break;
    case 'Short crop': break;
    case 'Bob': back = <path d={`M${50 - rx - 3} 66 Q${50 - rx - 5} 20 50 18 Q${50 + rx + 5} 20 ${50 + rx + 3} 66 L${50 + rx - 3} 66 L${50 + rx - 3} 40 L${50 - rx + 3} 40 L${50 - rx + 3} 66Z`} fill={c} />; break;
    case 'Long wavy': back = <path d={`M${50 - rx - 3} 92 C${50 - rx - 9} 70 ${50 - rx - 2} 52 ${50 - rx - 2} 40 Q50 8 ${50 + rx + 2} 40 C${50 + rx + 2} 52 ${50 + rx + 9} 70 ${50 + rx + 3} 92 Q${50 + rx - 2} 84 ${50 + rx - 4} 92 Q${50 + rx - 6} 70 ${50 + rx - 4} 50 L${50 - rx + 4} 50 Q${50 - rx + 6} 70 ${50 - rx + 4} 92 Q${50 - rx + 2} 84 ${50 - rx - 3} 92Z`} fill={c} />; front = side; break;
    case 'Curly': back = <g fill={c}>{[[30, 30], [38, 22], [50, 19], [62, 22], [70, 30], [27, 44], [73, 44], [29, 58], [71, 58]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" />)}</g>; front = <path d="M33 38 Q50 24 67 38 Q50 32 33 38Z" fill={c} />; break;
    case 'Braids': back = <g fill={c}><path d="M28 44 Q24 20 50 18 Q76 20 72 44 L66 44 L66 38 L34 38 L34 44Z" />{[27, 33, 67, 73].map((x, i) => <rect key={i} x={x - 2.5} y="44" width="5" height="44" rx="2.5" />)}</g>; front = side; break;
    case 'Afro': back = <circle cx="50" cy="40" r="31" fill={c} />; front = null; break;
    case 'Mohawk': back = <path d="M44 34 Q42 6 50 4 Q58 6 56 34Z" fill={c} />; front = null; break;
    case 'Pigtails': back = <g fill={c}><circle cx="22" cy="48" r="9" /><circle cx="78" cy="48" r="9" /></g>; front = side; break;
    case 'Top bun': back = <circle cx="50" cy="13" r="9" fill={c} />; front = side; break;
    case 'Ponytail': back = <path d={`M${50 + rx} 36 Q${50 + rx + 16} 50 ${50 + rx + 6} 78 Q${50 + rx - 2} 60 ${50 + rx - 4} 44Z`} fill={c} />; front = side; break;
    case 'Bowl cut': front = <path d={`M${50 - rx - 2} 52 Q${50 - rx - 4} 17 50 17 Q${50 + rx + 4} 17 ${50 + rx + 2} 52 L${50 + rx - 2} 52 L${50 + rx - 2} 36 L${50 - rx + 2} 36 L${50 - rx + 2} 52Z`} fill={c} />; break;
    case 'Slicked back': front = <g>{cap}<path d="M36 31 Q50 22 66 32" stroke="rgba(255,255,255,.35)" stroke-width="1.5" fill="none" /></g>; break;
    case 'Mullet': back = <path d={`M${50 - rx - 1} 44 L${50 - rx - 3} 70 L${50 - rx + 5} 62 Z M${50 + rx + 1} 44 L${50 + rx + 3} 70 L${50 + rx - 5} 62Z`} fill={c} />; break;
    case 'Pompadour': back = <path d="M30 34 Q28 6 54 8 Q74 10 70 34Z" fill={c} />; front = cap; break;
  }
  return { back, front };
}
export type Look = { type?: string; species?: string; skin?: string; hairStyle?: string; hairColor?: string; eyeColor?: string; eyeShape?: string; head?: string; neck?: string; facial?: string; accessory?: string; feature?: string; outfit?: string; zoom?: 'face' | 'eyes' | 'bust' };
export function Portrait(l: Look) {
  const sh = HEAD[l.head ?? 'Oval'] ?? HEAD.Oval;
  const alien = l.type === 'Alien', mon = l.type === 'Monster';
  let skin = SKIN[l.skin ?? 'Light'] ?? '#efc9a8';
  if (alien) skin = ['#9fb8c4', '#7fd1b0', '#b8a0e0', '#8fb0ff', '#d6e0a0'][hue(l.species ?? '') % 5];
  if (mon) skin = ['#8fae6e', '#a98bb5', '#b7936a', '#7a9db5', '#9aa0a8'][hue(l.species ?? '') % 5];
  const hc = HAIRC[l.hairColor ?? 'Dark brown'] ?? '#3b271c';
  const ec = EYEC[l.eyeColor ?? 'Brown'] ?? '#6b4226';
  const oc = l.outfit ? OUTFITC[l.outfit] ?? '#2d3a55' : '#2d3a55';
  const rx = sh.rx + (alien ? -2 : mon ? 3 : 0), ry = sh.ry + (alien ? 5 : 0);
  const { back, front } = alien || mon ? { back: null, front: null } : hair(l.hairStyle ?? 'Short crop', hc, rx);
  const nl = { Short: 6, Average: 10, Long: 16, Strong: 10 }[l.neck ?? 'Average'] ?? 10;
  const nw = l.neck === 'Strong' ? 17 : 11;
  const hy = 46 - (nl - 10) * 0.3, cy = hy;
  const es = l.eyeShape ?? 'Almond';
  const ery = { Almond: 2.4, Round: 3.4, Hooded: 1.8, Wide: 3, Narrow: 1.5, Upturned: 2.4, Downturned: 2.4, Deep: 2.6 }[es] ?? 2.4;
  const tilt = es === 'Upturned' ? -12 : es === 'Downturned' ? 12 : 0;
  const ex = alien ? 8 : 8.5;
  const view = l.zoom === 'eyes' ? '30 32 40 28' : l.zoom === 'bust' ? '8 0 84 100' : '14 6 72 94';
  const f = l.facial ?? 'None';
  const feat = l.feature ?? '';
  const acc = l.accessory ?? 'None';
  return (
    <svg viewBox={view} class="art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect x="-20" y="-20" width="140" height="140" fill="#f2f2ee" />
      {back}
      <path d={`M10 110 Q12 ${74 + (nl - 10)} 50 ${72 + (nl - 10)} Q88 ${74 + (nl - 10)} 90 110Z`} fill={oc} />
      {acc === 'Scarf' && <path d={`M36 ${70 + nl - 10} Q50 ${82 + nl - 10} 64 ${70 + nl - 10} L66 ${78 + nl - 10} Q50 ${90 + nl - 10} 34 ${78 + nl - 10}Z`} fill="#d65a31" />}
      <rect x={50 - nw / 2} y={cy + ry - 6} width={nw} height={nl + 14} fill={skin} />
      <path d={`M${50 - rx} ${cy} Q${50 - rx} ${cy - ry} 50 ${cy - ry} Q${50 + rx} ${cy - ry} ${50 + rx} ${cy} Q${50 + rx - sh.jaw * 3} ${cy + ry - 4} 50 ${cy + ry} Q${50 - rx + sh.jaw * 3} ${cy + ry - 4} ${50 - rx} ${cy}Z`} fill={skin} />
      {mon && <><path d="M32 30 L25 10 L42 24Z M68 30 L75 10 L58 24Z" fill="#e8dcc0" /></>}
      {(l.zoom !== 'eyes') && (l.feature === 'Round ears' || !alien) && <><ellipse cx={50 - rx} cy={cy + 2} rx="3" ry="5" fill={skin} /><ellipse cx={50 + rx} cy={cy + 2} rx="3" ry="5" fill={skin} /></>}
      {(feat === 'Pointed ears' || alien) && <><path d={`M${50 - rx} ${cy - 2} l-9 -8 l2 14z M${50 + rx} ${cy - 2} l9 -8 l-2 14z`} fill={skin} /></>}
      {front}
      {feat === 'Thick brows' || feat === 'Thin brows' ? null : null}
      <g stroke={alien ? 'none' : '#0000'}>
        {[-1, 1].map(s => <g key={s} transform={`rotate(${tilt * s * -1} ${50 + s * ex} ${cy})`}>
          {alien ? <ellipse cx={50 + s * ex} cy={cy} rx="5.5" ry="8" fill="#0b0d14" transform={`rotate(${s * -18} ${50 + s * ex} ${cy})`} /> :
            <><ellipse cx={50 + s * ex} cy={cy} rx="4.6" ry={ery + 1.2} fill="#fff" /><circle cx={50 + s * ex} cy={cy} r={Math.min(ery + 0.4, 2.8)} fill={feat === 'Different-coloured eyes' && s > 0 ? '#3d7fd0' : ec} /><circle cx={50 + s * ex} cy={cy} r="1" fill="#111" />
              {es === 'Hooded' && <rect x={50 + s * ex - 5} y={cy - 4} width="10" height="3" fill={skin} />}</>}
          <path d={`M${50 + s * ex - 6} ${cy - ery - 4 - (feat === 'Thick brows' ? 0 : 0.5)} Q${50 + s * ex} ${cy - ery - 7} ${50 + s * ex + 6} ${cy - ery - 4}`} stroke={feat === 'Thin brows' ? '#4a3a32' : hc} stroke-width={feat === 'Thick brows' ? 3.4 : feat === 'Thin brows' ? 0.9 : 1.8} fill="none" stroke-linecap="round" />
        </g>)}
      </g>
      {l.zoom !== 'eyes' && <>
        <path d={`M50 ${cy + 2} l-2 7 h4`} stroke="rgba(0,0,0,.25)" stroke-width="1.2" fill="none" />
        <path d={`M43 ${cy + 15} Q50 ${cy + (feat === 'Dimples' || l.type !== 'Monster' ? 20 : 18)} 57 ${cy + 15}`} stroke="#7a2e35" stroke-width="2" fill="none" stroke-linecap="round" />
        {mon && <path d={`M44 ${cy + 15} l2 -5 l2 5z M52 ${cy + 15} l2 -5 l2 5z`} fill="#fffbe8" />}
      </>}
      {feat === 'Light freckles' || feat === 'Freckles' ? <g fill="rgba(120,60,30,.5)">{[[40, 4], [43, 7], [46, 5], [54, 5], [57, 7], [60, 4]].map(([x, y], i) => <circle key={i} cx={x} cy={cy + y + 4} r=".9" />)}</g> : null}
      {feat === 'Rosy cheeks' && <g fill="rgba(230,90,110,.35)"><circle cx="38" cy={cy + 9} r="4" /><circle cx="62" cy={cy + 9} r="4" /></g>}
      {feat === 'Small scar' && <path d={`M60 ${cy - 11} l5 9`} stroke="#b36a5a" stroke-width="1.2" />}
      {feat === 'Birthmark' && <circle cx="58" cy={cy + 10} r="1.8" fill="#6a3b25" />}
      {feat === 'Vitiligo patches' && <g fill="#fbeee3" opacity=".8"><ellipse cx="38" cy={cy + 6} rx="4" ry="3" /><ellipse cx="62" cy={cy + 12} rx="3" ry="4" /></g>}
      {feat === 'Face gems' && <g fill="#7fe3ff"><circle cx="38" cy={cy + 3} r="1.3" /><circle cx="62" cy={cy + 3} r="1.3" /><circle cx="50" cy={cy - 12} r="1.3" /></g>}
      {feat === 'Laugh lines' && <path d={`M40 ${cy + 8} q-2 5 0 9 M60 ${cy + 8} q2 5 0 9`} stroke="rgba(0,0,0,.25)" fill="none" />}
      {feat === 'Beauty mark' && <circle cx="56" cy={cy + 14} r="1" fill="#2a1a12" />}
      {f !== 'None' && <g fill={hc}>
        {f === 'Stubble' && <path d={`M${50 - rx + 3} ${cy + 8} Q50 ${cy + ry + 6} ${50 + rx - 3} ${cy + 8} Q50 ${cy + 12} ${50 - rx + 3} ${cy + 8}Z`} opacity=".4" />}
        {(f === 'Short beard' || f === 'Full beard' || f === 'Goatee' || f === 'Mutton chops') && <path d={f === 'Full beard' ? `M${50 - rx + 1} ${cy + 4} Q50 ${cy + ry + 14} ${50 + rx - 1} ${cy + 4} Q50 ${cy + 20} ${50 - rx + 1} ${cy + 4}Z` : f === 'Goatee' ? `M45 ${cy + 17} Q50 ${cy + ry + 6} 55 ${cy + 17}Z` : f === 'Mutton chops' ? `M${50 - rx + 1} ${cy - 2} L${50 - rx + 8} ${cy + 14} L${50 - rx + 2} ${cy + 14}Z M${50 + rx - 1} ${cy - 2} L${50 + rx - 8} ${cy + 14} L${50 + rx - 2} ${cy + 14}Z` : `M${50 - rx + 3} ${cy + 6} Q50 ${cy + ry + 6} ${50 + rx - 3} ${cy + 6} Q50 ${cy + 18} ${50 - rx + 3} ${cy + 6}Z`} />}
        {(f === 'Moustache' || f === 'Full beard' || f === 'Short beard') && <path d={`M42 ${cy + 11} Q50 ${cy + 8} 58 ${cy + 11} Q50 ${cy + 14} 42 ${cy + 11}Z`} />}
        {f === 'Soul patch' && <ellipse cx="50" cy={cy + 20} rx="2" ry="1.8" />}
      </g>}
      {acc === 'Round glasses' && <g fill="rgba(255,255,255,.25)" stroke="#222" stroke-width="1.4"><circle cx={50 - ex} cy={cy} r="6.5" /><circle cx={50 + ex} cy={cy} r="6.5" /><path d={`M${50 - ex + 6.5} ${cy} h${2 * ex - 13}`} /></g>}
      {acc === 'Sunglasses' && <g fill="#14161c"><rect x={50 - ex - 7} y={cy - 4.5} width="14" height="9" rx="3.5" /><rect x={50 + ex - 7} y={cy - 4.5} width="14" height="9" rx="3.5" /><rect x="47" y={cy - 2} width="6" height="1.6" /></g>}
      {acc === 'Headphones' && <g><path d={`M${50 - rx - 1} ${cy} Q${50 - rx} ${cy - ry - 8} 50 ${cy - ry - 8} Q${50 + rx} ${cy - ry - 8} ${50 + rx + 1} ${cy}`} fill="none" stroke="#25272e" stroke-width="3" /><rect x={50 - rx - 6} y={cy - 6} width="7" height="14" rx="3" fill="#25272e" /><rect x={50 + rx - 1} y={cy - 6} width="7" height="14" rx="3" fill="#25272e" /></g>}
      {acc === 'Cap' && <g fill="#c8372d"><path d={`M${50 - rx - 1} ${cy - 6} Q${50 - rx} ${cy - ry - 4} 50 ${cy - ry - 4} Q${50 + rx} ${cy - ry - 4} ${50 + rx + 1} ${cy - 6}Z`} /><rect x={50 - rx - 9} y={cy - 8} width={rx + 12} height="3.5" rx="1.7" /></g>}
      {acc === 'Earrings' && <g fill="#e6b84a"><circle cx={50 - rx} cy={cy + 9} r="2" /><circle cx={50 + rx} cy={cy + 9} r="2" /></g>}
      {acc === 'Necklace' && <path d={`M40 ${cy + ry + nl - 1} Q50 ${cy + ry + nl + 12} 60 ${cy + ry + nl - 1}`} stroke="#e6b84a" stroke-width="1.6" fill="none" />}
    </svg>
  );
}
const BW = [70, 58, 46, 36, 28, 21]; // half widths of the torso for the six sizes
export function FullBody(l: Look & { size?: number; height?: string; prop?: string }) {
  const size = l.size ?? 2, w = BW[size] ?? 46;
  const alien = l.type === 'Alien', mon = l.type === 'Monster';
  let skin = SKIN[l.skin ?? 'Light'] ?? '#efc9a8';
  if (alien) skin = ['#9fb8c4', '#7fd1b0', '#b8a0e0', '#8fb0ff', '#d6e0a0'][hue(l.species ?? '') % 5];
  if (mon) skin = ['#8fae6e', '#a98bb5', '#b7936a', '#7a9db5', '#9aa0a8'][hue(l.species ?? '') % 5];
  const oc = OUTFITC[l.outfit ?? 'Smart blazer'] ?? '#2d3a55';
  const hc = HAIRC[l.hairColor ?? 'Dark brown'] ?? '#3b271c';
  const tall = { Short: 0.86, Average: 1, Tall: 1.12 }[l.height ?? 'Average'] ?? 1;
  const bw = w * 0.5 + 10, lw = Math.max(8, bw * 0.45);
  const H = 190 * tall, top = 250 - H, hr = alien ? 17 : 15;
  const sh = top + hr * 2 + 6, hip = sh + H * 0.36, foot = 246;
  const jeans = l.outfit === 'White tee & jeans' || l.outfit === 'Denim jacket';
  const leg = jeans ? '#3f5f94' : l.outfit === 'Summer dress' ? skin : oc === '#f8f8f8' ? '#444' : '#2b2d36';
  return (
    <svg viewBox="0 0 160 260" class="art" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <rect width="160" height="260" fill="#f2f2ee" />
      <rect x={80 - lw - 2} y={hip} width={lw} height={foot - hip} rx="4" fill={leg} /><rect x="82" y={hip} width={lw} height={foot - hip} rx="4" fill={leg} />
      <rect x={80 - lw - 5} y={foot - 5} width={lw + 6} height="7" rx="3" fill="#222" /><rect x="79" y={foot - 5} width={lw + 6} height="7" rx="3" fill="#222" />
      <rect x={80 - bw - 9} y={sh + 2} width="9" height={H * 0.4} rx="4.5" fill={oc} /><rect x={80 + bw} y={sh + 2} width="9" height={H * 0.4} rx="4.5" fill={oc} />
      <path d={`M${80 - bw} ${sh} Q80 ${sh - 6} ${80 + bw} ${sh} L${80 + bw * 0.94} ${hip + 4} L${80 - bw * 0.94} ${hip + 4}Z`} fill={oc} />
      <rect x="75" y={sh - 8} width="10" height="10" fill={skin} />
      <circle cx="80" cy={top + hr} r={hr} fill={skin} />
      {!alien && !mon && l.hairStyle !== 'Bald' && <path d={`M${80 - hr} ${top + hr} Q${80 - hr} ${top - 1} 80 ${top - 1} Q${80 + hr} ${top - 1} ${80 + hr} ${top + hr} Q80 ${top + 6} ${80 - hr} ${top + hr}Z`} fill={hc} />}
      {mon && <path d={`M${80 - hr + 2} ${top + 4} l-5 -14 l11 8z M${80 + hr - 2} ${top + 4} l5 -14 l-11 8z`} fill="#e8dcc0" />}
      {alien ? <><ellipse cx="74" cy={top + hr} rx="3" ry="5" fill="#0b0d14" /><ellipse cx="86" cy={top + hr} rx="3" ry="5" fill="#0b0d14" /></> : <><circle cx="75" cy={top + hr + 1} r="1.5" fill="#222" /><circle cx="85" cy={top + hr + 1} r="1.5" fill="#222" /></>}
    </svg>
  );
}
export function Avatar({ type, species, size, seed }: { type: string; species?: string; size: number; seed: number }) {
  const hs = ['Short crop', 'Bob', 'Curly', 'Long wavy', 'Pompadour'][seed % 5];
  const t = type === 'Alien' || type === 'Monster' ? type : 'Human';
  return <div class="avatar"><FullBody type={t} species={species} size={size} hairStyle={hs} hairColor={Object.keys(HAIRC)[(seed * 3) % 12]} outfit={Object.keys(OUTFITC)[(seed + 2) % 8]} /></div>;
}
export function BodyIcon({ size = 2 }: { size?: number }) {
  return <svg viewBox="0 0 40 50" class="art" aria-hidden="true"><rect width="40" height="50" fill="#f2f2ee" /><circle cx="20" cy="11" r="6" fill="#2d3a55" /><rect x={20 - BW[size] * 0.24} y="19" width={BW[size] * 0.48} height="25" rx="8" fill="#2d3a55" /></svg>;
}
export function Thumb({ label, kind = 0 }: { label: string; kind?: number }) {
  const h = hue(label);
  return (
    <svg viewBox="0 0 48 48" class="thumb" aria-hidden="true">
      <rect width="48" height="48" rx="8" fill={`hsl(${h} 25% 92%)`} />
      <circle cx="24" cy="18" r={8 + (kind % 3)} fill={`hsl(${h} 45% 45%)`} />
      <path d="M8 46c2-13 10-16 16-16s14 3 16 16z" fill={`hsl(${(h + 40) % 360} 40% 32%)`} />
    </svg>
  );
}
// Lazy: renders its child only once scrolled near view (keeps big sections light).
export function Lazy({ children, cls }: { children: any; cls?: string }) {
  const r = useRef<HTMLDivElement>(null); const [on, setOn] = useState(false);
  useEffect(() => {
    if (!r.current) return;
    if (!('IntersectionObserver' in window)) { setOn(true); return; }
    const o = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setOn(true); o.disconnect(); } }, { rootMargin: '300px' });
    o.observe(r.current); return () => o.disconnect();
  }, []);
  return <div ref={r} class={cls}>{on ? children : null}</div>;
}
