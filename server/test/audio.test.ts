import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { startApp } from "../src/app.js";
import {
  AudioSchema,
  compileAudio,
  synthesizeMusicWav,
  synthesizeSpeechWav,
} from "../src/audio.js";
import { buildProfile } from "../src/hardware.js";
import { loadRegistry } from "../src/registry.js";
import { UnsafePromptError } from "../src/safety/index.js";
import { loadLimits } from "../src/tiers.js";
import { fillTemplate, loadTemplates } from "../src/workflows.js";

function png(w: number, h: number): Buffer {
  const crc = (b: Buffer) => { let c, x = ~0; for (const v of b) { c = (x ^ v) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; x = (x >>> 8) ^ c; } return ~x >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(Array.from({ length: Math.min(h, 4) }, () => row)))), chunk("IEND", Buffer.alloc(0))]);
}

const limits = loadLimits();
const highHw = buildProfile({ gpus: [{ index: 0, name: "Fixture RTX 4090", vramGb: 24 }], ramGb: 64, freeDiskGb: 500, source: "fixture" }, limits);

describe("Audio Section (ACE-Step 1.5 Music + Speech TTS + Video Muxing)", () => {
  it("lists ACE-Step 1.5 Turbo (MIT) and Qwen3-TTS VoiceDesign (Apache-2.0) in models.json", () => {
    const reg = loadRegistry();
    expect(reg.licenseAllowList).toContain("MIT");
    expect(reg.licenses["MIT"]?.name).toContain("MIT");

    const ace = reg.models.find((m) => m.id === "ace-step-1.5");
    expect(ace).toBeDefined();
    expect(ace?.kind).toBe("audio");
    const aceVar = reg.variants.find((x) => x.id === "acestep-1.5-turbo");
    expect(aceVar?.license).toBe("MIT");
    expect(aceVar?.template).toBe("acestep_music");
    expect(aceVar?.files.map((f) => f.name)).toEqual([
      "acestep_v1.5_turbo.safetensors",
      "qwen_0.6b_ace15.safetensors",
      "qwen_1.7b_ace15.safetensors",
      "ace_1.5_vae.safetensors",
    ]);
    for (const f of aceVar!.files) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    }

    const tts = reg.models.find((m) => m.id === "qwen3-tts-voicedesign");
    expect(tts).toBeDefined();
    expect(tts?.kind).toBe("audio");
    const ttsVar = reg.variants.find((x) => x.id === "qwen3-tts-1.7b-voicedesign-bf16");
    expect(ttsVar?.license).toBe("Apache-2.0");
  });

  it("loads acestep_music template and substitutes tags, lyrics, seconds, bpm, seed, steps, and cfg", () => {
    const tpls = loadTemplates();
    const ace = tpls.get("acestep_music");
    expect(ace).toBeDefined();
    const g = fillTemplate(ace!, {
      tags: "upbeat creator pop, warm synth",
      lyrics: "[instrumental]",
      seconds: 15,
      bpm: 120,
      seed: 12345,
      steps: 8,
      cfg: 1,
      prefix: "audio/test_acestep",
    });

    expect(g["5"]?.inputs.tags).toBe("upbeat creator pop, warm synth");
    expect(g["5"]?.inputs.lyrics).toBe("[instrumental]");
    expect(g["5"]?.inputs.bpm).toBe(120);
    expect(g["7"]?.inputs.seconds).toBe(15);
    expect(g["5"]?.inputs.duration).toBe(15);
    expect(g["8"]?.inputs.seed).toBe(12345);
    expect(g["5"]?.inputs.seed).toBe(12345);
  });

  it("compiles music and speech requests and enforces SFW safety filtering", () => {
    const m = compileAudio({
      mode: "music",
      style: "chill_lofi",
      tags: "vinyl crackle, fender rhodes",
      lyrics: "[instrumental]",
      seconds: 10,
      seed: 42,
    });
    expect(m.mode).toBe("music");
    expect(m.bpm).toBe(88);
    expect(String(m.params.tags)).toContain("chill lofi hip hop");
    expect(String(m.params.tags)).toContain("vinyl crackle, fender rhodes");

    const s = compileAudio({
      mode: "speech",
      voice: "warm_host",
      text: "Welcome back to our local creator channel!",
      seed: 7,
    });
    expect(s.mode).toBe("speech");
    expect(s.text).toBe("Welcome back to our local creator channel!");

    expect(() =>
      compileAudio({
        mode: "speech",
        voice: "warm_host",
        text: "explicit nsfw line",
        seed: 1,
      }),
    ).toThrow(UnsafePromptError);

    expect(() =>
      compileAudio({
        mode: "music",
        style: "upbeat_pop",
        lyrics: "nsfw explicit lyrics",
        seconds: 10,
        seed: 1,
      }),
    ).toThrow(UnsafePromptError);
  });

  it("synthesizes valid RIFF WAVE PCM buffers for speech and music", async () => {
    const speech = await synthesizeSpeechWav("Hello creators", "warm_host", 99);
    expect(speech.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(speech.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(speech.length).toBeGreaterThan(24000);

    const music = synthesizeMusicWav(2, 120, 99);
    expect(music.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(music.length).toBeGreaterThan(48000);
  });

  it("runs music & speech jobs via POST /api/jobs and muxes audio onto video via POST /api/jobs/:id/mux", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "is-audio-"));
    const app = await startApp({ port: 0, token: "t", dataDir: dir, uiDir: os.tmpdir(), mock: true, hardwareOverride: highHw });
    const base = `http://127.0.0.1:${app.port}`;
    const headers = {
      "content-type": "application/json",
      authorization: "Bearer t",
      origin: base,
    };

    try {
      // 1. Create a speech job
      const spRes = await fetch(base + "/api/jobs", {
        method: "POST",
        headers,
        body: JSON.stringify({
          character: { type: "female" },
          seed: 11,
          audio: {
            mode: "speech",
            voice: "warm_host",
            text: "Hello from Influencer Studio!",
            seed: 11,
          },
        }),
      });
      expect(spRes.status).toBe(202);
      const spJob = (await spRes.json()) as { id: string };

      // 2. Create a music job
      const muRes = await fetch(base + "/api/jobs", {
        method: "POST",
        headers,
        body: JSON.stringify({
          character: { type: "female" },
          seed: 22,
          audio: {
            mode: "music",
            style: "upbeat_pop",
            seconds: 5,
            seed: 22,
          },
        }),
      });
      expect(muRes.status).toBe(202);
      const muJob = (await muRes.json()) as { id: string; template: string };
      expect(muJob.template).toBe("acestep_music");

      // 3. Upload a ref and create a video job
      const refRes = await fetch(base + "/api/refs", {
        method: "POST",
        headers: { "content-type": "image/png", authorization: "Bearer t", origin: base },
        body: png(768, 1024),
      });
      const ref = (await refRes.json()) as { id: string };

      const vidRes = await fetch(base + "/api/jobs", {
        method: "POST",
        headers,
        body: JSON.stringify({
          character: { type: "female" },
          seed: 44,
          video: { refId: ref.id, motion: "gentle", camera: "static", seconds: 2, size: 480 },
        }),
      });
      expect(vidRes.status).toBe(202);
      const vidJob = (await vidRes.json()) as { id: string };

      for (let i = 0; i < 120; i++) {
        const s1 = (await (await fetch(`${base}/api/jobs/${spJob.id}`, { headers })).json()) as { status: string };
        const s2 = (await (await fetch(`${base}/api/jobs/${muJob.id}`, { headers })).json()) as { status: string };
        const s3 = (await (await fetch(`${base}/api/jobs/${vidJob.id}`, { headers })).json()) as { status: string };
        if (s1.status === "done" && s2.status === "done" && s3.status === "done") break;
        await new Promise((r) => setTimeout(r, 50));
      }

      // 4. Mux speech onto video
      const muxRes = await fetch(`${base}/api/jobs/${vidJob.id}/mux`, {
        method: "POST",
        headers,
        body: JSON.stringify({ audioJobId: spJob.id }),
      });
      expect(muxRes.status).toBe(201);
      const muxJob = (await muxRes.json()) as { status: string; outputs: { mime: string }[] };
      expect(muxJob.status).toBe("done");
      expect(muxJob.outputs[0]?.mime).toBe("video/mp4");
    } finally {
      await app.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
