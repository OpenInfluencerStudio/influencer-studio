# Optional: install the app-managed ComfyUI (Windows) into this folder.
# ComfyUI is a separate program under GPL-3.0 (https://github.com/Comfy-Org/ComfyUI). This script downloads the pinned
# official portable build from GitHub and checks its SHA-256. Influencer Studio stays Apache-2.0 and only talks to it over HTTP.
#   powershell -ExecutionPolicy Bypass -File install-comfyui.ps1 [-Variant auto|nvidia|nvidia_cu126|amd|intel] [-DryRun] [-KeepDownload]
param([ValidateSet('auto', 'nvidia', 'nvidia_cu126', 'amd', 'intel')][string]$Variant = 'auto', [switch]$DryRun, [switch]$KeepDownload)
$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'
$here = $PSScriptRoot; $lock = Get-Content (Join-Path $here 'comfyui.lock.json') -Raw | ConvertFrom-Json
function Get-Sha([string]$f) { (Get-FileHash -Algorithm SHA256 -LiteralPath $f).Hash.ToLower() }
function Get-File([string]$url, [string]$out) { & curl.exe -fL --retry 8 --retry-delay 2 --retry-all-errors -C - -o $out $url; if ($LASTEXITCODE -ne 0) { throw "Download failed: $url" } }
if ($Variant -eq 'auto') {
  $gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name })
  if ($gpus -match 'NVIDIA') { if ($gpus -match 'GTX (9|10)\d\d|GTX 7\d\d|Quadro [KMP]\d') { $Variant = 'nvidia_cu126' } else { $Variant = 'nvidia' } }
  elseif ($gpus -match 'Radeon|AMD') { $Variant = 'amd' }
  elseif ($gpus -match 'Arc') { $Variant = 'intel' }
  else { Write-Host 'No supported graphics card found. Use your own ComfyUI, or try the app with INFLUENCER_STUDIO_MOCK=1.'; exit 1 }
}
$v = $lock.windowsPortable.$Variant; $ver = $lock.comfyui.version
$url = "https://github.com/Comfy-Org/ComfyUI/releases/download/$ver/$($v.file)"
$needGb = [math]::Ceiling($v.sizeMb * 4 / 1024)
$drive = (Get-Item $here).PSDrive; $freeGb = [math]::Floor($drive.Free / 1GB)
Write-Host 'Influencer Studio: app-managed ComfyUI'
Write-Host "  ComfyUI $ver (GPL-3.0, separate program), $Variant portable: $($v.for)"
Write-Host "  Download: $url ($($v.sizeMb) MB), SHA-256 $($v.sha256.Substring(0, 16))..."
Write-Host "  Into: $here (needs about $needGb GB free; $freeGb GB free on $($drive.Name):)"
if ($DryRun) { Write-Host 'Dry run: nothing downloaded.'; exit 0 }
if ($freeGb -lt $needGb) { throw "Not enough free disk space on $($drive.Name): ($freeGb GB free, about $needGb GB needed)." }
$dl = Join-Path $here 'downloads'; New-Item -ItemType Directory -Force -Path $dl | Out-Null
$arc = Join-Path $dl $v.file
if (-not (Test-Path $arc) -or (Get-Sha $arc) -ne $v.sha256) { Get-File $url "$arc.part"; Move-Item -Force "$arc.part" $arc }
if ((Get-Sha $arc) -ne $v.sha256) { Remove-Item -Force $arc; throw 'Checksum mismatch: the download was deleted. Run the script again.' }
Write-Host 'Checksum OK. Unpacking (this takes a few minutes)...'
$portable = Join-Path $here 'ComfyUI_windows_portable'
& tar.exe -xf $arc -C $here 2>$null
if (-not (Test-Path (Join-Path $portable 'python_embeded\python.exe'))) {
  $z = $lock.sevenZip; $zr = Join-Path $dl $z.file
  if (-not (Test-Path $zr) -or (Get-Sha $zr) -ne $z.sha256) { Get-File $z.url $zr }
  if ((Get-Sha $zr) -ne $z.sha256) { Remove-Item -Force $zr; throw '7zr.exe checksum mismatch.' }
  & $zr x $arc "-o$here" -y | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'Could not unpack the ComfyUI archive.' }
}
$py = Join-Path $portable 'python_embeded\python.exe'
foreach ($n in $lock.customNodes) {
  $dest = Join-Path $portable "ComfyUI\custom_nodes\$($n.name)"
  if (-not (Test-Path $dest)) {
    $zip = Join-Path $dl "$($n.name)-$($n.commit).zip"; Get-File "$($n.repo -replace 'github.com', 'codeload.github.com')/zip/$($n.commit)" $zip
    $tmp = Join-Path $dl "$($n.name)-unzip"; Expand-Archive -Force -LiteralPath $zip -DestinationPath $tmp
    Move-Item (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName $dest; Remove-Item -Recurse -Force $tmp
  }
  if (Test-Path (Join-Path $dest 'requirements.txt')) { & $py -s -m pip install -r (Join-Path $dest 'requirements.txt'); if ($LASTEXITCODE -ne 0) { throw "pip failed for $($n.name)" } }
}
@{ kind = 'portable'; version = $ver; variant = $Variant; license = 'GPL-3.0'; source = "$($lock.comfyui.source)/tree/$ver"; installedAt = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $here 'install.json')
if (-not $KeepDownload) { Remove-Item -Force $arc }
Write-Host "Done. Start Influencer Studio as usual; it starts this ComfyUI by itself on port $($lock.port) when no other ComfyUI is running."
