# Installing Influencer Studio

Influencer Studio is a local app. It runs on your computer, opens in your browser, and talks only to a ComfyUI that you run on the same computer. Everything it makes is SFW, adults only and fully clothed.

## What you need

1. **A computer with an NVIDIA graphics card** for generating (16 GB of VRAM recommended; smaller cards work with lower limits, and the app tells you what your card can do). Without a GPU you can still explore the character builder.
2. **ComfyUI** (current version) running on the same computer, with the **ComfyUI-GGUF** custom node installed (needed for the Qwen edit model). The app does not include ComfyUI.
3. About **60 GB of free disk space** for all models (less if you skip some). An SSD loads models much faster than a hard disk.

## Windows

1. Download `InfluencerStudio-<version>-win-x64.zip` from the GitHub Releases page, and (optional) check it against the `.sha256` file next to it.
2. Right-click the zip, choose **Extract All**, and pick a normal folder such as `C:\InfluencerStudio` (do not run it from inside the zip).
3. Start ComfyUI.
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
| `COMFYUI_URL` | `http://127.0.0.1:8188` | Your ComfyUI address. Must be on this computer. |
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
