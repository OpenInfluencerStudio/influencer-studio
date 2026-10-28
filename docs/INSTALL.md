# Installing Influencer Studio

Influencer Studio is a local app. It runs on your computer, opens in your browser, and talks only to a ComfyUI that you run on the same computer. Everything it makes is SFW, adults only and fully clothed.

## What you need

1. **A computer with an NVIDIA graphics card** for generating (16 GB of VRAM recommended; smaller cards work with lower limits, and the app tells you what your card can do). Without a GPU you can still explore the character builder.
2. **ComfyUI** on the same computer, with the **ComfyUI-GGUF** custom node (needed for the Qwen edit and LTX-2.5 GGUF models). Use your own ComfyUI (the app finds it on port 8188 or 8288 by itself), or run the optional installer once: **Install ComfyUI (optional).bat** on Windows, `./comfyui/install-comfyui.sh` on Linux and macOS. It downloads the pinned official ComfyUI (a separate GPL-3.0 program, about 2 GB on Windows) into the app folder, and the app then starts and stops it for you. See `comfyui/README.md`.
3. **comfy-api-proxy** (MIT, by Comfy Org): the small local server the app's Comfy SDK talks to. The optional ComfyUI installer adds it for you. If you use your own ComfyUI, run the installer once with `-ProxyOnly` (Windows: `powershell -ExecutionPolicy Bypass -File comfyui\install-comfyui.ps1 -ProxyOnly`) or `./comfyui/install-comfyui.sh --proxy-only`, or `pip install comfy-api-proxy==0.1.6` and keep `comfy-api-proxy` on your PATH. The app starts and stops it by itself.
4. About **60 GB of free disk space** for all models (less if you skip some). An SSD loads models much faster than a hard disk.

## Windows

1. Download `InfluencerStudio-<version>-win-x64.zip` from the GitHub Releases page, and (optional) check it against the `.sha256` file next to it.
2. Right-click the zip, choose **Extract All**, and pick a normal folder such as `C:\InfluencerStudio` (do not run it from inside the zip).
3. Start ComfyUI, or (no ComfyUI yet) double-click **Install ComfyUI (optional).bat** once.
4. Double-click **start.bat**. A black window opens and your browser opens by itself on a private link that ends in `#t=...`. Keep the black window open while you use the app; close it to stop.
5. Windows may show a SmartScreen warning because the app is not code-signed yet. Choose **More info > Run anyway** only if you downloaded it from the official Releases page.

## macOS

1. Download `InfluencerStudio-<version>-mac-arm64.tar.gz` (Apple silicon) or `-mac-x64.tar.gz` (Intel) and double-click it to unpack.
2. Control-click **start.command**, choose **Open**, and confirm (the app is not notarised yet). If macOS refuses, run `xattr -dr com.apple.quarantine <folder>` in Terminal once.
3. Note: generation on a Mac needs a ComfyUI build that supports your chip; the hardware scan currently reads NVIDIA GPUs only, so on a Mac most options show as locked until Apple support is added.

## Linux

```bash
tar -xzf InfluencerStudio-<version>-linux-x64.tar.gz
cd InfluencerStudio-<version>-linux-x64
./start.sh
```

Your browser opens on the private link. If it does not, copy the `Open:` link printed in the terminal.

## First run

1. **Hardware** screen: the app scans your GPU, VRAM, RAM and disk, and shows what it can run. Options your PC cannot run are locked with the reason.
2. **Models** screen: choose a **models folder** (your ComfyUI `models` folder, or set `INFLUENCER_STUDIO_MODELS_DIR`). Press **Download** on the models you want. You are shown the licence first, each file is checked against a stored SHA-256 checksum, and downloads can be paused and resumed (even after closing the app).
3. **Character** and **Generate** screens: build a character and press Generate.

## Settings

Set these before starting if you need them (Windows: add `set NAME=value` lines to `start.bat`; macOS and Linux: `export NAME=value` in the start script):

| Variable | Default | Meaning |
|---|---|---|
| `COMFYUI_URL` | unset (auto-detect) | Your ComfyUI address. Must be on this computer. When unset, the app tries port 8188 (stock ComfyUI), then 8288, then its own managed ComfyUI on 8190 if you installed it. Set it to pin one address, for example `set COMFYUI_URL=http://127.0.0.1:8288`. |
| `COMFYUI_PORTS` | `8188,8288` | Ports to auto-detect, in order. |
| `INFLUENCER_STUDIO_MANAGED_COMFY` | on | `0` = never start the app-managed ComfyUI. `INFLUENCER_STUDIO_COMFY_PORT` changes its port (default 8190). |
| `INFLUENCER_STUDIO_ENGINE` | `sdk` | `sdk` = every job through the Comfy SDK and comfy-api-proxy. `direct` = fallback without the SDK (troubleshooting only). |
| `COMFY_PROXY_URL` | unset | A comfy-api-proxy you already run. When unset the app reuses one on 8189 or 8289 that fronts the same ComfyUI, or starts its own on port 8191 with a random token (`INFLUENCER_STUDIO_PROXY_PORT`, `INFLUENCER_STUDIO_PROXY_CMD` to change). |
| `PORT` | `8787` | First port to try (the next 9 are tried if it is busy). Only `127.0.0.1` is used. |
| `INFLUENCER_STUDIO_MODELS_DIR` | unset | Your ComfyUI `models` folder. If unset, choose it in the Models screen. |
| `INFLUENCER_STUDIO_DATA` | `%LOCALAPPDATA%\InfluencerStudio` (Windows), `~/.influencer-studio` (others) | Settings, job queue, saved characters, pictures and videos. |
| `INFLUENCER_STUDIO_MOCK` | off | `1` draws placeholder images without any AI, to try the interface. |

## Updating and removing

Download the new zip and extract it next to the old one. Your characters and pictures live in the data folder above, so they carry over. To remove the app, delete its folder (and the data folder if you want to erase your work).

## Privacy and safety

The app only listens on your own computer and needs its private link. It contacts the internet only when you press Download (Hugging Face model hosts, over HTTPS). It never uploads your pictures. See `SAFETY.md`.

## Hardware levels
The app sorts your GPU by VRAM into Minimal (no usable GPU), Basic (under 8 GB), Standard (8 GB), Enhanced (12 GB), Pro (16 GB), Elite (24 GB), Mega (32 GB), Ultra (48 GB), Extreme (64 to 80 GB) and Max (96 GB and above).
