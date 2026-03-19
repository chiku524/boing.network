/**
 * Boing Network Hub — URLs for embedded ecosystem apps.
 * Point to production by default; override with env for staging/local.
 *
 * - Wallet: same app as the boing.express Chrome extension (web build).
 * - Network: testnet ecosystem for now; later can be a general network hub.
 */

export const HUB_APP_URLS = {
  observer: import.meta.env.VITE_OBSERVER_URL ?? "https://boing.observer",
  /** Same wallet as the Chrome extension — boing.express web app */
  express: import.meta.env.VITE_EXPRESS_URL ?? "https://boing.express",
  finance: import.meta.env.VITE_FINANCE_URL ?? "https://boing.finance",
  /** Testnet ecosystem (for now); later: general network hub for users */
  network: import.meta.env.VITE_NETWORK_URL ?? "https://boing.network/testnet",
} as const;

export type HubView = "home" | "observer" | "express" | "finance" | "network";

/** App version (from package.json via Vite define) */
export const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "0.1.0";
