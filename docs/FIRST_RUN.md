# First run and model downloads

This guide picks up after [installing](INSTALL.md): you have double-clicked `start.bat` (or run `./start.sh`) and the app has opened in your browser.

- [1. The quick tour](#1-the-quick-tour)
- [2. Check that ComfyUI is connected](#2-check-that-comfyui-is-connected)
- [3. Check your hardware level](#3-check-your-hardware-level)
- [4. Choose a models folder](#4-choose-a-models-folder)
- [5. Download your first model](#5-download-your-first-model)
- [6. Make your first character](#6-make-your-first-character)
- [7. What to download next](#7-what-to-download-next)
- [Where your work is saved](#where-your-work-is-saved)

## 1. The quick tour

A short tour opens the first time. Use **Next** and **Back**, or **Skip tour** (or Esc) to close it. It does not come back after a restart; open it again from **About > Show the quick tour again**.

The address in your browser ends in `#t=...`. That is a private session token. Bookmarks without it will not work; start the app again to get a fresh link.

## 2. Check that ComfyUI is connected

Open **About**. The Diagnostics table shows whether ComfyUI is online and which address the app uses, and whether generation goes through the Comfy SDK and comfy-api-proxy.

- **"MOCK GENERATOR"** in the header means mock mode is on: pictures are labelled placeholders, not AI images. Turn it off by removing `INFLUENCER_STUDIO_MOCK=1`.
- **ComfyUI offline:** start your ComfyUI (or run the optional installer) and restart the app. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#comfyui-is-offline-or-not-found).

## 3. Check your hardware level

Open **Hardware**. The scan shows your GPU, VRAM, system RAM, free disk and a level name, from **Minimal** (no usable GPU) to **Max** (96 GB and above). The level decides the largest picture size, video length and which models are allowed. The table is in the [README](../README.md#hardware-levels).

- **Locked options** are greyed out. Hover or focus one to see why, with real numbers, for example "Needs 12 GB VRAM (you have 8 GB)".
- The **level picker** lets you preview what other levels allow. Press **My PC** to go back. The server still checks every job against your real PC.
- **Custom** lets you enter your own numbers (VRAM, RAM, largest size, video length, batch, ComfyUI address, models folder). You can export and import them as JSON.
- **Advanced** (top right) has "Unlock unsupported options at my own risk". It releases soft limits only. Hard limits stay on: no GPU, missing model files, a full disk, ComfyUI offline.

Recommended models for your level are ticked in the model list. Tick the ones you want the app to use; your choice is remembered.

## 4. Choose a models folder

Open **Models**. If no models folder is set, enter a full folder path, for example your ComfyUI `models` folder (such as `<models-dir>`), and press **Use this folder**. Pick a drive with plenty of free space; an SSD loads models much faster than a hard disk.

You can also set it before starting with `INFLUENCER_STUDIO_MODELS_DIR` (see [Settings](INSTALL.md#settings)). If you use your own ComfyUI, the folder must be the one that ComfyUI reads models from, so it can find the files.

## 5. Download your first model

Start with **FLUX.2 klein 4B** (about 16 GB, 8 GB of VRAM or more). It makes the builder previews and images.

1. Press **Download** next to it.
2. Read the licence summary and the link to the full licence, then accept. Nothing downloads until you do.
3. The app checks free disk space first. While downloading it shows progress, speed and time left.
4. **Pause**, **Resume** and **Cancel** work at any time. A paused download continues where it stopped, even after closing the app.
5. When the files arrive, each one is checked against its stored SHA-256 before it is installed. A file that does not match is thrown away.

Downloads come only from Hugging Face over HTTPS. Only models with an allowed licence and a verified checksum can be downloaded.

| Model | Download size | Needs (VRAM) | Licence |
|---|---|---|---|
| FLUX.2 klein 4B | about 16 GB | 8 GB, 12 GB recommended | Apache-2.0 |
| Z-Image-Turbo 6B | about 13 GB more (shares the text encoder with klein) | 12 GB, 16 GB recommended | Apache-2.0 |
| Qwen-Image-Edit-2511 with Lightning and Multiple-Angles LoRAs | about 24 GB | 12 GB, 16 GB recommended | Apache-2.0 |
| Wan 2.2 TI2V-5B | about 18 GB | 12 GB, 16 GB recommended | Apache-2.0 |
| LTX-2.5 22B Distilled (optional) | about 31 GB | 16 GB, 24 GB recommended | LTX-2 Community License |
| ACE-Step 1.5 Turbo | about 10 GB | 6 GB, 8 GB recommended | MIT |
| Qwen3-TTS 1.7B VoiceDesign | about 4 GB | 6 GB, 8 GB recommended | Apache-2.0 |

The VRAM numbers are the app's estimates except where the Hardware screen says they were measured.

**LTX-2.5** uses the LTX-2 Community License, not an open-source licence. It is free for individuals and for organisations under $10M annual revenue. The app shows it and asks you to accept it before the download. Skip LTX-2.5 if that does not suit you; everything else works without it.

**The Qwen edit and LTX-2.5 models need the ComfyUI-GGUF custom node.** The optional installer adds it; with your own ComfyUI, install it from [city96/ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF).

## 6. Make your first character

1. Open **Character**. Pick a **Type** (or leave "Surprise me"), then a body size and anything else you like. Every option has a photo.
2. Or click a card under **Presets** or the **Silly preset pack**. It fills the builder and shows that preset in the big preview. Everything stays editable.
3. Press **Preview** to make a real example picture of your own character. Changing an option marks the preview as out of date.
4. Name it and press **Save to library** to keep it.
5. Open **Generate** to make several pictures, a video (Video mode), or music and voice lines (Video > Audio).

The first picture after starting is slower while the model loads from disk. On a 16 GB card a klein preview takes about 4 seconds once loaded.

## 7. What to download next

- **Same character in a new scene or angle:** Qwen-Image-Edit-2511.
- **Video:** Wan 2.2 TI2V-5B (silent), or LTX-2.5 for speech and sound effects.
- **Music and voice lines:** ACE-Step 1.5 Turbo and Qwen3-TTS.

## Where your work is saved

Settings, the job queue, saved characters, pictures and videos are kept in the data folder: `%LOCALAPPDATA%\InfluencerStudio` on Windows, `~/.influencer-studio` on Linux. Updating or deleting the app folder does not touch them.

Something not working? See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) and the [FAQ](../FAQ.md).
