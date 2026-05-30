interface TopBarProps {
  root: string | null;
  totalCount: number;
  filteredCount: number;
  isFiltering: boolean;
  onOpen: () => void;
}

/** Truncate a long path in the middle so both the drive and the leaf stay readable. */
function middleEllipsis(text: string, max = 72): string {
  if (text.length <= max) return text;
  const keep = max - 1; // room for the ellipsis
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return text.slice(0, head) + "…" + text.slice(text.length - tail);
}

export function TopBar({
  root,
  totalCount,
  filteredCount,
  isFiltering,
  onOpen,
}: TopBarProps) {
  const count = isFiltering ? `${filteredCount} / ${totalCount}` : `${totalCount}`;
  return (
    <header className="top-bar">
      <button className="btn" onClick={onOpen}>
        Open Folder
      </button>
      {root && (
        <span className="top-bar__path" title={root}>
          {middleEllipsis(root)}
        </span>
      )}
      {root && (
        <span className="top-bar__count">
          {count} sound{totalCount === 1 ? "" : "s"}
        </span>
      )}
    </header>
  );
}
