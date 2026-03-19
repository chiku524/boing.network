export type UpdateStatus =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "ready" }
  | { phase: "downloading"; percent: number; detail?: string }
  | { phase: "installing" }
  | { phase: "error"; message: string };

type Props = {
  status: UpdateStatus;
};

export function UpdateOverlay({ status }: Props) {
  if (status.phase === "idle" || status.phase === "ready" || status.phase === "error") {
    return null;
  }

  const message =
    status.phase === "checking"
      ? "Checking for updates…"
      : status.phase === "downloading"
        ? "Downloading update…"
        : status.phase === "installing"
          ? "Update ready. Restarting…"
          : "Preparing…";

  return (
    <div className="update-overlay" role="status" aria-live="polite" aria-label={message}>
      <p className="update-overlay__message">{message}</p>
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
  );
}
