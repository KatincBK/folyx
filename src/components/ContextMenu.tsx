interface ContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
  onClose: () => void;
}

/** Tiny right-click menu for a file row. A full-screen backdrop closes it on any
 *  outside click or right-click. */
export function ContextMenu({ x, y, onDelete, onClose }: ContextMenuProps) {
  return (
    <div
      className="context-menu__backdrop"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="context-menu"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="context-menu__item context-menu__item--danger"
          onClick={onDelete}
        >
          <span>Delete</span>
          <span className="context-menu__hint">Del</span>
        </button>
      </div>
    </div>
  );
}
