import { useState, useEffect, useCallback, useRef } from "react";
import { HUB_APP_URLS, type HubView } from "./config";
import { APP_VERSION } from "./config";
import { AppIcon } from "./components/AppIcons";
import { HomeView } from "./views/HomeView";
import { EmbedView } from "./views/EmbedView";
import "./styles.css";

const STORAGE_KEY_VIEW = "boing-hub-last-view";
const STORAGE_KEY_LAST_APP = "boing-hub-last-embed-view";

const NAV_ITEMS: { id: HubView; label: string; description: string }[] = [
  { id: "home", label: "Home", description: "Boing Network overview" },
  { id: "observer", label: "Observer", description: "Block explorer" },
  { id: "express", label: "Wallet", description: "Same wallet as the Chrome extension — send, stake, connect dApps" },
  { id: "finance", label: "Finance", description: "DEX & DeFi" },
  { id: "network", label: "Testnet", description: "Testnet ecosystem — register, faucet, quests, developers" },
];

function isValidView(v: string): v is HubView {
  return ["home", "observer", "express", "finance", "network"].includes(v);
}

const WINDOW_TITLE_BASE = "Boing Network Hub";

function App() {
  const [view, setViewState] = useState<HubView>("home");
  const [lastEmbedView, setLastEmbedView] = useState<HubView | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VIEW);
      if (stored && isValidView(stored)) {
        setViewState(stored);
        if (stored !== "home") setLastEmbedView(stored);
      }
      const lastApp = localStorage.getItem(STORAGE_KEY_LAST_APP);
      if (lastApp && isValidView(lastApp) && lastApp !== "home") setLastEmbedView(lastApp);
    } catch {
      /* ignore */
    }
  }, []);

  const setView = useCallback((next: HubView) => {
    setViewState(next);
    if (next !== "home") setLastEmbedView(next);
    try {
      localStorage.setItem(STORAGE_KEY_VIEW, next);
      if (next !== "home") localStorage.setItem(STORAGE_KEY_LAST_APP, next);
    } catch {
      /* ignore */
    }
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setView("home");
        e.preventDefault();
        return;
      }
      if (e.altKey && e.key >= "1" && e.key <= "5") {
        const i = e.key === "5" ? 4 : Number(e.key) - 1;
        const item = NAV_ITEMS[i];
        if (item) {
          e.preventDefault();
          setView(item.id);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setView]);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const label = view === "home" ? "Home" : NAV_ITEMS.find((n) => n.id === view)?.label ?? view;
    const title = view === "home" ? WINDOW_TITLE_BASE : `${label} — ${WINDOW_TITLE_BASE}`;
    document.title = title;
    if (typeof window.__TAURI_INTERNALS__ !== "undefined") {
      import("@tauri-apps/api/window")
        .then((w) => w.getCurrentWindow().setTitle(title))
        .catch(() => {});
    }
  }, [view]);

  const isEmbedView =
    view === "observer" || view === "express" || view === "finance" || view === "network";

  const lastUsedAppId: HubView | null = lastEmbedView;

  return (
    <div className="hub">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <aside className="hub-sidebar">
        <div
          className="hub-brand"
          role="button"
          tabIndex={0}
          onClick={() => setView("home")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setView("home");
            }
          }}
          aria-label="Boing Network — go to Home"
        >
          <img src="/favicon.svg" alt="" className="hub-logo" />
          <span className="hub-title">Boing Network</span>
        </div>
        <nav className="hub-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`hub-nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => setView(item.id)}
              title={`${item.description} (Alt+${index + 1})`}
              aria-current={view === item.id ? "page" : undefined}
            >
              <span className="hub-nav-icon">
                <AppIcon appId={item.id} size={18} />
              </span>
              <span className="hub-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="hub-footer">
          <span className="hub-footer-text">Alt+1–5 · Esc Home</span>
          <a
            className="hub-footer-version"
            href="https://boing.network"
            target="_blank"
            rel="noopener noreferrer"
            title="Boing Network"
          >
            v{APP_VERSION}
          </a>
        </div>
      </aside>
      <main
        id="main-content"
        ref={mainRef}
        className="hub-main"
        tabIndex={-1}
        role="main"
        aria-label={view === "home" ? "Home" : isEmbedView ? NAV_ITEMS.find((n) => n.id === view)?.label ?? "App" : undefined}
      >
        {view === "home" && <HomeView onNavigate={setView} lastUsedAppId={lastUsedAppId} />}
        {isEmbedView && (
          <EmbedView
            appId={view}
            url={HUB_APP_URLS[view]}
            title={NAV_ITEMS.find((n) => n.id === view)?.label ?? view}
          />
        )}
      </main>
    </div>
  );
}

export default App;
