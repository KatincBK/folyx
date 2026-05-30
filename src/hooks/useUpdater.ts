import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | "idle" // no update (or check failed/offline) — show nothing
  | "available"
  | "downloading"
  | "ready"
  | "error";

export interface UpdaterState {
  status: UpdateStatus;
  version: string | null;
  /** Download + install the pending update, then relaunch into it. */
  install: () => void;
}

/**
 * Checks GitHub Releases for a newer signed build on launch. Everything is wrapped
 * in try/catch so dev runs, offline use, or a not-yet-published release just leave
 * the app in "idle" (no banner) instead of erroring.
 */
export function useUpdater(): UpdaterState {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const found = await check();
        if (!cancelled && found) {
          setUpdate(found);
          setVersion(found.version);
          setStatus("available");
        }
      } catch {
        // No endpoint in dev / offline / no release yet — stay idle.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const install = () => {
    if (!update) return;
    void (async () => {
      try {
        setStatus("downloading");
        await update.downloadAndInstall();
        setStatus("ready");
        await relaunch();
      } catch {
        setStatus("error");
      }
    })();
  };

  return { status, version, install };
}
