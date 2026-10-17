import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic, readJsonSafe } from './store.js';
import type { Reason } from './reasons.js';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'interrupted';
export interface JobOutput { file: string; mime: string }
export interface Job {
  id: string; createdAt: string; updatedAt: string; status: JobStatus; progress: number; message?: string;
  template: string; variantId: string; prompt: string; negative: string; seed: number; width: number; height: number; batch: number; steps?: number;
  character: Record<string, unknown>; label: string; styleRef?: string; edit?: Record<string, unknown>; video?: Record<string, unknown>; frames?: number;
  mock: boolean; unsupported: boolean; softReasons: Reason[];
  outputs: JobOutput[]; error?: string;
}
export type NewJob = Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'progress' | 'outputs'>;

export interface RunnerCtx { update: (p: number, msg?: string) => void; cancelled: () => boolean; outputsDir: string; saveOutput: (name: string, data: Buffer, mime: string) => JobOutput }
export type Runner = (job: Job, ctx: RunnerCtx) => Promise<JobOutput[]>;
/** Re-check before running (setting may have been turned off while queued). Returns reasons to cancel with, or null. */
export type Recheck = (job: Job) => Reason[] | null;

interface Persisted { schemaVersion: 1; jobs: Job[] }
const MAX_QUEUE = 50;
const MAX_KEEP = 200;

export class JobQueue extends EventEmitter {
  private jobs: Job[] = [];
  private busy = false;
  private cancelFlags = new Set<string>();
  readonly outputsDir: string;
  constructor(private file: string, outputsDir: string, private runner: Runner, private recheck: Recheck) {
    super();
    this.outputsDir = outputsDir;
    fs.mkdirSync(outputsDir, { recursive: true });
    const p = readJsonSafe<Persisted>(file, { schemaVersion: 1, jobs: [] });
    this.jobs = Array.isArray(p.jobs) ? p.jobs : [];
    // On restart, running jobs are interrupted (plan 18.4); queued jobs continue.
    for (const j of this.jobs) if (j.status === 'running') { j.status = 'interrupted'; j.message = 'The app restarted while this job was running. Retry it.'; }
    this.save();
  }
  private save() { writeJsonAtomic(this.file, { schemaVersion: 1, jobs: this.jobs.slice(-MAX_KEEP) } satisfies Persisted); }
  private touch(j: Job) { j.updatedAt = new Date().toISOString(); this.save(); this.emit('job', j); }
  list(): Job[] { return [...this.jobs].reverse(); }
  get(id: string): Job | undefined { return this.jobs.find(j => j.id === id); }
  pending(): number { return this.jobs.filter(j => j.status === 'queued' || j.status === 'running').length; }
  enqueue(n: NewJob): Job {
    if (this.pending() >= MAX_QUEUE) throw Object.assign(new Error('Queue is full'), { status: 429 });
    const now = new Date().toISOString();
    const j: Job = { ...n, id: crypto.randomUUID(), createdAt: now, updatedAt: now, status: 'queued', progress: 0, outputs: [] };
    this.jobs.push(j); this.touch(j); void this.pump();
    return j;
  }
  cancel(id: string): Job | undefined {
    const j = this.get(id); if (!j) return undefined;
    if (j.status === 'queued') { j.status = 'cancelled'; j.message = 'Cancelled'; this.touch(j); }
    else if (j.status === 'running') { this.cancelFlags.add(id); }
    return j;
  }
  /** Resume anything left queued after a restart. */
  start() { void this.pump(); }
  private async pump(): Promise<void> {
    if (this.busy) return;
    const j = this.jobs.find(x => x.status === 'queued');
    if (!j) return;
    this.busy = true;
    try {
      const blocked = this.recheck(j);
      if (blocked) { j.status = 'cancelled'; j.error = 'locked_by_hardware'; j.message = blocked.map(r => r.text).join('; '); this.touch(j); return; }
      j.status = 'running'; j.progress = 2; this.touch(j);
      const ctx: RunnerCtx = {
        update: (p, msg) => { j.progress = Math.max(j.progress, Math.min(99, Math.round(p))); if (msg) j.message = msg; this.touch(j); },
        cancelled: () => this.cancelFlags.has(j.id), outputsDir: this.outputsDir,
        saveOutput: (name, data, mime) => { const safe = `${j.id}_${name.replace(/[^A-Za-z0-9._-]/g, '_')}`; fs.writeFileSync(path.join(this.outputsDir, safe), data); return { file: safe, mime }; },
      };
      const outs = await this.runner(j, ctx);
      if (this.cancelFlags.has(j.id)) { j.status = 'cancelled'; j.message = 'Cancelled'; }
      else { j.outputs = outs; j.status = 'done'; j.progress = 100; j.message = undefined; }
    } catch (e) {
      j.status = this.cancelFlags.has(j.id) ? 'cancelled' : 'failed';
      j.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.cancelFlags.delete(j.id); this.touch(j); this.busy = false;
      setImmediate(() => void this.pump());
    }
  }
  outputPath(jobId: string, index: number): { file: string; mime: string } | null {
    const o = this.get(jobId)?.outputs[index]; if (!o) return null;
    const full = path.resolve(this.outputsDir, o.file);
    if (!full.startsWith(path.resolve(this.outputsDir) + path.sep)) return null;
    return fs.existsSync(full) ? { file: full, mime: o.mime } : null;
  }
}
