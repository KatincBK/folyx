/** One audio file found under the chosen root. Mirrors the Rust `AudioFile` struct
 *  returned by the `scan_folder` command (see `src-tauri/src/lib.rs`). */
export interface AudioFile {
  /** File name with extension, e.g. "explosion_01.wav". */
  name: string;
  /** Absolute path on disk; pass through `convertFileSrc` before using as audio src. */
  path: string;
  /** Path relative to the chosen root, forward-slashed, e.g. "weapons/explosion_01.wav". */
  rel_path: string;
  /** Immediate parent folder name, e.g. "weapons". */
  folder: string;
  /** Lowercase extension without the dot, e.g. "wav". */
  ext: string;
  size_bytes: number;
  /** Length in seconds, read from the file header, or null if it couldn't be read. */
  duration_secs: number | null;
}

/** How the list is ordered. "default" is the scan order (grouped by subfolder). */
export type SortMode = "default" | "name" | "duration";

/** Active list filters. A null bound means "unbounded" on that side. */
export interface Filters {
  /** Show only starred files. */
  favoritesOnly: boolean;
  /** Minimum length in seconds, or null for no lower bound. */
  minSecs: number | null;
  /** Maximum length in seconds, or null for no upper bound. */
  maxSecs: number | null;
}

/** A filter set that hides nothing — the default. */
export const NO_FILTERS: Filters = {
  favoritesOnly: false,
  minSecs: null,
  maxSecs: null,
};

