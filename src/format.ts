/** Format a length in seconds as m:ss (e.g. 1:07). Returns "" for unknown
 *  (null/NaN) durations so callers can render an empty cell. */
export function formatDuration(secs: number | null): string {
  if (secs == null || !isFinite(secs) || secs < 0) return "";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
