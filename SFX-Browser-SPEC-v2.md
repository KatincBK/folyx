# SFX Browser — Build Spec (Tauri v2)

> **For the coding agent:** This is a complete, self-contained spec. Build the whole app from this single document. Do not ask clarifying questions for anything covered here; where something is unspecified, pick the simplest option that satisfies the Acceptance Criteria. Target a working `tauri dev` on the first run. Read the **Known Pitfalls** section before writing any code — the asset-protocol setup is the #1 thing that breaks audio playback.

---

## 1. What this app is

A **fast, minimalist desktop tool for auditioning sound effects.** The user points it at a folder full of game SFX (hundreds of files, nested in subfolders), and it lets them scan through and listen to each sound instantly — no loading waits, no auto-advance, no library import step.

It is **not** a media player and **not** an audio editor. There is no playlist, no queue, no editing, no tags, no database. It is a browser + an instant "play this one" button.

### Core problem it solves
Existing players (foobar2000, VLC) auto-advance to the next track when one finishes, which is wrong for SFX review. Here, **playing a sound never triggers another sound.** Each play is an isolated, deliberate action.

---

## 2. Goals & non-goals

**Goals**
- Pick a root folder; recursively find every audio file inside it (including all subfolders).
- Show the results as a single flat, scrollable, searchable list — fast even with 1000+ files.
- Select a file → it plays immediately. When it ends, **playback simply stops.** Nothing else plays.
- Keyboard-first: arrow keys move the selection, a key plays the selected one. Reviewing 200 sounds should feel like flicking through them.
- Cold-start to audible sound should feel instant (no perceptible loading spinner for a single short SFX).
- Remember the last folder between launches.

**Non-goals (do NOT build these)**
- No editing / trimming / effects / export.
- No playlists, queues, or auto-advance of any kind.
- No tagging, rating, metadata DB, or persistent library.
- No network features, no accounts, no cloud.
- No mobile build. Desktop only (Windows primary; macOS/Linux are a bonus, keep code cross-platform but don't add platform-specific UI).

---

## 3. Tech stack (use exactly this)

- **Framework:** Tauri v2 (current stable 2.x line). Scaffold with `create-tauri-app`.
- **Frontend template:** **React + TypeScript** (the `react-ts` template, Vite-based). The project is **already scaffolded with this template** — build on top of it, do not re-scaffold.
- **Backend:** Rust (Tauri core). Folder scanning happens in Rust for speed.
- **Audio playback:** native HTML5 `<audio>` element in the webview, fed file URLs via Tauri's `convertFileSrc`. Do **not** pull in Howler or any audio library; one `<audio>` element is enough. (See Section 6.3 for how to manage it correctly in React.)
- **Rust crates:** `walkdir` for recursive scanning. Tauri plugins: `tauri-plugin-dialog` (folder picker) and `tauri-plugin-store` (persist last folder). Nothing else.
- **Frontend libraries:** keep them minimal. No UI kit, no CSS framework, no state-management library (plain React state is enough). The **only** extra dependency allowed if needed is a list-virtualization library (`@tanstack/react-virtual` or `react-window`) — and only if plain rendering of the list is janky (see 6.2 / 9).

Keep total dependencies minimal. If a feature can be done with the platform/webview natively, do it natively.

---

## 4. Architecture overview

```
┌─────────────────────────────────────────────┐
│  Webview (React + TypeScript frontend)       │
│  - renders the file list + search + player   │
│  - one persistent <audio> ref does playback   │
│  - calls Rust commands via invoke()           │
└───────────────┬───────────────────────────────┘
                │ invoke / events
┌───────────────▼───────────────────────────────┐
│  Rust backend                                  │
│  - cmd: pick_folder()  -> opens OS dialog      │
│  - cmd: scan_folder(path) -> Vec<AudioFile>    │
│  - store plugin persists last_folder           │
└────────────────────────────────────────────────┘
```

Flow: user clicks **Open Folder** → Rust opens the native dialog → returns path → frontend calls `scan_folder(path)` → Rust walks the tree with `walkdir`, filters by audio extension, returns a list → frontend renders it → user navigates and plays via `<audio>` + `convertFileSrc`.

---

## 5. Rust backend — commands

Define these `#[tauri::command]` functions and register them in the invoke handler.

### 5.1 Data model
```rust
#[derive(serde::Serialize, Clone)]
struct AudioFile {
    name: String,          // file name with extension, e.g. "explosion_01.wav"
    path: String,          // absolute path, used for convertFileSrc
    rel_path: String,      // path relative to the chosen root, e.g. "weapons/explosion_01.wav"
    folder: String,        // immediate parent folder name, e.g. "weapons"
    ext: String,           // lowercase extension without dot, e.g. "wav"
    size_bytes: u64,
}
```

### 5.2 `scan_folder`
```rust
#[tauri::command]
fn scan_folder(root: String) -> Result<Vec<AudioFile>, String>
```
- Recursively walk `root` with `walkdir`.
- Keep only files whose lowercase extension is one of:
  `wav, mp3, ogg, flac, aiff, aif, m4a, aac, opus, wma`.
- Skip hidden files/folders (names starting with `.`).
- Sort the result by `rel_path` (case-insensitive) so the list order is stable and groups subfolders together.
- On error (path missing, permission denied), return `Err(message)` — the frontend will show it.
- This must stay fast for 1000+ files. `walkdir` + extension check is enough; do **not** read file contents or decode audio here.

### 5.3 `pick_folder`
Use `tauri-plugin-dialog`'s folder picker. Either expose it through the JS plugin API directly from the frontend, or wrap it in a command — pick whichever is simpler. Return the selected absolute path (or `None`/`null` if cancelled).

### 5.4 Persist last folder
Use `tauri-plugin-store` to save the last opened folder under key `last_folder`. On app start, the frontend reads it; if present and still exists, auto-scan it so the user lands straight in their library.

---

## 6. Frontend — behavior spec

### 6.1 Layout (single window, no chrome beyond the OS title bar)
A vertical stack:
1. **Top bar** (fixed): `Open Folder` button · current root path (truncated, ellipsized in the middle) · file count (e.g. "428 sounds").
2. **Search box** (fixed, just under the top bar): filters the list live by substring match against `rel_path` (case-insensitive). Empty = show all.
3. **File list** (fills remaining space, scrollable): one row per audio file.
4. **Player bar** (fixed at bottom): now-playing name, a seek/progress bar, current time / duration, play-pause toggle, and a volume slider.

### 6.2 File list rows
Each row shows: the **file name** (primary), and a smaller, dimmed **subfolder path** (`rel_path` minus the file name) so the user knows where it lives. Optionally a tiny right-aligned extension badge (`WAV`, `MP3`).
- The currently **selected** row is highlighted.
- The currently **playing** row gets a distinct accent (e.g. a small ▶ marker or accent bar) so it's clear which one is sounding.
- Rows must be cheap to render. With 1000+ items, **wrap each row in `React.memo`** so that changing the selection re-renders only the two affected rows (old + new selected), not the whole list. Pass primitive props (not freshly-created object/function references each render) so memoization actually holds — give row click handlers stable identities. If scrolling/typing still feels janky at 2000+ files, add virtualization with `@tanstack/react-virtual`. Try memoized plain rendering first.

### 6.3 Playback rules (THE important part)
- Use **one single, persistent `<audio>` element** held in a `useRef` (e.g. `const audioRef = useRef<HTMLAudioElement>(null)`). Render it **once** at the app root and never let it be remounted by re-renders. Control it **imperatively** through the ref — `audioRef.current.src = ...; audioRef.current.play()` — rather than driving `src` through JSX/state, because changing a keyed/conditionally-rendered audio element remounts it and kills playback. Treat the `<audio>` element as a mutable instance React doesn't re-create.
- Playing a file: set `audioRef.current.src = convertFileSrc(file.path)`, then `.play()`.
- **Selecting a file auto-plays it from the start.** (This is the fast-audition flow.)
- Selecting/playing a new file **stops and replaces** the current one (only one sound at a time) — just reassign `src` and call `.play()` again on the same element.
- **When a sound finishes, do nothing.** The `onEnded` handler must NOT advance the selection, change `src`, or start another file. It may only update UI state (e.g. set `isPlaying = false`). This "do nothing on end" rule is the entire point of the app — do not add next-track logic.
- Clicking an already-selected, finished row replays it from the start (reset `currentTime = 0`, then `.play()`).
- React state holds *what is selected and whether it's playing* (`selectedIndex`, `isPlaying`, `currentTime`, `duration`); the ref holds the *actual element*. Keep these two concerns separate — never store the `HTMLAudioElement` itself in state.

### 6.4 Keyboard controls (must work without clicking into anything)
- **↓ / ↑** — move selection down/up by one row. Selection auto-plays the newly selected file. The list auto-scrolls to keep the selection visible.
- **Space** — toggle play/pause of the current selection (don't move selection).
- **Enter** — replay the selected file from the start.
- **/** (slash) — focus the search box. **Esc** — clear search / unfocus search and return focus to the list.
- Holding ↓ to scan rapidly through sounds should feel responsive: debounce is fine, but each landed selection should start playing promptly.

### 6.5 States to handle
- **No folder chosen yet:** empty state with a clear "Open a folder of sounds to get started" + the Open Folder button centered.
- **Scanning:** brief inline indicator; for big trees show "Scanning…". (Scanning is one-time per folder open, not per-play.)
- **Folder has zero audio files:** message saying so.
- **A file fails to play** (codec unsupported by the webview, e.g. some `.wma`/`.aiff`): show a small inline error on the player bar and keep going; do not crash. Note in UI which formats may not play in the webview.
- **Persisted folder no longer exists on launch:** fall back to the empty state.

### 6.6 Visual style — minimalist
- Dark theme by default. Neutral grays, one subtle accent color for selection/playing. System UI font. Generous but compact spacing. No gradients, no shadows-as-decoration, no icons beyond play/pause and volume. Think "developer tool," not "consumer media player." The list and instant playback are the product; the chrome should disappear.

---

## 7. Critical configuration — `tauri.conf.json`

**The webview cannot play files off the disk by default.** You must enable the asset protocol and give it a scope, or `<audio src=convertFileSrc(...)>` returns 403 / "asset protocol not configured to allow the path."

In `tauri.conf.json` under `app.security`, set:

```json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": {
          "allow": ["**"],
          "requireLiteralLeadingDot": false
        }
      },
      "csp": "default-src 'self'; media-src 'self' asset: http://asset.localhost https://asset.localhost; img-src 'self' asset: http://asset.localhost https://asset.localhost"
    }
  }
}
```

Notes:
- The scope **must** be broad (`["**"]`) because the user picks an arbitrary folder at runtime, and the dialog plugin does **not** auto-extend the asset scope to the picked path. A narrow scope = silent playback failures. (For a single-user local tool auditioning their own files this broad scope is acceptable.)
- The CSP **must** include `media-src ... asset:` (and the `asset.localhost` origins) or the webview blocks the audio even when the scope allows it.
- In the frontend, import `convertFileSrc` from `@tauri-apps/api/core` and use it for every file path before assigning to `<audio>.src`.

Also ensure the dialog and store plugins are registered in `src-tauri/src/lib.rs` (`.plugin(tauri_plugin_dialog::init())`, `.plugin(tauri_plugin_store::Builder::new().build())`) and their permissions are added to `src-tauri/capabilities/default.json` (e.g. `dialog:allow-open`, `store:default`, plus core defaults). Add the matching npm packages `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-store`.

---

## 8. Acceptance criteria (definition of done)

The build is done when ALL of these are true:

1. `npm install && npm run tauri dev` launches the app on Windows with no manual fixups.
2. Clicking **Open Folder** opens the native OS folder picker.
3. After choosing a folder with nested subfolders, every supported audio file inside it (at any depth) appears in the list, sorted by relative path, with an accurate count.
4. Clicking a row plays that sound immediately, with no spinner for a normal short SFX.
5. When a sound finishes playing, **no other sound starts** and the selection does not move.
6. ↑/↓ move the selection and auto-play the selected file; the list scrolls to follow; holding the key lets you scan quickly.
7. Space pauses/resumes; Enter replays from start.
8. The search box filters the visible list live by path substring.
9. Closing and reopening the app re-opens the last folder automatically.
10. A file in an unsupported codec shows an inline error instead of crashing.
11. The app stays responsive with 1000+ files in the list.

---

## 9. Known pitfalls (read before coding)

- **#1 audio won't play:** almost always the asset protocol / CSP (Section 7). Set `assetProtocol.enable = true`, scope `["**"]`, and `media-src asset:` in CSP. Use `convertFileSrc` — never a raw `file://` URL.
- **Dialog scope ≠ asset scope:** picking a folder via the dialog plugin does NOT grant the asset protocol access to it. The broad asset scope is what makes runtime-chosen paths playable.
- **Windows path separators:** `convertFileSrc` handles them, but if you build URLs manually you'll break. Always go through `convertFileSrc`.
- **Don't decode audio in Rust:** scanning must be a pure filesystem walk. Decoding to get duration would make scanning slow; get duration from the `<audio>` element's `onLoadedMetadata` event in the frontend instead.
- **`onEnded` event:** make sure no handler on `onEnded` advances playback. It's easy to add "next track" logic by habit — don't. It may only flip `isPlaying` to false.
- **React: don't remount the `<audio>`:** keep it in a `useRef`, render it once at the root, control it imperatively. Driving `src` through state + JSX, or giving it a changing `key`, remounts the element and cuts off playback. (See 6.3.)
- **React: stale-closure key handlers:** the global key listener (↑/↓/Space/Enter) reads `selectedIndex`. If you register it once in a `useEffect` with `[]`, it captures the initial value forever. Either keep the latest selection in a ref that the handler reads, or re-bind the listener when selection changes. Don't ship arrow keys that "stop working after the first move."
- **React: rapid key-repeat re-renders:** holding ↓ fires many selection changes; combined with a 1000-row list this can thrash. Memoized rows (6.2) plus imperative audio (not src-via-state) keep this smooth.
- **Large lists:** if memoized plain rendering of 2000 rows is still janky, add `@tanstack/react-virtual`, but try memoization first.

---

## 10. Suggested file structure

```
sfx-browser/
├─ src/                       # React + TypeScript frontend
│  ├─ main.tsx                # React entry (from template)
│  ├─ App.tsx                 # root: owns state, renders the single <audio>, wires everything
│  ├─ hooks/
│  │  ├─ useAudioPlayer.ts    # wraps the persistent <audio> ref: play/pause/replay/seek/volume
│  │  └─ useKeyboard.ts       # global ↑/↓/Space/Enter//Esc handling (reads latest selection via ref)
│  ├─ components/
│  │  ├─ TopBar.tsx           # Open Folder button, root path, file count
│  │  ├─ SearchBox.tsx        # live filter input
│  │  ├─ FileList.tsx         # scroll container + selection/scroll-into-view
│  │  ├─ FileRow.tsx          # React.memo'd single row
│  │  └─ PlayerBar.tsx        # now-playing, seek bar, time, play/pause, volume
│  ├─ types.ts                # AudioFile type (mirrors the Rust struct)
│  └─ styles.css              # minimalist dark theme
├─ index.html
├─ src-tauri/
│  ├─ src/lib.rs              # commands: scan_folder; plugin registration
│  ├─ src/main.rs
│  ├─ tauri.conf.json         # asset protocol + CSP (Section 7)
│  ├─ capabilities/default.json
│  └─ Cargo.toml              # walkdir, dialog, store
└─ package.json
```

State lives in `App.tsx`: `{ root, files: AudioFile[], filtered: AudioFile[], selectedIndex, isPlaying, currentTime, duration }` via plain `useState`/`useMemo` (derive `filtered` from `files` + search query with `useMemo`). No state-management library. The `<audio>` element is a `useRef` owned by `App` and passed to `useAudioPlayer` — it is **never** stored in React state.
