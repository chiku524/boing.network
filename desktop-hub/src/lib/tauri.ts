import { isTauri as isTauriRuntime } from "@tauri-apps/api/core";

/** True when running inside the Tauri webview (desktop). Uses the official runtime flag, not ad-hoc globals. */
export function isTauri(): boolean {
  return isTauriRuntime();
}
