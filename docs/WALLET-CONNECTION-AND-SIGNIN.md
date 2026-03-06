# Wallet Connection and Sign-In

This doc describes the current testnet portal sign-in, what is needed to add **wallet connection** and **address + password** sign-in, and what the **boing.express wallet** (or any Boing-compatible wallet) needs to implement for secure connection to websites, web apps, and dApps.

---

## 1. Current sign-in (portal)

- **Flow:** User enters account ID (32-byte hex, `0x...`). Frontend calls `GET /api/portal/me?account_id_hex=...`. If the account is registered (developer / user / node_operator), the portal stores `{ account_id_hex, role }` in `localStorage` and redirects to the role’s hub.
- **No wallet:** No browser extension or wallet is involved; it’s address-only.
- **No password:** Anyone who knows the address can “sign in” as that account. Fine for testnet; not acceptable for mainnet or sensitive actions.

---

## 2. Adding wallet connection to sign-in

To support “Connect wallet” on the portal (and later dApps):

### 2.1 Wallet injector (browser extension)

- The wallet (e.g. boing.express) injects a provider into `window` (e.g. `window.ethereum` or `window.boing`).
- Standard pattern: **EIP-1193** (`request({ method: 'eth_requestAccounts' })` to get accounts; `personal_sign` or equivalent for signing a message).
- **Website/dApp responsibilities:**
  - Detect provider (e.g. `window.boing` or `window.ethereum`).
  - Call “request accounts” to get the current account (address).
  - For **authentication**, have the user sign a one-time or short-lived message (e.g. “Sign in to Boing Portal at {origin} at {timestamp}”), then send that signature (and address) to the backend; backend verifies the signature and issues a session (e.g. JWT or session cookie). Do **not** treat “I have the address” as proof of control; always verify with a signature.

### 2.2 What the portal would need

- **Frontend:** A small “Connect wallet” button that (1) requests accounts from the injected provider, (2) requests a sign-in message and sends it to the backend, (3) on success, stores session and redirects.
- **Backend:** New endpoint, e.g. `POST /api/portal/auth/sign-in` with body `{ account_id_hex, message, signature }`. Backend recovers signer from `message` + `signature` and checks it matches `account_id_hex`; if the account is registered, create session and return success.
- **Chain/RPC:** The wallet and the site must agree on the chain (e.g. Boing testnet/mainnet) and that the address format is 32-byte hex. The portal does not need to send transactions; only **message signing** for auth.

---

## 3. Adding address + password sign-in

To support “Sign in with address + password” (no wallet):

- **Backend:** Store a **hashed password** per account (e.g. in `portal_registrations` or a dedicated `portal_auth` table). Use a secure hash (e.g. Argon2 or bcrypt); never store plaintext passwords.
- **Registration:** When a user registers (or in a separate “Set password” step), they submit a password; backend hashes it and stores the hash linked to `account_id_hex`.
- **Sign-in:** User submits `account_id_hex` + password; backend hashes the submitted password, compares to stored hash, and if it matches and the account is registered, create session.
- **Security:** Use HTTPS only; consider rate limiting and lockout for failed attempts. Optional: combine with message signing (wallet) so that sensitive actions require a fresh signature even when session was created with password.

---

## 4. What boing.express wallet needs for secure dApp connection

For the Boing wallet to connect securely to websites/web apps/dApps, the following are typically required.

### 4.1 Provider API (injected or standard)

- **EIP-1193–style provider** so dApps can call:
  - `request({ method: 'eth_requestAccounts' })` → returns array of account addresses (e.g. 32-byte hex with `0x`).
  - `request({ method: 'personal_sign', params: [message, address] })` (or equivalent) → returns signature so the dApp or backend can verify the signer.
- Optional: `request({ method: 'eth_chainId' })` and/or `request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ... }] })` if the wallet supports multiple chains (e.g. Boing testnet vs mainnet).
- Expose this on a well-known object (e.g. `window.boing` or register as an EIP-6963 provider) so dApps can discover and use it.

### 4.2 Account format and chain

- **Account format:** Boing uses 32-byte (64 hex chars + `0x`) account addresses. The wallet must expose these in the same format the chain/RPC expects.
- **Chain ID:** Define a chain ID for Boing testnet and mainnet (if not already). dApps will use this to request the correct chain and RPC URL.

### 4.3 RPC and signing

- **RPC:** The wallet needs the correct Boing RPC URL (testnet/mainnet) to submit transactions and optionally to verify state. The dApp may pass this, or the wallet may have it built in for known chains.
- **Signing:** For auth, dApps only need **message signing** (e.g. `personal_sign`). For transactions, the wallet must support signing the Boing transaction format (whatever the node expects: e.g. raw tx bytes or a structured payload).

### 4.4 Security and UX

- **Origin and prompts:** Before signing a message or sending a tx, show the user the **origin** (domain) and a clear description (e.g. “Sign in to Boing Portal” or “Approve transfer”). Never sign blindly.
- **Phishing resistance:** Validate that the request is coming from a page the user is viewing (e.g. same tab/window). Optional: support WalletConnect or similar for mobile/second device so the same principles apply there.
- **Key storage:** Private keys must be stored and used in a secure way (e.g. encrypted, not exportable by default). This is entirely inside the wallet implementation.

### 4.5 Optional: WalletConnect / EIP-6963

- **WalletConnect:** If the wallet is on mobile or as a separate app, WalletConnect (v2) allows dApps to connect to it via QR or deep link. The wallet then needs to implement the WalletConnect provider side and the same RPC/signing methods.
- **EIP-6963:** Multi-injector discovery so dApps can list “available wallets” instead of relying on a single `window.ethereum`. Boing wallet can advertise itself via this so it appears in “Connect wallet” modals that support the standard.

---

## 5. Summary

| Feature | Portal/dApp side | Wallet (boing.express) side |
|--------|-------------------|------------------------------|
| **Current sign-in** | Address only; no proof of control | N/A |
| **Wallet connect** | Request accounts + sign-in message; verify signature on backend | EIP-1193 provider; `eth_requestAccounts`; `personal_sign` (or equivalent); expose on `window` or EIP-6963 |
| **Password sign-in** | Submit address + password; backend compares hash | N/A |
| **Secure dApp connection** | Use provider for accounts + signing; never trust “I have the address” without a signature | Provider API; 32-byte hex accounts; Boing chain ID + RPC; secure key storage; clear user prompts with origin |

Implementing wallet connection on the portal requires a backend sign-in endpoint that verifies a signature and then creates a session. Implementing address + password requires storing and checking a hashed password per account. The Boing wallet needs an EIP-1193–style provider with account discovery and message (and transaction) signing, plus clear UX and secure key handling, to support secure connections to any website or dApp.
