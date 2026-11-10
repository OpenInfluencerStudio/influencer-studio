# Contributing

Thanks for helping. Influencer Studio is an early preview, so bug reports and testing on different hardware are the most useful contributions right now.

## Reporting a bug

1. In the app, open **About** and press **Copy report**. It has no file paths, user names, prompts or pictures.
2. Press **Feedback** (top bar) to open a new [GitHub issue](https://github.com/OpenInfluencerStudio/influencer-studio/issues), and paste the report.
3. Say what you did, what you expected and what happened. Add a screenshot if it helps.

Good titles: `[0.2.0-prelaunch] Hardware: Custom panel rejects 24 GB`. Testers can follow [docs/TESTING.md](docs/TESTING.md).

Keep issues SFW. Do not post unsuitable pictures, private information or session links (anything with `#t=`).

## Security issues

Please do not post the details of a security problem in public (for example a way around the session token, the loopback-only rule or the safety filter). Open an issue titled "Security contact request" with no details, and the maintainers will arrange a private way to share them.

## Setting up for development

Needs Node.js 20 or newer. A GPU and ComfyUI are optional: mock mode draws placeholder pictures.

```bash
npm install
npm run build
INFLUENCER_STUDIO_MOCK=1 npm start   # prints a private link
npm run dev:server                   # tsx watch
npm run dev:ui                       # vite dev server
```

Layout:

| Folder | What is in it |
|---|---|
| `server/` | Node and TypeScript server: hardware scan, levels, prompt compiler, safety, job queue, ComfyUI client, Comfy SDK engine, downloads |
| `ui/` | Preact and Vite interface |
| `workflows/` | ComfyUI API workflow templates with parameter slots |
| `data/limits.json` | Hardware levels and their limits |
| `models.json` | Model registry: licences, sources, SHA-256 checksums, VRAM and RAM needs |
| `assets/previews/` | Option thumbnails and preset pictures (webp) |
| `comfyui/` | Optional installer for an app-managed ComfyUI |
| `scripts/` | Packaging, smoke test, Playwright UI tests, link check |

## Before you send a pull request

```bash
npm test                                   # unit, golden and HTTP tests (vitest)
npm run typecheck
node scripts/check-links.mjs               # relative links and images in the docs
```

UI changes: the Playwright scripts in `scripts/` (`test-prelaunch.mjs`, `test-builder.mjs`, `test-presets.mjs` and others) run against a mock-mode server, for example `node scripts/test-presets.mjs "http://127.0.0.1:8787/#t=<token>" /tmp/shots`. They need `npm i --no-save playwright` and a Chrome install. `scripts/align-check.mjs` checks control alignment at four window sizes.

Packaging: `node scripts/package.mjs --platform win --arch x64`, then `node scripts/smoke-package.mjs dist-release/<folder>` (add `--keep` to keep the folder).

## Rules for changes

- **SFW, adults only, fully clothed, respectful.** No options, prompts, presets, thumbnails or examples that break this. See [SAFETY.md](SAFETY.md).
- **Open licences only.** New models must be Apache-2.0, MIT or similar, with a SHA-256 for every file in `models.json`, and an entry in [THIRD_PARTY.md](THIRD_PARTY.md). No partner nodes or closed APIs.
- **Local only.** No telemetry and no new network calls beyond ComfyUI on this computer and model downloads the user starts.
- **No private data in the repository:** no tokens, personal paths or real people's pictures.
- Keep changes small and focused, add or update tests, and write user-facing text in plain words.

By contributing you agree that your contribution is licensed under [Apache-2.0](LICENSE).
