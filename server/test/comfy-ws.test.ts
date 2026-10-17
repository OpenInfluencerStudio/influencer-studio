import { describe, it, expect } from 'vitest';
import http from 'node:http';
import type net from 'node:net';
import { WebSocketServer } from 'ws';
import { ComfyProgress, ProgressTracker, type ProgressMsg } from '../src/comfy-ws.js';
import { loadTemplates, fillTemplate } from '../src/workflows.js';

const tpl = loadTemplates().get('klein_t2i')!;
const wf = fillTemplate(tpl, { prompt: 'x', width: 512, height: 512, seed: 1 });

describe('ProgressTracker (pure)', () => {
  it('moves forward monotonically through a klein run and names the steps', () => {
    const t = new ProgressTracker(wf); t.stepsHint = 4;
    const seq: ProgressMsg[] = [
      { type: 'execution_start' }, { type: 'execution_cached', nodes: [] },
      { type: 'executing', node: '1' }, { type: 'executed', node: '1' }, { type: 'executing', node: '2' }, { type: 'executed', node: '2' },
      { type: 'executing', node: '7' }, { type: 'progress', node: '7', value: 1, max: 4 }, { type: 'progress', node: '7', value: 3, max: 4 }, { type: 'executed', node: '7' },
      { type: 'executing', node: '8' }, { type: 'executed', node: '9' }, { type: 'executing', node: null },
    ];
    let last = 0; const msgs: string[] = [];
    for (const m of seq) { const r = t.feed(m); if (r) { expect(r.percent).toBeGreaterThanOrEqual(last); last = r.percent; msgs.push(r.message); } }
    expect(msgs).toContain('Loading the model'); expect(msgs.some(m => m.startsWith('Drawing, step 3 of 4'))).toBe(true); expect(last).toBe(98);
    // the sampler step fraction must carry the bar well past the halfway mark (regression: it used to stall near 20%)
    const t2 = new ProgressTracker(wf); t2.stepsHint = 4; for (const m of seq.slice(0, 8)) t2.feed(m); expect(t2.feed({ type: 'progress', node: '7', value: 4, max: 4 })!.percent).toBeGreaterThan(55);
  });
  it('cached nodes do not stall the bar', () => {
    const t = new ProgressTracker(wf);
    t.feed({ type: 'execution_cached', nodes: ['1', '2', '3'] });
    const r = t.feed({ type: 'executing', node: '7' })!; expect(r.percent).toBeLessThan(98);
  });
});

describe('ComfyProgress (real socket against a fake /ws)', () => {
  it('connects, filters by prompt id, and ignores binary/garbage', async () => {
    const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/ws' });
    wss.on('connection', (s, req) => {
      expect(req.url).toContain('clientId=cid');
      setTimeout(() => {
        s.send(JSON.stringify({ type: 'progress', data: { value: 2, max: 4, prompt_id: 'other', node: '7' } }));
        s.send(JSON.stringify({ type: 'progress', data: { value: 3, max: 4, prompt_id: 'p1', node: '7' } }));
        s.send(Buffer.from([1, 2, 3]), { binary: true }); s.send('not json');
        s.send(JSON.stringify({ type: 'executing', data: { node: null, prompt_id: 'p1' } }));
      }, 50);
    });
    await new Promise<void>(r => srv.listen(0, '127.0.0.1', r));
    const port = (srv.address() as net.AddressInfo).port;
    const p = new ComfyProgress(`http://127.0.0.1:${port}`, 'cid');
    expect(await p.connect()).toBe(true);
    const got: ProgressMsg[] = []; p.watch(() => 'p1', m => got.push(m));
    await new Promise(r => setTimeout(r, 250));
    expect(got).toEqual([{ type: 'progress', node: '7', value: 3, max: 4 }, { type: 'executing', node: null }]);
    p.close(); wss.close(); srv.closeAllConnections(); srv.close();
  });
  it('connect() resolves false when nothing listens, and remote hosts are refused', async () => {
    expect(await new ComfyProgress('http://127.0.0.1:9', 'c').connect(500)).toBe(false);
    expect(() => new ComfyProgress('http://example.com:8188', 'c')).toThrow();
  });
});
