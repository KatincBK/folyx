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
}
