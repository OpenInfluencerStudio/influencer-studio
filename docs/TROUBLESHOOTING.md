# Troubleshooting

Start with **About > Diagnostics**: it shows the version, your hardware level, whether ComfyUI is online and at which address, the generation engine, the models folder and each model's status. **Copy report** puts all of it on the clipboard without file paths, user names, prompts or pictures, ready to paste into an issue.

- [The app does not start](#the-app-does-not-start)
- [The browser does not open, or the page says the token is missing](#the-browser-does-not-open-or-the-page-says-the-token-is-missing)
- [ComfyUI is offline or not found](#comfyui-is-offline-or-not-found)
- [The app uses the wrong ComfyUI](#the-app-uses-the-wrong-comfyui)
- [Comfy SDK or comfy-api-proxy errors](#comfy-sdk-or-comfy-api-proxy-errors)
- [Pictures say MOCK GENERATOR](#pictures-say-mock-generator)
- [Options or models are locked](#options-or-models-are-locked)
- [Model downloads](#model-downloads)
- [A model is installed but jobs fail](#a-model-is-installed-but-jobs-fail)
- [Generation is slow or runs out of memory](#generation-is-slow-or-runs-out-of-memory)
- [My description is refused](#my-description-is-refused)
- [Style reference upload fails](#style-reference-upload-fails)
- [Linux notes (experimental)](#linux-notes-experimental)
- [Reporting a problem](#reporting-a-problem)

## The app does not start

- **Windows SmartScreen** stops it: builds are not code-signed yet. Choose **More info > Run anyway**, only for a download from the official Releases page.
- **You started it from inside the zip.** Extract the whole zip first (right-click > Extract All), then run `start.bat` from the extracted folder.
- **The black window closes straight away.** Open a Command Prompt in the app folder and run `start.bat` there to read the error.
- **Port in use.** The app tries port 8787 and the next 9 ports. If all are busy, set another start port, for example `set PORT=9100` in `start.bat`.
- **Antivirus** may quarantine `node\node.exe`. It is the official Node.js runtime, checked against nodejs.org's checksums when the package was built. Restore it or add the app folder as an exception.

## The browser does not open, or the page says the token is missing

The app prints `Open: http://127.0.0.1:8787/#t=...` in its window. Copy that whole link, including the `#t=...` part, into your browser. A bookmark or an address without the token gets "Missing or wrong session token". Each start makes a new token, so use the newest link.

The app only answers on `127.0.0.1`. Opening it from another computer, or through `localhost` with a different port, is refused on purpose.

## ComfyUI is offline or not found

1. Make sure ComfyUI is running and open it in your browser (for example `http://127.0.0.1:8188`).
2. With no address set, the app tries port 8188, then 8288, then its own managed ComfyUI on 8190 if you installed it. If your ComfyUI uses another port, set it in `start.bat`, for example `set COMFYUI_URL=http://127.0.0.1:8000`, or enter it under **Hardware > Custom**.
3. Only addresses on this computer are allowed. A ComfyUI on another machine is refused unless you allow it under Custom with **Advanced** switched on.
4. Restart the app after changing settings.

No ComfyUI at all? Run **Install ComfyUI (optional).bat** (Windows) or `./comfyui/install-comfyui.sh` (Linux). See [comfyui/README.md](../comfyui/README.md).

## The app uses the wrong ComfyUI

If you have more than one ComfyUI, the app uses the first one that answers (8188, then 8288) and prints a warning at startup naming it. Pin the one you want with `COMFYUI_URL`, for example add `set COMFYUI_URL=http://127.0.0.1:8288` to `start.bat` before the line that starts the app.

## Comfy SDK or comfy-api-proxy errors

Every job goes through the Comfy SDK to comfy-api-proxy, a small local server in front of ComfyUI.

- **The proxy is not installed.** Run the installer in proxy-only mode once: `powershell -ExecutionPolicy Bypass -File comfyui\install-comfyui.ps1 -ProxyOnly` (Windows) or `./comfyui/install-comfyui.sh --proxy-only` (Linux). Or `pip install comfy-api-proxy==0.1.6` and make sure `comfy-api-proxy` is on your PATH.
- **Port 8191 is busy.** Set `INFLUENCER_STUDIO_PROXY_PORT` to a free port.
- **You run your own proxy.** Set `COMFY_PROXY_URL`, for example `http://127.0.0.1:8189`.
- **Still stuck?** `set INFLUENCER_STUDIO_ENGINE=direct` makes the app talk to ComfyUI without the SDK. Use it only to find out whether the proxy is the problem, and switch back afterwards.

## Pictures say MOCK GENERATOR

Mock mode is on, so the app draws labelled placeholders instead of AI pictures. Remove `INFLUENCER_STUDIO_MOCK=1` from your start script or environment and restart. The badge also appears when you started with mock mode to try the interface without a GPU.

## Options or models are locked

Hover or focus a locked item to see why.

- **"Needs N GB VRAM (you have M GB)"**: your card is below that model's minimum. Pick a smaller option, or switch on **Advanced** and "Unlock unsupported options at my own risk". Expect slow runs or out-of-memory errors when you do.
- **"No usable GPU"**: the scan found no NVIDIA GPU through `nvidia-smi`. Update the NVIDIA driver. AMD and Apple GPUs are not detected yet.
- **Missing files, a full disk or ComfyUI offline** are hard limits and cannot be unlocked. Fix the cause and press **Re-scan** on the Hardware screen.

## Model downloads

- **The Download button is greyed out:** choose a models folder first (Models screen), or the model is locked for your level, or it has no verified checksum yet. Hover the button for the reason.
- **"Needs N GB free ... but only M GB is available":** free some space or choose a folder on a bigger drive.
- **The download stalls or the connection drops:** press **Pause**, then **Resume**. Downloads continue where they stopped, even after a restart.
- **"The checksum ... did not match, so the file was deleted":** the file arrived damaged. Press Download again.
- **Behind a proxy or firewall:** the app needs HTTPS access to `huggingface.co` and its file servers.
- **Already have the files?** Put them in the right subfolders of your models folder (for example `diffusion_models`, `text_encoders`, `vae`, `loras`) with the exact file names from `models.json`. The Models screen shows them as installed.

## A model is installed but jobs fail

- **The app and ComfyUI read different folders.** The models folder in the app must be the one your ComfyUI loads from. Check About > Diagnostics and your ComfyUI's `extra_model_paths.yaml`.
- **"Unknown node" or missing GGUF loader:** the Qwen edit and LTX-2.5 models need the [ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF) custom node. Install it and restart ComfyUI.
- **ACE-Step or LTX-2.5 nodes missing:** update ComfyUI to a recent version. The optional installer pins one that has been tested.
- **"Too many jobs, wait a moment":** the app accepts up to 10 jobs a minute. Wait and try again.

## Generation is slow or runs out of memory

- The first job after starting loads the model from disk and is much slower. Models on a hard disk can take minutes to load; an SSD is much faster.
- Lower the size, batch or video length, or pick the smaller model for your level.
- Close other programs that use the GPU (games, other AI tools, browsers with hardware acceleration).
- If you unlocked options under Advanced, turn the unlock off again.

## My description is refused

"That description isn't supported in this app" means a free-text field tripped the safety filter: content that is not SFW, not fully clothed, under 21, demeaning, an attempt to copy a real person, or an attempt to override the rules. Reword it. If you think a normal description was refused by mistake, report it with the text.

## Style reference upload fails

Use a PNG, JPEG or WebP picture under 8 MB. The file type is checked by content, not by name. Only use pictures you have the right to use, of adults, and never a real person's likeness without consent.

## Linux notes (experimental)

- `./start.sh: Permission denied`: run `chmod +x start.sh comfyui/install-comfyui.sh`.
- The installer needs Python 3.10 to 3.13 and `git`. Point it at a specific Python with `PYTHON=/usr/bin/python3.12 ./comfyui/install-comfyui.sh`.
- No browser opens on a server without a desktop: copy the `Open:` link into a browser on the same machine. The app does not listen on other network addresses.

## Reporting a problem

Open **About**, press **Copy report**, then press **Feedback** to open a new GitHub issue and paste the report. Say what you did, what you expected and what happened, and add a screenshot if it helps. See [CONTRIBUTING.md](../CONTRIBUTING.md).
