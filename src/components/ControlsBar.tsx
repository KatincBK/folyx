import type { Filters, SortMode } from "../types";
import { NO_FILTERS } from "../types";

interface ControlsBarProps {
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const SORTS: { value: SortMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "name", label: "Name" },
  { value: "duration", label: "Length" },
];

/** Parse a seconds input: "" → null (unbounded), otherwise a non-negative number
 *  (anything invalid is ignored by returning the previous value via NaN guard). */
function parseSecs(raw: string): number | null | undefined {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return isFinite(n) && n >= 0 ? n : undefined;
}

/** Toolbar with list ordering (sort) and filters (favorites-only + length range). */
export function ControlsBar({
  sort,
  onSortChange,
  filters,
  onFiltersChange,
}: ControlsBarProps) {
  const hasFilters =
    filters.favoritesOnly || filters.minSecs != null || filters.maxSecs != null;

  return (
    <div className="controls-bar">
      <div className="controls-bar__group" role="group" aria-label="Sort by">
        <span className="controls-bar__label">Sort</span>
        <div className="segmented">
          {SORTS.map((s) => (
            <button
              key={s.value}
              className={
                "segmented__btn" + (sort === s.value ? " segmented__btn--on" : "")
              }
              aria-pressed={sort === s.value}
              onClick={() => onSortChange(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className={
          "controls-bar__fav" + (filters.favoritesOnly ? " controls-bar__fav--on" : "")
        }
        aria-pressed={filters.favoritesOnly}
        onClick={() =>
          onFiltersChange({ ...filters, favoritesOnly: !filters.favoritesOnly })
        }
        title="Show only favorites"
      >
        <span aria-hidden="true">{filters.favoritesOnly ? "★" : "☆"}</span>
        Favorites
      </button>

      <div className="controls-bar__group" role="group" aria-label="Length range">
        <span className="controls-bar__label">Length</span>
        <input
          className="controls-bar__num"
          type="number"
          min={0}
          placeholder="min"
          value={filters.minSecs ?? ""}
          onChange={(e) => {
            const v = parseSecs(e.currentTarget.value);
            if (v !== undefined) onFiltersChange({ ...filters, minSecs: v });
          }}
          aria-label="Minimum length in seconds"
        />
        <span className="controls-bar__dash">–</span>
        <input
          className="controls-bar__num"
          type="number"
          min={0}
          placeholder="max"
          value={filters.maxSecs ?? ""}
          onChange={(e) => {
            const v = parseSecs(e.currentTarget.value);
            if (v !== undefined) onFiltersChange({ ...filters, maxSecs: v });
          }}
          aria-label="Maximum length in seconds"
        />
        <span className="controls-bar__unit">s</span>
      </div>

      {hasFilters && (
        <button
          className="controls-bar__clear"
          onClick={() => onFiltersChange(NO_FILTERS)}
          title="Clear filters"
        >
          Clear
        </button>
      )}
    </div>
  );
}
