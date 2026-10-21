#!/bin/sh
# Optional: install the app-managed ComfyUI (Linux and macOS) into this folder.
# ComfyUI is a separate program under GPL-3.0 (https://github.com/Comfy-Org/ComfyUI). This script downloads the
# pinned official version from GitHub; Influencer Studio itself stays Apache-2.0 and only talks to it over HTTP.
#   ./install-comfyui.sh [auto|nvidia|nvidia_cu126|amd|cpu|mac] [--dry-run] [--proxy-only]
# --proxy-only: you already run ComfyUI; only install comfy-api-proxy (MIT, the local Comfy API v2 server the app's Comfy SDK uses).
# Re-running is safe: it re-checks out the pinned version and reinstalls requirements.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
lock="$here/comfyui.lock.json"
variant=auto; dry=0; proxyonly=0
for a in "$@"; do case "$a" in --dry-run) dry=1 ;; --proxy-only) proxyonly=1 ;; auto|nvidia|nvidia_cu126|amd|cpu|mac) variant=$a ;; *) echo "Unknown option: $a" >&2; exit 2 ;; esac; done
PY=${PYTHON:-python3}
command -v "$PY" >/dev/null 2>&1 || { echo "Python 3.10 to 3.13 is needed (python3 not found)." >&2; exit 1; }
"$PY" -c 'import sys; sys.exit(0 if (3,10) <= sys.version_info[:2] <= (3,13) else 1)' || { echo "Python 3.10 to 3.13 is needed; found $("$PY" --version 2>&1). Set PYTHON=/path/to/python3.13" >&2; exit 1; }
j() { "$PY" -c 'import json,sys; d=json.load(open(sys.argv[1]))
for k in sys.argv[2].split("."): d=d[int(k)] if isinstance(d,list) else d[k]
print(d)' "$lock" "$1"; }
install_proxy() {
  pver=$(j sdkProxy.version)
  echo "Installing comfy-api-proxy $pver (MIT) into $here/proxy-venv"
  [ -x "$here/proxy-venv/bin/python" ] || "$PY" -m venv "$here/proxy-venv"
  "$here/proxy-venv/bin/python" -m pip install --upgrade pip >/dev/null
  "$here/proxy-venv/bin/python" -m pip install "comfy-api-proxy==$pver"
}
if [ "$proxyonly" = 1 ]; then
  [ "$dry" = 1 ] && { echo "Dry run: would install comfy-api-proxy $(j sdkProxy.version) into $here/proxy-venv"; exit 0; }
  install_proxy; echo "Done. The app starts comfy-api-proxy by itself in front of your ComfyUI."; exit 0
fi
command -v git >/dev/null 2>&1 || { echo "git is needed." >&2; exit 1; }
if [ "$variant" = auto ]; then
  if [ "$(uname -s)" = Darwin ]; then variant=mac
  elif command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1; then variant=nvidia
  elif [ -e /dev/kfd ]; then variant=amd
  else variant=cpu; fi
fi
ver=$(j comfyui.version); repo=$(j comfyui.source); idx=$(j torchIndex.$variant)
gname=$(j customNodes.0.name); grepo=$(j customNodes.0.repo); gcommit=$(j customNodes.0.commit)
echo "Influencer Studio: app-managed ComfyUI"
echo "  ComfyUI $ver (GPL-3.0, separate program) from $repo"
echo "  PyTorch: ${idx:-default PyPI build} (variant $variant)"
echo "  Custom node: $gname @ ${gcommit%????????????????????????????????}"
echo "  Comfy SDK proxy: comfy-api-proxy $(j sdkProxy.version) (MIT) in its own venv"
echo "  Into: $here (about 5-8 GB with PyTorch; models are separate)"
[ "$dry" = 1 ] && { echo "Dry run: nothing downloaded."; exit 0; }
if [ -d "$here/ComfyUI/.git" ]; then git -C "$here/ComfyUI" fetch --depth 1 origin tag "$ver"; git -C "$here/ComfyUI" checkout -q "$ver"
else git clone --depth 1 --branch "$ver" "$repo" "$here/ComfyUI"; fi
[ -x "$here/venv/bin/python" ] || "$PY" -m venv "$here/venv"
vpy="$here/venv/bin/python"
"$vpy" -m pip install --upgrade pip
if [ -n "$idx" ]; then "$vpy" -m pip install torch torchvision torchaudio --index-url "$idx"; else "$vpy" -m pip install torch torchvision torchaudio; fi
"$vpy" -m pip install -r "$here/ComfyUI/requirements.txt"
gdir="$here/ComfyUI/custom_nodes/$gname"
[ -d "$gdir/.git" ] || git clone "$grepo" "$gdir"
git -C "$gdir" fetch -q origin "$gcommit" 2>/dev/null || true; git -C "$gdir" checkout -q "$gcommit"
"$vpy" -m pip install -r "$gdir/requirements.txt"
install_proxy
cat > "$here/install.json" <<JSON
{ "kind": "venv", "version": "$ver", "variant": "$variant", "license": "GPL-3.0", "source": "$repo/tree/$ver", "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)" }
JSON
echo "Done. Start Influencer Studio as usual; it starts this ComfyUI by itself on port $(j port) when no other ComfyUI is running."
