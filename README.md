# Influencer Studio

A simple, local, open-weights influencer content studio for ComfyUI. Build a character with a deep visual builder (Type, Body size, hair, outfit, face and more), and generate images on your own computer. Everything is SFW, adults only and fully clothed. Nothing leaves your machine.

Status: **early milestone (0.1)**. See "What works today" below.

Follow along on X: [@OpenInflStudio](https://x.com/OpenInflStudio)

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
| `INFLUENCER_STUDIO_MOCK` | off | `1` = **mock generator**: draws labelled placeholder images, no AI. For trying the UI without a GPU or ComfyUI. |

Try it with no GPU: `INFLUENCER_STUDIO_MOCK=1 npm start`.

## What works today

- Hardware scan on launch (GPU and VRAM through `nvidia-smi`, RAM, free disk, OS), graceful when there is no GPU. Mapped to tiers T0 to T9 from `data/limits.json`.
- Hardware locks: options your PC cannot run are greyed with the real numbers ("Needs 12 GB VRAM (you have 8 GB)"). The Advanced setting "Unlock unsupported options at my own risk" releases soft limits; hard limits (no GPU, missing files, disk full, ComfyUI offline) always stay on. The server checks every job.
- `models.json` registry: licence, source, sha256, per-variant VRAM and RAM tiers, best-fitting file suggested automatically.
- Character builder with Type (Man, Woman, Non-binary, Trans woman, Trans man, Alien, Monster; default "Surprise me"), species for Alien and Monster, six Body sizes, age (21+), hair, face, outfit and more, shuffle with per-section locks, presets and a saved library.
- Prompt compiler with safety rules (adults only, fully clothed, respectful wording, blocked-terms filter) and golden snapshot tests.
- Job queue (saved to disk, progress over server-sent events), ComfyUI client, bundled workflow template (FLUX.2 klein text-to-image) with parameter slots only.
- Local security: loopback only, per-session token, Origin and Host checks, strict CSP, input validation, no outgoing network calls except to your ComfyUI.

## Not built yet

Video, motion transfer, lip-sync, audio, camera and look presets, in-app model downloads, generated preview thumbnails (the builder uses simple drawn previews), step-by-step progress from ComfyUI (progress is coarse), packaging for Windows, macOS and Linux.

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
