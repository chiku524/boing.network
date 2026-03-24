/// <reference types="vite/client" />

interface Window {
  __TAURI_INTERNALS__?: unknown;
  /** Set by the Tauri webview runtime (see @tauri-apps/api/core `isTauri`). */
  isTauri?: boolean;
}
