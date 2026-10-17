import { useState, useEffect } from 'preact/hooks';
import { api, ApiError } from './api';

const PREC = [['auto', 'Automatic'], ['bf16', 'BF16'], ['fp16', 'FP16'], ['fp8', 'FP8'], ['gguf-q8', 'GGUF Q8'], ['gguf-q6', 'GGUF Q6'], ['gguf-q5', 'GGUF Q5'], ['gguf-q4', 'GGUF Q4']];
const NUM: [string, string, number, number][] = [['vramGb', 'VRAM (GB)', 1, 1024], ['ramGb', 'System RAM (GB)', 4, 4096], ['maxImagePx', 'Max image size, long side (px)', 256, 16384], ['maxVideoPx', 'Max video size, long side (px)', 256, 8192], ['maxVideoSeconds', 'Max video length (seconds)', 1, 60], ['maxBatch', 'Max batch size', 1, 64], ['maxRefs', 'Max reference images', 1, 16], ['maxSteps', 'Max steps', 1, 200]];

/** Custom hardware level: type your own numbers. An explicit override; hard limits (missing files, disk, ComfyUI offline) stay on. */
export function CustomPanel({ onDone, adv }: { onDone: () => void; adv: boolean }) {
  const [c, setC] = useState<any>(null); const [msg, setMsg] = useState(''); const [bad, setBad] = useState(false);
  useEffect(() => { api<any>('GET', '/api/custom').then(r => setC({ ...r.profile, enabled: true })).catch(e => setMsg(e.message)); }, []);
  if (!c) return <p class="muted" role="status">{msg || 'Loading…'}</p>;
  const set = (k: string, v: unknown) => setC({ ...c, [k]: v });
  const save = async (enabled: boolean) => {
    try { const body = { ...c, enabled }; if (!body.comfyUrl) delete body.comfyUrl; if (!body.modelsDir) delete body.modelsDir; await api('POST', '/api/custom', body); setBad(false); setMsg(enabled ? 'Saved. Custom numbers are on.' : 'Saved. Custom numbers are off.'); onDone(); }
    catch (e) { setBad(true); setMsg((e as ApiError).message); }
  };
  const exp = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' })); a.download = 'influencer-studio-custom-profile.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const imp = async (f: File | undefined) => { if (!f) return; try { if (f.size > 20000) throw new Error('That file is too big to be a profile.'); const j = JSON.parse(await f.text()); setC({ ...j, enabled: true }); setBad(false); setMsg('Profile loaded. Check the numbers, then press Save and turn on.'); } catch (e) { setBad(true); setMsg('Could not read that file: ' + (e as Error).message); } };
  return <div class="custom" role="group" aria-label="Custom hardware settings">
    <h3>Custom hardware</h3>
    <p class="muted small">Type the numbers for your machine. They replace the scan, count as your own override like the Advanced unlock, and are checked on the server. Missing files, low disk and ComfyUI being offline still block.</p>
    <div class="cgrid">{NUM.map(([k, l, lo, hi]) => <label key={k} class="cf"><span>{l}</span><input type="number" min={lo} max={hi} step="any" value={c[k]} onInput={e => set(k, Number((e.target as HTMLInputElement).value))} /></label>)}
      <label class="cf"><span>Precision / quant</span><select value={c.precision} onChange={e => set('precision', (e.target as HTMLSelectElement).value)}>{PREC.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label class="cf"><span>Profile name</span><input type="text" maxLength={40} value={c.name} onInput={e => set('name', (e.target as HTMLInputElement).value)} /></label>
      <label class="cf wide"><span>ComfyUI address (this computer by default)</span><input type="text" placeholder="http://127.0.0.1:8288" value={c.comfyUrl ?? ''} onInput={e => set('comfyUrl', (e.target as HTMLInputElement).value)} /></label>
      <label class="cf wide"><span>Models folder (full path)</span><input type="text" value={c.modelsDir ?? ''} onInput={e => set('modelsDir', (e.target as HTMLInputElement).value)} /></label>
      <label class="cf wide"><span>Notes</span><input type="text" maxLength={300} value={c.notes} onInput={e => set('notes', (e.target as HTMLInputElement).value)} /></label></div>
    {adv ? <label class="cf chk"><input type="checkbox" checked={c.allowRemoteComfy} onChange={e => set('allowRemoteComfy', (e.target as HTMLInputElement).checked)} /> Allow a ComfyUI on another computer (needs Unlock unsupported options)</label> : <p class="muted small">A ComfyUI on another computer needs Advanced (top right).</p>}
    <div class="row"><button class="primary" onClick={() => save(true)}>Save and turn on</button><button class="ghost" onClick={() => save(false)}>Save and turn off</button><button class="ghost" onClick={exp}>Export JSON</button>
      <label class="ghost filebtn">Import JSON<input type="file" accept="application/json,.json" hidden onChange={e => imp((e.target as HTMLInputElement).files?.[0])} /></label></div>
    <p class={bad ? 'warn' : 'muted small'} role={bad ? 'alert' : 'status'}>{msg}</p></div>;
}
