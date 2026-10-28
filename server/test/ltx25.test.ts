import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { loadRegistry } from "../src/registry.js";
import { loadTemplates, fillTemplate } from "../src/workflows.js";
import { compileVideo, VideoSchema } from "../src/video.js";
import { DownloadManager } from "../src/downloads.js";
import { startApp } from "../src/app.js";
import { buildProfile } from "../src/hardware.js";
import { loadLimits } from "../src/tiers.js";

function png(w: number, h: number): Buffer {
  const crc = (b: Buffer) => { let c, x = ~0; for (const v of b) { c = (x ^ v) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; x = (x >>> 8) ^ c; } return ~x >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(Array.from({ length: Math.min(h, 4) }, () => row)))), chunk("IEND", Buffer.alloc(0))]);
}

const limits = loadLimits();
const highHw = buildProfile({ gpus: [{ index: 0, name: "Fixture RTX 4090", vramGb: 24 }], ramGb: 64, freeDiskGb: 500, source: "fixture" }, limits);

describe("LTX-2.5 Distilled (22B GGUF + native synchronized audio)", () => {
  it("registers ltx-2.5-distilled with LTX-2-Community licence and 4 SHA-256 verified files", () => {
    const reg = loadRegistry();
    expect(reg.licenseAllowList).toContain("LTX-2-Community");
    expect(reg.licenses["LTX-2-Community"]?.name).toContain("LTX-2 Community License");
    const m = reg.models.find(x => x.id === "ltx-2.5-distilled");
    expect(m).toBeDefined();
    expect(m?.license).toBe("LTX-2-Community");
    expect(m?.kind).toBe("video");
    const v = reg.variants.find(x => x.id === "ltx-2.5-22b-distilled-q4km");
    expect(v).toBeDefined();
    expect(v?.template).toBe("ltx25_i2v_audio");
    expect(v?.files).toHaveLength(4);
    expect(v?.files.map(f => f.name)).toEqual([
      "ltx-2.5-22b-distilled-Q4_K_M.gguf",
      "gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors",
      "ltx-2.5-video-vae-bf16.safetensors",
      "ltx-2.5-audio-vae-bf16.safetensors",
    ]);
  });

  it("enforces LTX-2-Community licence acceptance gate in DownloadManager", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "is-ltx-dl-"));
    const reg = loadRegistry();
    const dm = new DownloadManager(path.join(dir, "downloads.json"), reg, () => dir);
    expect(() => dm.start("ltx-2.5-22b-distilled-q4km", "Apache-2.0")).toThrow(/Read and accept the licence before downloading/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("loads ltx25_i2v_audio and ltx25_t2v_audio and synchronizes length across video + audio latents", () => {
    const tpls = loadTemplates();
    const i2v = tpls.get("ltx25_i2v_audio");
    const t2v = tpls.get("ltx25_t2v_audio");
    expect(i2v).toBeDefined();
    expect(t2v).toBeDefined();
    const wf = fillTemplate(i2v!, {
      image: "ref_test.png",
      prompt: "A woman speaking in a studio",
      negative: "blurry",
      width: 640,
      height: 640,
      length: 73,
      seed: 12345,
      prefix: "video/test_ltx25",
    });
    expect(wf["10"].inputs.length).toBe(73);
    expect(wf["12"].inputs.frames_number).toBe(73);
    expect(wf["14"].class_type).toBe("LTXVDualCFGGuider");
    expect(wf["21"].class_type).toBe("LTXVAudioVAEDecode");
    expect(wf["22"].class_type).toBe("CreateVideo");
  });

  it("compiles speech & audioPrompt into the LTX-2.5 prompt and enforces strict SFW safety filtering", () => {
    const v = VideoSchema.parse({
      refId: "00000000-0000-4000-8000-000000000001",
      motion: "gentle",
      camera: "static",
      seconds: 2,
      size: 640,
      speech: "Welcome back to the studio, today we are testing local AI video!",
      audioPrompt: "warm studio room tone, soft acoustic ambience",
    });
    const compiled = compileVideo(v);
    expect(compiled).toContain("The person speaks clearly with natural lip-sync, saying: \"Welcome back to the studio, today we are testing local AI video!\".");
    expect(compiled).toContain("Synchronized audio and sound effects: warm studio room tone, soft acoustic ambience.");

    // Reject unsafe speech or audioPrompt via validateNotes
    expect(() => compileVideo({
      ...v,
      speech: "explicit nude scene",
    })).toThrow();
    expect(() => compileVideo({
      ...v,
      audioPrompt: "nsfw adult audio",
    })).toThrow();
  });

  it("routes /api/jobs with variantId ltx-2.5-22b-distilled-q4km to ltx25_i2v_audio", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "is-ltx-job-"));
    const app = await startApp({ port: 0, token: "t", dataDir: dir, uiDir: os.tmpdir(), mock: true, hardwareOverride: highHw });
    const base = `http://127.0.0.1:${app.port}`;
    try {
      const refRes = await fetch(base + "/api/refs", {
        method: "POST",
        headers: { "content-type": "image/png", authorization: "Bearer t", origin: base },
        body: png(768, 1024),
      });
      const ref = await refRes.json() as { id: string };
      const res = await fetch(base + "/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer t", origin: base },
        body: JSON.stringify({
          character: { type: "female" },
          seed: 77,
          variantId: "ltx-2.5-22b-distilled-q4km",
          video: {
            refId: ref.id,
            motion: "gentle",
            camera: "static",
            seconds: 2,
            size: 640,
            speech: "Hello everyone, welcome to Influencer Studio!",
            audioPrompt: "warm studio room tone",
          },
        }),
      });
      expect(res.status).toBe(202);
      const job = await res.json() as { template: string; variantId: string; prompt: string };
      expect(job.template).toBe("ltx25_i2v_audio");
      expect(job.variantId).toBe("ltx-2.5-22b-distilled-q4km");
      expect(job.prompt).toContain("Hello everyone, welcome to Influencer Studio!");
      expect(job.prompt).toContain("warm studio room tone");
    } finally {
      await app.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
