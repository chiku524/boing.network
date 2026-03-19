# Boing Network Hub

All-in-one **desktop application** for the Boing Network ecosystem, built with **Tauri 2** (Rust + web frontend). It bundles access to:

- **[Observer](https://boing.observer)** — Block explorer (blocks, accounts, faucet, QA check)
- **Wallet** — Same app as the [boing.express Chrome extension](https://boing.express) (send, stake, dApp connect)
- **[Finance](https://boing.finance)** — DEX & DeFi (swap, liquidity, bridge, portfolio)
- **Testnet** — Testnet ecosystem (register, faucet, quests, developers). Later: general network hub for users.

Users get a single window with a sidebar to switch between these apps, each loaded in an embedded view (iframe) pointing to the live sites. No need to open multiple browser tabs.

## Prerequisites

- **Node.js** 18+ and **npm** (or pnpm/yarn)
- **Rust** (latest stable): [rustup](https://rustup.rs/)
- **Tauri 2 system deps**: [Tauri — Prerequisites](https://v2.tauri.app/start/prerequisites/)

If on Windows you see **"An Application Control policy has blocked this file" (os error 4551)** when running `tauri dev` or `tauri build`, allow Rust/cargo build scripts in your security policy (e.g. Windows Defender Application Control or corporate policy), or run from a path/folder that is not restricted.

## Quick start

```bash
cd desktop-hub
npm install
```

Generate app icons (required for build; use the repo favicon):

```bash
npm run tauri icon public/favicon.svg
```

Run in development:

```bash
npm run tauri:dev
```

Build for production:

```bash
npm run tauri:build
```

Outputs (installers and binaries) are under `src-tauri/target/release/` and `src-tauri/target/release/bundle/`.

## Configuration

Embedded app URLs are set in `src/config.ts` and can be overridden with env vars at build time:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_OBSERVER_URL` | `https://boing.observer` | Observer (block explorer) |
| `VITE_EXPRESS_URL` | `https://boing.express` | Wallet (same as Chrome extension web app) |
| `VITE_FINANCE_URL` | `https://boing.finance` | Finance (DEX) |
| `VITE_NETWORK_URL` | `https://boing.network/testnet` | Testnet ecosystem (later: network hub) |

Example for local/staging:

```bash
VITE_OBSERVER_URL=http://localhost:3000 VITE_EXPRESS_URL=http://localhost:5173 npm run tauri:dev
```

## Project layout

```
desktop-hub/
  src/                 # Vite + React frontend (hub shell)
    config.ts          # App URLs
    App.tsx            # Sidebar + view routing
    views/             # Home view + embed (iframe) view
  src-tauri/           # Tauri 2 Rust backend
    tauri.conf.json    # Window, build, bundle config
    capabilities/     # Permissions (e.g. shell open)
    src/               # Rust entry (lib.rs, main.rs)
    icons/             # App icons (generate with `tauri icon`)
  public/
    favicon.svg        # Used for icon generation and shell branding
```

## Tech stack

- **Shell**: React 18 + TypeScript + Vite
- **Desktop**: Tauri 2 (Rust), with `tauri-plugin-shell` for opening external links
- **Embedded apps**: Loaded via iframe from production (or configured) URLs; no code from observer/express/finance is bundled into the hub

## Why Tauri over Electron

- Smaller binaries and lower memory use
- System WebView instead of bundling Chromium
- Rust backend for security and performance
- Same web frontend (React) as the rest of the ecosystem

## License

Same as the Boing Network repository.
