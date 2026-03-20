export type UpdateStatus =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "ready" }
  | { phase: "downloading"; percent: number; detail?: string }
  | { phase: "installing" }
  | { phase: "error"; message: string };

type Props = {
  status: UpdateStatus;
  /** When true, show the card with "Checking for updates…" when status is idle (e.g. on updating screen). */
  showCheckingWhenIdle?: boolean;
};

/** VibeMiner-style overlay: full-screen blur, centered card with icon, spinner, and phase label. */
export function UpdateOverlay({ status, showCheckingWhenIdle }: Props) {
  const showCard =
    status.phase === "checking" ||
    status.phase === "downloading" ||
    status.phase === "installing" ||
    (showCheckingWhenIdle && status.phase === "idle");
  if (!showCard || status.phase === "ready" || status.phase === "error") {
    return null;
  }

  const label =
    status.phase === "idle" || status.phase === "checking"
      ? "Checking for updates…"
      : status.phase === "downloading"
        ? "Downloading update…"
        : status.phase === "installing"
          ? "Installing… The app will be restarting in a moment."
          : "Preparing…";

  return (
    <div
      className="update-overlay update-overlay--card"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="update-overlay__card">
        <div className="update-overlay__icon" aria-hidden="true">
          <img src="/favicon.svg" alt="" className="update-overlay__icon-img" />
        </div>
        <p className="update-overlay__title">Boing Network Hub</p>
        <div className="update-overlay__spinner" aria-hidden="true" />
        <p className="update-overlay__message">{label}</p>
        {(status.phase === "downloading" || status.phase === "installing") && (
          <div className="update-overlay__progress-wrap">
            <div
              className="update-overlay__progress-bar"
              style={{
                width: status.phase === "downloading" ? `${status.percent}%` : "100%",
              }}
            />
          </div>
        )}
        {status.phase === "downloading" && status.detail !== undefined && (
          <p className="update-overlay__detail">{status.detail}</p>
        )}
      </div>
    </div>
  );
}
