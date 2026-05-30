import { useEffect, useRef } from "react";
import type { AudioFile } from "../types";
import { FileRow, ROW_HEIGHT } from "./FileRow";

interface FileListProps {
  files: AudioFile[]; // the already-filtered list
  selectedIndex: number;
  playingPath: string | null;
  onSelect: (index: number) => void;
  onContextMenu: (index: number, x: number, y: number) => void;
}

/**
 * Scrollable list of file rows. Plain (memoized) rendering — fast enough for the
 * target scale; virtualization is only worth adding if 2000+ rows feel janky.
 * Keeps the selected row in view as the keyboard cursor moves.
 */
export function FileList({
  files,
  selectedIndex,
  playingPath,
  onSelect,
  onContextMenu,
}: FileListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = containerRef.current;
    if (!c || selectedIndex < 0) return;
    const top = selectedIndex * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < c.scrollTop) {
      c.scrollTop = top;
    } else if (bottom > c.scrollTop + c.clientHeight) {
      c.scrollTop = bottom - c.clientHeight;
    }
  }, [selectedIndex]);

  return (
    <div className="file-list" ref={containerRef} role="listbox" tabIndex={-1}>
      {files.map((file, index) => (
        <FileRow
          key={file.path}
          file={file}
          index={index}
          isSelected={index === selectedIndex}
          isPlaying={file.path === playingPath}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
