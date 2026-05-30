import type { UpdateStatus } from "../hooks/useUpdater";

interface UpdateBannerProps {
  status: Exclude<UpdateStatus, "idle">;
  version: string | null;
  onInstall: () => void;
}

/** Thin strip above the top bar shown only when an update is in play. */
export function UpdateBanner({ status, version, onInstall }: UpdateBannerProps) {
  return (
    <div className="update-banner">
      {status === "available" && (
        <>
          <span className="update-banner__text">
            A new version{version ? ` (v${version})` : ""} is available.
          </span>
          <button className="update-banner__btn" onClick={onInstall}>
            Restart &amp; update
          </button>
        </>
      )}
      {status === "downloading" && (
        <span className="update-banner__text">Downloading update…</span>
      )}
      {status === "ready" && (
        <span className="update-banner__text">Restarting…</span>
      )}
      {status === "error" && (
        <span className="update-banner__text">
          Update failed — try again later.
        </span>
      )}
    </div>
  );
}
