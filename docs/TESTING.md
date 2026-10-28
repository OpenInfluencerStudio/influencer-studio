# Influencer Studio 0.2.0-prelaunch: test checklist

Goal: find what is broken, confusing or ugly before launch. Tick what you try; note anything odd.
Everything stays on your PC. The app sends nothing by itself (no telemetry).

## How to report an issue
1. Open **About** (top bar) and press **Copy report** (it contains no file paths, user names, prompts or images).
2. Press **Feedback** in the top bar, or **Send feedback / report issue** on About. GitHub opens in a new tab.
3. Say: what you did, what you expected, what happened, a screenshot if useful. Paste the report.
Good titles: `[0.2.0-prelaunch] Hardware: Custom panel rejects 24 GB`. Label: `prelaunch`.

## 0. Start-up (2 min)
- [x] Launch from the desktop shortcut. A console window stays open, the browser opens by itself.
- [x] Tab title "Influencer Studio" and the lime logo icon show. Header shows `v0.2.0-prelaunch`.
- [x] First-run quick tour appears, **Next/Back/Skip/Esc** work, it does not return after a restart, About > "Show the quick tour again" reopens it.
- [x] Closing the console window stops the app.

## 1. Hardware screen
- [x] Scan shows your GPU, VRAM, RAM, free disk and a level name (Minimal ... Max).
- [x] The three model rows (FLUX.2 klein 4B, Qwen-Image-Edit, Wan 2.2 TI2V-5B) react to hover, focus, click and Space/Enter; the recommended one is pre-selected; the choice survives a reload and is used by jobs.
- [x] Locked rows say why on hover. **Advanced** toggle unlocks them with a warning.
- [x] Level picker: try each level, "My PC" returns to the detected one.
- [x] **Custom** level: enter values (VRAM, RAM, max resolution, video length, batch, precision, ComfyUI URL, models folder), save, export/import JSON. A non-local ComfyUI URL is refused unless allowed under Advanced.

## 2. Character builder
- [x] Every option has a photo (colour swatches excepted). Scroll each section: images load lazily, none broken.
- [x] Types: Man, Woman, Non-binary, Trans woman/man, Alien, Monster and the creature types. Creature types hide hair style and show creature outfit/accessory/prop tiles.
- [x] Species, body size, age, height, proportions, head shape, neck, eye shape, features, facial hair, accessories, props, shoes, expression, lighting, background, style.
- [x] **Realism <-> Ridiculous** slider moves with mouse and arrow keys. **Silly preset pack** (34): click a few.
- [x] **Preview** makes a real example image (needs ComfyUI + klein). Changing a choice marks it stale; it survives a reload.
- [x] Shuffle, Presets, Save to library, load from library.

## 3. Generate (image and video mode)
- [x] Generate with 1 and several images; progress, cancel, result grid, download.
- [x] Same character: new pose/outfit/background from a result; reference upload (PNG/JPEG/WebP).
- [x] Video mode: a short clip with Wan (only where your level allows it).
- [x] Resolution and batch options lock or unlock to match your level, with a reason.

## 4. Models
- [x] Installed/not-installed status is right. Download asks you to accept the licence, shows progress, pause/resume/cancel, verifies the file.
- [x] Models folder shows as configured (see About > Diagnostics).

## 5. About / Diagnostics
- [x] Version, hardware, ComfyUI online/offline, model status are correct.
- [x] Copy report works; paste somewhere and check for private paths (there must be none).

## 6. Safety and content
- [x] Prompts and options stay adult, clothed, non-demeaning. Try odd text in any free-text field: blocked words give a friendly message.
- [x] Report any image that looks unsuitable, with the settings used.

## Per hardware level: what to expect (test the level you have; use **Custom** or the level picker to see the lock behaviour of others)
| Level | Roughly | Expect |
|---|---|---|
| Minimal | no usable GPU / under 4 GB | Generation locked with a reason; builder, About, diagnostics work |
| Basic | 4-6 GB | Small images only, smallest model variants |
| Standard | 8 GB | Images at moderate size, klein small variants; no video |
| Enhanced | 10-12 GB | klein full, Qwen edit lightning variants |
| Pro | 16 GB | klein bf16, Qwen GGUF, short video (Wan 5B) |
| Elite / Mega | 24-32 GB | larger resolutions and batches |
| Ultra / Extreme / Max | 48-96 GB+ | highest caps; use Custom for beyond |
Check on your level: first Preview time, a normal image, batch of 4, a video, a restart (state kept), switching level up and down (locks and reasons change, nothing crashes).

## 7. Packaging
- [x] Windows zip: extract anywhere (avoid Program Files), run `start.bat`, or run `Create desktop shortcut.bat` once.
- [x] Linux: `tar xzf`, `./start.sh`.
- [x] Data is kept in your user data folder, not in the app folder; deleting the app folder does not lose your library.

## Known limits (do not report)
- Plan-only: signed model catalogue / update checks (not built), Launch website (not built).
- Mock generator banner means ComfyUI is not connected: images are placeholders.

## 8. Phase 1 Automated & Live Verification Summary (2026-10-28, Europe/London)
- [x] **Unit & integration test suite**: 25 test files, 196 tests passing (`npm test`).
- [x] **About screen Comfy Developer Platform badge**: `#platform-badge` shows `Built on the Comfy Developer Platform — Comfy SDK 0.5.0 (Comfy API v2 via comfy-api-proxy)` plus live proxy/ComfyUI status from `/api/health` and Diagnostics table `Platform` row.
- [x] **Finer live SDK step progress**: `SdkEngine.run()` streams live sampler step progress (`Drawing, step 1 of 4` -> `step 2 of 4` -> `step 3 of 4` -> `step 4 of 4` -> `Finishing the picture` -> `Fetching the result` -> `done`) monotonically from `@comfyorg/sdk` `Progress` events.
- [x] **Silly preset hero regeneration (6/6)**: `disco_moth`, `stair_step_steve`, `banana_detective`, `unicorn_hair`, `curly_toe_queen`, and `spring_steps` regenerated on <your-pc> (`127.0.0.1:8288`), visually verified, and shipped in `assets/previews/presets/*.webp` (<= 48 KB each).
- [x] **Windows managed-proxy start/stop test on <your-pc>**: `app/server.mjs` started its own `comfy-api-proxy.exe` on `http://127.0.0.1:8191` fronting `http://127.0.0.1:8288`, rejected unauthenticated `POST /api/v2/jobs` with `401`, completed a live FLUX.2 klein 4B job with step-by-step progress, and cleanly stopped only its own proxy PID on exit.
- [x] **Windows one-step ComfyUI installer (`comfyui/install-comfyui.ps1`) on <your-pc>**: tested `-DryRun`, `-ProxyOnly -DryRun`, `-ProxyOnly` venv install, and full portable ComfyUI `v0.42.1` + pinned `ComfyUI-GGUF` + `comfy-api-proxy==0.1.6` install in a spare folder on <your-pc>, then cleaned up.
- [x] **Playwright E2E & alignment suite**: `test-prelaunch.mjs`, `test-modelsel.mjs`, `test-builder.mjs`, `test-presets.mjs`, `test-typeswitch.mjs`, `test-tileretry.mjs`, `fallback-audit.mjs` (0 fallbacks across all 18 types at `SILLY=0` and `SILLY=4`), and `align-check.mjs` (0 findings across 4 viewports x 11 screens) all pass.
