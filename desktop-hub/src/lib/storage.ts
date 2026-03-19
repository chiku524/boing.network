/**
 * Local storage keys and helpers for hub preferences and auth state.
 */

export const STORAGE_KEY_VIEW = "boing-hub-last-view";
export const STORAGE_KEY_LAST_APP = "boing-hub-last-embed-view";
export const STORAGE_KEY_WELCOME_DISMISSED = "boing-hub-welcome-dismissed";
export const STORAGE_KEY_SIGNED_IN = "boing-hub-signed-in";
export const STORAGE_KEY_SHOW_INTRO = "boing-hub-show-intro";

export function getWelcomeDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_WELCOME_DISMISSED) === "1";
  } catch {
    return false;
  }
}

export function setWelcomeDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY_WELCOME_DISMISSED, "1");
  } catch {
    /* ignore */
  }
}

export function clearWelcomeDismissed(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_WELCOME_DISMISSED);
  } catch {
    /* ignore */
  }
}

export function getSignedIn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_SIGNED_IN) === "1";
  } catch {
    return false;
  }
}

export function setSignedIn(): void {
  try {
    localStorage.setItem(STORAGE_KEY_SIGNED_IN, "1");
  } catch {
    /* ignore */
  }
}

export function clearSignedIn(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SIGNED_IN);
  } catch {
    /* ignore */
  }
}

/** Default true = show intro on next launch */
export function getShowIntro(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY_SHOW_INTRO);
    return v === null || v === "1";
  } catch {
    return true;
  }
}

export function setShowIntro(show: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_SHOW_INTRO, show ? "1" : "0");
  } catch {
    /* ignore */
  }
}
