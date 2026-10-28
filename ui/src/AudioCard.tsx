import { useState } from 'preact/hooks';
import { api, ApiError } from './api';

type StyleOpt = { id: string; label: string; blurb: string; bpm: number };
type VoiceOpt = { id: string; label: string; blurb: string };

/** Audio studio: generate background music & soundtracks with ACE-Step 1.5 (MIT) or spoken influencer voice lines (Apache-2.0 TTS), and mux audio onto generated videos. */
export function AudioCard({ schema, opts, jobs, ch, seed, setNotice, go }: { schema: any; opts: any; jobs: any[]; ch: Record<string, any>; seed: number; setNotice: (n: any) => void; go: (s: any) => void }) {
  const as = schema.audio ?? { styles: [], voices: [] };
  const styles: StyleOpt[] = as.styles ?? [];
  const voices: VoiceOpt[] = as.voices ?? [];
  const [mode, setMode] = useState<'music' | 'speech'>('music');
  const [style, setStyle] = useState(styles[0]?.id ?? 'upbeat_pop');
  const [seconds, setSeconds] = useState(10);
  const [tags, setTags] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [voice, setVoice] = useState(voices[0]?.id ?? 'warm_host');
  const [text, setText] = useState('Welcome back to the channel! Everything you see and hear was generated locally on this PC.');
  const [busy, setBusy] = useState(false);
  const [muxBusy, setMuxBusy] = useState(false);
  const [muxMsg, setMuxMsg] = useState('');

  const aceModel = opts.models.find((m: any) => m.id === 'ace-step-1.5');
  const aceVar = aceModel?.variants?.[0];
  const aceMissing = mode === 'music' && !opts.mock && aceVar && aceVar.installed === false;

  const videoJobs = jobs.filter(j => j.status === 'done' && j.outputs?.[0]?.mime?.startsWith('video/'));
  const audioJobs = jobs.filter(j => j.status === 'done' && j.outputs?.[0]?.mime?.startsWith('audio/'));
  const [selVid, setSelVid] = useState('');
  const [selAud, setSelAud] = useState('');
  const curVid = videoJobs.find(v => v.id === selVid) ?? videoJobs[0];
  const curAud = audioJobs.find(a => a.id === selAud) ?? audioJobs[0];

  const run = async () => {
    setBusy(true); setNotice(null);
    try {
      const audio: Record<string, any> = mode === 'speech'
        ? { mode: 'speech', voice, text: text.trim(), seed }
        : {
            mode: 'music',
            style,
            seconds,
            seed,
            ...(tags.trim() ? { tags: tags.trim() } : {}),
            ...(lyrics.trim() ? { lyrics: lyrics.trim() } : {}),
          };
      await api('POST', '/api/jobs', {
        character: ch && Object.keys(ch).length ? ch : { type: 'surprise' },
        seed,
        audio,
      });
    } catch (e) {
      const a = e as ApiError;
      setNotice({ text: a.message, reasons: a.body?.reasons });
    } finally {
      setBusy(false);
    }
  };

  const mux = async () => {
    if (!curVid || !curAud) return;
    setMuxBusy(true); setMuxMsg(''); setNotice(null);
    try {
      await api('POST', `/api/jobs/${curVid.id}/mux`, { audioJobId: curAud.id });
      setMuxMsg('Combined video + audio added to Results.');
    } catch (e) {
      const a = e as ApiError;
      setNotice({ text: a.message });
    } finally {
      setMuxBusy(false);
    }
  };

  return (
    <div class="card" id="audio-card" role="tabpanel" aria-labelledby="vin-audio">
      <h2>🎵 Audio Studio (Music & Speech)</h2>
      <p class="muted small">Create background music with ACE-Step 1.5 Turbo (MIT) or spoken character lines (Apache-2.0), then pair them with any generated video.</p>
      <div class="field">
        <h3>Audio type</h3>
        <div class="pills" id="audio-mode-pills" role="radiogroup" aria-label="Audio type">
          <button role="radio" aria-checked={mode === 'music'} class={'pillb' + (mode === 'music' ? ' on' : '')} onClick={() => setMode('music')}>🎵 Music & Soundtrack</button>
          <button role="radio" aria-checked={mode === 'speech'} class={'pillb' + (mode === 'speech' ? ' on' : '')} onClick={() => setMode('speech')}>🗣 Speech / Voiceover</button>
        </div>
      </div>

      {mode === 'music' ? (
        <>
          {aceMissing && (
            <div class="alert" role="status">
              <b>ACE-Step 1.5 Turbo weights not downloaded yet</b>
              <div>Download ACE-Step 1.5 Turbo (MIT) on the Models screen to generate music in ComfyUI.</div>
              <button class="ghost" onClick={() => go('models')}>Open Models</button>
            </div>
          )}
          <div class="field">
            <h3>Music style</h3>
            <div class="pills" role="radiogroup" aria-label="Music style">
              {styles.map(s => (
                <button key={s.id} role="radio" aria-checked={style === s.id} class={'pillb' + (style === s.id ? ' on' : '')} title={s.blurb} onClick={() => setStyle(s.id)}>{s.label}</button>
              ))}
            </div>
          </div>
          <div class="field">
            <h3>Length</h3>
            <div class="chips">
              {[5, 10, 15, 30].map(s => (
                <button key={s} class={'chip' + (seconds === s ? ' on' : '')} onClick={() => setSeconds(s)}>{s} s</button>
              ))}
            </div>
          </div>
          <div class="field">
            <h3>Extra style or instruments (optional)</h3>
            <input id="audio-tags" class="txt" maxLength={200} value={tags} placeholder="for example: warm analog synth lead, handclaps" onInput={e => setTags((e.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <h3>Lyrics or structure (optional — leave blank for instrumental)</h3>
            <input id="audio-lyrics" class="txt" maxLength={600} value={lyrics} placeholder="[instrumental] or [verse] Walking through the neon light" onInput={e => setLyrics((e.target as HTMLInputElement).value)} />
          </div>
          <button id="audio-generate-btn" class="primary wide" disabled={busy || !!aceMissing} onClick={run}>{busy ? 'Generating music…' : 'Make music track'}</button>
        </>
      ) : (
        <>
          <div class="field">
            <h3>Voice preset</h3>
            <div class="pills" role="radiogroup" aria-label="Voice preset">
              {voices.map(v => (
                <button key={v.id} role="radio" aria-checked={voice === v.id} class={'pillb' + (voice === v.id ? ' on' : '')} title={v.blurb} onClick={() => setVoice(v.id)}>{v.label}</button>
              ))}
            </div>
          </div>
          <div class="field">
            <h3>Line for your character to speak</h3>
            <input id="audio-speech-text" class="txt" maxLength={300} value={text} placeholder="Type a clean, safe-for-work line to speak…" onInput={e => setText((e.target as HTMLInputElement).value)} />
          </div>
          <button id="audio-generate-btn" class="primary wide" disabled={busy || !text.trim()} onClick={run}>{busy ? 'Synthesizing speech…' : 'Speak line'}</button>
        </>
      )}

      {videoJobs.length > 0 && audioJobs.length > 0 && (
        <div class="field" id="audio-mux-panel">
          <h3>Attach audio to a video clip</h3>
          <p class="muted small">Combine your generated music or spoken voiceover with a video clip into a single MP4 with sound.</p>
          <div class="row">
            <button id="audio-mux-btn" class="ghost" disabled={muxBusy} onClick={mux}>{muxBusy ? 'Combining…' : `Attach "${curAud.label.slice(0, 28)}" to "${curVid.label.slice(0, 24)}"`}</button>
            {muxMsg && <small class="muted" role="status">{muxMsg}</small>}
          </div>
        </div>
      )}
    </div>
  );
}
