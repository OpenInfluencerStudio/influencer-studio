# Installing Influencer Studio

Influencer Studio is a local app. It runs on your computer, opens in your browser, and talks only to a ComfyUI running on the same computer. Everything it makes is SFW, adults only and fully clothed.

- [What you need](#what-you-need)
- [Windows](#windows)
- [Linux (experimental)](#linux-experimental)
- [macOS](#macos)
- [Settings](#settings)
- [Updating and removing](#updating-and-removing)

## What you need

1. **A computer with an NVIDIA graphics card** for generating. 16 GB of VRAM is the tested level; 8 GB runs FLUX.2 klein 4B images, and the app tells you what your card can do. Without a GPU you can still explore the builder. See [Hardware levels](../README.md#hardware-levels).
2. **ComfyUI** on the same computer, with the **ComfyUI-GGUF** custom node (needed for the Qwen edit and LTX-2.5 GGUF models). Use your own ComfyUI (the app finds it on port 8188 or 8288 by itself), or run the optional installer once (below). ComfyUI is a separate GPL-3.0 program; see [comfyui/README.md](../comfyui/README.md).
3. **comfy-api-proxy** (MIT, by Comfy Org): the small local server the app's Comfy SDK talks to. The optional ComfyUI installer adds it for you. If you use your own ComfyUI, run the installer once in proxy-only mode (below), or `pip install comfy-api-proxy==0.1.6` and keep `comfy-api-proxy` on your PATH. The app starts and stops it by itself.
4. **Free disk space** for the models you choose: about 16 GB for FLUX.2 klein 4B alone, about 116 GB for every model. An SSD loads models much faster than a hard disk.

## Windows

Windows 10 or 11, 64-bit.

1. Download `InfluencerStudio-0.2.0-prelaunch-win-x64.zip` from the [Releases page](https://github.com/OpenInfluencerStudio/influencer-studio/releases).
2. (Optional) Check the download. In PowerShell, in your Downloads folder, run `Get-FileHash .\InfluencerStudio-0.2.0-prelaunch-win-x64.zip -Algorithm SHA256` and compare the result with the `.sha256` file from the same release.
3. Right-click the zip, choose **Extract All**, and pick a normal folder such as `C:\InfluencerStudio`. Avoid `Program Files`, and do not run the app from inside the zip.
4. Set up ComfyUI:
   - **You already run ComfyUI:** start it as usual. Then get the proxy once: open PowerShell in the app folder and run `powershell -ExecutionPolicy Bypass -File comfyui\install-comfyui.ps1 -ProxyOnly`.
   - **You have no ComfyUI:** double-click **Install ComfyUI (optional).bat** once. It downloads the pinned official ComfyUI portable build (about 2 GB, 6 to 8 GB unpacked), checks its SHA-256, adds ComfyUI-GGUF and the proxy, and the app then starts and stops this ComfyUI for you.
5. Double-click **start.bat**. A black window opens and your browser opens by itself on a private link that ends in `#t=...`. Keep the black window open while you use the app; close it to stop the app.
6. (Optional) Double-click **Create desktop shortcut.bat** once to get an Influencer Studio icon on your desktop.
7. Windows may show a SmartScreen warning because the app is not code-signed yet. Choose **More info > Run anyway** only if you downloaded it from the official Releases page.

Next: [docs/FIRST_RUN.md](FIRST_RUN.md).

## Linux (experimental)

The Linux build is experimental: it starts and passes the same smoke test as Windows, but it has had much less real-world use. Reports are welcome.

```bash
sha256sum -c InfluencerStudio-0.2.0-prelaunch-linux-x64.tar.gz.sha256   # optional: check the download
tar -xzf InfluencerStudio-0.2.0-prelaunch-linux-x64.tar.gz
cd InfluencerStudio-0.2.0-prelaunch-linux-x64
./start.sh
```

- No ComfyUI yet? Run `./comfyui/install-comfyui.sh` once. It clones the pinned ComfyUI tag, makes a Python virtual environment and installs PyTorch for your GPU. Python 3.10 to 3.13 and `git` are needed (set `PYTHON=/path/to/python3.13` to pick one).
- Already run ComfyUI? Run `./comfyui/install-comfyui.sh --proxy-only` once to get the proxy.
- Your browser opens on the private link. If it does not, copy the `Open:` link printed in the terminal. Press Ctrl+C to stop.

## macOS

There is no macOS package in this release. You can run from source (see [Run from source](../README.md#run-from-source)), but the hardware scan reads NVIDIA GPUs only, so most options show as locked on a Mac.

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

Download the new package and extract it next to the old one. Your characters, pictures and settings live in the data folder (`%LOCALAPPDATA%\InfluencerStudio` on Windows, `~/.influencer-studio` on Linux), so they carry over. To remove the app, delete its folder, and the data folder too if you want to erase your work. Models stay in your models folder until you delete them.

## Privacy

The app only listens on your own computer and needs its private link. It contacts the internet only when you press Download (Hugging Face, over HTTPS). It never uploads your pictures. See [SAFETY.md](../SAFETY.md).
