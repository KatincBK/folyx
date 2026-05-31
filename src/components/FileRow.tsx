import { memo, useEffect, useRef, useState } from "react";
import type { AudioFile } from "../types";
import { formatDuration } from "../format";

/** Fixed row height. Rows are uniform so the list can scroll-to-index cheaply
 *  (and so virtualization stays trivial to add later if ever needed). */
export const ROW_HEIGHT = 44;

interface FileRowProps {
  file: AudioFile;
  index: number;
  isSelected: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  isRenaming: boolean;
  onSelect: (index: number) => void;
  onContextMenu: (index: number, x: number, y: number) => void;
  onToggleFavorite: (path: string) => void;
  onStartRename: (index: number) => void;
  /** Commit a new *stem* (file name without its extension). */
  onCommitRename: (index: number, newStem: string) => void;
  onCancelRename: () => void;
}

/** The file name without its extension — the part we let the user edit. */
function stemOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Inline editor shown in place of the name while renaming. Mounts focused with
 *  its text selected; commits on Enter/blur, cancels on Esc. The `committed`
 *  guard stops Enter (which unmounts us) from also firing a blur-commit. */
function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    onCommit(value);
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    onCancel();
  };

  return (
    <input
      ref={ref}
      className="file-row__rename"
      type="text"
      value={value}
      spellCheck={false}
      autoComplete="off"
      onChange={(e) => setValue(e.currentTarget.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation(); // keep the app's global shortcuts out of the field
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
    />
  );
}

/**
 * A single file row. Wrapped in `React.memo` and fed only primitive props plus
 * stable callbacks, so changing the selection re-renders just the two affected
 * rows (old + new) instead of the whole list.
 */
export const FileRow = memo(function FileRow({
  file,
  index,
  isSelected,
  isPlaying,
  isFavorite,
  isRenaming,
  onSelect,
  onContextMenu,
  onToggleFavorite,
  onStartRename,
  onCommitRename,
  onCancelRename,
}: FileRowProps) {
  // Subfolder = rel_path minus the file name (empty when the file sits in root).
  const slash = file.rel_path.lastIndexOf("/");
  const subfolder = slash >= 0 ? file.rel_path.slice(0, slash) : "";

  const className =
    "file-row" +
    (isSelected ? " file-row--selected" : "") +
    (isPlaying ? " file-row--playing" : "") +
    (isFavorite ? " file-row--favorite" : "");

  return (
    <div
      className={className}
      style={{ height: ROW_HEIGHT }}
      onClick={() => onSelect(index)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(index, e.clientX, e.clientY);
      }}
      role="option"
      aria-selected={isSelected}
    >
      <button
        className={"file-row__star" + (isFavorite ? " file-row__star--on" : "")}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(file.path);
        }}
        aria-pressed={isFavorite}
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        {isFavorite ? "★" : "☆"}
      </button>

      <span className="file-row__marker" aria-hidden="true">
        {isPlaying ? "▶" : ""}
      </span>

      <span className="file-row__text">
        {isRenaming ? (
          <RenameInput
            initial={stemOf(file.name)}
            onCommit={(value) => onCommitRename(index, value)}
            onCancel={onCancelRename}
          />
        ) : (
          <span
            className="file-row__name"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartRename(index);
            }}
            title="Double-click to rename"
          >
            {file.name}
          </span>
        )}
        {subfolder && <span className="file-row__sub">{subfolder}</span>}
      </span>

      <span className="file-row__dur">{formatDuration(file.duration_secs)}</span>
      <span className="file-row__ext">{file.ext.toUpperCase()}</span>
    </div>
  );
});
