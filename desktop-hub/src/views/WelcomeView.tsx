import { useCallback } from "react";
import { HubEngraveBackground } from "../components/HubEngraveBackground";

const TESTNET_URL = "https://boing.network/testnet";
const EXPRESS_URL = "https://boing.express";

type Props = {
  onSignIn: () => void;
  onRegister: () => void;
  onContinueAsGuest: () => void;
};

export function WelcomeView({ onSignIn, onRegister, onContinueAsGuest }: Props) {
  const openExternal = useCallback(async (url: string) => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const handleSignIn = useCallback(() => {
    openExternal(EXPRESS_URL);
    onSignIn();
  }, [openExternal, onSignIn]);

  const handleRegister = useCallback(() => {
    openExternal(TESTNET_URL);
    onRegister();
  }, [openExternal, onRegister]);

  return (
    <div className="welcome-view" role="main" aria-label="Welcome">
      <HubEngraveBackground />
      <div className="welcome-view__card">
        <img src="/favicon.svg" alt="" className="welcome-view__logo" />
        <h1 className="welcome-view__title">Welcome to Boing Network Hub</h1>
        <p className="welcome-view__subtitle">
          Sign in to sync your wallet, or continue without an account to explore the ecosystem.
        </p>
        <div className="welcome-view__actions">
          <button
            type="button"
            className="welcome-view__btn welcome-view__btn--primary"
            onClick={handleSignIn}
          >
            Sign in
          </button>
          <button
            type="button"
            className="welcome-view__btn"
            onClick={handleRegister}
          >
            Register
          </button>
          <button
            type="button"
            className="welcome-view__btn welcome-view__btn--secondary"
            onClick={onContinueAsGuest}
          >
            Continue without account
          </button>
        </div>
      </div>
    </div>
  );
}
