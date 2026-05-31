import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-dialog";

import type { AudioFile, Filters, SortMode } from "./types";
import { NO_FILTERS } from "./types";
import {
  getLastFolder,
  setLastFolder,
  getFavorites as loadFavorites,
  setFavorites as saveFavorites,
} from "./store";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useKeyboard } from "./hooks/useKeyboard";
import { TopBar } from "./components/TopBar";
import { SearchBox } from "./components/SearchBox";
import { ControlsBar } from "./components/ControlsBar";
import { FileList } from "./components/FileList";
import { PlayerBar } from "./components/PlayerBar";
import { ContextMenu } from "./components/ContextMenu";
import { UpdateBanner } from "./components/UpdateBanner";
import { useUpdater } from "./hooks/useUpdater";
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
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortMode>("default");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  // Load starred paths once on launch (persisted globally, across folders).
  useEffect(() => {
    void loadFavorites()
      .then((list) => setFavorites(new Set(list)))
      .catch(() => {});
  }, []);

  // App version (from tauri.conf.json) shown in the top-right corner.
  useEffect(() => {
    void getVersion()
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  // Self-update: checks GitHub Releases on launch; banner appears only if found.
  const { status: updateStatus, version: updateVersion, install: installUpdate } =
    useUpdater();

  // The visible list: search → favorites/length filters → sort. Each step is
  // skipped when inactive so the common "no filters, default order" case returns
  // the original array untouched.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = files;
    if (q) list = list.filter((f) => f.rel_path.toLowerCase().includes(q));
    if (filters.favoritesOnly) list = list.filter((f) => favorites.has(f.path));
    if (filters.minSecs != null || filters.maxSecs != null) {
      const min = filters.minSecs ?? -Infinity;
      const max = filters.maxSecs ?? Infinity;
      // Unknown-duration files can't satisfy a numeric range, so drop them.
      list = list.filter(
        (f) => f.duration_secs != null && f.duration_secs >= min && f.duration_secs <= max,
      );
    }
    if (sort === "name") {
      list = [...list].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
    } else if (sort === "duration") {
      list = [...list].sort((a, b) => {
        // Unknown durations sort to the end.
        if (a.duration_secs == null) return b.duration_secs == null ? 0 : 1;
        if (b.duration_secs == null) return -1;
        return a.duration_secs - b.duration_secs;
      });
    }
    return list;
  }, [files, query, favorites, filters, sort]);

  const isFiltering =
    query.trim() !== "" ||
    filters.favoritesOnly ||
    filters.minSecs != null ||
    filters.maxSecs != null;

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

  // Star / unstar a file. Persists the whole set so it survives re-scans.
  const toggleFavorite = useCallback((path: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      void saveFavorites([...next]);
      return next;
    });
  }, []);

  // Changing the order or filters can move/remove the cursor's target, so drop
  // the selection (matches how typing in the search box behaves).
  const onSortChange = useCallback((next: SortMode) => {
    setSort(next);
    setSelectedIndex(-1);
  }, []);
  const onFiltersChange = useCallback((next: Filters) => {
    setFilters(next);
    setSelectedIndex(-1);
  }, []);

  // ── Renaming (double-click a name, or F2) ──────────────────────────────
  const onStartRename = useCallback((index: number) => {
    const file = filteredRef.current[index];
    if (file) setRenamingPath(file.path);
  }, []);
  const onCancelRename = useCallback(() => setRenamingPath(null), []);

  // Commit a new stem: rename on disk, then update the file record (and any
  // references to its old path in favorites / the player) in place.
  const onCommitRename = useCallback(async (index: number, newStem: string) => {
    const file = filteredRef.current[index];
    if (!file) {
      setRenamingPath(null);
      return;
    }
    const dot = file.name.lastIndexOf(".");
    const ext = dot > 0 ? file.name.slice(dot) : ""; // ".wav", original case
    const currentStem = dot > 0 ? file.name.slice(0, dot) : file.name;
    const stem = newStem.trim();
    if (stem === "" || stem === currentStem) {
      setRenamingPath(null); // nothing to do
      return;
    }
    const newName = stem + ext;
    let newPath: string;
    try {
      newPath = await invoke<string>("rename_file", { path: file.path, newName });
    } catch (err) {
      setPlayError(`Couldn't rename "${file.name}": ${String(err)}`);
      setRenamingPath(null);
      return;
    }
    const oldPath = file.path;
    // The file stays in its folder, so only rel_path's last segment changes.
    const slash = file.rel_path.lastIndexOf("/");
    const newRelPath =
      slash >= 0 ? file.rel_path.slice(0, slash + 1) + newName : newName;
    const patch = { name: newName, path: newPath, rel_path: newRelPath };

    setFiles((prev) =>
      prev.map((f) => (f.path === oldPath ? { ...f, ...patch } : f)),
    );
    setPlayingFile((prev) =>
      prev && prev.path === oldPath ? { ...prev, ...patch } : prev,
    );
    setFavorites((prev) => {
      if (!prev.has(oldPath)) return prev;
      const next = new Set(prev);
      next.delete(oldPath);
      next.add(newPath);
      void saveFavorites([...next]);
      return next;
    });
    setRenamingPath(null);
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
    setRenamingPath(null);
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
    onRename: () => {
      const file = filteredRef.current[selectedIndexRef.current];
      if (file) setRenamingPath(file.path);
    },
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
        favorites={favorites}
        renamingPath={renamingPath}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
        onToggleFavorite={toggleFavorite}
        onStartRename={onStartRename}
        onCommitRename={onCommitRename}
        onCancelRename={onCancelRename}
      />
    );
  }

  return (
    <div className="app">
      {updateStatus !== "idle" && (
        <UpdateBanner
          status={updateStatus}
          version={updateVersion}
          onInstall={installUpdate}
        />
      )}
      <TopBar
        root={root}
        totalCount={files.length}
        filteredCount={filtered.length}
        isFiltering={isFiltering}
        version={appVersion}
        onOpen={openFolder}
      />
      {root && (
        <SearchBox query={query} onChange={onSearchChange} inputRef={searchInputRef} />
      )}
      {root && files.length > 0 && (
        <ControlsBar
          sort={sort}
          onSortChange={onSortChange}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
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
