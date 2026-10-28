# Third-party components and models

Model weights are not distributed in this repository. Users download them from the original sources (in the app, after accepting each licence) and every file is checked against a stored SHA-256.

Licences and SHA-256 checksums below were checked against the live Hugging Face and GitHub listings on 21–28 Oct 2026.

## Models

| Model | Licence | Upstream | Files downloaded from |
|---|---|---|---|
| FLUX.2 klein 4B | Apache-2.0 | [black-forest-labs/FLUX.2-klein-4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B) | [Comfy-Org/vae-text-encorder-for-flux-klein-4b](https://huggingface.co/Comfy-Org/vae-text-encorder-for-flux-klein-4b) (Apache-2.0) |
| Qwen3 4B text encoder (used by klein) | Apache-2.0 | [Qwen/Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B) | same as above |
| Qwen-Image-Edit-2511 | Apache-2.0 | [Qwen/Qwen-Image-Edit-2511](https://huggingface.co/Qwen/Qwen-Image-Edit-2511) | [unsloth/Qwen-Image-Edit-2511-GGUF](https://huggingface.co/unsloth/Qwen-Image-Edit-2511-GGUF) (Apache-2.0) |
| Qwen2.5-VL 7B text encoder and Qwen-Image VAE | Apache-2.0 | [Qwen/Qwen2.5-VL-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct) | [Comfy-Org/Qwen-Image_ComfyUI](https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI) (Apache-2.0) |
| Qwen-Image-Edit-2511 Lightning 4-step LoRA | Apache-2.0 | [lightx2v/Qwen-Image-Edit-2511-Lightning](https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning) | same |
| Qwen-Image-Edit-2511 Multiple-Angles LoRA | Apache-2.0 | [fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA](https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA) | same |
| Wan 2.2 TI2V-5B | Apache-2.0 | [Wan-AI/Wan2.2-TI2V-5B](https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B) | [Comfy-Org/Wan_2.2_ComfyUI_Repackaged](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged) (Apache-2.0) |
| UMT5-XXL text encoder (used by Wan) | Apache-2.0 | [google/umt5-xxl](https://huggingface.co/google/umt5-xxl) | same as Wan |
| Z-Image-Turbo 6B | Apache-2.0 | [Tongyi-MAI/Z-Image-Turbo](https://huggingface.co/Tongyi-MAI/Z-Image-Turbo) | [Comfy-Org/z_image_turbo](https://huggingface.co/Comfy-Org/z_image_turbo) (Apache-2.0; shares the identical Qwen3 4B text encoder file with FLUX.2 klein 4B) |
| LTX-2.5 22B Distilled (Q4_K_M GGUF + Video/Audio VAEs) | LTX-2 Community License | [Lightricks/LTX-2](https://huggingface.co/Lightricks/LTX-2) | [QuantStack/LTX-2.5-GGUF](https://huggingface.co/QuantStack/LTX-2.5-GGUF) and [Lightricks/LTX-2.5-19b-dev](https://huggingface.co/Lightricks/LTX-2.5-19b-dev) (LTX-2 Community License; accepted in-app before download) |
| Gemma 4 12B text encoder with LTX-2.5 projection | LTX-2 Community License / Gemma Terms | [google/gemma-3-12b-it](https://huggingface.co/google/gemma-3-12b-it) | [Lightricks/LTX-2.5-19b-dev](https://huggingface.co/Lightricks/LTX-2.5-19b-dev) |
| ACE-Step 1.5 Turbo (music & soundtrack generation + Qwen 0.6B/1.7B encoders + audio VAE) | MIT | [ACE-Step/Ace-Step1.5](https://huggingface.co/ACE-Step/Ace-Step1.5) | [Comfy-Org/ace_step_1.5_ComfyUI_files](https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files) (MIT) |
| Qwen3-TTS 1.7B VoiceDesign (spoken voice lines) | Apache-2.0 | [Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign) | same (Apache-2.0) |

## Software you install separately (not bundled)

| Component | Licence | Source |
|---|---|---|
| ComfyUI | GPL-3.0 | [Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI) |
| ComfyUI-GGUF custom node | Apache-2.0 | [city96/ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF) |

Influencer Studio talks to ComfyUI over its local HTTP and WebSocket API and does not include or link ComfyUI code.

The optional installer in `comfyui/` (for people with no ComfyUI yet) downloads the official ComfyUI build pinned in `comfyui/comfyui.lock.json` from its GitHub releases or tag, plus ComfyUI-GGUF at a pinned commit, into the app folder. ComfyUI stays a separate GPL-3.0 program that the app starts as its own process; it is not included in the Influencer Studio download. On Windows the installer may also fetch the official 7-Zip `7zr.exe` (LGPL-2.1, SHA-256 checked) only to unpack the ComfyUI archive.

## Comfy Developer Platform

| Component | Licence | Source | How it is used |
|---|---|---|---|
| Comfy SDK (`@comfyorg/sdk` 0.5.0) | MIT | [Comfy-Org/comfy-typescript-sdk](https://github.com/Comfy-Org/comfy-typescript-sdk) | Bundled into `app/server.mjs`. Every generation job is submitted, followed and downloaded through it. |
| comfy-api-proxy 0.1.6 | MIT | [Comfy-Org/comfy-api-proxy](https://github.com/Comfy-Org/comfy-api-proxy) | Installed by the optional installer (or by you) and started by the app on 127.0.0.1 with a random token. It serves Comfy API v2 in front of your local ComfyUI. |

Both run fully on your computer with no account or API key. The app's SDK calls go through a guard that refuses any address that is not this computer, so it never contacts Comfy Cloud, the Comfy Router or any partner API, and no partner or API nodes are used.

## Bundled in release packages

- Node.js runtime (MIT; official build, checksum verified at build time), licence file in `node/LICENSE-node.txt`.
- zod (MIT) and ws (MIT), bundled into `app/server.mjs`.
- Preact (MIT), bundled into the UI.

## Preview thumbnails

The option thumbnails in `assets/previews/` were generated with FLUX.2 klein 4B (Apache-2.0) from synthetic characters and ship under this project's Apache-2.0 licence.
