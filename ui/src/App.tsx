import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { About, Walkthrough, FeedbackLink, WALK_KEY } from './About';
import { api, ApiError, initToken, subscribe, fetchBlobUrl, uploadRef, loadPreviews, pickPreview, type PreviewItem } from './api';
import { SameCharacter, SaveAsCharacter, RefThumb } from './SameCharacter';
import { VideoCard } from './VideoCard';
import { Models } from './Models';
import { type Mode, type VideoInput, MODE_KEY, INPUT_KEY, parseMode, parseInput, load, save, navIndex, videoInputs } from './modes';
import { SEL_KEY, parseSel, effective, toggle, gate, pick } from './modelsel';
import { CustomPanel } from './CustomPanel';
import { hue } from './Art';
import { Portrait, FullBody, Lazy, Avatar, SKIN, HAIRC, EYEC } from './Art';

type Screen = 'scan' | 'home' | 'builder' | 'generate' | 'models' | 'about';
const NAV: [Screen, string][] = [['scan', 'Hardware'], ['home', 'Home'], ['builder', 'Character'], ['generate', 'Generate'], ['models', 'Models'], ['about', 'About']];

type Opt = { id: string; label: string; silly?: boolean };
type Ctl = { id: string; title: string; ui: string; multi: boolean; maxSelected: number; applies: 'all' | 'human'; default: string | string[]; options: Opt[] };
type Schema = { video: { motions: Opt[]; cameras: Opt[]; seconds: number[]; sizes: number[] }; types: (Opt & { human: boolean })[]; species: Record<string, Opt[]>; sizes: Opt[]; ageBands: (Opt & { age: number })[]; controls: Ctl[]; presets: (Opt & { silly?: boolean })[]; silliness: Opt[]; edit: { poses: Opt[]; azimuths: Opt[]; elevations: Opt[]; distances: Opt[] } };
type Reason = { code: string; hard: boolean; text: string };
type Variant = { id: string; label: string; format: string; sizeGb: number; license: string; minVramGb: number; state: string; reasons: Reason[]; installed: boolean | null; sources: string[]; downloadable: boolean; est: boolean };
type ModelOpt = { id: string; name: string; kind: string; bestVariantId: string | null; variants: Variant[] };
type Res = { px: number; width: number; height: number; state: string; reason: string | null };
type Opts = { version: string; custom: any; customActive: boolean; profile: any; pretend: string | null; realTier: string; realTierName: string; tier: { id: string; name: string; label: string; estimated: boolean }; models: ModelOpt[]; resolutions: Res[]; settings: { unlock_unsupported: boolean }; comfyOnline: boolean; mock: boolean; summary: string };
export type Job = { id: string; status: string; progress: number; message?: string; error?: string; label: string; prompt: string; seed: number; width: number; height: number; mock: boolean; unsupported: boolean; outputs: { index: number; mime: string }[]; createdAt: string; character?: any; edit?: any; video?: any };
type Ch = Record<string, any>;

const NONHUMAN = new Set(['alien', 'monster', 'cat_person', 'dog_person', 'fox_person', 'frog_person', 'insect_person', 'bird_person', 'rodent_person', 'reptile_person', 'robot', 'plush_person']);
const humanType = (t: string) => !NONHUMAN.has(t);
const STATE_TXT: Record<string, string> = { recommended: 'Recommended for your GPU', runs: 'Fits your GPU', slow: 'Slow on your PC', locked_soft: 'Locked', blocked_hard: 'Not available' };

export function App() {
  const [token] = useState(initToken);
  const [screen, setScreen] = useState<Screen>('scan');
  const [walk, setWalk] = useState(() => { try { return localStorage.getItem(WALK_KEY) !== '1'; } catch { return false; } });
  const closeWalk = (done: boolean) => { setWalk(false); if (done) { try { localStorage.setItem(WALK_KEY, '1'); } catch { /* storage blocked */ } } setScreen('scan'); };
  const [adv, setAdv] = useState(false);
  const [mode, setModeS] = useState<Mode>(() => load(MODE_KEY, parseMode));
  const [vin, setVinS] = useState<VideoInput>(() => load(INPUT_KEY, parseInput));
  const setMode = (m: Mode) => { setModeS(m); save(MODE_KEY, m); if (m === 'video') setScreen(s => (s === 'home' || s === 'builder' ? 'generate' : s)); };
  const setVin = (v: VideoInput) => { setVinS(v); save(INPUT_KEY, v); };
  const [msel, setMselS] = useState<string[] | null>(() => load(SEL_KEY, parseSel));
  const setMsel = (v: string[]) => { setMselS(v); save(SEL_KEY, JSON.stringify(v)); };
  const [schema, setSchema] = useState<Schema | null>(null);
  const [opts, setOpts] = useState<Opts | null>(null);
  const [pretend, setPretend] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [err, setErr] = useState('');
  const [ch, setCh] = useState<Ch>({ type: 'surprise', bodySize: 'medium', age: 38 });
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [px, setPx] = useState(1024);
  const [batch, setBatch] = useState(1);
  const [notice, setNotice] = useState<{ text: string; reasons?: Reason[] } | null>(null);
  const [styleRef, setStyleRef] = useState<{ id: string; url: string; name: string } | null>(null);

  const loadOpts = useCallback(async (p: string | null, refresh = false) => {
    try { if (refresh) await api('GET', '/api/hardware?refresh=1'); setOpts(await api('GET', '/api/options' + (p ? '?pretend=' + p : ''))); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => {
    if (!token) return;
    api<Schema>('GET', '/api/schema').then(setSchema).catch(e => setErr(e.message));
    loadOpts(null);
    api<Job[]>('GET', '/api/jobs').then(setJobs).catch(() => {});
    return subscribe(j => setJobs(js => { const i = js.findIndex(x => x.id === j.id); if (i < 0) return [j, ...js]; const n = [...js]; n[i] = j; return n; }));
  }, [token]);
  useEffect(() => { if (token) loadOpts(pretend); }, [pretend]);

  if (!token) return <div class="shell"><div class="card center-card"><h1>Open the link from the terminal</h1><p class="muted">Influencer Studio needs its private session link (it ends in <code>#t=…</code>). Start the app with <code>npm start</code> and open the printed address.</p></div></div>;
  if (err && !opts) return <div class="shell"><div class="card center-card"><h1>Cannot reach the local server</h1><p class="muted">{err}</p></div></div>;
  if (!schema || !opts) return <div class="shell"><div class="card center-card" role="status">Loading…</div></div>;

  const unlocked = opts.settings.unlock_unsupported;
  const setUnlock = async (v: boolean) => { await api('POST', '/api/settings', { unlock_unsupported: v }); await loadOpts(pretend); };
  const gpu = opts.profile.gpus.find((g: any) => g.index === opts.profile.selectedGpu);

  const generate = async () => {
    setNotice(null);
    try {
      const pk = pick(opts.models as any, msel, unlocked, 'image');
      if (pk.blocked) { setNotice({ text: pk.blocked }); setScreen('generate'); return; }
      const body: any = { ...(pk.variantId ? { variantId: pk.variantId } : {}), character: ch, seed, width: opts.resolutions.find(r => r.px === px)!.width, height: px, batch };
      if (styleRef) { body.styleRef = styleRef.id; delete body.width; delete body.height; delete body.batch; }
      await api('POST', '/api/jobs', body);
      setSeed(Math.floor(Math.random() * 1e9)); setScreen('generate');
    } catch (e) {
      const a = e as ApiError;
      setNotice({ text: a.message, reasons: a.body?.reasons });
      setScreen('generate');
    }
  };
  const ctx = { mode, setMode, vin, setVin, setNotice, styleRef, setStyleRef, schema, opts, adv, unlocked, setUnlock, pretend, setPretend, ch, setCh, seed, setSeed, px, setPx, batch, setBatch, jobs, generate, notice, go: setScreen, loadOpts, msel, setMsel };

  return (
    <div class={'shell' + (adv ? ' adv' : '')}>
      <header class="top">
        <div class="logo"><img class="mark" src="./icon.svg" width="28" height="28" alt="" />Influencer Studio<small class="verb" id="ver-badge" title="Pre-launch test build">v{opts.version}</small>{opts.mock && <small class="mockb" title="No AI model is running; images are placeholders">MOCK GENERATOR</small>}</div>
        <ModeSwitch mode={mode} set={setMode} />
        <nav aria-label="Main">
          {NAV.map(([k, l]) => <button key={k} class={screen === k ? 'on' : ''} aria-current={screen === k ? 'page' : undefined} onClick={() => setScreen(k)}>{l}</button>)}
        </nav>
        <div class="right">
          <FeedbackLink version={opts.version} cls="chip fbk" short />
          {unlocked && <button class="chip warnchip" onClick={() => setUnlock(false)} title="Click to lock again">Unlocked: unsupported options on</button>}
          <Toggle label="Advanced" on={adv} set={setAdv} />
          <span class="pill" title="Detected hardware">{gpu ? `${gpu.name.replace('NVIDIA ', '').replace('GeForce ', '')} · ${gpu.vramGb} GB` : 'No GPU found'} · {opts.tier.name}</span>
        </div>
      </header>
      {walk && <Walkthrough go={setScreen} close={closeWalk} />}
      {!opts.comfyOnline && !opts.mock && <div class="banner" role="status">ComfyUI is offline at its configured address. You can still build characters; generation resumes when ComfyUI is running.</div>}
      <main key={screen} class="fade">
        {screen === 'scan' && <Scan {...ctx} />}
        {screen === 'home' && <Home {...ctx} />}
        {screen === 'builder' && <Builder {...ctx} />}
        {screen === 'generate' && <Generate {...ctx} />}
        {screen === 'models' && <Models {...ctx} />}
        {screen === 'about' && <About {...ctx} setWalk={setWalk} />}
      </main>
    </div>
  );
}
type Ctx = ReturnType<typeof Object> & any;

function ModeSwitch({ mode, set, big }: { mode: Mode; set: (m: Mode) => void; big?: boolean }) {
  const items: [Mode, string][] = [['image', '🖼 Image'], ['video', '🎬 Video']];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = (e: KeyboardEvent, i: number) => { const n = navIndex(e.key, i, 2); if (n === null) return; e.preventDefault(); set(items[n]![0]); refs.current[n]?.focus(); };
  return <div class={'modesw' + (big ? ' big' : '')} role="radiogroup" aria-label="Mode: Image or Video">
    {items.map(([k, l], i) => <button key={k} ref={el => { refs.current[i] = el; }} role="radio" aria-checked={mode === k} tabIndex={mode === k ? 0 : -1} class={mode === k ? 'on' : ''} onKeyDown={e => key(e, i)} onClick={() => set(k)}>{l}</button>)}
  </div>;
}

function InputTabs({ vin, set, models }: { vin: VideoInput; set: (v: VideoInput) => void; models: ModelOpt[] }) {
  const ins = videoInputs(models as any);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = (e: KeyboardEvent, i: number) => { const n = navIndex(e.key, i, ins.length); if (n === null) return; e.preventDefault(); set(ins[n]!.id); refs.current[n]?.focus(); };
  return <div class="card vinputs"><div class="inputtabs" role="tablist" aria-label="Video input mode">
    {ins.map((x, i) => <button key={x.id} ref={el => { refs.current[i] = el; }} role="tab" id={'vin-' + x.id} aria-selected={vin === x.id} aria-controls="vin-panel" tabIndex={vin === x.id ? 0 : -1} class={(vin === x.id ? 'on' : '') + (x.locked ? ' locked' : '')} onKeyDown={e => key(e, i)} onClick={() => set(x.id)}>{x.locked ? '🔒 ' : ''}{x.label}{x.reason === 'Coming soon' ? <small> · soon</small> : null}</button>)}
  </div></div>;
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (b: boolean) => void }) {
  return <button role="switch" aria-checked={on} class={'tog' + (on ? ' on' : '')} onClick={() => set(!on)}><span class="knob" />{label}</button>;
}

function StateChip({ s }: { s: string }) { return <span class={'state ' + s}>{s === 'locked_soft' || s === 'blocked_hard' ? '🔒 ' : s === 'recommended' ? '★ ' : '✓ '}{STATE_TXT[s]}</span>; }

function Confirm({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => keep.current?.focus(), []);
  return <div class="modal" role="presentation"><div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="dlgt">
    <h2 id="dlgt">Unlock unsupported options?</h2>
    <p>Jobs may crash ComfyUI, freeze your PC or take hours. Nothing is broken by trying, but save your work first. Missing files and no-GPU stay blocked.</p>
    <div class="row"><button ref={keep} class="primary" onClick={onNo}>Keep locked</button><button class="ghost danger" onClick={onYes}>Unlock at my own risk</button></div>
  </div></div>;
}

function ModelList(p: Ctx) {
  const { opts } = p; const [msg, setMsg] = useState('');
  const eff = effective(opts.models as any, p.msel, p.unlocked);
  const click = (m: ModelOpt) => {
    const g = gate(m as any, p.unlocked);
    if (!g.selectable) { setMsg(`${m.name}: ${g.reason}`); return; }
    const n = toggle(opts.models as any, eff, m.id, p.unlocked); if (n) { p.setMsel(n); setMsg(`${m.name} ${n.includes(m.id) ? 'selected' : 'not selected'}.`); }
  };
  return <>
    <p class="muted small" id="mlist-help">Tick the models the app should use. Only one model per kind is used. Recommended models are ticked for you; your choice is remembered.</p>
    <ul class="lst mlist" role="group" aria-label="Models to use" aria-describedby="mlist-help">{opts.models.map((m: ModelOpt) => {
      const v = m.variants.find(x => x.id === m.bestVariantId) ?? m.variants[0]!; const g = gate(m as any, p.unlocked); const on = eff.includes(m.id);
      const eff2 = p.unlocked && v.state === 'locked_soft'; const tip = g.reason || (on ? 'Selected: used for ' + m.kind + ' jobs' : 'Click to use this model');
      return (<li key={m.id} class={g.locked ? (eff2 ? 'unl-on' : 'locked') : ''}>
        <button type="button" role="checkbox" aria-checked={on} aria-disabled={!g.selectable} title={tip} data-model={m.id} class={'mrow' + (on ? ' on' : '')} onClick={() => click(m)}>
          <span class="ico">{on ? '✓' : g.locked ? (eff2 ? '⚠' : '🔒') : '○'}</span>
          <span class="mbody"><b>{m.name}</b> <em>{m.kind}</em> <StateChip s={v.state} />
            <small>{v.label} · {v.sizeGb} GB{v.reasons.length ? ' · ' + v.reasons.map(r => r.text).join('; ') : ''}{eff2 ? ' · Unsupported on your PC: may crash or freeze' : ''}</small></span>
        </button></li>); })}</ul>
    <p class="muted small" role="status" aria-live="polite" id="mlist-msg">{msg}</p></>;
}

function Scan(p: Ctx) {
  const { opts } = p; const pr = opts.profile;
  const [showCustom, setShowCustom] = useState(false); const [step, setStep] = useState(0); const [run, setRun] = useState(0); const [ask, setAsk] = useState(false);
  useEffect(() => { setStep(0); const t = setInterval(() => setStep(s => (s < 6 ? s + 1 : s)), 350); return () => clearInterval(t); }, [run]);
  const g = pr.gpus.find((x: any) => x.index === pr.selectedGpu);
  const rows: [string, string][] = [['Operating system', `${pr.os.platform} ${pr.os.arch}`], ['GPU', g ? g.name : 'No usable GPU found'], ['VRAM', g ? g.vramGb + ' GB' : '0 GB'], ['System RAM', pr.ramGb + ' GB'], ['Free disk', pr.freeDiskGb === null ? 'unknown' : pr.freeDiskGb + ' GB'], ['Hardware level', `${opts.tier.name} · ${opts.tier.label}${opts.tier.estimated ? ' (estimated)' : ''}`]];
  const rec = opts.models.filter((m: ModelOpt) => m.bestVariantId);
  const tiers = [['My PC', null], ['Minimal', 'T0'], ['Basic', 'T1'], ['Standard', 'T2'], ['Enhanced', 'T3'], ['Pro', 'T4'], ['Elite', 'T5'], ['Mega', 'T6'], ['Ultra', 'T7'], ['Extreme', 'T8'], ['Max', 'T9']] as [string, string | null][];
  return (
    <section class="grid2">
      <div class="card">
        <h1>Hardware scan</h1>
        <p class="muted">{opts.summary}</p>
        <div class="scanbar" aria-hidden="true"><i style={{ width: Math.min(step, 6) * 16.6 + '%' }} /></div>
        <ul class="rows" aria-live="polite">{rows.map(([k, v], i) => <li key={k} class={i < step ? 'show' : ''}><span>{k}</span><b>{i < step ? v : '…'}</b></li>)}</ul>
        {pr.notes.map((n: string) => <p class="muted small" key={n}>{n}</p>)}
        <div class="row"><button class="ghost" onClick={async () => { await p.loadOpts(p.pretend, true); setRun(run + 1); }}>Re-scan</button></div>
        {step >= 6 && <div class="result glow">{rec.length ? <>Recommended: <b>{rec.map((m: ModelOpt) => m.name).join(', ')}</b><br />Best resolution: <b>{[...opts.resolutions].reverse().find((r: Res) => r.state !== 'locked_soft')?.px} px</b> · best-fitting file picked automatically.</> : <>{opts.profile.tier === 'T0' ? 'This computer cannot run local generation models. Generation is locked; you can still explore the character builder.' : 'No installed model fits this PC yet.'}</>}</div>}
      </div>
      <div class="card">
        <h2>What your hardware can run</h2>
        <div class="seg" role="group" aria-label="Pretend my GPU (preview only)">{tiers.map(([l, v]) => <button key={l} class={p.pretend === v ? 'on' : ''} onClick={() => p.setPretend(v)}>{l}</button>)}<button class={opts.customActive ? 'on' : ''} aria-expanded={showCustom} onClick={() => { p.setPretend(null); setShowCustom(!showCustom); }}>Custom{opts.customActive ? ' ✓' : ''}</button></div>
        {showCustom && <CustomPanel adv={p.adv} onDone={() => p.loadOpts(null)} />}
        {p.pretend && <p class="muted small">Preview only: you are looking at the {opts.tier.name} level. The server still checks every job against your real PC ({opts.realTierName}).</p>}
        {p.adv ? <div class="unl"><Toggle label="Unlock unsupported options at my own risk" on={p.unlocked} set={v => (v ? setAsk(true) : p.setUnlock(false))} />
          <p class="muted small">Lets you pick models and sizes your PC probably cannot run. Hard limits (no GPU, missing files) stay on.</p>{p.unlocked && <p class="warn">Unlocked options may be very slow or crash. The server still checks each job.</p>}</div>
          : <p class="muted small">Locked items need more VRAM or RAM than this PC has. Switch on Advanced (top right) to find the unlock setting.</p>}
        {ask && <Confirm onNo={() => setAsk(false)} onYes={() => { setAsk(false); p.setUnlock(true); }} />}
        <ModelList {...p} />
        <h3>Resolution levels</h3>
        <div class="chips res">{opts.resolutions.map((r: Res) => <span key={r.px} class={'chip static' + (r.state === 'locked_soft' ? ' locked' : '')} title={r.reason ?? ''}>{r.state === 'locked_soft' ? '🔒 ' : ''}{r.px} px</span>)}</div>
        <div class="scan-cta"><button class="primary" onClick={() => p.go('builder')}>Continue to the builder</button></div>
      </div>
    </section>
  );
}

function Home(p: Ctx) {
  return (
    <section class="home">
      <h1 class="hero">Create your <span class="grad">character</span></h1>
      <ModeSwitch mode={p.mode} set={p.setMode} big />
      <div class="prompt card glow">
        <label class="lbl" for="notes">Extra detail (optional, up to 200 characters)</label>
        <textarea id="notes" maxLength={200} placeholder="e.g. holding a coffee cup" value={p.ch.notes ?? ''} onInput={e => p.setCh({ ...p.ch, notes: (e.target as HTMLTextAreaElement).value || undefined })} />
        <div class="row"><button class="ghost" onClick={() => p.go('builder')}>Choose character</button><button class="primary" onClick={p.mode === 'video' ? () => p.go('generate') : p.generate}>{p.mode === 'video' ? 'Open video tools' : 'Generate image'}</button></div>
      </div>
      <p class="muted">{p.adv ? 'Advanced mode: all controls visible.' : 'Simple mode: the essentials only. Switch on Advanced (top right) for every control.'} Adults only, SFW, fully clothed.</p>
    </section>
  );
}

const SYM: Record<string, string> = { surprise: '◌', male: '♂', female: '♀', non_binary: '⚲', trans_woman: '⚧', trans_man: '⚧', cat_person: '🐱', dog_person: '🐶', fox_person: '🦊', frog_person: '🐸', insect_person: '🦋', bird_person: '🦉', rodent_person: '🐹', reptile_person: '🦎', robot: '🤖', plush_person: '🧸' };
type Section = { id: string; title: string; ui: string; options: Opt[]; multi?: boolean; max?: number };

function Builder(p: Ctx) {
  const { schema, ch, setCh } = p as { schema: Schema; ch: Ch; setCh: (c: Ch) => void };
  const [open, setOpen] = useState<Record<string, boolean>>({ type: true, species: true, bodySize: true, hairStyle: true });
  const [lock, setLock] = useState<Record<string, boolean>>({});
  const [pv, setPv] = useState<Map<string, PreviewItem[]>>(new Map());
  useEffect(() => { loadPreviews().then(setPv); }, []);
  const type = ch.type as string;
  const human = humanType(type);
  const secs: Section[] = [
    { id: 'type', title: 'Character type', ui: 'type', options: schema.types },
    ...(schema.species[type] ? [{ id: 'species', title: (schema.types.find(t => t.id === type)?.label ?? 'Character') + ' species', ui: 'species', options: schema.species[type] }] : []),
    { id: 'bodySize', title: 'Body size', ui: 'size', options: schema.sizes },
    { id: 'age', title: 'Age', ui: 'pill', options: schema.ageBands },
    ...schema.controls.filter(c => human || (c.applies === 'all' && c.id !== 'hairStyle')).filter(c => p.adv || !['expression', 'lighting', 'background', 'renderStyle'].includes(c.id) || true).map(c => ({ id: c.id, title: c.title, ui: c.ui, options: c.options, multi: c.multi, max: c.maxSelected })),
  ];
  const curOf = (s: Section): string | string[] => {
    if (s.id === 'age') return schema.ageBands.reduce((a, b) => (Math.abs(b.age - ch.age) < Math.abs(a.age - ch.age) ? b : a)).id;
    if (s.id === 'species') return ch.species ?? schema.species[type]?.[0].id;
    const c = schema.controls.find(x => x.id === s.id);
    return ch[s.id] ?? (c ? c.default : '');
  };
  const labelOf = (id: string): string => { const s = secs.find(x => x.id === id); if (!s) return ''; const v = curOf(s) as string; return s.options.find(o => o.id === v)?.label ?? ''; };
  const choose = (s: Section, o: Opt) => {
    const n = { ...ch };
    if (s.id === 'type') { n.type = o.id; delete n.species; if (!humanType(o.id)) { delete n.hairStyle; /* hair style has no tiles for non-human types; species default applied server side */ } }
    else if (s.id === 'age') n.age = schema.ageBands.find(a => a.id === o.id)!.age;
    else if (s.multi) { const cur = (ch[s.id] as string[]) ?? []; n[s.id] = cur.includes(o.id) ? cur.filter(x => x !== o.id) : [...cur, o.id].slice(-(s.max ?? 3)); }
    else n[s.id] = o.id;
    setCh(n);
  };
  const shuffle = async () => {
    const locks = Object.keys(lock).filter(k => lock[k]);
    try { setCh(await api('POST', '/api/randomise', { character: ch, locks: locks.map(l => (l === 'age' ? 'age' : l)), seed: Math.floor(Math.random() * 4294967295), mode: (ch.silliness ?? 0) > 0 ? 'silly' : 'realistic' })); } catch { /* ignore */ }
  };
  const sizeIdx = Math.max(0, schema.sizes.findIndex(s => s.id === ch.bodySize));
  const sp = schema.species[type]?.find(o => o.id === (ch.species ?? schema.species[type]?.[0].id))?.label ?? '';
  const look = { type: type === 'alien' ? 'Alien' : type === 'monster' ? 'Monster' : 'Human', species: sp, skin: labelOf('skinTone'), hairStyle: labelOf('hairStyle'), hairColor: labelOf('hairColor'), eyeColor: labelOf('eyeColor'), eyeShape: labelOf('eyeShape'), head: labelOf('headShape'), neck: labelOf('neck'), facial: labelOf('facialHair'), accessory: labelOf('accessory'), outfit: labelOf('outfit'), height: labelOf('height'), feature: ((ch.features as string[]) ?? []).length ? schema.controls.find(c => c.id === 'features')!.options.find(o => o.id === ch.features[0])?.label : labelOf('distinctive') };
  const typeLabel = schema.types.find(t => t.id === type)?.label ?? '';
  return (
    <section class="builder">
      <aside class="panel" aria-label="Character builder">
        <div class="ptabs" role="tablist">{['Create Influencer', 'Motion'].map((t, i) => <button key={t} role="tab" aria-selected={i === 0} disabled={i === 1} title={i === 1 ? 'Motion transfer arrives in a later milestone' : ''} class={i === 0 ? 'on' : ''}>{t}</button>)}</div>
        <div class="pscroll">
          <div class="sec slider" id="silly-slider"><label for="silly-range"><b>Realism ↔ Ridiculous</b> <span class="muted">{schema.silliness[ch.silliness ?? 0]?.label}</span></label>
            <input id="silly-range" type="range" min={0} max={schema.silliness.length - 1} step={1} value={ch.silliness ?? 0} aria-valuetext={schema.silliness[ch.silliness ?? 0]?.label} onInput={e => setCh({ ...ch, silliness: Number((e.target as HTMLInputElement).value) })} />
            <div class="ticks" aria-hidden="true">{schema.silliness.map(l => <span key={l.id}>{l.label}</span>)}</div></div>
          <StyleRefBox ref_={p.styleRef} set={p.setStyleRef} />
          {secs.map(s => {
            const isOpen = open[s.id]; const cur = curOf(s); const flat = ['swatch', 'pill'].includes(s.ui);
            const sw = (o: Opt) => s.id === 'skinTone' ? SKIN[o.label] : s.id === 'hairColor' ? HAIRC[o.label] : s.id === 'eyeColor' ? EYEC[o.label] : '';
            return (
              <div class="sec" key={s.id}>
                <div class="shead">
                  <button class="stog" aria-expanded={!!isOpen} onClick={() => setOpen({ ...open, [s.id]: !isOpen })}><span class="stitle">{s.title} · {s.options.length}</span><span class={'chev' + (isOpen ? ' up' : '')} aria-hidden="true">⌃</span></button>
                  <button class={'lk' + (lock[s.id] ? ' on' : '')} aria-pressed={!!lock[s.id]} title={`Lock ${s.title} when shuffling`} onClick={() => setLock({ ...lock, [s.id]: !lock[s.id] })}>{lock[s.id] ? '🔒' : '🔓'}</button>
                </div>
                {isOpen && (s.ui === 'pill' ? <div class="pills" role={s.multi ? 'group' : 'radiogroup'} aria-label={s.title}>{s.options.map(o => <button key={o.id} role={s.multi ? 'checkbox' : 'radio'} aria-checked={cur === o.id} class={'pillb' + (cur === o.id ? ' on' : '')} onClick={() => choose(s, o)}>{o.label}</button>)}</div> :
                  <div class="tg" role={s.multi ? 'group' : 'radiogroup'} aria-label={s.title}>{s.options.map(o => {
                    const on = s.multi ? (cur as string[]).includes(o.id) : cur === o.id; const swc = sw(o);
                    return <button key={o.id} role={s.multi ? 'checkbox' : 'radio'} aria-checked={on} class={'bt' + (on ? ' on' : '') + (flat || (s.ui === 'type' && o.id !== 'alien' && o.id !== 'monster') ? ' flat' : '')} onClick={() => choose(s, o)}>
                      {s.ui === 'type' ? ((): any => { const pi = pv.get('type/' + (o.id === 'trans_woman' ? 'female' : o.id === 'trans_man' ? 'male' : o.id))?.[0] ?? null; const sym = <span class="gsym" aria-hidden="true">{SYM[o.id]}</span>;
                        return o.id === 'alien' || o.id === 'monster' ? <div class="ph"><Thumb item={pi} alt={o.label} fallback={<Lazy cls="ph"><Portrait type={o.id === 'alien' ? 'Alien' : 'Monster'} species={schema.species[o.id][0].label} zoom="bust" /></Lazy>} /></div> : pi ? <div class="ph"><Thumb item={pi} alt={o.label} fallback={sym} /><span class="symb" aria-hidden="true">{SYM[o.id]}</span></div> : sym; })() :
                        swc ? <i class="sw" style={{ background: swc }} /> :
                          <div class="ph">{(() => {
                            const ctl = s.id === 'species' ? 'species' : s.id; const opt = s.id === 'species' ? `${type}_${o.id}` : o.id;
                            const baseT = type === 'trans_woman' ? 'female' : type === 'trans_man' ? 'male' : type === 'surprise' ? 'male' : type;
                            const pi = ['pill', 'swatch'].includes(s.ui) ? null : pickPreview(pv, ctl, opt, type, s.options.findIndex(x => x.id === o.id)) ?? (BASE_OPT.has(o.id) ? (pv.get('type/' + baseT)?.[0] ?? pv.get('type/male')?.[0] ?? null) : null);
                            const fb = <Lazy cls="ph"><Tile s={s} o={o} look={look} size={sizeIdx} type={type} schema={schema} /></Lazy>;
                            return <><Thumb item={pi} alt={o.label} fallback={fb} />{pi && s.id === 'bodySize' && <span class="silb" aria-hidden="true"><FullBody {...look} size={schema.sizes.findIndex(z => z.id === o.id)} /></span>}</>;
                          })()}</div>}
                      <span class="tl">{o.label}</span>
                    </button>;
                  })}</div>)}
              </div>);
          })}
        </div>
        <div class="gbar"><button class="shuf" aria-label="Shuffle character" title="Shuffle (locked sections stay)" onClick={shuffle}>⤮</button><button class="gen-btn" onClick={p.generate}>Generate ✨</button></div>
      </aside>
      <div class="canvas">
        <LivePreview ch={ch} seed={p.seed} pv={pv} schema={schema} type={type} opts={p.opts} msel={p.msel} unlocked={p.unlocked} jobs={p.jobs} setNotice={p.setNotice} />
        <Library setCh={setCh} />
        <div class="card"><h2>Presets</h2><div class="chips">{schema.presets.filter(x => !x.silly).map(x => <button key={x.id} class="chip" onClick={async () => setCh(await api('POST', '/api/preset', { character: ch, preset: x.id }))}>{x.label}</button>)}</div></div>
        <div class="card" id="silly-pack"><h2>Silly preset pack <small class="muted">{schema.presets.filter(x => x.silly).length} presets</small></h2><div class="chips">{schema.presets.filter(x => x.silly).map(x => <button key={x.id} class="chip" onClick={async () => setCh(await api('POST', '/api/preset', { character: ch, preset: x.id }))}>{x.label}</button>)}</div><small class="muted">One click fills the builder. Everything stays editable.</small></div>
      </div>
    </section>
  );
}
function StyleRefBox({ ref_, set }: { ref_: { id: string; url: string; name: string } | null; set: (r: { id: string; url: string; name: string } | null) => void }) {
  const input = useRef<HTMLInputElement>(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [over, setOver] = useState(false);
  const take = async (f?: File) => {
    if (!f) return; setMsg('');
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setMsg('Use a PNG, JPEG or WebP image.'); return; }
    if (f.size > 8 * 1024 * 1024) { setMsg('The image must be under 8 MB.'); return; }
    setBusy(true);
    try { const r = await uploadRef(f); if (ref_) { URL.revokeObjectURL(ref_.url); api('DELETE', '/api/refs/' + ref_.id).catch(() => {}); } set({ id: r.id, url: URL.createObjectURL(f), name: f.name.slice(0, 40) }); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const remove = () => { if (!ref_) return; URL.revokeObjectURL(ref_.url); api('DELETE', '/api/refs/' + ref_.id).catch(() => {}); set(null); setMsg(''); };
  return <div class={'drop' + (over ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer?.files?.[0]); }}>
    {ref_ ? <div class="refrow"><img class="refimg" src={ref_.url} alt="Your style reference" /><div class="refmeta"><b>Style reference</b><small>{ref_.name}</small><small>Next images follow this person and look. Image size is set by the reference.</small><div class="row"><button class="ghost tiny" onClick={() => input.current?.click()}>Replace</button><button class="ghost tiny" onClick={remove}>Remove</button></div></div></div>
      : <button class="dropbtn" disabled={busy} onClick={() => input.current?.click()} aria-label="Add style reference image"><span class="plus" aria-hidden="true">+</span><b>{busy ? 'Adding…' : 'Add style reference'}</b><small>Optional · PNG, JPEG or WebP · drop a file here</small></button>}
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { take((e.target as HTMLInputElement).files?.[0]); (e.target as HTMLInputElement).value = ''; }} />
    {msg && <small class="warn" role="alert">{msg}</small>}
    {!ref_ && <small class="muted">Use images you have the right to use. Adults only, SFW.</small>}
  </div>;
}

/** Generated preview thumbnail (webp, lazy) with the SVG art as the fallback when no file exists or it fails to load. */
/** Default/none options show the plain reference photo for the current type instead of drawn art. */
const BASE_OPT = new Set(['none', 'average', 'balanced', 'unspecified']);
function Thumb({ item, alt, fallback }: { item: PreviewItem | null; alt: string; fallback: any }) {
  const [tries, setTries] = useState(0);
  if (!item || tries > 2) return fallback;
  // A failed load (busy server, interrupted connection) is retried twice before the drawn fallback is used, so a hiccup never sticks.
  return <img class={'pimg ' + item.framing} src={'/previews/' + item.file + (tries ? '?r=' + tries : '')} width={item.w} height={item.h} alt={alt} loading="lazy" decoding="async" onError={() => { setTimeout(() => setTries(t => t + 1), 400 * (tries + 1)); }} />;
}
const SILLY_ICON: Record<string, string> = { hairStyle: '💇', outfit: '🧥', proportions: '🔍', background: '🌈', renderStyle: '🎨', prop: '🎈' };
/** Drawn fallback for the playful options until their generated thumbnail exists (plan 28). */
function SillyTile({ s, o }: { s: Section; o: Opt }) {
  const h = hue(o.label);
  return <svg viewBox="0 0 48 48" class="art" role="img" aria-label={o.label}><rect width="48" height="48" rx="8" fill={`hsl(${h} 70% 88%)`} /><circle cx="24" cy="22" r="14" fill={`hsl(${(h + 40) % 360} 75% 70%)`} /><text x="24" y="29" font-size="18" text-anchor="middle">{SILLY_ICON[s.id] ?? '✨'}</text></svg>;
}
function Tile({ s, o, look, size, type, schema }: { s: Section; o: Opt; look: any; size: number; type: string; schema: Schema }) {
  const L = { ...look }; const nh = !humanType(type);
  const k = s.ui;
  if (o.silly) return <SillyTile s={s} o={o} />;
  if (s.id === 'species') return <Portrait {...L} species={o.label} zoom="bust" />;
  if (k === 'hair') return <Portrait {...L} hairStyle={o.label} zoom="bust" />;
  if (k === 'outfit') return <FullBody {...L} outfit={o.label} size={size} />;
  if (k === 'head') return <Portrait {...L} head={o.label} zoom="bust" />;
  if (k === 'neck') return <Portrait {...L} neck={o.label} zoom="bust" />;
  if (k === 'eye') return <Portrait {...L} eyeShape={o.label} zoom="eyes" />;
  if (k === 'body') return <FullBody {...L} size={size} height={s.id === 'height' ? o.label : look.height} />;
  if (k === 'size') return <FullBody {...L} size={schema.sizes.findIndex(z => z.id === o.id)} />;
  if (k === 'acc') return <Portrait {...L} accessory={o.label} zoom="bust" />;
  if (k === 'face') return <Portrait {...L} {...(s.id === 'facialHair' ? { facial: o.label } : { feature: o.label })} zoom="bust" />;
  void nh; return null;
}
const PREVIEW_KEY = 'is_preview';
const sigOf = (ch: Ch, seed: number) => JSON.stringify([ch, seed]);
/** Real preview: a realistic placeholder before any generation, and a real generated image of the current selection after pressing Preview (last result cached). */
function LivePreview({ ch, seed, pv, schema, type, opts, msel, unlocked, jobs, setNotice }: any) {
  const [pseed] = useState(() => seed);
  const [cache, setCache] = useState<{ sig: string; jobId: string } | null>(() => { try { return JSON.parse(localStorage.getItem(PREVIEW_KEY) ?? 'null'); } catch { return null; } });
  const [url, setUrl] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const job = cache ? jobs.find((j: Job) => j.id === cache.jobId) : null;
  const done = job?.status === 'done'; const running = !!job && ['queued', 'running'].includes(job.status);
  useEffect(() => {
    if (!cache || !done) { setUrl(''); return; }
    let u = ''; let dead = false;
    fetchBlobUrl(`/api/outputs/${cache.jobId}/0`).then(x => { u = x; if (!dead) setUrl(x); else URL.revokeObjectURL(x); }).catch(() => {});
    return () => { dead = true; if (u) URL.revokeObjectURL(u); };
  }, [cache?.jobId, done]);
  const sig = sigOf(ch, pseed); const stale = !!cache && cache.sig !== sig;
  const run = async () => {
    setErr(''); setBusy(true); setNotice(null);
    try {
      const pk = pick(opts.models, msel, unlocked, 'image'); if (pk.blocked) { setErr(pk.blocked); return; }
      const j = await api<Job>('POST', '/api/jobs', { ...(pk.variantId ? { variantId: pk.variantId } : {}), character: ch, seed: pseed, width: 576, height: 768, batch: 1 });
      const c = { sig, jobId: j.id }; setCache(c); try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(c)); } catch { /* storage blocked */ }
    } catch (e) { const a = e as ApiError; setErr(a.message + (a.body?.reasons?.length ? ': ' + a.body.reasons.map((r: Reason) => r.text).join('; ') : '')); } finally { setBusy(false); }
  };
  // Realistic placeholder: the generated full-body photo for this type and body size, else the type picture, else a plain card.
  const sizeId = ch.bodySize ?? 'medium';
  const hasPhoto = humanType(type) || type === 'alien' || type === 'monster'; // playful creature types have no example photo until their thumbnails are generated
  const ph = !hasPhoto ? (pv.get('type/' + type)?.[0] ?? null) : pickPreview(pv, 'bodySize', sizeId, type, 0) ?? pv.get('type/' + (type === 'trans_woman' ? 'female' : type === 'trans_man' ? 'male' : type))?.[0] ?? pv.get('type/female')?.[0] ?? null;
  const typeLabel = schema.types.find((t: any) => t.id === type)?.label ?? '';
  const failed = job && ['failed', 'cancelled', 'interrupted'].includes(job.status);
  return <div class="stage card glow" id="live-preview">
    <div class="bigart real" aria-live="polite">
      {url ? <img src={url} alt={`Generated preview: ${typeLabel}`} />
        : ph ? <img src={'/previews/' + ph.file} alt={`Example photo for ${typeLabel}, ${schema.sizes.find((z: Opt) => z.id === sizeId)?.label ?? ''} (not your exact selection)`} class="phimg" />
          : <div class="phempty">No example photo for this playful type yet.<br />Press Preview to see it.</div>}
      {running && <div class="pvbusy" role="status"><i class="spin" />Generating… {Math.round(job!.progress)}%</div>}
    </div>
    <div class="pvrow"><button class="primary" disabled={busy || running} onClick={run}>{running ? 'Generating…' : url ? 'Update preview' : 'Preview'}</button></div>
    <small class="muted" role="status">{url ? (stale ? 'Last preview. Your selection has changed since; press Update preview.' : 'Preview of your current selection.') : 'Example photo shown until you press Preview.'}</small>
    {(err || failed) && <small class="warn" role="alert">{err || job?.error || 'The preview did not finish.'}</small>}
    <SaveBar ch={ch} seed={seed} />
    <small class="muted">Adults only, SFW, fully clothed.</small>
  </div>;
}
function SaveBar({ ch, seed }: { ch: Ch; seed: number }) {
  const [name, setName] = useState(''); const [msg, setMsg] = useState('');
  const save = async () => { try { await api('POST', '/api/characters', { name: name || 'My character', character: ch, seed }); setMsg('Saved'); window.dispatchEvent(new Event('lib')); } catch (e) { setMsg((e as Error).message); } };
  return <div class="row savebar"><input aria-label="Character name" placeholder="Name (optional)" maxLength={30} value={name} onInput={e => setName((e.target as HTMLInputElement).value)} /><button class="primary" onClick={save}>Save to library</button>{msg && <small class="muted" role="status">{msg}</small>}</div>;
}
function Library({ setCh }: { setCh: (c: Ch) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api('GET', '/api/characters').then(setItems).catch(() => {});
  useEffect(() => { load(); window.addEventListener('lib', load); return () => window.removeEventListener('lib', load); }, []);
  return <div class="card"><h2>Saved library</h2>{items.length === 0 ? <p class="muted">Nothing saved yet.</p> : <div class="lib">{items.map(c => <div key={c.id} class="libi"><button class="libb" onClick={() => setCh(c.character)}>{c.refImage ? <RefThumb id={c.refImage} alt={c.name} /> : <Avatar type={c.character.type === 'alien' ? 'Alien' : c.character.type === 'monster' ? 'Monster' : 'Human'} size={Math.max(0, ['ultra_fat', 'fat', 'medium', 'thin', 'skinny', 'stick_thin'].indexOf(c.character.bodySize))} seed={c.name.length} />}<span>{c.name}</span></button><button class="ghost tiny" aria-label={'Delete ' + c.name} onClick={async () => { await api('DELETE', '/api/characters/' + c.id); load(); }}>✕</button></div>)}</div>}</div>;
}

function Img({ job, idx }: { job: Job; idx: number }) {
  const [url, setUrl] = useState('');
  const isVideo = job.outputs[idx]?.mime?.startsWith('video/');
  useEffect(() => { let u = ''; let dead = false; fetchBlobUrl(`/api/outputs/${job.id}/${idx}`).then(x => { u = x; if (!dead) setUrl(x); else URL.revokeObjectURL(x); }).catch(() => {}); return () => { dead = true; if (u) URL.revokeObjectURL(u); }; }, [job.id, idx]);
  if (url && isVideo) return <div class="vidwrap"><video src={url} controls loop muted playsInline preload="metadata" aria-label={`Generated video: ${job.label}`} /><a class="ghost tiny savevid" href={url} download={`influencer-studio-${job.id.slice(0, 8)}.mp4`}>Save video</a></div>;
  return url ? <img src={url} alt={`Generated image ${idx + 1}: ${job.label}`} decoding="async" loading="lazy" /> : <div class="imgph" aria-hidden="true" />;
}

function Generate(p: Ctx) {
  const { opts, jobs } = p as { opts: Opts; jobs: Job[] };
  const latest = jobs[0];
  const [prompt, setPrompt] = useState('');
  useEffect(() => { if (p.adv) api('POST', '/api/compile', { character: p.ch, seed: p.seed }).then(r => setPrompt(r.positive)).catch(() => setPrompt('')); }, [p.adv, p.ch, p.seed]);
  const busy = latest && (latest.status === 'queued' || latest.status === 'running');
  const video = p.mode === 'video';
  const ins = videoInputs(opts.models as any); const curIn = ins.find(x => x.id === p.vin) ?? ins[0]!;
  return (
    <section class={'gen' + (video ? ' genv' : '')} data-mode={p.mode}>
      {video && <div class="wide3"><InputTabs vin={p.vin} set={p.setVin} models={opts.models} /></div>}
      {!video && <div class="card">
        <h2>Output</h2>
        <h3>Resolution (long side)</h3>
        <div class="chips res">{opts.resolutions.map((r: Res) => { const lk = r.state === 'locked_soft'; const dis = lk && !p.unlocked; return <button key={r.px} class={'chip' + (p.px === r.px ? ' on' : '') + (lk ? ' locked' : '')} disabled={dis} aria-disabled={dis} title={r.reason ?? ''} onClick={() => p.setPx(r.px)}>{lk ? (p.unlocked ? '⚠ ' : '🔒 ') : ''}{r.px}</button>; })}</div>
        {opts.resolutions.some((r: Res) => r.state === 'locked_soft') && <p class="muted small">Locked sizes need a stronger GPU. {p.adv ? 'You can unlock them on the Hardware screen.' : 'Advanced mode shows the unlock setting.'}</p>}
        {p.styleRef && <p class="muted small">Style reference is on: the image size follows your reference (about 1 megapixel) and one image is made per run.</p>}
        <h3>Images per run</h3>
        <div class="chips">{[1, 2, 4].map(n => <button key={n} class={'chip' + (p.batch === n ? ' on' : '')} onClick={() => p.setBatch(n)}>{n}</button>)}</div>
        {p.adv && <><h3>Seed</h3><div class="row"><input class="num" type="number" min={0} max={4294967295} value={p.seed} onInput={e => p.setSeed(Math.max(0, Math.min(4294967295, Math.floor(Number((e.target as HTMLInputElement).value) || 0))))} /><button class="ghost" onClick={() => p.setSeed(Math.floor(Math.random() * 1e9))}>🎲</button></div>
          <h3>Compiled prompt</h3><pre class="prompt-pre" tabIndex={0}>{prompt}</pre></>}
        <p class="muted small">Camera and look presets arrive in a later milestone.</p>
      </div>}
      {!video && <SameCharacter schema={p.schema} setNotice={p.setNotice} opts={opts} msel={p.msel} unlocked={p.unlocked} />}
      {video && (curIn.id === 'i2v' && curIn.available ? <VideoCard msel={p.msel} schema={p.schema} opts={opts} jobs={jobs} unlocked={p.unlocked} adv={p.adv} setNotice={p.setNotice} go={p.go} />
        : <div class="card" id="vin-panel" role="tabpanel" aria-labelledby={'vin-' + curIn.id}><h2>🔒 {curIn.label}</h2><p class="muted">{curIn.reason === 'Coming soon' ? 'Coming soon. It will appear here once a compatible open model is installed on a PC that can run it.' : curIn.reason}</p>{curIn.reason !== 'Coming soon' && <button class="ghost" onClick={() => p.go('models')}>Open Models</button>}</div>)}
      <div class="card stage2">
        <div class="preview glow">
          {p.notice && <div class="alert" role="alert"><b>{p.notice.text}</b>{p.notice.reasons?.map((r: Reason) => <div key={r.code + r.text}>{r.hard ? '⛔' : '🔒'} {r.text}</div>)}{p.notice.reasons?.some((r: Reason) => !r.hard) && <button class="ghost" onClick={() => p.go('scan')}>Open Hardware</button>}</div>}
          {latest ? <>
            {latest.status === 'done' ? <div class="outs">{latest.outputs.map(o => <Img key={o.index} job={latest} idx={o.index} />)}</div> : latest.status === 'failed' || latest.status === 'interrupted' || latest.status === 'cancelled' ? <div class="alert"><b>{latest.status === 'failed' ? 'Generation failed' : latest.status}</b><div>{latest.error ?? latest.message}</div></div> : <div class="spin" role="status" aria-label="Generating" />}
            {latest.status === 'done' && !latest.mock && !latest.video && latest.outputs[0]?.mime === 'image/png' && <SaveAsCharacter key={latest.id} jobId={latest.id} character={(latest as any).character ?? p.ch} seed={latest.seed} />}
            <div class="prog" aria-hidden="true"><i style={{ width: latest.progress + '%' }} /></div>
            <small class="muted">{latest.status}{latest.message ? ' · ' + latest.message : ''} · {latest.label}{latest.mock ? ' · MOCK (placeholder image, not AI)' : ''}{latest.unsupported ? ' · unsupported settings' : ''}</small>
          </> : <p class="muted">Pick a character, then press Generate.</p>}
        </div>
        <div class="row">{!video && <button class="primary wide" disabled={!!busy} onClick={p.generate}>{busy ? `Generating… ${latest.progress}%` : 'Generate image'}</button>}
          {busy && <button class="ghost" onClick={() => api('POST', `/api/jobs/${latest.id}/cancel`, {})}>Cancel</button>}</div>
      </div>
      <div class="card wide3"><h2>Results {jobs.length ? `· ${jobs.length}` : ''}</h2>
        {jobs.length === 0 ? <p class="muted">No results yet.</p> : <div class="gal">{jobs.slice(0, 24).map(j => <div class="gi" key={j.id}>
          {j.status === 'done' && j.outputs[0] ? <Img job={j} idx={0} /> : <div class="imgph"><small>{j.status}</small></div>}
          <small>{j.label}</small>
          {(j.status === 'failed' || j.status === 'interrupted' || j.status === 'cancelled') && <button class="ghost tiny" onClick={() => api('POST', `/api/jobs/${j.id}/retry`, {}).catch(() => {})}>Retry</button>}
        </div>)}</div>}
      </div>
    </section>
  );
}
