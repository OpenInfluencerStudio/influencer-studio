import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from './api';

export const WALK_KEY = 'is_walkthrough_done';
const ISSUES = 'https://github.com/OpenInfluencerStudio/influencer-studio/issues/new';
export const issueUrl = (version: string) => `${ISSUES}?labels=prelaunch&title=${encodeURIComponent('[' + version + '] ')}`;

/** Opens GitHub's new-issue page in a new tab. A plain link: nothing is sent from the app, the user decides what to paste. */
export function FeedbackLink({ version, cls, short }: { version: string; cls?: string; short?: boolean }) {
  return <a class={cls ?? 'chip'} href={issueUrl(version)} target="_blank" rel="noopener noreferrer" id="feedback-link" title="Send feedback / report issue. Opens GitHub in a new tab; nothing is sent from the app." aria-label="Send feedback / report issue">{short ? 'Feedback' : 'Send feedback / report issue'}</a>;
}

type Diag = { version: string; channel: string; generatedAt: string; report: string; runtime: { node: string; platform: string; arch: string; mock: boolean };
  hardware: { os: string; gpus: { name: string; vramGb: number }[]; ramGb: number; freeDiskGb: number | null; tier: string; tierLabel: string; customActive: boolean; notes: string[] };
  comfy: { online: boolean; address: string; device?: string; vramTotalGb?: number; vramFreeGb?: number };
  models: { id: string; label: string; variants: { label: string; state: string; installed: boolean; sizeGb: number; license: string }[] }[]; modelsFolder: string };

export function About(p: any) {
  const [d, setD] = useState<Diag | null>(null); const [err, setErr] = useState(''); const [copied, setCopied] = useState(false); const ta = useRef<HTMLTextAreaElement>(null);
  const load = () => api<Diag>('GET', '/api/diagnostics').then(setD).catch(e => setErr((e as Error).message));
  useEffect(() => { load(); }, []);
  const copy = async () => {
    if (!d) return;
    try { await navigator.clipboard.writeText(d.report); } catch { ta.current?.select(); document.execCommand?.('copy'); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };
  const ver = d?.version ?? p.opts.version ?? '';
  return (
    <div class="grid2" id="about-page">
      <section class="card" aria-labelledby="ab-h">
        <h2 id="ab-h">Influencer Studio</h2>
        <p class="muted">Version <b id="version-stamp">{ver}</b> {d && <span class="chip">{d.channel} build</span>}</p>
        <p>This is a pre-launch test build. Thank you for trying it. Anything odd, broken or confusing is useful to hear about.</p>
        <p><FeedbackLink version={ver} cls="primary linkbtn" /></p>
        <p class="muted">Opens GitHub in a new tab. The app never sends anything by itself: no telemetry, no analytics. To include details, press <b>Copy report</b> and paste it into the issue.</p>
        <p><button class="chip" id="show-walkthrough" onClick={() => p.setWalk(true)}>Show the quick tour again</button></p>
      </section>
      <section class="card" aria-labelledby="dg-h">
        <h2 id="dg-h">Diagnostics</h2>
        {err && <p class="err" role="alert">{err}</p>}
        {!d && !err && <p class="muted">Checking…</p>}
        {d && <>
          <table class="kv"><tbody>
            <tr><td>App</td><td>{d.version}</td></tr>
            <tr><td>System</td><td>{d.hardware.os} · Node {d.runtime.node}</td></tr>
            <tr><td>GPU</td><td>{d.hardware.gpus.map(g => `${g.name} (${g.vramGb} GB)`).join(', ') || 'none found'}</td></tr>
            <tr><td>RAM / free disk</td><td>{d.hardware.ramGb} GB / {d.hardware.freeDiskGb ?? 'unknown'} GB</td></tr>
            <tr><td>Hardware level</td><td>{d.hardware.tier}{d.hardware.customActive ? ' (Custom)' : ''}</td></tr>
            <tr><td>Generator</td><td>{d.runtime.mock ? 'Mock (placeholder images)' : d.comfy.online ? `ComfyUI online${d.comfy.device ? ' · ' + d.comfy.device : ''}` : 'ComfyUI offline'}</td></tr>
            <tr><td>Models folder</td><td>{d.modelsFolder}</td></tr>
          </tbody></table>
          <h3>Model status</h3>
          <ul class="dmodels">{d.models.flatMap(m => m.variants.map(v => <li key={m.id + v.label}>{m.label} · {v.label}: <b>{v.installed ? 'installed' : 'not installed'}</b> <span class="muted">({v.state})</span></li>))}</ul>
          <h3>Report to copy</h3>
          <textarea ref={ta} id="diag-report" readOnly rows={10} value={d.report} aria-label="Diagnostics report" />
          <p><button class="primary" id="copy-report" onClick={copy}>{copied ? 'Copied ✓' : 'Copy report'}</button> <button class="ghost" onClick={load}>Refresh</button></p>
          <p class="muted">The report has no file paths, user names, prompts or images.</p>
        </>}
      </section>
    </div>
  );
}

const STEPS: { title: string; body: string; screen?: string }[] = [
  { title: 'Welcome to the pre-launch build', body: 'Influencer Studio runs on your own PC. This 1-minute tour shows where things are. You can skip it any time and reopen it from About.' },
  { title: '1 · Hardware', body: 'The Hardware screen scans your PC and picks a level (Minimal to Max). It locks what your PC cannot run and says why. Advanced lets you unlock things at your own risk, and Custom is for unusual setups.', screen: 'scan' },
  { title: '2 · Character', body: 'Build a character from photos of every option. The Realism ↔ Ridiculous slider and the silly preset pack add fun options. Press Preview for a real example image.', screen: 'builder' },
  { title: '3 · Generate', body: 'Generate images (or short videos in Video mode) from your character. Results stay on your PC.', screen: 'generate' },
  { title: '4 · Models', body: 'See which AI models are installed and download the ones that fit your PC, after you accept each licence. Nothing downloads without you.', screen: 'models' },
  { title: '5 · Tell us what you find', body: 'Use "Send feedback / report issue" in the top bar. On the About screen, "Copy report" gives a private-path-free summary to paste. The app sends nothing by itself.', screen: 'about' },
];
export function Walkthrough({ go, close }: { go: (s: any) => void; close: (done: boolean) => void }) {
  const [i, setI] = useState(0); const ref = useRef<HTMLDivElement>(null); const st = STEPS[i]; const last = i === STEPS.length - 1;
  useEffect(() => { ref.current?.querySelector<HTMLElement>('button.primary')?.focus(); }, [i]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(true); return; }
      if (e.key === 'Tab' && ref.current) { const f = Array.from(ref.current.querySelectorAll<HTMLElement>('button')); const a = document.activeElement; if (!f.length) return; if (e.shiftKey && a === f[0]) { f[f.length - 1].focus(); e.preventDefault(); } else if (!e.shiftKey && a === f[f.length - 1]) { f[0].focus(); e.preventDefault(); } }
    };
    document.addEventListener('keydown', onKey); return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);
  const to = (n: number) => { setI(n); const s = STEPS[n].screen; if (s) go(s); };
  return (
    <div class="walk-back" id="walkthrough">
      <div class="walk" role="dialog" aria-modal="true" aria-labelledby="walk-h" ref={ref}>
        <p class="muted walk-n">Step {i + 1} of {STEPS.length}</p>
        <h2 id="walk-h">{st.title}</h2><p>{st.body}</p>
        <div class="walk-dots" aria-hidden="true">{STEPS.map((_, k) => <i key={k} class={k === i ? 'on' : ''} />)}</div>
        <div class="walk-btns">
          <button class="ghost" id="walk-skip" onClick={() => close(true)}>Skip tour</button>
          <span style="flex:1" />
          {i > 0 && <button class="ghost" onClick={() => to(i - 1)}>Back</button>}
          {last ? <button class="primary" id="walk-done" onClick={() => close(true)}>Done</button> : <button class="primary" id="walk-next" onClick={() => to(i + 1)}>Next</button>}
        </div>
      </div>
    </div>
  );
}
