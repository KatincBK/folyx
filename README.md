# Folyx

A fast, minimalist desktop tool for **auditioning sound effects**. Point it at a
folder of SFX (hundreds of files, nested in subfolders) and flick through them —
each sound plays the instant you select it, and **playing a sound never triggers
another one.** No auto-advance, no library import, no editing. Just a searchable
list and an instant "play this one."

Built with [Tauri v2](https://tauri.app) + React + TypeScript.

## Features

- Recursively scans a folder for audio (`wav, mp3, ogg, flac, aiff, aif, m4a, aac, opus, wma`).
- Flat, searchable, scrollable list — fast with 1000+ files.
- **Keyboard-first:** ↑/↓ move and auto-play, **Space** play/pause, **Enter** replay,
  **/** search, **Esc** clear, **Del** delete (to the Recycle Bin).
- Right-click a track → **Delete**.
- Remembers the last folder between launches.
- **Self-updating:** new releases install themselves.

## Develop

Requires Node, Rust (MSVC toolchain on Windows), and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

## Cutting a release

Releases are built and signed by GitHub Actions (`.github/workflows/release.yml`)
and published to GitHub Releases. Installed copies pick them up automatically.

1. Bump the version in **both** `package.json` and `src-tauri/tauri.conf.json`.
2. Tag and push:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
3. The workflow builds the Windows installer, signs the update, and publishes the
   release with `latest.json`.

> The updater signing key lives in repo secrets `TAURI_SIGNING_PRIVATE_KEY` and
> `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The private key is **not** in this repo —
> keep your backup safe; losing it means existing installs can no longer update.
