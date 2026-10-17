# Influencer Studio

A simple, local, open-weights influencer content studio for ComfyUI. Build a character with a deep visual builder (Type, Body size, hair, outfit, face and more), and generate images on your own computer. Everything is SFW, adults only and fully clothed. Nothing leaves your machine.

Status: **early milestone (0.1)**. See "What works today" below.

Follow along on X: [@OpenInflStudio](https://x.com/OpenInflStudio)

## Install (no coding)

Download the package for your system from the Releases page and follow [docs/INSTALL.md](docs/INSTALL.md): unzip, start ComfyUI, double-click `start.bat` (Windows) or `start.command` / `start.sh`. Builds are unsigned for now.

## Quick start

Requires Node.js 20 or newer and a running ComfyUI with the FLUX.2 klein 4B files installed (see `models.json`).

```bash
npm install
npm run build
npm start          # prints a private link like http://127.0.0.1:8787/#t=...
```

Open the printed link in your browser. The `#t=...` part is a one-time session token; the app will not work without it.

Settings (environment variables):

| Variable | Default | Meaning |
|---|---|---|
| `COMFYUI_URL` | `http://127.0.0.1:8288` | Your ComfyUI address. Must be on this computer. |
| `PORT` | `8787` | Local port (the server only listens on `127.0.0.1`). |
| `INFLUENCER_STUDIO_MODELS_DIR` | unset | Your ComfyUI `models` folder, so installed files are detected. |
| `INFLUENCER_STUDIO_DATA` | `.runtime/` | Where settings, the job queue, the library and outputs are stored. |
| `INFLUENCER_STUDIO_PREVIEWS` | `assets/previews/` | Folder with the generated option thumbnails (webp) and `manifest.json`. Missing files fall back to drawn previews. |
| `INFLUENCER_STUDIO_MOCK` | off | `1` = **mock generator**: draws labelled placeholder images, no AI. For trying the UI without a GPU or ComfyUI. |

Try it with no GPU: `INFLUENCER_STUDIO_MOCK=1 npm start`.

## What works today

- Hardware scan on launch (GPU and VRAM through `nvidia-smi`, RAM, free disk, OS), graceful when there is no GPU. Mapped to tiers T0 to T9 from `data/limits.json`.
- Hardware locks: options your PC cannot run are greyed with the real numbers ("Needs 12 GB VRAM (you have 8 GB)"). The Advanced setting "Unlock unsupported options at my own risk" releases soft limits; hard limits (no GPU, missing files, disk full, ComfyUI offline) always stay on. The server checks every job.
- `models.json` registry: licence, source, sha256, per-variant VRAM and RAM tiers, best-fitting file suggested automatically.
- Character builder with Type (Man, Woman, Non-binary, Trans woman, Trans man, Alien, Monster; default "Surprise me"), species for Alien and Monster, six Body sizes, age (21+), hair, face, outfit and more, shuffle with per-section locks, presets and a saved library.
- Prompt compiler with safety rules (adults only, fully clothed, respectful wording, blocked-terms filter) and golden snapshot tests.
- Job queue (saved to disk, progress over server-sent events), ComfyUI client, bundled workflow templates (FLUX.2 klein text-to-image and image edit) with parameter slots only.
- Real generation through your ComfyUI, with live step-by-step progress over ComfyUI's WebSocket ("Reading your prompt", "Drawing, step 3 of 4"). Falls back to polling if the socket is not available.
- "Add style reference": drop a PNG, JPEG or WebP (up to 8 MB, checked by content, stored under a random name) and new images follow that person and look through the FLUX.2 klein edit template. Use images you have the right to use; adults only.
- Preview thumbnails: generated with FLUX.2 klein 4B on one synthetic adult per look (Man, Woman, Non-binary, Alien, Monster), webp, lazy-loaded, with drawn SVG art as the fallback for anything not generated yet. The manifest (`server/src/thumbs.ts`) lists every thumbnail with its prompt, framing and seed; `scripts/thumbs/` generates and packs them.
- Same character, new scene or angle: save a result as a library character (the picture is stored with it), then in Generate > "Same character" pick a new outfit, place, pose or light, or a new camera angle (8 directions x 3 heights x 3 distances). Runs Qwen-Image-Edit-2511 (Q4_K_M GGUF + Lightning 4-step LoRA, plus the Multiple-Angles LoRA for angles) through two bundled templates (`qwen_edit`, `qwen_angles`). Needs about 24 GB of model files and a 16 GB GPU. Measured on the reference PC (RTX 5060 Ti 16 GB, models on a slow HDD): first run about 5 minutes, repeat runs 2.5 to 3 minutes each, most of it re-reading the text encoder from the disk; put the models on an SSD to be much faster. Honest limits: face, hair, glasses, freckles and outfit colours carried over in all 7 test pictures, but camera angles are approximate (side and front-quarter views work, low angles are weak, and back views come out as a side profile).
- Video: Generate > "Make a video" animates a saved character picture or a recent result with Wan 2.2 TI2V-5B (no audio): 8 motions, 4 camera moves, 1 to 4 seconds, sizes capped by your hardware tier (locked with the real numbers, releasable with the Advanced unlock). Measured on the reference PC (RTX 5060 Ti 16 GB): 2 s at 480x640 takes about 56 s once the models are loaded and about 6 minutes the first time (models read from a hard disk); 4 s about 3 minutes; 2 s at 640x832 about 105 s. Face, hair and outfit stay stable; motion is deliberately gentle ("turns head" is subtle).
- In-app model downloads: Models screen > Download shows the licence first and needs you to accept it, checks free disk space, shows progress, speed and time left, can pause and resume (HTTP Range, also after restarting the app), verifies every file against its stored SHA-256 before installing it, and only talks to Hugging Face over HTTPS. Only licence-allow-listed models with a verified checksum can be downloaded.
- Packaging: `node scripts/package.mjs --platform win|mac|linux --arch x64|arm64` builds a folder with its own Node.js runtime, one bundled server file, the UI, workflows and thumbnails, plus a launcher that opens your browser at the private link. A GitHub Actions workflow (`.github/workflows/release.yml`) builds all platforms and runs a smoke test on each.
- Local security: loopback only, per-session token, Origin and Host checks, strict CSP, input validation. The only outgoing network calls are to your ComfyUI and, when you press Download, to Hugging Face.

## Not built yet

Motion transfer, lip-sync, audio, camera and look presets, an automatic image safety check on style references and outputs, code-signed installers, Apple GPU detection.

Honest limit: body size. With text prompts alone the model clearly separates Larger / Medium / Slim, but "Very slim" and "Extra slim" look nearly alike. Each size tile therefore shows a small silhouette badge next to the generated preview.

## Develop

```bash
npm test               # server unit, golden and HTTP tests (vitest)
npm run typecheck
npm run dev:server     # tsx watch (set INFLUENCER_STUDIO_TOKEN to keep a fixed token)
npm run dev:ui         # vite dev server (UI only)
```

Layout: `server/` (Node and TypeScript), `ui/` (Preact and Vite), `workflows/` (ComfyUI API templates plus manifests), `data/limits.json`, `models.json`.

You download the models yourself; see `models.json` and `THIRD_PARTY.md`. Guard rails are best-effort, not proof: see `SAFETY.md`.

License: Apache-2.0
