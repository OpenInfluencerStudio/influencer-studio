# Changelog

All notable changes to Influencer Studio. Dates are in the form YYYY-MM-DD.

## 0.2.0-prelaunch (2026-11-10)

The first public preview. Windows is the main platform; Linux is experimental.

### Added

- **Character builder** with Type (Man, Woman, Non-binary, Trans woman, Trans man, Alien, Monster and creature types), body size, age (21+), hair, face, outfit, shoes, accessories, props, expression, lighting, background and style. Every option has a photo thumbnail.
- **Realism to Ridiculous** slider and a **Silly preset pack** of 33 characters, plus 6 everyday presets. Each preset has its own picture; clicking one fills the builder and shows it in the big preview.
- **Images** with FLUX.2 klein 4B and Z-Image-Turbo 6B (both Apache-2.0), with an optional style reference picture.
- **Same character, new scene or camera angle** with Qwen-Image-Edit-2511 (Apache-2.0) and its Lightning and Multiple-Angles LoRAs.
- **Video** with Wan 2.2 TI2V-5B (Apache-2.0, silent) and the optional LTX-2.5 22B Distilled (LTX-2 Community License) with synced speech and sound effects.
- **Audio**: music with ACE-Step 1.5 Turbo (MIT), voice lines with Qwen3-TTS 1.7B VoiceDesign (Apache-2.0), and putting a track onto a video clip.
- **Hardware scan** with ten levels from Minimal to Max, a Custom level, clear lock reasons, and an Advanced "unlock at my own risk" setting for soft limits. The server checks every job.
- **In-app model downloads** with the licence shown first, disk-space check, pause and resume, and SHA-256 checks on every file.
- **Comfy Developer Platform**: every job goes through the Comfy SDK and a local comfy-api-proxy (Comfy API v2) in front of your own ComfyUI. The About screen shows the engine in use and live step-by-step progress.
- **ComfyUI auto-detect** on port 8188 then 8288, a startup warning when more than one ComfyUI answers, and an optional installer for an app-managed ComfyUI (pinned version, started and stopped by the app).
- **About and Diagnostics** with a copyable report free of private data, a first-run tour and a feedback link.
- **Packages** for Windows x64 (zip) and Linux x64 (tar.gz) with their own Node.js runtime and `.sha256` files.
- **Docs**: README, install guide, first-run and model-download guide, troubleshooting, FAQ, safety, third-party licences, contributing guide and tester checklist.

### Security and privacy

- Listens on `127.0.0.1` only, with a per-session token, Host and Origin checks, a strict Content Security Policy, rate limiting and validated inputs.
- No telemetry. The only internet traffic is model downloads from Hugging Face that you start.

### Known limits

- Builds are not code-signed. The hardware scan reads NVIDIA GPUs only. Only the 16 GB level is measured; other levels are estimates.
- Camera angles are approximate, and "Very slim" and "Extra slim" look nearly alike.
- No automatic image safety check on outputs yet. No macOS package.
