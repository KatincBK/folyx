import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import type { AudioFile } from "./types";
import { getLastFolder, setLastFolder } from "./store";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useKeyboard } from "./hooks/useKeyboard";
import { TopBar } from "./components/TopBar";
import { SearchBox } from "./components/SearchBox";
import { FileList } from "./components/FileList";
import { PlayerBar } from "./components/PlayerBar";
import { ContextMenu } from "./components/ContextMenu";
import "./styles.css";

/** Simple centered message used for the empty / scanning / no-files / error states. */
function CenterState({
  title,
  hint,
  error,
  children,
}: {
  title: string;
  hint?: string;
  error?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={"center-state" + (error ? " center-state--error" : "")}>
      <div className="center-state__title">{title}</div>
      {hint && <div className="center-state__hint">{hint}</div>}
      {children}
    </div>
  );
}

function App() {
  // ── State: what's loaded and what's selected/playing ──────────────────
  const [root, setRoot] = useState<string | null>(null);
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [playingFile, setPlayingFile] = useState<AudioFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // Live, case-insensitive substring filter over the relative path.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.rel_path.toLowerCase().includes(q));
  }, [files, query]);

  // The one persistent <audio> element; src is set imperatively (see useAudioPlayer).
  const audioRef = useRef<HTMLAudioElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const controller = useAudioPlayer(audioRef, {
    onTimeUpdate: setCurrentTime,
    onLoadedMetadata: setDuration,
    onPlay: () => {
      setIsPlaying(true);
      setPlayError(null);
    },
    onPause: () => setIsPlaying(false),
    // THE rule: a finished sound stops here. No advancing, ever.
    onEnded: () => setIsPlaying(false),
    onError: () => {
      setIsPlaying(false);
      const f = playingFileRef.current;
      setPlayError(
        f
          ? `Can't play "${f.name}" — ${f.ext.toUpperCase()} may be unsupported by the webview.`
          : "Playback error.",
      );
    },
  });

  // Keep the audio element's volume in sync with state (also sets it initially).
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ── Refs mirroring the latest state, read by stable/global callbacks ──
  const selectedIndexRef = useRef(selectedIndex);
  const filteredRef = useRef(filtered);
  const playingFileRef = useRef(playingFile);
  const queryRef = useRef(query);
  selectedIndexRef.current = selectedIndex;
  filteredRef.current = filtered;
  playingFileRef.current = playingFile;
  queryRef.current = query;

  // Play the file at `index` in the *filtered* list, from the start. Re-playing
  // the already-playing file just restarts it.
  function play(index: number) {
    const list = filteredRef.current;
    if (index < 0 || index >= list.length) return;
    const file = list[index];
    setSelectedIndex(index);
    setPlayError(null);
    setCurrentTime(0);
    if (playingFileRef.current?.path === file.path) {
      controller.replay();
      return;
    }
    setPlayingFile(file);
    setDuration(0);
    controller.play(convertFileSrc(file.path));
  }

  // Stable `play` reference so memoized rows don't re-render on every change.
  const playRef = useRef(play);
  playRef.current = play;
  const onSelect = useCallback((index: number) => playRef.current(index), []);

  // Move the currently-selected file to the Recycle Bin and drop it from the list.
  // Does not start playback; the cursor stays put so the next file slides under it.
  const deleteSelected = useCallback(async () => {
    const idx = selectedIndexRef.current;
    const list = filteredRef.current;
    if (idx < 0 || idx >= list.length) return;
    const file = list[idx];
    try {
      await invoke("delete_file", { path: file.path });
    } catch (err) {
      setPlayError(`Couldn't delete "${file.name}": ${String(err)}`);
      return;
    }
    // If the deleted file was the one loaded in the player, stop it.
    if (playingFileRef.current?.path === file.path) {
      audioRef.current?.pause();
      setPlayingFile(null);
      setIsPlaying(false);
    }
    setFiles((prev) => prev.filter((f) => f.path !== file.path));
    // Clamp the cursor: same index now points to the next file (or the new last).
    const newLen = list.length - 1;
    setSelectedIndex(idx >= newLen ? newLen - 1 : idx);
  }, []);

  // Right-click a row: select it (no playback) and open the context menu there.
  const onContextMenu = useCallback((index: number, x: number, y: number) => {
    setSelectedIndex(index);
    setMenu({
      x: Math.min(x, window.innerWidth - 160),
      y: Math.min(y, window.innerHeight - 80),
    });
  }, []);

  // ── Folder scanning ───────────────────────────────────────────────────
  const scan = useCallback(async (path: string, isRestore = false) => {
    audioRef.current?.pause();
    setScanning(true);
    setScanError(null);
    setSelectedIndex(-1);
    setPlayingFile(null);
    setIsPlaying(false);
    setQuery("");
    try {
      const result = await invoke<AudioFile[]>("scan_folder", { root: path });
      setFiles(result);
      setRoot(path);
    } catch (err) {
      if (isRestore) {
        // A remembered folder that no longer exists → quietly fall back to empty.
        setRoot(null);
        setFiles([]);
      } else {
        setRoot(path);
        setFiles([]);
        setScanError(String(err));
      }
    } finally {
      setScanning(false);
    }
  }, []);

  const openFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await scan(selected);
      await setLastFolder(selected);
    }
  }, [scan]);

  // Restore the last folder on launch (guarded against StrictMode double-run).
  const didRestore = useRef(false);
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    void (async () => {
      const last = await getLastFolder();
      if (last) await scan(last, true);
    })();
  }, [scan]);

  // ── Global keyboard ───────────────────────────────────────────────────
  useKeyboard({
    onArrowDown: () => {
      const len = filteredRef.current.length;
      if (len === 0) return;
      play(Math.min(selectedIndexRef.current + 1, len - 1));
    },
    onArrowUp: () => {
      const len = filteredRef.current.length;
      if (len === 0) return;
      const cur = selectedIndexRef.current;
      play(cur <= 0 ? 0 : cur - 1);
    },
    onTogglePlayPause: () => controller.togglePlayPause(),
    onReplay: () => play(selectedIndexRef.current),
    onDelete: () => void deleteSelected(),
    onFocusSearch: () => {
      const el = searchInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    },
    onEscape: () => {
      setMenu(null);
      if (queryRef.current) setQuery("");
      searchInputRef.current?.blur();
    },
  });

  const onSearchChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(-1); // cursor resets to the top of the new result set
  }, []);

  // ── Render ────────────────────────────────────────────────────────────
  let content: ReactNode;
  if (scanning) {
    content = <CenterState title="Scanning…" />;
  } else if (scanError) {
    content = <CenterState error title="Couldn't scan this folder" hint={scanError} />;
  } else if (!root) {
    content = (
      <CenterState
        title="No folder open"
        hint="Open a folder of sounds to get started. Folyx scans every subfolder for audio."
      >
        <button className="btn" onClick={openFolder}>
          Open Folder
        </button>
      </CenterState>
    );
  } else if (files.length === 0) {
    content = (
      <CenterState
        title="No audio files in this folder"
        hint="Folyx looks for wav, mp3, ogg, flac, aiff, aif, m4a, aac, opus, wma."
      />
    );
  } else {
    content = (
      <FileList
        files={filtered}
        selectedIndex={selectedIndex}
        playingPath={playingFile?.path ?? null}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
      />
    );
  }

  return (
    <div className="app">
      <TopBar
        root={root}
        totalCount={files.length}
        filteredCount={filtered.length}
        isFiltering={query.trim() !== ""}
        onOpen={openFolder}
      />
      {root && (
        <SearchBox query={query} onChange={onSearchChange} inputRef={searchInputRef} />
      )}
      {content}
      {root && (
        <PlayerBar
          file={playingFile}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          error={playError}
          onTogglePlayPause={() => controller.togglePlayPause()}
          onSeek={(t) => {
            controller.seek(t);
            setCurrentTime(t);
          }}
          onVolumeChange={setVolume}
        />
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onDelete={() => {
            setMenu(null);
            void deleteSelected();
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {/* The single persistent audio element — never keyed, src set imperatively. */}
      <audio ref={audioRef} />
    </div>
  );
}

export default App;
