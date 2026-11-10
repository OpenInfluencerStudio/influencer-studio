import { useState, useEffect, useRef } from 'preact/hooks';
import { api, ApiError } from './api';

type Reason = { code: string; hard: boolean; text: string };
type VFile = { name: string; folder: string; sizeBytes: number };
type Variant = { id: string; label: string; sizeGb: number; license: string; licenseInfo: { name: string; url: string; summary: string } | null; minVramGb: number; state: string; reasons: Reason[]; installed: boolean | null; sources: string[]; downloadable: boolean; est: boolean; files: VFile[] };
type Item = { variantId: string; status: string; files: { name: string; sizeBytes: number; got: number; status: string }[]; error?: string; message?: string; speedBps?: number };
type DlState = { modelsDir: string | null; modelsDirSource: string; items: Item[] };

const gb = (n: number) => (n / 1e9).toFixed(n >= 1e10 ? 1 : 2) + ' GB';
const mb = (n: number) => (n / 1e6 >= 1000 ? (n / 1e9).toFixed(2) + ' GB' : (n / 1e6).toFixed(0) + ' MB');
const eta = (left: number, bps?: number) => { if (!bps || bps < 1000) return ''; const s = left / bps; return s > 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min left` : s > 60 ? `${Math.round(s / 60)} min left` : `${Math.round(s)} s left`; };
const STATE_TXT: Record<string, string> = { recommended: 'Recommended for your GPU', runs: 'Fits your GPU', slow: 'Slow on your PC', locked_soft: 'Locked', blocked_hard: 'Not available' };

function Licence({ v, onYes, onNo, free }: { v: Variant; onYes: () => void; onNo: () => void; free: number | null }) {
  const [ok, setOk] = useState(false); const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  const total = v.files.reduce((n, f) => n + f.sizeBytes, 0);
  return <div class="modal" role="presentation"><div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="lict" style={{ maxWidth: '520px' }}>
    <h2 id="lict">Before you download</h2>
    <p><b>{v.licenseInfo?.name ?? v.license}</b></p>
    <p class="muted">{v.licenseInfo?.summary}</p>
    {v.licenseInfo && <p class="small"><a href={v.licenseInfo.url} target="_blank" rel="noopener noreferrer">Read the full licence</a> · Model page: {v.sources.map(s => <a key={s} href={s} target="_blank" rel="noopener noreferrer">{s.replace('https://', '')}</a>)}</p>}
    <ul class="lst">{v.files.map(f => <li key={f.name}><div><b>{f.name}</b><small>{f.folder} · {mb(f.sizeBytes)}</small></div></li>)}</ul>
    <p class="small">Total {gb(total)}. Each file is checked against a stored SHA-256 checksum before it is installed.{free !== null ? ` Free space on this PC: ${free} GB.` : ''}</p>
    <label class="row"><input type="checkbox" checked={ok} onChange={e => setOk((e.target as HTMLInputElement).checked)} /> <span>I have read the licence and accept it for {v.license}.</span></label>
    <div class="row"><button ref={first} class="ghost" onClick={onNo}>Cancel</button><button class="primary" disabled={!ok} onClick={onYes}>Download {gb(total)}</button></div>
  </div></div>;
}

export function Models(p: any) {
  const [dl, setDl] = useState<DlState | null>(null);
  const [ask, setAsk] = useState<Variant | null>(null);
  const [err, setErr] = useState('');
  const [dir, setDir] = useState('');
  const prev = useRef<Record<string, string>>({});
  const load = () => api<DlState>('GET', '/api/downloads').then(s => {
    setDl(s);
    for (const i of s.items) { if (prev.current[i.variantId] && prev.current[i.variantId] !== 'done' && i.status === 'done') p.loadOpts(p.pretend); prev.current[i.variantId] = i.status; }
  }).catch(() => {});
  useEffect(() => { load(); }, []);
  const active = dl?.items.some(i => i.status === 'downloading' || i.status === 'verifying');
  useEffect(() => { const t = setInterval(load, active ? 1000 : 6000); return () => clearInterval(t); }, [active]);
  const act = async (id: string, a: 'pause' | 'resume' | 'cancel') => { setErr(''); try { await api('POST', `/api/downloads/${id}/${a}`, {}); } catch (e) { setErr((e as ApiError).message); } load(); };
  const start = async (v: Variant) => { setAsk(null); setErr(''); try { await api('POST', '/api/downloads', { variantId: v.id, acceptedLicense: v.license }); } catch (e) { setErr((e as ApiError).message); } load(); };
  const saveDir = async () => { setErr(''); try { await api('POST', '/api/settings', { models_dir: dir.trim() }); setDir(''); } catch (e) { setErr((e as ApiError).message); } load(); p.loadOpts(p.pretend); };
  const free = p.opts.profile.freeDiskGb ?? null;
  const noDir = dl && !dl.modelsDir;
  return (
    <section>
      <h1>Models</h1>
      <p class="muted">{p.opts.summary} Only models with a permissive open licence are listed. Nothing is downloaded until you read the licence and press Download.</p>
      <div class="card">
        <b>Models folder:</b> {dl?.modelsDir ? <code>{dl.modelsDir}</code> : <span class="muted">not set</span>}{dl?.modelsDirSource === 'env' && <small class="muted"> (set by the launcher)</small>}
        {dl && dl.modelsDirSource !== 'env' && dl.modelsDirSource !== 'config' && (p.adv || noDir) && <div class="row"><input class="num" style={{ width: '360px' }} aria-label="Models folder path" placeholder="Full folder path, for example C:\ComfyUI\models" value={dir} onInput={e => setDir((e.target as HTMLInputElement).value)} /><button class="ghost" disabled={dir.trim().length < 3} onClick={saveDir}>Use this folder</button></div>}
        {noDir && <p class="muted small">Pick a folder with plenty of free space (the files are large). An SSD loads models much faster than a hard disk.</p>}
      </div>
      {err && <div class="alert" role="alert"><b>{err}</b></div>}
      <div class="dl">
        {p.opts.models.flatMap((m: any) => m.variants.map((v: Variant) => {
          const it = dl?.items.find(i => i.variantId === v.id);
          const live = it && it.status !== 'done';
          const blockers = v.reasons.filter(r => r.code !== 'FILE_MISSING' && !(!r.hard && p.unlocked));
          const lk = blockers.length > 0;
          const total = v.files.reduce((n, f) => n + f.sizeBytes, 0); const got = it ? it.files.reduce((n, f) => n + f.got, 0) : 0;
          const pct = it ? Math.min(100, Math.round((got / total) * 100)) : 0;
          return (
            <div key={v.id} class={'card dli' + (lk ? ' locked' : '')} aria-disabled={lk}>
              <div><b>{m.name}</b> <em>{m.kind}</em> {m.bestVariantId === v.id && <span class="badge">Suggested</span>}
                <small>{v.label} · {v.sizeGb} GB · Licence: {v.licenseInfo?.name ?? v.license} · Source: {v.sources.map(s => s.replace('https://', '')).join(', ')}</small>
                <small>Checksum: {v.downloadable ? 'SHA-256 verified on download' : 'not yet verified, cannot be downloaded'} · {v.est ? 'hardware numbers are estimates' : 'measured on the reference PC'}</small></div>
              <div><span class={'state ' + v.state}>{v.state === 'locked_soft' || v.state === 'blocked_hard' ? '🔒 ' : '✓ '}{STATE_TXT[v.state]}</span>{v.reasons.map(r => <small key={r.text} class="rsn">{r.text}</small>)}
                {live && it && <div class="dlp"><div class="prog" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }} /></div>
                  <small>{it.status === 'verifying' ? (it.message ?? 'Checking files') : it.status === 'paused' ? `Paused · ${pct}% (${gb(got)} of ${gb(total)})` : it.status === 'error' ? '' : `${pct}% · ${gb(got)} of ${gb(total)} · ${it.speedBps ? (it.speedBps / 1e6).toFixed(1) + ' MB/s' : '…'} ${eta(total - got, it.speedBps)}`}</small>
                  {it.message && it.status === 'downloading' && <small class="rsn">{it.message}</small>}
                  {it.status === 'error' && <small class="rsn" role="alert">⛔ {it.error}</small>}</div>}
              </div>
              <div class="act">
                {v.installed ? <span class="okk">✓ Installed</span> : !live ? <>
                  <span class="muted">{v.installed === null ? 'Install status unknown' : 'Not installed'}</span>
                  <button class="ghost" disabled={lk || !v.downloadable || !!noDir} title={noDir ? 'Choose a models folder first' : lk ? blockers[0].text : !v.downloadable ? 'No verified checksum yet' : ''} onClick={() => setAsk(v)}>Download</button></> : <>
                  {(it!.status === 'downloading' || it!.status === 'verifying') && <button class="ghost" onClick={() => act(v.id, 'pause')}>Pause</button>}
                  {(it!.status === 'paused' || it!.status === 'error') && <button class="primary" onClick={() => act(v.id, 'resume')}>Resume</button>}
                  <button class="ghost tiny" onClick={() => act(v.id, 'cancel')}>Cancel</button></>}
              </div>
            </div>); }))}
      </div>
      {ask && <Licence v={ask} free={free} onNo={() => setAsk(null)} onYes={() => start(ask)} />}
    </section>
  );
}
