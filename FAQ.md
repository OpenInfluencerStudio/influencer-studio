# FAQ

**Is it free?** Yes. Influencer Studio is open source under Apache-2.0. Core image, edit, video and speech models are Apache-2.0, ACE-Step 1.5 music is MIT, and the optional LTX-2.5 audio-video model uses the LTX-2 Community License (free for creators and entities under $10M annual revenue; accepted in-app before download). See `THIRD_PARTY.md`.

**How does it use the Comfy Developer Platform?** Every job goes through the official Comfy SDK (`@comfyorg/sdk`) to comfy-api-proxy, Comfy's local Comfy API v2 server, in front of your own ComfyUI. It is all on your computer: no account, no API key, no Comfy Cloud or Router, no partner nodes.

**Does anything leave my computer?** No. The app only listens on your own computer (`127.0.0.1`) behind a private link with a session token. The only internet traffic is model downloads from Hugging Face over HTTPS, and only when you press Download. There is no telemetry, and your pictures are never uploaded.

**What do I need?** An NVIDIA graphics card (16 GB of VRAM recommended; smaller cards work with lower limits), ComfyUI running on the same computer with the ComfyUI-GGUF custom node, and about 60 GB of free disk space for all models. An SSD makes model loading much faster. See `docs/INSTALL.md`.

**Do I have to install ComfyUI myself?** No. If you already run ComfyUI, the app finds it by itself on port 8188 (a stock install) or 8288. If you have none, run the optional installer once (**Install ComfyUI (optional).bat** on Windows, `./comfyui/install-comfyui.sh` on Linux and macOS). It downloads the pinned official ComfyUI into the app folder, and the app starts and stops it for you. ComfyUI is a separate program under GPL-3.0; see `comfyui/README.md`.

**My ComfyUI is on a different port.** Set `COMFYUI_URL`, for example `set COMFYUI_URL=http://127.0.0.1:8288` in `start.bat`, or list ports to try with `COMFYUI_PORTS`. You can also enter the address under Hardware > Custom.

**I have more than one ComfyUI installed.** When no address is set, the app uses the first one that answers (port 8188, then 8288) and prints a warning at startup naming the one it picked. To always use a specific install, pin it with `COMFYUI_URL`, for example `set COMFYUI_URL=http://127.0.0.1:8288` in `start.bat`.

**Can I try it without a GPU?** Yes. The character builder, hardware screen and About page work without one, and setting `INFLUENCER_STUDIO_MOCK=1` draws labelled placeholder images so you can try the whole interface.

**Why are some options greyed out?** The hardware scan found your PC can't run them. Hover to see the reason with real numbers, for example "Needs 12 GB VRAM (you have 8 GB)". Advanced > "Unlock unsupported options at my own risk" releases soft limits; hard limits like no GPU, missing model files, a full disk or ComfyUI being offline always stay on.

**Which model should I download?** The Models screen pre-selects the best fit for your hardware. **FLUX.2 klein 4B** and **Z-Image-Turbo 6B** make images (they share the same Qwen3 4B text encoder and VAE), **Qwen-Image-Edit-2511** keeps the same character in a new scene or camera angle (needs a 16 GB GPU), **Wan 2.2 TI2V-5B** makes silent short videos, **LTX-2.5 22B Distilled** makes short videos with synchronized speech and sound effects, and **ACE-Step 1.5 Turbo** makes background music and soundtracks.

**How long does generating take?** On the reference PC (RTX 5060 Ti 16 GB): a klein preview image in about 4 seconds, a same-character edit in 2.5 to 3 minutes, and a 2-second video in about a minute once models are loaded. First runs are slower while models load from disk.

**Windows says the app is unrecognised.** Builds are not code-signed yet. Choose More info > Run anyway only if you downloaded it from the official GitHub Releases page.

**Does it work on Mac or Linux?** Linux and Mac builds are experimental. The hardware scan currently reads NVIDIA GPUs only, so on a Mac most options show as locked until Apple support is added.

**What content is allowed?** SFW only: adults (21+ in the builder), fully clothed, respectful wording, with a blocked-terms filter. Only use reference images you have the right to use, and never a real person's likeness without their consent. See `SAFETY.md`.

**Is there audio, lip-sync or motion transfer?** Yes for audio and synced speech! Switch to **Video** mode: when **LTX-2.5 22B Distilled** is selected in **Image to video**, you can type a spoken line and sound-effects prompt for native synchronized audio-video generation. Or open the **Audio** tab to generate background music with **ACE-Step 1.5 Turbo** (MIT) or spoken voiceovers (TTS) and attach them onto any generated video clip. Standalone motion transfer and lip-sync re-animation are planned for a future update.

**Where are my characters and pictures stored?** In the data folder: `%LOCALAPPDATA%\InfluencerStudio` on Windows, `~/.influencer-studio` elsewhere. Updating the app keeps them.

**How do I report a problem?** Open About, press Copy report (it contains no file paths, user names, prompts or images), then press Feedback to open a GitHub issue and paste it in.
