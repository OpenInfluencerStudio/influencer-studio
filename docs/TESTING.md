# Influencer Studio 0.2.0-prelaunch: tester checklist

Goal: find what is broken, confusing or ugly before launch. Tick what you try; note anything odd.
Everything stays on your PC. The app sends nothing by itself (no telemetry).

## How to report an issue
1. Open **About** (top bar) and press **Copy report** (it contains no file paths, user names, prompts or images).
2. Press **Feedback** in the top bar, or **Send feedback / report issue** on About. GitHub opens in a new tab.
3. Say: what you did, what you expected, what happened, a screenshot if useful. Paste the report.
Good titles: `[0.2.0-prelaunch] Hardware: Custom panel rejects 24 GB`. Label: `prelaunch`.

## 0. Start-up (2 min)
- [ ] Launch from the desktop shortcut. A console window stays open, the browser opens by itself.
- [ ] Tab title "Influencer Studio" and the lime logo icon show. Header shows `v0.2.0-prelaunch`.
- [ ] First-run quick tour appears, **Next/Back/Skip/Esc** work, it does not return after a restart, About > "Show the quick tour again" reopens it.
- [ ] Closing the console window stops the app.

## 1. Hardware screen
- [ ] Scan shows your GPU, VRAM, RAM, free disk and a level name (Minimal ... Max).
- [ ] All seven model rows (FLUX.2 klein 4B, Z-Image-Turbo 6B, Qwen-Image-Edit-2511, Wan 2.2 TI2V-5B, LTX-2.5 22B Distilled, ACE-Step 1.5 Turbo, Qwen3-TTS 1.7B VoiceDesign) react to hover, focus, click and Space/Enter; the recommended one is pre-selected; the choice survives a reload and is used by jobs.
- [ ] Locked rows say why on hover. **Advanced** toggle unlocks them with a warning.
- [ ] Level picker: try each level, "My PC" returns to the detected one.
- [ ] **Custom** level: enter values (VRAM, RAM, max resolution, video length, batch, precision, ComfyUI URL, models folder), save, export/import JSON. A non-local ComfyUI URL is refused unless allowed under Advanced.

## 2. Character builder
- [ ] Every option has a photo (colour swatches excepted). Scroll each section: images load lazily, none broken.
- [ ] Types: Man, Woman, Non-binary, Trans woman/man, Alien, Monster and the creature types. Creature types hide hair style and show creature outfit/accessory/prop tiles.
- [ ] Species, body size, age, height, proportions, head shape, neck, eye shape, features, facial hair, accessories, props, shoes, expression, lighting, background, style.
- [ ] **Realism <-> Ridiculous** slider moves with mouse and arrow keys. **Silly preset pack** (33): click a few.
- [ ] **Preview** makes a real example image (needs ComfyUI + klein). Changing a choice marks it stale; it survives a reload.
- [ ] Shuffle, Presets, Save to library, load from library.

## 3. Generate (image and video mode)
- [ ] Generate with 1 and several images; progress, cancel, result grid, download.
- [ ] Same character: new pose/outfit/background from a result; reference upload (PNG/JPEG/WebP).
- [ ] Video mode: a short clip with Wan (only where your level allows it).
- [ ] Resolution and batch options lock or unlock to match your level, with a reason.

## 4. Models
- [ ] Installed/not-installed status is right. Download asks you to accept the licence, shows progress, pause/resume/cancel, verifies the file.
- [ ] Models folder shows as configured (see About > Diagnostics).

## 5. About / Diagnostics
- [ ] Version, hardware, ComfyUI online/offline, model status are correct.
- [ ] Copy report works; paste somewhere and check for private paths (there must be none).

## 6. Safety and content
- [ ] Prompts and options stay adult, clothed, non-demeaning. Try odd text in any free-text field: blocked words give a friendly message.
- [ ] Report any image that looks unsuitable, with the settings used.

## Per hardware level: what to expect (test the level you have; use **Custom** or the level picker to see the lock behaviour of others)
| Level | VRAM | Expect |
|---|---|---|
| Minimal | no usable NVIDIA GPU | Generation locked with a reason; builder, About and diagnostics work |
| Basic | under 8 GB | Small images (up to 768 px) only; most models locked |
| Standard | 8 GB | FLUX.2 klein 4B images up to 1024 px; no video |
| Enhanced | 12 GB | Larger images, Z-Image-Turbo, Qwen edit and Wan video unlock at their minimum |
| Pro | 16 GB | The measured reference level: all image models, same-character edits, short Wan video, LTX-2.5 at its minimum |
| Elite / Mega | 24 / 32 GB | Larger resolutions, longer clips and bigger batches |
| Ultra / Extreme / Max | 48 / 64-80 / 96 GB+ | Highest caps; use Custom for anything beyond |
Check on your level: first Preview time, a normal image, batch of 4, a video, a restart (state kept), switching level up and down (locks and reasons change, nothing crashes).

## 7. Packaging
- [ ] Windows zip: extract anywhere (avoid Program Files), run `start.bat`, or run `Create desktop shortcut.bat` once.
- [ ] Linux: `tar xzf`, `./start.sh`.
- [ ] Data is kept in your user data folder, not in the app folder; deleting the app folder does not lose your library.

## Known limits (do not report)
- Not built yet: a signed model catalogue and update checks, motion transfer, standalone lip-sync, an automatic image safety check, code-signed installers, Apple GPU detection.
- Mock generator banner means ComfyUI is not connected: images are placeholders.
