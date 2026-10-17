import { useState, useEffect } from 'preact/hooks';
import { HW, MODELS, RES, SPECIES, SIZES, SECS, PRESETS, GENDERS } from './data';
import type { Sec } from './data';
import { Thumb, Avatar, Portrait, FullBody, Lazy, SKIN, HAIRC, EYEC } from './Art';

type Screen = 'scan' | 'home' | 'builder' | 'generate' | 'downloads';
const NAV: [Screen, string][] = [['scan', 'Hardware'], ['home', 'Home'], ['builder', 'Character'], ['generate', 'Generate'], ['downloads', 'Models']];

export function App() {
  const [screen, setScreen] = useState<Screen>('scan');
  const [hwId, setHw] = useState('pro');
  const [adv, setAdv] = useState(false);
  const [unlock, setUnlock] = useState(false);
  const [mode, setMode] = useState<'Image' | 'Video'>('Image');
  const hw = HW.find(h => h.id === hwId)!;
  const ctx = { hw, adv, setAdv, unlock, setUnlock, mode, setMode, go: setScreen };
  return (
    <div class="shell">
      <header class="top">
        <div class="logo"><span class="dot" />Influencer Studio<small>UI mock</small></div>
        <nav aria-label="Main">
          {NAV.map(([k, l]) => <button key={k} class={screen === k ? 'on' : ''} aria-current={screen === k ? 'page' : undefined} onClick={() => setScreen(k)}>{l}</button>)}
        </nav>
        <div class="right">
          <Toggle label="Advanced" on={adv} set={setAdv} />
          <span class="pill" title="Detected hardware">{hw.name.replace('NVIDIA ', '')} · {hw.vram} GB</span>
        </div>
      </header>
      <main key={screen} class="fade">
        {screen === 'scan' && <Scan {...ctx} hwId={hwId} setHw={setHw} />}
        {screen === 'home' && <Home {...ctx} />}
        {screen === 'builder' && <Builder />}
        {screen === 'generate' && <Generate {...ctx} />}
        {screen === 'downloads' && <Downloads {...ctx} />}
      </main>
    </div>
  );
}
type Ctx = ReturnType<typeof mk>; function mk() { return null as any; }
type P = { hw: typeof HW[0]; adv: boolean; unlock: boolean; setUnlock: (b: boolean) => void; setAdv: (b: boolean) => void; mode: 'Image' | 'Video'; setMode: (m: 'Image' | 'Video') => void; go: (s: Screen) => void };

function Toggle({ label, on, set }: { label: string; on: boolean; set: (b: boolean) => void }) {
  return <button role="switch" aria-checked={on} class={'tog' + (on ? ' on' : '')} onClick={() => set(!on)}><span class="knob" />{label}</button>;
}
const ok = (need: number, hw: P['hw'], unlock: boolean) => unlock || hw.vram >= need;

function Scan(p: P & { hwId: string; setHw: (s: string) => void }) {
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => { setStep(0); const t = setInterval(() => setStep(s => (s < 5 ? s + 1 : s)), 450); return () => clearInterval(t); }, [p.hwId, run]);
  const rows = [['GPU', p.hw.name], ['VRAM', p.hw.vram + ' GB'], ['System RAM', p.hw.ram + ' GB'], ['Free disk', '1.8 TB'], ['Performance tier', p.hw.tier]];
  const best = MODELS.filter(m => p.hw.vram >= m.need);
  const maxRes = [...RES].reverse().find(r => p.hw.vram >= r.need);
  return (
    <section class="grid2">
      <div class="card">
        <h1>Hardware scan</h1>
        <div class="seg" role="group" aria-label="Simulate hardware">
          {HW.map(h => <button key={h.id} class={p.hwId === h.id ? 'on' : ''} onClick={() => p.setHw(h.id)}>{h.vram >= 96 ? 'RTX PRO 6000 · 96 GB' : h.vram === 16 ? '16 GB GPU' : 'Weak on-board GPU'}</button>)}
        </div>
        <div class="scanbar" aria-hidden="true"><i style={{ width: Math.min(step, 5) * 20 + '%' }} /></div>
        <ul class="rows" aria-live="polite">
          {rows.map(([k, v], i) => <li key={k} class={i < step ? 'show' : ''}><span>{k}</span><b>{i < step ? v : '…'}</b></li>)}
        </ul>
        <button class="ghost" onClick={() => setRun(run + 1)}>Re-scan</button>
        {step >= 5 && <div class="result glow">
          {best.length ? <>Recommended: <b>{best.map(m => m.name).join(', ')}</b><br />Best resolution: <b>{maxRes?.r}</b> · Suggested quant picked automatically.</> :
            <>This computer cannot run local generation models. Everything is locked; you can still explore the app.</>}
        </div>}
      </div>
      <div class="card">
        <h2>What your hardware can run</h2>
        <div class="unl"><Toggle label="Unlock unsupported options at my own risk" on={p.unlock} set={p.setUnlock} />
          {p.unlock && <p class="warn">Unlocked options may be very slow or crash. The server still checks each job.</p>}</div>
        <ul class="lst">
          {MODELS.map(m => { const o = ok(m.need, p.hw, p.unlock); const real = p.hw.vram >= m.need; return (
            <li key={m.id} class={o ? '' : 'locked'}>
              <span class="ico">{o ? '✓' : '🔒'}</span>
              <div><b>{m.name}</b> <em>{m.kind}</em>
                <small>{o ? (real ? `Runs well · ${m.quant}` : 'Unlocked: may be slow') : `Locked: needs ${m.need} GB VRAM, you have ${p.hw.vram} GB`}</small></div>
            </li>); })}
        </ul>
        <h3>Resolution levels</h3>
        <div class="chips">{RES.map(r => { const o = ok(r.need, p.hw, p.unlock); return <span key={r.r} class={'chip static' + (o ? '' : ' locked')} title={o ? '' : `Needs ${r.need} GB VRAM`}>{o ? '' : '🔒 '}{r.r}</span>; })}</div>
        <button class="primary" onClick={() => p.go('home')}>Continue</button>
      </div>
    </section>
  );
}

function Home(p: P) {
  const vid = p.mode === 'Video';
  const inputs = vid ? [['Text to video', 12], ['Image to video', 12], ['Motion transfer', 20], ['Lip-sync', 24]] as [string, number][] : [['Text to image', 8], ['Edit image', 12], ['Angles / re-shoot', 12]] as [string, number][];
  const [inp, setInp] = useState(0);
  useEffect(() => setInp(0), [p.mode]);
  const [prompt, setPrompt] = useState('');
  return (
    <section class="home">
      <h1 class="hero">Create your <span class="grad">character</span></h1>
      <div class="seg big" role="group" aria-label="Mode">
        {(['Image', 'Video'] as const).map(m => <button key={m} class={p.mode === m ? 'on' : ''} onClick={() => p.setMode(m)}>{m === 'Image' ? '🖼 Image' : '🎬 Video'}</button>)}
        <button disabled title="Coming soon">🎵 Audio · Coming soon</button>
      </div>
      {p.adv && <div class="chips center">{inputs.map(([n, need], i) => { const o = ok(need, p.hw, p.unlock); return <button key={n} disabled={!o} title={o ? '' : `Needs ${need} GB VRAM`} class={'chip' + (inp === i ? ' on' : '')} onClick={() => setInp(i)}>{o ? '' : '🔒 '}{n}</button>; })}</div>}
      <div class="prompt card glow">
        <textarea aria-label="Describe your scene" placeholder="Describe the scene, e.g. “walking through a neon market at dusk”" value={prompt} onInput={e => setPrompt((e.target as HTMLTextAreaElement).value)} />
        <div class="row"><button class="ghost" onClick={() => p.go('builder')}>Choose character</button><button class="primary" onClick={() => p.go('generate')}>Generate {p.mode.toLowerCase()}</button></div>
      </div>
      <p class="muted">{p.adv ? 'Advanced mode: all controls visible.' : 'Simple mode: the essentials only. Switch on Advanced (top right) for every control.'}</p>
      <div class="cards3">
        {[['Character builder', 'builder'], ['Generate', 'generate'], ['Models', 'downloads']].map(([t, s]) => <button key={t} class="card tile" onClick={() => p.go(s as Screen)}><Thumb label={t} /><b>{t}</b></button>)}
      </div>
    </section>
  );
}

const RND = 'Neutral / random';
function Tile({ sec, o, look, size }: { sec: Sec; o: string; look: any; size: number }) {
  const k = sec.kind;
  const L = { ...look };
  if (!['outfit', 'body', 'size', 'type'].includes(k)) { L.type = 'Human'; L.species = ''; }
  if (k === 'hair') return <Portrait {...L} hairStyle={o} zoom="bust" />;
  if (k === 'outfit') return <FullBody {...L} outfit={o} size={size} />;
  if (k === 'head') return <Portrait {...L} head={o} zoom="bust" />;
  if (k === 'neck') return <Portrait {...L} neck={o} zoom="bust" />;
  if (k === 'eye') return <Portrait {...L} eyeShape={o} zoom="eyes" />;
  if (k === 'body') return <FullBody {...L} size={size} height={sec.id === 'height' ? o : look.height} />;
  if (k === 'size') return <FullBody {...L} size={SIZES.indexOf(o)} />;
  if (k === 'acc') return <Portrait {...L} accessory={o} zoom="bust" />;
  if (k === 'face') return <Portrait {...L} {...(sec.id === 'fh' ? { facial: o } : { feature: o })} zoom="bust" />;
  if (k === 'type') return <Portrait {...L} type={o === 'Neutral / random' ? 'Human' : o} zoom="bust" />;
  if (k === 'species') return <Portrait {...L} zoom="bust" />;
  return null;
}
function Builder() {
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(SECS.map(s => [s.id, !!s.open])));
  const [sel, setSel] = useState<Record<string, string>>({ type: RND, gender: RND, size: 'Medium', hair: 'Short crop', hairc: 'Dark brown', outfit: 'Smart blazer', skin: 'Light', eyec: 'Brown', eyes: 'Almond', head: 'Oval', neck: 'Average', fh: 'None', dist: 'None', acc: 'None', feat: '', height: 'Average', prop: 'Balanced', age: 'Adult (30–45)', ethn: 'Mixed' });
  const [spec, setSpec] = useState<Record<string, string>>({ Alien: 'Grey-skinned', Monster: 'Friendly troll' });
  const [lock, setLock] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState('Create Influencer');
  const [seed, setSeed] = useState(0);
  const [saved, setSaved] = useState<{ n: string; type: string; size: number; seed: number }[]>([{ n: 'Alex', type: RND, size: 2, seed: 1 }, { n: 'Zyra', type: 'Alien', size: 3, seed: 2 }, { n: 'Bruno', type: 'Monster', size: 1, seed: 3 }]);
  const type = sel.type;
  const species = SPECIES[type];
  const pick = (id: string, o: string) => setSel(s => ({ ...s, [id]: o }));
  const rand = () => {
    const n = { ...sel };
    SECS.forEach(s => { if (!lock[s.id] && s.opts.length && !['type', 'species'].includes(s.id)) n[s.id] = s.opts[Math.floor(Math.random() * s.opts.length)]; });
    setSel(n); setSeed(x => x + 1);
  };
  const look = { type: type === 'Alien' || type === 'Monster' ? type : 'Human', species: species ? spec[type] : '', skin: sel.skin, hairStyle: sel.hair, hairColor: sel.hairc, eyeColor: sel.eyec, eyeShape: sel.eyes, head: sel.head, neck: sel.neck, facial: sel.fh, accessory: sel.acc, feature: sel.feat || sel.dist, outfit: sel.outfit, height: sel.height };
  const size = Math.max(0, SIZES.indexOf(sel.size));
  const secs = SECS.filter(s => s.id !== 'species' || species);
  const bigLook = { ...look };
  return (
    <section class="builder">
      <aside class="panel" aria-label="Character builder">
        <div class="ptabs" role="tablist">{['Create Influencer', 'Motion'].map(t => <button key={t} role="tab" aria-selected={tab === t} class={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
        <div class="pscroll">
          {tab === 'Motion' ? <div class="sec"><div class="drop"><b>Drop a motion video</b><small>Reference video that drives the movement (needs 20 GB VRAM)</small></div><div class="drop"><b>Choose a character</b><small>Use the one you built in Create Influencer</small></div></div> : <>
            <div class="drop" tabIndex={0}><span class="plus">⬆</span><b>Upload your photo</b><small>Optional · adults only</small></div>
            {secs.map(s => {
              const isOpen = open[s.id]; const n = s.id === 'species' ? species!.length : s.opts.length;
              const opts = s.id === 'species' ? species! : s.opts;
              const cur = s.id === 'species' ? spec[type] : sel[s.id];
              const choose = (o: string) => s.id === 'species' ? setSpec({ ...spec, [type]: o }) : pick(s.id, o);
              const ico = s.kind === 'swatch' || s.kind === 'pill' || s.kind === 'gender';
              return (
                <div class="sec" key={s.id}>
                  <div class="shead">
                    <button class="stog" aria-expanded={!!isOpen} onClick={() => setOpen({ ...open, [s.id]: !isOpen })}><span class="sico" aria-hidden="true">{s.icon}</span><span class="stitle">{s.title} · {n}</span><span class={'chev' + (isOpen ? ' up' : '')} aria-hidden="true">⌃</span></button>
                    <button class={'lk' + (lock[s.id] ? ' on' : '')} aria-pressed={!!lock[s.id]} title={`Lock ${s.title} when shuffling`} onClick={() => setLock({ ...lock, [s.id]: !lock[s.id] })}>{lock[s.id] ? '🔒' : '🔓'}</button>
                  </div>
                  {isOpen && (s.kind === 'pill' ? <div class="pills" role="radiogroup" aria-label={s.title}>{opts.map(o => <button key={o} role="radio" aria-checked={cur === o} class={'pillb' + (cur === o ? ' on' : '')} onClick={() => choose(o)}>{o}</button>)}</div> :
                    <div class="tg" role="radiogroup" aria-label={s.title}>{opts.map(o => {
                      const sw = s.id === 'skin' ? SKIN[o] : s.id === 'hairc' ? HAIRC[o] : s.id === 'eyec' ? EYEC[o] : '';
                      const on = cur === o;
                      return <button key={o} role="radio" aria-checked={on} class={'bt' + (on ? ' on' : '') + (ico ? ' flat' : '')} onClick={() => choose(o)}>
                        {s.kind === 'gender' ? <span class="gsym" aria-hidden="true">{GENDERS.find(g => g[0] === o)![1]}</span> :
                          sw ? <i class="sw" style={{ background: sw }} /> :
                            <Lazy cls="ph"><Tile sec={s} o={o} look={look} size={size} /></Lazy>}
                        <span class="tl">{o}</span>
                      </button>;
                    })}</div>)}
                </div>);
            })}
          </>}
        </div>
        <div class="gbar"><button class="shuf" aria-label="Shuffle character" title="Shuffle (locked sections stay)" onClick={rand}>⤮</button><button class="gen-btn" onClick={() => setSeed(x => x + 1)}>Generate ✨</button></div>
      </aside>
      <div class="canvas">
        <div class="stage card glow">
          <div class="bigart"><FullBody {...bigLook} size={size} /></div>
          <div class="cap">{type === RND ? 'Neutral / random' : type}{species ? ' · ' + spec[type] : ''} · {sel.size}</div>
          <div class="row"><button class="ghost" onClick={rand}>🎲 Shuffle</button><button class="primary" onClick={() => setSaved([{ n: 'Character ' + (saved.length + 1), type, size, seed }, ...saved])}>Save to library</button></div>
          <small class="muted">Placeholder art. Real previews are generated in the full app. Adults only, SFW, fully clothed.</small>
        </div>
        <div class="card"><h2>Saved library</h2>
          <div class="lib">{saved.map((c, i) => <button key={i} class="libi" onClick={() => { pick('type', c.type); pick('size', SIZES[c.size]); setSeed(c.seed); }}><Avatar type={c.type} size={c.size} seed={c.seed} /><span>{c.n}</span></button>)}</div>
        </div>
        <div class="card"><h2>Presets</h2><div class="chips">{PRESETS.map(p => <button key={p} class="chip" onClick={rand}>{p}</button>)}</div></div>
      </div>
    </section>
  );
}

function Generate(p: P) {
  const [busy, setBusy] = useState(0);
  const [look, setLook] = useState('Cinematic');
  const [cam, setCam] = useState('Medium shot');
  useEffect(() => { if (busy > 0 && busy < 100) { const t = setTimeout(() => setBusy(busy + 4), 80); return () => clearTimeout(t); } }, [busy]);
  const slot = (t: string, need: number, d: string) => { const o = ok(need, p.hw, p.unlock); return (
    <div class={'slot card' + (o ? '' : ' locked')}><b>{o ? '' : '🔒 '}{t}</b><small>{o ? d : `Needs ${need} GB VRAM`}</small>{o && <button class="ghost">Drop file or browse</button>}</div>); };
  return (
    <section class="gen">
      <div class="card">
        <h2>Camera and look</h2>
        <h3>Shot</h3><div class="chips">{['Close-up', 'Medium shot', 'Wide', 'Low angle', 'Over shoulder'].map(c => <button key={c} class={'chip' + (cam === c ? ' on' : '')} onClick={() => setCam(c)}>{c}</button>)}</div>
        <h3>Look</h3><div class="opts">{['Cinematic', 'Film grain', 'Studio', 'Neon night', 'Soft daylight'].map((l, i) => <button key={l} class={'opt' + (look === l ? ' on' : '')} onClick={() => setLook(l)}><Thumb label={l} kind={i} /><span>{l}</span></button>)}</div>
        {p.adv && <><h3>Advanced</h3><label class="rng">Steps <input type="range" min="4" max="40" value="8" /></label><label class="rng">Guidance <input type="range" min="1" max="10" value="4" /></label></>}
      </div>
      <div class="card stage2">
        <div class="seg"><button class={p.mode === 'Image' ? 'on' : ''} onClick={() => p.setMode('Image')}>Image</button><button class={p.mode === 'Video' ? 'on' : ''} onClick={() => p.setMode('Video')}>Video</button></div>
        <div class="preview glow">{busy > 0 && busy < 100 ? <div class="spin" role="status" aria-label="Generating" /> : <Avatar type="Neutral" size={2} seed={busy ? 4 : 0} />}
          <div class="prog"><i style={{ width: Math.min(busy, 100) + '%' }} /></div></div>
        <button class="primary wide" onClick={() => setBusy(1)}>{busy > 0 && busy < 100 ? `Generating… ${busy}%` : `Generate ${p.mode.toLowerCase()} (mock)`}</button>
      </div>
      <div class="card">
        <h2>Inputs</h2>
        {slot('Motion transfer', 20, 'Reference video that drives movement')}
        {slot('Lip-sync', 24, 'Voice clip to match the mouth')}
        <div class="slot card locked"><b>🎵 Audio</b><small>Coming soon</small></div>
      </div>
    </section>
  );
}

function Downloads(p: P) {
  const [prog, setProg] = useState<Record<string, number>>({ klein: 100, qwen: 42 });
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  useEffect(() => { const t = setInterval(() => setProg(o => { const n = { ...o }; for (const k in n) if (n[k] > 0 && n[k] < 100 && !paused[k]) n[k] = Math.min(100, n[k] + 2); return n; }), 400); return () => clearInterval(t); }, [paused]);
  return (
    <section>
      <h1>Models</h1>
      <p class="muted">Only permissively licensed models are offered. Downloads resume if interrupted and are checked against a checksum.</p>
      <div class="dl">
        {MODELS.map(m => { const o = ok(m.need, p.hw, p.unlock); const v = prog[m.id] ?? 0; return (
          <div key={m.id} class={'card dli' + (o ? '' : ' locked')}>
            <div><b>{m.name}</b> <em>{m.kind}</em>
              <small>{m.quant} · {m.size} GB · Licence: <a href="#" onClick={e => e.preventDefault()}>{m.lic}</a> · Source: huggingface.co</small></div>
            <div class="bar"><i style={{ width: v + '%' }} /></div>
            <div class="act">{!o ? <span class="muted">🔒 Needs {m.need} GB VRAM</span> : v === 100 ? <span class="okk">✓ Installed · sha256 verified</span> : v > 0 ?
              <><span>{v}%</span><button class="ghost" onClick={() => setPaused({ ...paused, [m.id]: !paused[m.id] })}>{paused[m.id] ? 'Resume' : 'Pause'}</button></> :
              <button class="primary" onClick={() => setProg({ ...prog, [m.id]: 1 })}>Download</button>}</div>
          </div>); })}
      </div>
    </section>
  );
}
