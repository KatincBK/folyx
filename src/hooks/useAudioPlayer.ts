import { useEffect, useRef, type RefObject } from "react";

/** Callbacks the player fires as the underlying media element changes state.
 *  App turns these into React state (currentTime, duration, isPlaying, errors). */
export interface AudioPlayerEvents {
  onTimeUpdate: (currentTime: number) => void;
  onLoadedMetadata: (duration: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onError: () => void;
}

/** Imperative handle for the single persistent <audio> element. */
export interface AudioController {
  /** Load a new source and play it from the start (replaces whatever was playing). */
  play: (src: string) => void;
  /** Toggle play/pause of the currently-loaded source. No-op if nothing loaded. */
  togglePlayPause: () => void;
  /** Restart the currently-loaded source from 0. No-op if nothing loaded. */
  replay: () => void;
  /** Seek the currently-loaded source to `time` seconds. */
  seek: (time: number) => void;
  /** Set output volume in [0, 1]. */
  setVolume: (volume: number) => void;
}

/**
 * Wraps the one persistent `<audio>` element (held in `audioRef`) and drives it
 * imperatively. The element is never remounted or keyed and its `src` is never
 * bound through JSX/state — doing so would cut off playback. React state only
 * mirrors *what* is playing; this hook owns the actual element.
 *
 * The crucial rule lives here: when a sound ends we only fire `onEnded` (which
 * flips `isPlaying` to false). We never advance to another file.
 */
export function useAudioPlayer(
  audioRef: RefObject<HTMLAudioElement | null>,
  events: AudioPlayerEvents,
): AudioController {
  // Keep the latest callbacks in a ref so the listener effect can run exactly
  // once (no re-subscribing on every render, no stale closures).
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => eventsRef.current.onTimeUpdate(audio.currentTime);
    const onMeta = () => eventsRef.current.onLoadedMetadata(audio.duration);
    const onPlay = () => eventsRef.current.onPlay();
    const onPause = () => eventsRef.current.onPause();
    const onEnded = () => eventsRef.current.onEnded();
    const onError = () => eventsRef.current.onError();

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [audioRef]);

  // The controller is created once and kept stable across renders so callers can
  // pass it around without breaking memoization.
  const controllerRef = useRef<AudioController | null>(null);
  if (!controllerRef.current) {
    const safePlay = (audio: HTMLAudioElement) => {
      // play() rejects if interrupted by a quick re-select; the `error` event
      // handles genuine failures, so swallow the promise rejection here.
      void audio.play().catch(() => {});
    };

    controllerRef.current = {
      play(src: string) {
        const audio = audioRef.current;
        if (!audio) return;
        // Assigning a fresh src resets currentTime to 0 on its own.
        audio.src = src;
        safePlay(audio);
      },
      togglePlayPause() {
        const audio = audioRef.current;
        if (!audio || !audio.src) return;
        if (audio.paused) safePlay(audio);
        else audio.pause();
      },
      replay() {
        const audio = audioRef.current;
        if (!audio || !audio.src) return;
        audio.currentTime = 0;
        safePlay(audio);
      },
      seek(time: number) {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = time;
      },
      setVolume(volume: number) {
        const audio = audioRef.current;
        if (!audio) return;
        audio.volume = volume;
      },
    };
  }

  return controllerRef.current;
}
