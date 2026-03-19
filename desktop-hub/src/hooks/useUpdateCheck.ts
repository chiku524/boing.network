import { useState, useCallback } from "react";
import type { UpdateStatus } from "../components/UpdateOverlay";

const isTauri = typeof window !== "undefined" && typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined";

export function useUpdateCheck() {
  const [status, setStatus] = useState<UpdateStatus>({ phase: "idle" });

  const runCheck = useCallback(async (): Promise<"proceed" | "restarting"> => {
    if (!isTauri) return "proceed";

    setStatus({ phase: "checking" });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update == null) {
        setStatus({ phase: "ready" });
        return "proceed";
      }

      setStatus({ phase: "downloading", percent: 0 });
      let contentLength = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data?.contentLength != null) {
          contentLength = event.data.contentLength;
        } else if (event.event === "Progress" && event.data?.chunkLength != null) {
          downloaded += event.data.chunkLength;
          const percent = contentLength > 0 ? Math.min(100, Math.round((downloaded / contentLength) * 100)) : 0;
          setStatus({ phase: "downloading", percent, detail: `${percent}%` });
        } else if (event.event === "Finished") {
          setStatus({ phase: "installing" });
        }
      });

      try {
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch {
        /* process plugin not installed; installer may restart the app */
      }
      return "restarting";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update check failed";
      setStatus({ phase: "error", message });
      return "proceed";
    }
  }, []);

  const clearStatus = useCallback(() => {
    setStatus({ phase: "idle" });
  }, []);

  return { status, runCheck, clearStatus };
}
