import { spawn } from 'node:child_process';

/** Open the app's own loopback URL in the default browser. Refuses anything else; no shell is involved. */
export function openBrowser(url: string): boolean {
  let u: URL; try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'http:' || u.hostname !== '127.0.0.1') return false;
  try {
    const [cmd, args] = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    const c = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }); c.on('error', () => {}); c.unref(); return true;
  } catch { return false; }
}
