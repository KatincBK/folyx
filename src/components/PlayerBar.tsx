import type { AudioFile } from "../types";

interface PlayerBarProps {
  file: AudioFile | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  error: string | null;
  onTogglePlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
}

function formatTime(t: number): string {
  if (!isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Bottom-fixed transport: now-playing, seek bar, times, play/pause, volume.
 *  A failed play (unsupported codec) shows inline here instead of crashing. */
export function PlayerBar({
  file,
  isPlaying,
  currentTime,
  duration,
  volume,
  error,
  onTogglePlayPause,
  onSeek,
  onVolumeChange,
}: PlayerBarProps) {
  const seekMax = duration > 0 && isFinite(duration) ? duration : 0;

  return (
    <footer className="player-bar">
      <button
        className="player-bar__play"
        onClick={onTogglePlayPause}
        disabled={!file}
        aria-label={isPlaying ? "Pause" : "Play"}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div className="player-bar__main">
        <div className="player-bar__now">
          {error ? (
            <span className="player-bar__error">{error}</span>
          ) : (
            <span className="player-bar__name">
              {file ? file.name : "No sound selected"}
            </span>
          )}
        </div>
        <div className="player-bar__seek">
          <span className="player-bar__time">{formatTime(currentTime)}</span>
          <input
            className="player-bar__range"
            type="range"
            min={0}
            max={seekMax}
            step={0.01}
            value={Math.min(currentTime, seekMax)}
            disabled={!file || seekMax === 0}
            aria-label="Seek"
            onChange={(e) => onSeek(Number(e.currentTarget.value))}
          />
          <span className="player-bar__time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-bar__volume">
        <span className="player-bar__vol-icon" aria-hidden="true">
          {"🔊"}
        </span>
        <input
          className="player-bar__range player-bar__range--vol"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          aria-label="Volume"
          onChange={(e) => onVolumeChange(Number(e.currentTarget.value))}
        />
      </div>
    </footer>
  );
}
