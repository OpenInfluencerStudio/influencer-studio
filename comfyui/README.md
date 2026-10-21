# App-managed ComfyUI (optional)

Influencer Studio needs ComfyUI to generate. If you already run ComfyUI, the app finds it on port 8188 (stock) or 8288 and uses it; nothing here is needed.

If you have no ComfyUI, run the installer in this folder once:

- Windows: double-click `Install ComfyUI (optional).bat` in the app folder (or run `install-comfyui.ps1`). It downloads the pinned official ComfyUI Windows portable build (about 2 GB, roughly 6-8 GB unpacked) and checks its SHA-256.
- Linux and macOS: run `./comfyui/install-comfyui.sh`. It clones the pinned ComfyUI tag, makes a Python virtual environment and installs PyTorch for your GPU (NVIDIA, AMD, Apple or CPU).

After that, the app starts this ComfyUI by itself on port 8190 (loopback only) when no other ComfyUI is running, and stops it when you close the app. Set `INFLUENCER_STUDIO_MANAGED_COMFY=0` to turn this off, `INFLUENCER_STUDIO_COMFY_PORT` to change the port, or `COMFYUI_URL` to always use a specific ComfyUI. If you chose a models folder in the app (or set `INFLUENCER_STUDIO_MODELS_DIR`), the managed ComfyUI reads models from there.

## Comfy SDK proxy

The installer also adds **comfy-api-proxy** (MIT, Comfy Org): `proxy-venv` on Linux and macOS, `proxy-lib` next to the portable ComfyUI on Windows (ComfyUI's own packages are not changed). The app's Comfy SDK sends every job to it; the app starts it on 127.0.0.1:8191 with a random token and stops it on exit. Already running your own ComfyUI? Run the installer with `-ProxyOnly` / `--proxy-only` to get just the proxy.

## Licence

ComfyUI is a separate program licensed under the GNU General Public License v3.0. It is not part of Influencer Studio and is not included in the Influencer Studio download; the installer fetches it from its official source.

- Source code: https://github.com/Comfy-Org/ComfyUI (the exact version is pinned in `comfyui.lock.json`)
- Licence: https://github.com/Comfy-Org/ComfyUI/blob/master/LICENSE (a copy is inside the installed `ComfyUI` folder)

Influencer Studio talks to ComfyUI only over its local HTTP and WebSocket API and stays under Apache-2.0. The ComfyUI-GGUF custom node (Apache-2.0) is installed the same way.

## Updates

Versions are pinned in `comfyui.lock.json` (ComfyUI tag, portable build SHA-256s, custom node commit). A new app release can bump the pins after testing; re-run the installer to update. The app never updates ComfyUI by itself.
