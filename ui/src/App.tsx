import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { api, ApiError, initToken, subscribe, fetchBlobUrl } from './api';
import { Portrait, FullBody, Lazy, Avatar, SKIN, HAIRC, EYEC } from './Art';

type Screen = 'scan' | 'home' | 'builder' | 'generate' | 'models';
const NAV: [Screen, string][] = [['scan', 'Hardware'], ['home', 'Home'], ['builder', 'Character'], ['generate', 'Generate'], ['models', 'Models']];

type Opt = { id: string; label: string };
type Ctl = { id: string; title: string; ui: string; multi: boolean; maxSelected: number; applies: 'all' | 'human'; default: string | string[]; options: Opt[] };
type Schema = { types: (Opt & { human: boolean })[]; species: Record<string, Opt[]>; sizes: Opt[]; ageBands: (Opt & { age: number })[]; controls: Ctl[]; presets: Opt[] };
type Reason = { code: string; hard: boolean; text: string };
type Variant = { id: string; label: string; format: string; sizeGb: number; license: string; minVramGb: number; state: string; reasons: Reason[]; installed: boolean | null; sources: string[]; downloadable: boolean; est: boolean };
type ModelOpt = { id: string; name: string; kind: string; bestVariantId: string | null; variants: Variant[] };
type Res = { px: number; width: number; height: number; state: string; reason: string | null };
type Opts = { profile: any; pretend: string | null; realTier: string; tier: { id: string; label: string; estimated: boolean }; models: ModelOpt[]; resolutions: Res[]; settings: { unlock_unsupported: boolean }; comfyOnline: boolean; mock: boolean; summary: string };
export type Job = { id: string; status: string; progress: number; message?: string; error?: string; label: string; prompt: string; seed: number; width: number; height: number; mock: boolean; unsupported: boolean; outputs: { index: number; mime: string }[]; createdAt: string };
type Ch = Record<string, any>;

const humanType = (t: string) => t !== 'alien' && t !== 'monster';
const STATE_TXT: Record<string, string> = { recommended: 'Recommended for your GPU', runs: 'Fits your GPU', slow: 'Slow on your PC', locked_soft: 'Locked', blocked_hard: 'Not available' };

export function App() {
  const [token] = useState(initToken);
  const [screen, setScreen] = useState<Screen>('scan');
  const [adv, setAdv] = useState(false);
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
      const body: any = { character: ch, seed, width: opts.resolutions.find(r => r.px === px)!.width, height: px, batch };
      await api('POST', '/api/jobs', body);
      setSeed(Math.floor(Math.random() * 1e9)); setScreen('generate');
    } catch (e) {
      const a = e as ApiError;
      setNotice({ text: a.message, reasons: a.body?.reasons });
      setScreen('generate');
    }
  };
  const ctx = { schema, opts, adv, unlocked, setUnlock, pretend, setPretend, ch, setCh, seed, setSeed, px, setPx, batch, setBatch, jobs, generate, notice, go: setScreen, loadOpts };

  return (
    <div class={'shell' + (adv ? ' adv' : '')}>
      <header class="top">
        <div class="logo"><span class="dot" />Influencer Studio{opts.mock && <small class="mockb" title="No AI model is running; images are placeholders">MOCK GENERATOR</small>}</div>
        <nav aria-label="Main">
          {NAV.map(([k, l]) => <button key={k} class={screen === k ? 'on' : ''} aria-current={screen === k ? 'page' : undefined} onClick={() => setScreen(k)}>{l}</button>)}
        </nav>
        <div class="right">
          {unlocked && <button class="chip warnchip" onClick={() => setUnlock(false)} title="Click to lock again">Unlocked: unsupported options on</button>}
          <Toggle label="Advanced" on={adv} set={setAdv} />
          <span class="pill" title="Detected hardware">{gpu ? `${gpu.name.replace('NVIDIA ', '').replace('GeForce ', '')} · ${gpu.vramGb} GB` : 'No GPU found'} · {opts.profile.tier}</span>
        </div>
      </header>
      {!opts.comfyOnline && !opts.mock && <div class="banner" role="status">ComfyUI is offline at its configured address. You can still build characters; generation resumes when ComfyUI is running.</div>}
      <main key={screen} class="fade">
        {screen === 'scan' && <Scan {...ctx} />}
        {screen === 'home' && <Home {...ctx} />}
        {screen === 'builder' && <Builder {...ctx} />}
        {screen === 'generate' && <Generate {...ctx} />}
        {screen === 'models' && <Models {...ctx} />}
      </main>
    </div>
  );
}
type Ctx = ReturnType<typeof Object> & any;

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

function Scan(p: Ctx) {
  const { opts } = p; const pr = opts.profile;
  const [step, setStep] = useState(0); const [run, setRun] = useState(0); const [ask, setAsk] = useState(false);
  useEffect(() => { setStep(0); const t = setInterval(() => setStep(s => (s < 6 ? s + 1 : s)), 350); return () => clearInterval(t); }, [run]);
  const g = pr.gpus.find((x: any) => x.index === pr.selectedGpu);
  const rows: [string, string][] = [['Operating system', `${pr.os.platform} ${pr.os.arch}`], ['GPU', g ? g.name : 'No usable GPU found'], ['VRAM', g ? g.vramGb + ' GB' : '0 GB'], ['System RAM', pr.ramGb + ' GB'], ['Free disk', pr.freeDiskGb === null ? 'unknown' : pr.freeDiskGb + ' GB'], ['Performance tier', `${pr.tier} · ${opts.tier.label}${opts.tier.estimated ? ' (estimated)' : ''}`]];
  const rec = opts.models.filter((m: ModelOpt) => m.bestVariantId);
  const tiers = [['My PC', null], ['T0', 'T0'], ['T1', 'T1'], ['T4', 'T4'], ['T5', 'T5'], ['T9', 'T9']] as [string, string | null][];
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
        <div class="seg" role="group" aria-label="Pretend my GPU (preview only)">{tiers.map(([l, v]) => <button key={l} class={p.pretend === v ? 'on' : ''} onClick={() => p.setPretend(v)}>{l}</button>)}</div>
        {p.pretend && <p class="muted small">Preview only: you are looking at tier {p.pretend}. The server still checks every job against your real PC ({opts.realTier}).</p>}
        {p.adv ? <div class="unl"><Toggle label="Unlock unsupported options at my own risk" on={p.unlocked} set={v => (v ? setAsk(true) : p.setUnlock(false))} />
          <p class="muted small">Lets you pick models and sizes your PC probably cannot run. Hard limits (no GPU, missing files) stay on.</p>{p.unlocked && <p class="warn">Unlocked options may be very slow or crash. The server still checks each job.</p>}</div>
          : <p class="muted small">Locked items need more VRAM or RAM than this PC has. Switch on Advanced (top right) to find the unlock setting.</p>}
        {ask && <Confirm onNo={() => setAsk(false)} onYes={() => { setAsk(false); p.setUnlock(true); }} />}
        <ul class="lst">{opts.models.map((m: ModelOpt) => { const v = m.variants.find(x => x.id === m.bestVariantId) ?? m.variants[0]; const eff = p.unlocked && v.state === 'locked_soft'; return (
          <li key={m.id} class={v.state === 'locked_soft' || v.state === 'blocked_hard' ? (eff ? 'unl-on' : 'locked') : ''} aria-disabled={(v.state === 'locked_soft' && !p.unlocked) || v.state === 'blocked_hard'}>
            <span class="ico">{v.state === 'locked_soft' || v.state === 'blocked_hard' ? (eff ? '⚠' : '🔒') : '✓'}</span>
            <div><b>{m.name}</b> <em>{m.kind}</em> <StateChip s={v.state} />
              <small>{v.label} · {v.sizeGb} GB{v.reasons.length ? ' · ' + v.reasons.map(r => r.text).join('; ') : ''}{eff ? ' · Unsupported on your PC: may crash or freeze' : ''}</small></div>
          </li>); })}</ul>
        <h3>Resolution levels</h3>
        <div class="chips">{opts.resolutions.map((r: Res) => <span key={r.px} class={'chip static' + (r.state === 'locked_soft' ? ' locked' : '')} title={r.reason ?? ''}>{r.state === 'locked_soft' ? '🔒 ' : ''}{r.px} px</span>)}</div>
        <button class="primary" onClick={() => p.go('builder')}>Continue to the builder</button>
      </div>
    </section>
  );
}

function Home(p: Ctx) {
  return (
    <section class="home">
      <h1 class="hero">Create your <span class="grad">character</span></h1>
      <div class="seg big" role="group" aria-label="Mode">
        <button class="on">🖼 Image</button>
        <button disabled title="Video arrives in a later milestone">🎬 Video · Soon</button>
        <button disabled title="Coming soon">🎵 Audio · Coming soon</button>
      </div>
      <div class="prompt card glow">
        <label class="lbl" for="notes">Extra detail (optional, up to 200 characters)</label>
        <textarea id="notes" maxLength={200} placeholder="e.g. holding a coffee cup" value={p.ch.notes ?? ''} onInput={e => p.setCh({ ...p.ch, notes: (e.target as HTMLTextAreaElement).value || undefined })} />
        <div class="row"><button class="ghost" onClick={() => p.go('builder')}>Choose character</button><button class="primary" onClick={p.generate}>Generate image</button></div>
      </div>
      <p class="muted">{p.adv ? 'Advanced mode: all controls visible.' : 'Simple mode: the essentials only. Switch on Advanced (top right) for every control.'} Adults only, SFW, fully clothed.</p>
    </section>
  );
}

const SYM: Record<string, string> = { surprise: '◌', male: '♂', female: '♀', non_binary: '⚲', trans_woman: '⚧', trans_man: '⚧' };
type Section = { id: string; title: string; ui: string; options: Opt[]; multi?: boolean; max?: number };

function Builder(p: Ctx) {
  const { schema, ch, setCh } = p as { schema: Schema; ch: Ch; setCh: (c: Ch) => void };
  const [open, setOpen] = useState<Record<string, boolean>>({ type: true, species: true, bodySize: true, hairStyle: true });
  const [lock, setLock] = useState<Record<string, boolean>>({});
  const type = ch.type as string;
  const human = humanType(type);
  const secs: Section[] = [
    { id: 'type', title: 'Character type', ui: 'type', options: schema.types },
    ...(schema.species[type] ? [{ id: 'species', title: type === 'alien' ? 'Alien species' : 'Monster species', ui: 'species', options: schema.species[type] }] : []),
    { id: 'bodySize', title: 'Body size', ui: 'size', options: schema.sizes },
    { id: 'age', title: 'Age', ui: 'pill', options: schema.ageBands },
    ...schema.controls.filter(c => human || c.applies === 'all').filter(c => p.adv || !['expression', 'lighting', 'background', 'renderStyle'].includes(c.id) || true).map(c => ({ id: c.id, title: c.title, ui: c.ui, options: c.options, multi: c.multi, max: c.maxSelected })),
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
    if (s.id === 'type') { n.type = o.id; delete n.species; if (!humanType(o.id)) { /* species default applied server side */ } }
    else if (s.id === 'age') n.age = schema.ageBands.find(a => a.id === o.id)!.age;
    else if (s.multi) { const cur = (ch[s.id] as string[]) ?? []; n[s.id] = cur.includes(o.id) ? cur.filter(x => x !== o.id) : [...cur, o.id].slice(-(s.max ?? 3)); }
    else n[s.id] = o.id;
    setCh(n);
  };
  const shuffle = async () => {
    const locks = Object.keys(lock).filter(k => lock[k]);
    try { setCh(await api('POST', '/api/randomise', { character: ch, locks: locks.map(l => (l === 'age' ? 'age' : l)), seed: Math.floor(Math.random() * 4294967295), mode: 'realistic' })); } catch { /* ignore */ }
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
                    return <button key={o.id} role={s.multi ? 'checkbox' : 'radio'} aria-checked={on} class={'bt' + (on ? ' on' : '') + (flat || (s.ui === 'type' && humanType(o.id)) ? ' flat' : '')} onClick={() => choose(s, o)}>
                      {s.ui === 'type' ? (o.id === 'alien' || o.id === 'monster' ? <Lazy cls="ph"><Portrait type={o.id === 'alien' ? 'Alien' : 'Monster'} species={schema.species[o.id][0].label} zoom="bust" /></Lazy> : <span class="gsym" aria-hidden="true">{SYM[o.id]}</span>) :
                        swc ? <i class="sw" style={{ background: swc }} /> :
                          <Lazy cls="ph"><Tile s={s} o={o} look={look} size={sizeIdx} type={type} schema={schema} /></Lazy>}
                      <span class="tl">{o.label}</span>
                    </button>;
                  })}</div>)}
              </div>);
          })}
        </div>
        <div class="gbar"><button class="shuf" aria-label="Shuffle character" title="Shuffle (locked sections stay)" onClick={shuffle}>⤮</button><button class="gen-btn" onClick={p.generate}>Generate ✨</button></div>
      </aside>
      <div class="canvas">
        <div class="stage card glow">
          <div class="bigart"><FullBody {...look} size={sizeIdx} /></div>
          <div class="cap">{typeLabel}{sp ? ' · ' + sp : ''} · {schema.sizes[sizeIdx]?.label}</div>
          <SaveBar ch={ch} seed={p.seed} />
          <small class="muted">Schematic preview. Generated previews come with the thumbnail library. Adults only, SFW, fully clothed.</small>
        </div>
        <Library setCh={setCh} />
        <div class="card"><h2>Presets</h2><div class="chips">{schema.presets.map(x => <button key={x.id} class="chip" onClick={async () => setCh(await api('POST', '/api/preset', { character: ch, preset: x.id }))}>{x.label}</button>)}</div></div>
      </div>
    </section>
  );
}
function Tile({ s, o, look, size, type, schema }: { s: Section; o: Opt; look: any; size: number; type: string; schema: Schema }) {
  const L = { ...look }; const nh = !humanType(type);
  const k = s.ui;
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
function SaveBar({ ch, seed }: { ch: Ch; seed: number }) {
  const [name, setName] = useState(''); const [msg, setMsg] = useState('');
  const save = async () => { try { await api('POST', '/api/characters', { name: name || 'My character', character: ch, seed }); setMsg('Saved'); window.dispatchEvent(new Event('lib')); } catch (e) { setMsg((e as Error).message); } };
  return <div class="row savebar"><input aria-label="Character name" placeholder="Name (optional)" maxLength={30} value={name} onInput={e => setName((e.target as HTMLInputElement).value)} /><button class="primary" onClick={save}>Save to library</button>{msg && <small class="muted" role="status">{msg}</small>}</div>;
}
function Library({ setCh }: { setCh: (c: Ch) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api('GET', '/api/characters').then(setItems).catch(() => {});
  useEffect(() => { load(); window.addEventListener('lib', load); return () => window.removeEventListener('lib', load); }, []);
  return <div class="card"><h2>Saved library</h2>{items.length === 0 ? <p class="muted">Nothing saved yet.</p> : <div class="lib">{items.map(c => <div key={c.id} class="libi"><button class="libb" onClick={() => setCh(c.character)}><Avatar type={c.character.type === 'alien' ? 'Alien' : c.character.type === 'monster' ? 'Monster' : 'Human'} size={Math.max(0, ['ultra_fat', 'fat', 'medium', 'thin', 'skinny', 'stick_thin'].indexOf(c.character.bodySize))} seed={c.name.length} /><span>{c.name}</span></button><button class="ghost tiny" aria-label={'Delete ' + c.name} onClick={async () => { await api('DELETE', '/api/characters/' + c.id); load(); }}>✕</button></div>)}</div>}</div>;
}

function Img({ job, idx }: { job: Job; idx: number }) {
  const [url, setUrl] = useState('');
  useEffect(() => { let u = ''; let dead = false; fetchBlobUrl(`/api/outputs/${job.id}/${idx}`).then(x => { u = x; if (!dead) setUrl(x); else URL.revokeObjectURL(x); }).catch(() => {}); return () => { dead = true; if (u) URL.revokeObjectURL(u); }; }, [job.id, idx]);
  return url ? <img src={url} alt={`Generated image ${idx + 1}: ${job.label}`} decoding="async" loading="lazy" /> : <div class="imgph" aria-hidden="true" />;
}

function Generate(p: Ctx) {
  const { opts, jobs } = p as { opts: Opts; jobs: Job[] };
  const latest = jobs[0];
  const [prompt, setPrompt] = useState('');
  useEffect(() => { if (p.adv) api('POST', '/api/compile', { character: p.ch, seed: p.seed }).then(r => setPrompt(r.positive)).catch(() => setPrompt('')); }, [p.adv, p.ch, p.seed]);
  const busy = latest && (latest.status === 'queued' || latest.status === 'running');
  return (
    <section class="gen">
      <div class="card">
        <h2>Output</h2>
        <h3>Resolution (long side)</h3>
        <div class="chips">{opts.resolutions.map((r: Res) => { const lk = r.state === 'locked_soft'; const dis = lk && !p.unlocked; return <button key={r.px} class={'chip' + (p.px === r.px ? ' on' : '') + (lk ? ' locked' : '')} disabled={dis} aria-disabled={dis} title={r.reason ?? ''} onClick={() => p.setPx(r.px)}>{lk ? (p.unlocked ? '⚠ ' : '🔒 ') : ''}{r.px}</button>; })}</div>
        {opts.resolutions.some((r: Res) => r.state === 'locked_soft') && <p class="muted small">Locked sizes need a stronger GPU. {p.adv ? 'You can unlock them on the Hardware screen.' : 'Advanced mode shows the unlock setting.'}</p>}
        <h3>Images per run</h3>
        <div class="chips">{[1, 2, 4].map(n => <button key={n} class={'chip' + (p.batch === n ? ' on' : '')} onClick={() => p.setBatch(n)}>{n}</button>)}</div>
        {p.adv && <><h3>Seed</h3><div class="row"><input class="num" type="number" min={0} max={4294967295} value={p.seed} onInput={e => p.setSeed(Math.max(0, Math.min(4294967295, Math.floor(Number((e.target as HTMLInputElement).value) || 0))))} /><button class="ghost" onClick={() => p.setSeed(Math.floor(Math.random() * 1e9))}>🎲</button></div>
          <h3>Compiled prompt</h3><pre class="prompt-pre" tabIndex={0}>{prompt}</pre></>}
        <p class="muted small">Camera and look presets arrive in a later milestone.</p>
      </div>
      <div class="card stage2">
        <div class="preview glow">
          {p.notice && <div class="alert" role="alert"><b>{p.notice.text}</b>{p.notice.reasons?.map((r: Reason) => <div key={r.code + r.text}>{r.hard ? '⛔' : '🔒'} {r.text}</div>)}{p.notice.reasons?.some((r: Reason) => !r.hard) && <button class="ghost" onClick={() => p.go('scan')}>Open Hardware</button>}</div>}
          {latest ? <>
            {latest.status === 'done' ? <div class="outs">{latest.outputs.map(o => <Img key={o.index} job={latest} idx={o.index} />)}</div> : latest.status === 'failed' || latest.status === 'interrupted' || latest.status === 'cancelled' ? <div class="alert"><b>{latest.status === 'failed' ? 'Generation failed' : latest.status}</b><div>{latest.error ?? latest.message}</div></div> : <div class="spin" role="status" aria-label="Generating" />}
            <div class="prog" aria-hidden="true"><i style={{ width: latest.progress + '%' }} /></div>
            <small class="muted">{latest.status}{latest.message ? ' · ' + latest.message : ''} · {latest.label}{latest.mock ? ' · MOCK (placeholder image, not AI)' : ''}{latest.unsupported ? ' · unsupported settings' : ''}</small>
          </> : <p class="muted">Pick a character, then press Generate.</p>}
        </div>
        <div class="row"><button class="primary wide" disabled={!!busy} onClick={p.generate}>{busy ? `Generating… ${latest.progress}%` : 'Generate image'}</button>
          {busy && <button class="ghost" onClick={() => api('POST', `/api/jobs/${latest.id}/cancel`, {})}>Cancel</button>}</div>
      </div>
      <div class="card">
        <h2>Inputs</h2>
        {['Motion transfer', 'Lip-sync'].map(n => <div class="slot card locked" key={n}><b>🔒 {n}</b><small>Arrives in a later milestone</small></div>)}
        <div class="slot card locked"><b>🎵 Audio</b><small>Coming soon</small></div>
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

function Models(p: Ctx) {
  const { opts } = p as { opts: Opts };
  return (
    <section>
      <h1>Models</h1>
      <p class="muted">{opts.summary} Only permissively licensed models are listed. In-app downloads (progress, resume, checksum) arrive in a later milestone; for now place files in your ComfyUI model folders and set <code>INFLUENCER_STUDIO_MODELS_DIR</code> so installs are detected.</p>
      <div class="dl">
        {opts.models.flatMap((m: ModelOpt) => m.variants.map(v => { const lk = v.state === 'locked_soft' || v.state === 'blocked_hard'; return (
          <div key={v.id} class={'card dli' + (lk ? ' locked' : '')} aria-disabled={lk}>
            <div><b>{m.name}</b> <em>{m.kind}</em> {m.bestVariantId === v.id && <span class="badge">Suggested</span>}
              <small>{v.label} · {v.sizeGb} GB · Licence: {v.license} · Source: {v.sources.map(s => s.replace('https://', '')).join(', ')}</small>
              <small>Checksum: {v.downloadable ? 'sha256 listed in models.json' : 'not yet verified'} · {v.est ? 'hardware numbers are estimates' : 'measured on the reference PC'}</small></div>
            <div><StateChip s={v.state} />{v.reasons.map(r => <small key={r.text} class="rsn">{r.text}</small>)}</div>
            <div class="act"><span class="muted">{v.installed === null ? 'Install status unknown' : v.installed ? '✓ Installed' : 'Not installed'}</span><button class="ghost" disabled title="Downloads arrive in a later milestone">Download</button></div>
          </div>); }))}
      </div>
    </section>
  );
}
