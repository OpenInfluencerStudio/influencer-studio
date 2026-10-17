import { useState, useEffect } from 'preact/hooks';
import { api, ApiError, fetchBlobUrl } from './api';

type Opt = { id: string; label: string };
export type EditSchema = { poses: Opt[]; azimuths: Opt[]; elevations: Opt[]; distances: Opt[] };
type Lib = { id: string; name: string; character: Record<string, any>; refImage?: string };

/** Small picture of a saved character, loaded lazily through the authenticated API. */
export function RefThumb({ id, alt }: { id: string; alt: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => { let u = ''; let dead = false; fetchBlobUrl('/api/refs/' + id).then(x => { u = x; if (!dead) setUrl(x); else URL.revokeObjectURL(x); }).catch(() => {}); return () => { dead = true; if (u) URL.revokeObjectURL(u); }; }, [id]);
  return url ? <img class="refthumb" src={url} alt={alt} loading="lazy" decoding="async" /> : <div class="refthumb ph" aria-hidden="true" />;
}

/** Same character, new scene / outfit / pose, or a new camera angle. Uses the saved picture of a library character (Qwen-Image-Edit-2511). */
export function SameCharacter({ schema, setNotice, setErr: _x }: { schema: any; setNotice: (n: any) => void; setErr?: unknown }) {
  const es: EditSchema = schema.edit;
  const [items, setItems] = useState<Lib[]>([]);
  const [sel, setSel] = useState('');
  const [mode, setMode] = useState<'scene' | 'angle'>('scene');
  const [outfit, setOutfit] = useState(''); const [background, setBackground] = useState(''); const [pose, setPose] = useState(''); const [lighting, setLighting] = useState('');
  const [note, setNote] = useState('');
  const [az, setAz] = useState('right'); const [el, setEl] = useState('eye'); const [dist, setDist] = useState('medium');
  const [busy, setBusy] = useState(false);
  const load = () => api<Lib[]>('GET', '/api/characters').then(l => { const w = l.filter(x => x.refImage); setItems(w); setSel(s => (s && w.some(x => x.id === s) ? s : w[0]?.id ?? '')); }).catch(() => {});
  useEffect(() => { load(); window.addEventListener('lib', load); return () => window.removeEventListener('lib', load); }, []);
  const ctl = (id: string): Opt[] => schema.controls.find((c: any) => c.id === id)?.options ?? [];
  const cur = items.find(x => x.id === sel);
  const pills = (label: string, list: Opt[], val: string, set: (v: string) => void, none = false) => <div class="field"><h3>{label}</h3><div class="pills" role="radiogroup" aria-label={label}>
    {none && <button role="radio" aria-checked={val === ''} class={'pillb' + (val === '' ? ' on' : '')} onClick={() => set('')}>Keep</button>}
    {list.map(o => <button key={o.id} role="radio" aria-checked={val === o.id} class={'pillb' + (val === o.id ? ' on' : '')} onClick={() => set(o.id)}>{o.label}</button>)}</div></div>;
  const run = async () => {
    if (!cur?.refImage) return; setBusy(true); setNotice(null);
    const edit: any = mode === 'scene'
      ? { kind: 'scene', refId: cur.refImage, ...(outfit ? { outfit } : {}), ...(background ? { background } : {}), ...(pose ? { pose } : {}), ...(lighting ? { lighting } : {}), ...(note.trim() ? { note: note.trim() } : {}) }
      : { kind: 'angle', refId: cur.refImage, azimuth: az, elevation: el, distance: dist };
    try { await api('POST', '/api/jobs', { character: cur.character, edit }); }
    catch (e) { const a = e as ApiError; setNotice({ text: a.message, reasons: a.body?.reasons }); }
    finally { setBusy(false); }
  };
  return <div class="card" id="same-character">
    <h2>Same character</h2>
    {items.length === 0 ? <p class="muted">Make a picture you like, then press <b>Save as character</b> under it. Your saved characters appear here so you can put them in new scenes, outfits and camera angles.</p> : <>
      <div class="chars" role="radiogroup" aria-label="Saved character">{items.map(c => <button key={c.id} role="radio" aria-checked={sel === c.id} class={'charpick' + (sel === c.id ? ' on' : '')} onClick={() => setSel(c.id)}><RefThumb id={c.refImage!} alt={c.name} /><span>{c.name}</span></button>)}</div>
      <div class="chips" role="tablist">{(['scene', 'angle'] as const).map(m => <button key={m} role="tab" aria-selected={mode === m} class={'chip' + (mode === m ? ' on' : '')} onClick={() => setMode(m)}>{m === 'scene' ? 'New scene / outfit / pose' : 'New camera angle'}</button>)}</div>
      {mode === 'scene' ? <>
        {pills('Outfit', ctl('outfit'), outfit, setOutfit, true)}
        {pills('Place', ctl('background'), background, setBackground, true)}
        {pills('Pose', es.poses, pose, setPose, true)}
        {pills('Light', ctl('lighting'), lighting, setLighting, true)}
        <label class="lbl" for="sc-note">Extra detail (optional, up to 200 characters)</label>
        <input id="sc-note" maxLength={200} value={note} onInput={e => setNote((e.target as HTMLInputElement).value)} placeholder="for example: holding a coffee cup" />
      </> : <>
        {pills('Direction', es.azimuths, az, setAz)}
        {pills('Height', es.elevations, el, setEl)}
        {pills('Distance', es.distances, dist, setDist)}
      </>}
      <button class="primary wide" disabled={busy || (mode === 'scene' && !outfit && !background && !pose && !lighting && !note.trim())} onClick={run}>{busy ? 'Sending…' : mode === 'scene' ? 'Put them in the new scene' : 'Shoot from this angle'}</button>
      <small class="muted">Uses the saved picture of {cur?.name ?? 'the character'} as the reference. Takes about a minute on a 16 GB GPU. Adults only, SFW, fully clothed.</small>
    </>}
  </div>;
}

/** Under the latest picture: store it as a library character so it can be reused in new scenes and angles. */
export function SaveAsCharacter({ jobId, character, seed }: { jobId: string; character: Record<string, any>; seed: number }) {
  const [name, setName] = useState(''); const [msg, setMsg] = useState('');
  const save = async () => {
    try {
      const ref = await api<{ id: string }>('POST', '/api/refs/from-job', { jobId, index: 0 });
      await api('POST', '/api/characters', { name: name.trim() || 'My character', character, seed, refImage: ref.id });
      setMsg('Saved. Find it under Same character.'); window.dispatchEvent(new Event('lib'));
    } catch (e) { setMsg((e as Error).message); }
  };
  return <div class="row savebar"><input aria-label="Character name" placeholder="Name" maxLength={30} value={name} onInput={e => setName((e.target as HTMLInputElement).value)} /><button class="primary" onClick={save}>Save as character</button>{msg && <small class="muted" role="status">{msg}</small>}</div>;
}
