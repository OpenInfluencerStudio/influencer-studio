// Build a self-contained release folder + archive for one platform. Works from any host (the app is plain JavaScript).
//   node scripts/package.mjs --platform win|mac|linux --arch x64|arm64 [--node 24.19.0] [--out dist-release] [--no-build] [--keep]
// Result: <out>/InfluencerStudio-<version>-<platform>-<arch>.zip (win) or .tar.gz (mac, linux), plus a .sha256 file.
// The folder holds: the official Node.js runtime (downloaded and checked against nodejs.org SHASUMS256), one bundled server file,
// the built UI, models.json, workflows, thumbnails, and a launcher that opens your browser at the private link.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const flag = n => process.argv.includes('--' + n);
const platform = arg('platform', process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux');
const arch = arg('arch', process.arch === 'arm64' ? 'arm64' : 'x64');
const nodeVersion = arg('node', '24.19.0');
const outDir = path.resolve(root, arg('out', 'dist-release'));
if (!['win', 'mac', 'linux'].includes(platform) || !['x64', 'arm64'].includes(arch)) throw new Error('bad --platform/--arch');
if (!/^\d+\.\d+\.\d+$/.test(nodeVersion)) throw new Error('bad --node');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const name = `InfluencerStudio-${version}-${platform}-${arch}`;
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

if (!flag('no-build')) { console.log('> building UI and server'); sh('npm', ['run', 'build'], { shell: process.platform === 'win32' }); }

// 1. stage folder
const stage = path.join(outDir, name); fs.rmSync(stage, { recursive: true, force: true }); fs.mkdirSync(stage, { recursive: true });
const cp = (from, to) => fs.cpSync(path.join(root, from), path.join(stage, to), { recursive: true });

// 2. bundle the server (zod and ws are bundled in; no node_modules needed at run time)
console.log('> bundling server');
await build({ entryPoints: [path.join(root, 'server/src/index.ts')], bundle: true, platform: 'node', target: 'node22', format: 'esm', outfile: path.join(stage, 'app', 'server.mjs'), minify: false, legalComments: 'linked', logLevel: 'warning',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" }, define: { 'process.env.WS_NO_BUFFER_UTIL': '"1"', 'process.env.WS_NO_UTF_8_VALIDATE': '"1"' } });
fs.writeFileSync(path.join(stage, 'app', 'package.json'), JSON.stringify({ type: 'module', private: true }));
cp('ui/dist', 'ui/dist'); cp('models.json', 'models.json'); cp('workflows', 'workflows'); cp('data/limits.json', 'data/limits.json');
if (fs.existsSync(path.join(root, 'assets/previews'))) cp('assets/previews', 'assets/previews');
for (const f of ['LICENSE', 'THIRD_PARTY.md', 'SAFETY.md', 'FAQ.md', 'README.md']) if (fs.existsSync(path.join(root, f))) cp(f, f);
fs.copyFileSync(path.join(root, 'docs/INSTALL.md'), path.join(stage, 'INSTALL.md'));
if (fs.existsSync(path.join(stage, 'app', 'server.mjs.LEGAL.txt'))) fs.renameSync(path.join(stage, 'app', 'server.mjs.LEGAL.txt'), path.join(stage, 'THIRD_PARTY_BUNDLED.txt'));

// 3. Node runtime for the target (official build, checksum checked)
const nodePlat = { win: 'win', mac: 'darwin', linux: 'linux' }[platform]; const ext = platform === 'win' ? 'zip' : 'tar.gz';
const nodeFile = `node-v${nodeVersion}-${nodePlat}-${arch}.${ext}`;
const cache = path.join(os.homedir(), '.cache', 'influencer-studio-build'); fs.mkdirSync(cache, { recursive: true });
const nodeArc = path.join(cache, nodeFile);
if (!fs.existsSync(nodeArc)) {
  console.log('> downloading', nodeFile);
  const part = nodeArc + '.part';
  // curl resumes and retries on flaky connections; it ships with Windows 10+, macOS and Linux.
  sh('curl', ['-fL', '--retry', '8', '--retry-delay', '2', '--retry-all-errors', '-C', '-', '-o', part, `https://nodejs.org/dist/v${nodeVersion}/${nodeFile}`]);
  fs.renameSync(part, nodeArc);
}
const sums = execFileSync('curl', ['-fsSL', '--retry', '5', `https://nodejs.org/dist/v${nodeVersion}/SHASUMS256.txt`], { encoding: 'utf8' });
const want = sums.split('\n').find(l => l.endsWith('  ' + nodeFile))?.split(/\s+/)[0];
if (!want) throw new Error('No checksum listed for ' + nodeFile);
if (sha256(nodeArc) !== want) { fs.unlinkSync(nodeArc); throw new Error('Node archive checksum mismatch, deleted. Run again.'); }
console.log('> node checksum ok', want.slice(0, 16));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'is-node-'));
if (ext === 'zip') { const py = spawnSync('python3', ['-c', 'import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', nodeArc, tmp]); if (py.status !== 0) sh(process.platform === 'win32' ? 'tar' : 'unzip', process.platform === 'win32' ? ['-xf', nodeArc, '-C', tmp] : ['-q', nodeArc, '-d', tmp]); }
else sh('tar', ['-xzf', nodeArc, '-C', tmp]);
const nodeDir = path.join(tmp, `node-v${nodeVersion}-${nodePlat}-${arch}`);
fs.mkdirSync(path.join(stage, 'node'), { recursive: true });
if (platform === 'win') fs.copyFileSync(path.join(nodeDir, 'node.exe'), path.join(stage, 'node', 'node.exe'));
else { fs.copyFileSync(path.join(nodeDir, 'bin', 'node'), path.join(stage, 'node', 'node')); fs.chmodSync(path.join(stage, 'node', 'node'), 0o755); }
fs.copyFileSync(path.join(nodeDir, 'LICENSE'), path.join(stage, 'node', 'LICENSE-node.txt'));
fs.rmSync(tmp, { recursive: true, force: true });

// 4. launchers
const env = (win) => win
  ? ['set "INFLUENCER_STUDIO_OPEN=1"', 'if not defined INFLUENCER_STUDIO_DATA set "INFLUENCER_STUDIO_DATA=%LOCALAPPDATA%\\InfluencerStudio"']  // COMFYUI_URL is left unset so the server auto-detects 8188, then 8288; set it to pin an address
  : ['export INFLUENCER_STUDIO_OPEN=1', 'export INFLUENCER_STUDIO_DATA="${INFLUENCER_STUDIO_DATA:-$HOME/.influencer-studio}"'];
if (platform === 'win') {
  fs.writeFileSync(path.join(stage, 'start.bat'), ['@echo off', 'setlocal', 'cd /d "%~dp0"', 'title Influencer Studio', ...env(true), 'echo Starting Influencer Studio. Your browser opens by itself. Close this window to stop.', '"%~dp0node\\node.exe" "%~dp0app\\server.mjs"', 'if errorlevel 1 (echo. & echo The app stopped with an error. See above. & pause)', ''].join('\r\n'));
  fs.copyFileSync(path.join(root, 'ui/public/favicon.ico'), path.join(stage, 'icon.ico'));
  fs.writeFileSync(path.join(stage, 'Create desktop shortcut.bat'), ['@echo off', 'cd /d "%~dp0"', 'powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath(\'Desktop\')+\'\\Influencer Studio.lnk\'); $s.TargetPath=\'%~dp0start.bat\'; $s.WorkingDirectory=\'%~dp0\'; $s.IconLocation=\'%~dp0icon.ico\'; $s.Save()"', 'echo A shortcut called Influencer Studio is now on your desktop.', 'pause', ''].join('\r\n'));
} else {
  const body = ['#!/bin/sh', 'cd "$(dirname "$0")"', ...env(false), 'echo "Starting Influencer Studio. Your browser opens by itself. Press Ctrl+C to stop."', 'exec ./node/node ./app/server.mjs', ''].join('\n');
  const f = platform === 'mac' ? 'start.command' : 'start.sh'; fs.writeFileSync(path.join(stage, f), body, { mode: 0o755 }); fs.chmodSync(path.join(stage, f), 0o755);
}
// Optional app-managed ComfyUI: only the pinned lock file, installer scripts and licence notes ship. ComfyUI itself (GPL-3.0) is downloaded by the user's own run of the installer.
fs.mkdirSync(path.join(stage, 'comfyui'), { recursive: true });
for (const f of ['comfyui.lock.json', 'README.md', platform === 'win' ? 'install-comfyui.ps1' : 'install-comfyui.sh']) fs.copyFileSync(path.join(root, 'comfyui', f), path.join(stage, 'comfyui', f));
if (platform !== 'win') fs.chmodSync(path.join(stage, 'comfyui', 'install-comfyui.sh'), 0o755);
else fs.writeFileSync(path.join(stage, 'Install ComfyUI (optional).bat'), ['@echo off', 'cd /d "%~dp0"', 'echo This downloads the official ComfyUI portable build (about 2 GB, GPL-3.0, a separate program) into the comfyui folder.', 'echo Skip this if you already run ComfyUI. Close this window to cancel.', 'pause', 'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0comfyui\\install-comfyui.ps1" %*', 'pause', ''].join('\r\n'));
if (fs.existsSync(path.join(root, 'docs/prelaunch-test-checklist.md'))) fs.copyFileSync(path.join(root, 'docs/prelaunch-test-checklist.md'), path.join(stage, 'TESTING.md'));
fs.writeFileSync(path.join(stage, 'BUILD-INFO.json'), JSON.stringify({ app: 'influencer-studio', version, platform, arch, node: nodeVersion, nodeSha256: want, builtAt: new Date().toISOString().slice(0, 10) }, null, 2));

// 5. archive + checksum
const archive = path.join(outDir, name + (platform === 'win' ? '.zip' : '.tar.gz')); fs.rmSync(archive, { force: true });
if (platform === 'win') {
  // Try, in order: zip, Python's zipfile, bsdtar (Windows and macOS tar). GNU tar cannot write zip files, so it is never used here.
  const bsd = (spawnSync('tar', ['--version'], { encoding: 'utf8' }).stdout ?? '').includes('bsdtar');
  const tries = [['zip', ['-qr', archive, name]], ['python3', ['-c', 'import shutil,sys;shutil.make_archive(sys.argv[1],"zip",sys.argv[2],sys.argv[3])', archive.replace(/\.zip$/, ''), outDir, name]], ['python', ['-c', 'import shutil,sys;shutil.make_archive(sys.argv[1],"zip",sys.argv[2],sys.argv[3])', archive.replace(/\.zip$/, ''), outDir, name]], ...(bsd ? [['tar', ['-a', '-cf', archive, name]]] : [])];
  let made = false; for (const [c, a] of tries) { const r = spawnSync(c, a, { cwd: outDir }); if (r.status === 0 && fs.existsSync(archive)) { made = true; break; } }
  if (!made) throw new Error('Could not create the zip (install zip or Python)');
  const head = fs.readFileSync(archive).subarray(0, 2).toString('latin1'); if (head !== 'PK') throw new Error('The archive is not a valid zip');
} else sh('tar', ['-czf', archive, '-C', outDir, name]);
fs.writeFileSync(archive + '.sha256', `${sha256(archive)}  ${path.basename(archive)}\n`);
console.log('> done', archive, (fs.statSync(archive).size / 1e6).toFixed(1) + ' MB');
if (!flag('keep')) fs.rmSync(stage, { recursive: true, force: true });
