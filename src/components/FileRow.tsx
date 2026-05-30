import { memo } from "react";
import type { AudioFile } from "../types";

/** Fixed row height. Rows are uniform so the list can scroll-to-index cheaply
 *  (and so virtualization stays trivial to add later if ever needed). */
export const ROW_HEIGHT = 44;

interface FileRowProps {
  file: AudioFile;
  index: number;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: (index: number) => void;
}

/**
 * A single file row. Wrapped in `React.memo` and fed only primitive props plus a
 * stable `onSelect`, so changing the selection re-renders just the two affected
 * rows (old + new) instead of the whole list.
 */
export const FileRow = memo(function FileRow({
  file,
  index,
  isSelected,
  isPlaying,
  onSelect,
}: FileRowProps) {
  // Subfolder = rel_path minus the file name (empty when the file sits in root).
  const slash = file.rel_path.lastIndexOf("/");
  const subfolder = slash >= 0 ? file.rel_path.slice(0, slash) : "";

  const className =
    "file-row" +
    (isSelected ? " file-row--selected" : "") +
    (isPlaying ? " file-row--playing" : "");

  return (
    <div
      className={className}
      style={{ height: ROW_HEIGHT }}
      onClick={() => onSelect(index)}
      role="option"
      aria-selected={isSelected}
    >
      <span className="file-row__marker" aria-hidden="true">
        {isPlaying ? "▶" : ""}
      </span>
      <span className="file-row__text">
        <span className="file-row__name">{file.name}</span>
        {subfolder && <span className="file-row__sub">{subfolder}</span>}
      </span>
      <span className="file-row__ext">{file.ext.toUpperCase()}</span>
    </div>
  );
});
