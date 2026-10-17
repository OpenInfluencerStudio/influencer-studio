import { useState, useEffect } from 'preact/hooks';
import { pick } from './modelsel';
import { api, ApiError, fetchBlobUrl } from './api';
import { RefThumb } from './SameCharacter';

type Opt = { id: string; label: string };
type Lib = { id: string; name: string; character: Record<string, any>; refImage?: string };
type Src = { key: string; label: string; character: Record<string, any>; refId?: string; jobId?: string };

function JobThumb({ id }: { id: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => { let u = ''; let dead = false; fetchBlobUrl(`/api/outputs/${id}/0`).then(x => { u = x; if (!dead) setUrl(x); else URL.revokeObjectURL(x); }).catch(() => {}); return () => { dead = true; if (u) URL.revokeObjectURL(u); }; }, [id]);
  return url ? <img class="refthumb" src={url} alt="Recent result" loading="lazy" decoding="async" /> : <div class="refthumb ph" aria-hidden="true" />;
}

/** Video mode: animate a saved character picture or a recent result with Wan 2.2 TI2V-5B. Durations and sizes are capped by the hardware tier. */
export function VideoCard({ msel, schema, opts, jobs, unlocked, adv, setNotice, go }: { msel: string[] | null; schema: any; opts: any; jobs: any[]; unlocked: boolean; adv: boolean; setNotice: (n: any) => void; go: (s: any) => void }) {
  const vs = schema.video; const tier = opts.tier;
  const model = opts.models.find((m: any) => m.id === 'wan22-ti2v-5b'); const variant = model?.variants?.[0];
  const hard = variant?.state === 'blocked_hard';
  const [lib, setLib] = useState<Lib[]>([]);
  const [sel, setSel] = useState('');
  const [motion, setMotion] = useState('gentle'); const [camera, setCamera] = useState('static');
  const [seconds, setSeconds] = useState(2); const [size, setSize] = useState(640); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api<Lib[]>('GET', '/api/characters').then(l => setLib(l.filter(x => x.refImage))).catch(() => {});
  useEffect(() => { load(); window.addEventListener('lib', load); return () => window.removeEventListener('lib', load); }, []);
  const recent = jobs.filter(j => j.status === 'done' && !j.mock && j.outputs[0]?.mime === 'image/png' && !j.edit).slice(0, 6);
  const srcs: Src[] = [
    ...lib.map(c => ({ key: 'lib:' + c.id, label: c.name, character: c.character, refId: c.refImage })),
    ...recent.map(j => ({ key: 'job:' + j.id, label: j.label, character: j.character ?? {}, jobId: j.id })),
  ];
  const cur = srcs.find(s => s.key === sel) ?? srcs[0];
  const frames = (s: number) => s * 24 + 1;
  const cap = tier.maxVideoFrames, pxCap = tier.maxVideoPx;
  const run = async () => {
    if (!cur) return; setBusy(true); setNotice(null);
    try {
      let refId = cur.refId;
      if (!refId && cur.jobId) refId = (await api('POST', '/api/refs/from-job', { jobId: cur.jobId, index: 0 })).id;
      const video: any = { refId, motion, camera, seconds, size, ...(note.trim() ? { note: note.trim() } : {}) };
      const pk = pick(opts.models, msel, unlocked, 'video'); if (pk.blocked) { setNotice({ text: pk.blocked }); return; }
      await api('POST', '/api/jobs', { ...(pk.variantId ? { variantId: pk.variantId } : {}), character: cur.character && Object.keys(cur.character).length ? cur.character : { type: 'surprise' }, video });
    } catch (e) { const a = e as ApiError; setNotice({ text: a.message, reasons: a.body?.reasons }); }
    finally { setBusy(false); }
  };
  const pills = (label: string, list: Opt[], val: string, set: (v: string) => void) => <div class="field"><h3>{label}</h3><div class="pills" role="radiogroup" aria-label={label}>
    {list.map(o => <button key={o.id} role="radio" aria-checked={val === o.id} class={'pillb' + (val === o.id ? ' on' : '')} onClick={() => set(o.id)}>{o.label}</button>)}</div></div>;
  return (
    <div class="card" id="video-card">
      <h2>🎬 Make a video</h2>
      <p class="muted small">Bring a picture to life with a short motion (Wan 2.2 TI2V-5B, no audio).</p>
      {hard && <div class="alert" role="status"><b>Not ready on this PC</b>{variant.reasons.map((r: any) => <div key={r.text}>⛔ {r.text}</div>)}<button class="ghost" onClick={() => go('models')}>Open Models</button></div>}
      {srcs.length === 0 ? <p class="muted">Make a picture first, then it shows up here to animate. Saving it as a character keeps it.</p> : <>
        <h3>Picture to animate</h3>
        <div class="lib" role="radiogroup" aria-label="Picture to animate">{srcs.map(s => <button key={s.key} role="radio" aria-checked={cur?.key === s.key} class={'libb' + (cur?.key === s.key ? ' on' : '')} onClick={() => setSel(s.key)}>{s.refId ? <RefThumb id={s.refId} alt={s.label} /> : <JobThumb id={s.jobId!} />}<span>{s.label}</span></button>)}</div>
        {pills('Motion', vs.motions, motion, setMotion)}
        {pills('Camera', vs.cameras, camera, setCamera)}
        <div class="field"><h3>Length</h3><div class="chips">{vs.seconds.map((s: number) => { const lk = frames(s) > cap && tier.id !== 'T0'; const dis = lk && !unlocked; return <button key={s} class={'chip' + (seconds === s ? ' on' : '') + (lk ? ' locked' : '')} disabled={dis} aria-disabled={dis} title={lk ? `${frames(s)} frames is above the ${cap} frame limit for tier ${tier.id}` : ''} onClick={() => setSeconds(s)}>{lk ? (unlocked ? '⚠ ' : '🔒 ') : ''}{s} s</button>; })}</div></div>
        <div class="field"><h3>Size (long side)</h3><div class="chips">{vs.sizes.map((px: number) => { const lk = px > pxCap && tier.id !== 'T0'; const dis = lk && !unlocked; return <button key={px} class={'chip' + (size === px ? ' on' : '') + (lk ? ' locked' : '')} disabled={dis} aria-disabled={dis} title={lk ? `${px} px is above the ${pxCap} px limit for your hardware tier ${tier.id}` : ''} onClick={() => setSize(px)}>{lk ? (unlocked ? '⚠ ' : '🔒 ') : ''}{px}</button>; })}</div></div>
        {adv && <div class="field"><h3>Extra detail (optional)</h3><input class="txt" maxLength={200} value={note} placeholder="for example: near a window" onInput={e => setNote((e.target as HTMLInputElement).value)} /></div>}
        <p class="muted small">About 1 minute on a 16 GB card once the models are loaded (the first run takes several minutes). {tier.estimated ? 'Limits for your tier are estimates.' : ''}</p>
        <button class="primary wide" disabled={busy || !cur || hard} onClick={run}>{busy ? 'Sending…' : 'Make video'}</button>
      </>}
    </div>
  );
}
