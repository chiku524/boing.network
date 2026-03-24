import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { useNavigate } from "react-router-dom";
import { isTauri as isTauriApp } from "../lib/tauri";
import UpdateOverlay from "./SplashUpdateOverlay";
import "./SplashScreen.css";

const INTRO_DURATION_MS = 1800;

const PHASE = {
  INTRO: "intro",
  CHECKING: "checking",
  DOWNLOADING: "downloading",
  INSTALLING: "installing",
  OPENING: "opening",
} as const;

/**
 * Frameless splash window: intro animation → update check (and optional download) → close and show main.
 * Same pattern as dice.express and vibeminer for reliable cold start and update flow.
 */
export function SplashScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<typeof PHASE[keyof typeof PHASE]>(PHASE.INTRO);
  const [introDone, setIntroDone] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  // Intro animation: minimal fade-in (dice.express / vibeminer style)
  useEffect(() => {
    if (!isTauriApp()) {
      setIntroDone(true);
      return;
    }
    const t = setTimeout(() => setIntroDone(true), INTRO_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  // After intro, run update check and optional download (StrictMode-safe: each mount gets its own cancelled flag)
  useEffect(() => {
    if (!introDone || !isTauriApp()) return;

    let cancelled = false;

    const run = async () => {
      setPhase(PHASE.CHECKING);
      console.info("[Boing Hub] Checking for updates…");

      try {
        const update = await check({ timeout: 22_000 });
        if (cancelled) return;

        if (update) {
          setUpdateVersion(update.version);
          setPhase(PHASE.DOWNLOADING);

          await update.downloadAndInstall(() => {
            if (cancelled) return;
          });

          if (cancelled) return;
          setPhase(PHASE.INSTALLING);
          await relaunch();
          return;
        }
      } catch (err) {
        // Missing capability, network, TLS, or signature verify — continue to app.
        console.warn("[Boing Hub] Update check failed:", err);
      }

      if (cancelled) return;
      setPhase(PHASE.OPENING);

      if (isTauriApp()) {
        try {
          await invoke("close_splash_and_show_main");
        } catch {
          /* ignore */
        }
      } else {
        navigate("/app", { replace: true });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [introDone, navigate]);

  const showSplashOverlay =
    phase === PHASE.CHECKING ||
    phase === PHASE.OPENING ||
    phase === PHASE.DOWNLOADING ||
    phase === PHASE.INSTALLING;

  return (
    <>
      <div className="splash-screen splash-screen--intro">
        <div className="splash-screen__content">
          <div className="splash-screen__symbol" aria-hidden>
            <img src="/favicon.svg" alt="" width={72} height={72} />
          </div>
          <h1 className="splash-screen__name">Boing Network</h1>
          <p className="splash-screen__tagline">Hub</p>
        </div>
      </div>
      {showSplashOverlay && (
        <UpdateOverlay phase={phase} version={updateVersion} />
      )}
    </>
  );
}
