# Boing Network — VibeMiner Integration

> **Purpose:** How Boing testnet (and mainnet) can be offered as a one-click mining/validator experience in VibeMiner desktop apps.  
> **Audience:** VibeMiner maintainers and network operators who want to list Boing in the app.

---

## 1. What VibeMiner needs from Boing

To support “one-click” running of a Boing node (validator or full node) from VibeMiner, the app typically needs:

| Item | What Boing provides |
|------|----------------------|
| **Node binary** | `boing-node` (single executable; build from this repo or use a published release). |
| **How to run** | CLI flags: `--validator`, `--rpc-port`, `--data-dir`, `--p2p_listen`, `--bootnodes`, `--faucet-enable` (testnet). |
| **RPC** | JSON-RPC over HTTP on `--rpc-port` (default 8545). Methods: `boing_chainHeight`, `boing_submitTransaction`, etc. See [RPC-API-SPEC.md](RPC-API-SPEC.md). |
| **Testnet faucet** | RPC method `boing_faucetRequest([hex_account_id])` when node is started with `--faucet-enable`; or point users to the web faucet. |
| **Bootnodes** | Comma-separated multiaddrs for testnet/mainnet; published on [TESTNET.md](TESTNET.md) and website `/network/testnet`. |

No separate “miner” binary: **validating** is done by running `boing-node --validator`. PoS: validators stake BOING (bond/unbond via transactions).

---

## 2. Suggested integration flow in VibeMiner

1. **Discovery**  
   User selects “Boing Network” (testnet or mainnet) in the app.

2. **Binary**  
   - Either: bundle or download `boing-node` for the user’s OS (Windows, macOS, Linux).  
   - Or: prompt user to install from [releases](https://github.com/boing-network/boing-network/releases) and detect `boing-node` in PATH.

3. **One-click “Start node”**  
   VibeMiner runs something equivalent to:

   **Testnet:**

   ```text
   boing-node --p2p_listen /ip4/0.0.0.0/tcp/4001 \
     --bootnodes <OFFICIAL_TESTNET_BOOTNODES> \
     --validator \
     --rpc-port 8545 \
     --data-dir <USER_DATA_DIR>
   ```

   **Mainnet (when live):**

   ```text
   boing-node --p2p_listen /ip4/0.0.0.0/tcp/4001 \
     --bootnodes <OFFICIAL_MAINNET_BOOTNODES> \
     --validator \
     --rpc-port 8545 \
     --data-dir <USER_DATA_DIR>
   ```

   Omit `--validator` if the user only wants a full node.

4. **Health / status**  
   Poll `http://127.0.0.1:8545/` with:

   ```json
   {"jsonrpc":"2.0","id":1,"method":"boing_chainHeight","params":[]}
   ```

   Show chain height and “Synced” / “Syncing” in the UI.

5. **Faucet (testnet only)**  
   - Option A: In-app “Get testnet BOING” that calls the **public testnet RPC** `boing_faucetRequest([user_account_hex])` (no need to run a faucet locally).  
   - Option B: Link to the web faucet (e.g. [boing.network/network/faucet](/network/faucet)).

6. **Staking (validator)**  
   User must hold BOING and submit a `Bond` transaction (via RPC or a wallet that supports Boing). Validator set is derived from top stakers. VibeMiner can link to docs or a “How to stake” page.

---

## 3. Where to get bootnodes and RPC URLs

| Network | Bootnodes | Public RPC (for faucet / read-only) |
|---------|-----------|-------------------------------------|
| **Testnet** | [TESTNET.md](TESTNET.md) §6; website `/network/testnet` | To be published at testnet launch |
| **Mainnet** | To be published | To be published |

**Why "no nodes" or "cannot connect"?** If VibeMiner shows no nodes or cannot join the testnet, it means bootnodes and/or a public RPC are not yet live. The Boing team must complete the steps in [LAUNCH-BLOCKING-CHECKLIST.md](LAUNCH-BLOCKING-CHECKLIST.md) first.

When Boing publishes the official testnet, the repo and website will list:

- Comma-separated bootnode multiaddrs.
- A public testnet RPC URL (for faucet and light queries).

VibeMiner can read these from a config file, the website, or a small API so the app stays up to date without code changes.

---

## 4. Onboarding details you can provide

If you have **VibeMiner-specific onboarding** (e.g. app store links, install steps, or a “Add your network” form), we can:

- Link to it from [TESTNET.md](TESTNET.md) and the website “Join Testnet” / “One-click mining” section.
- Describe it in this doc (e.g. “To add Boing to VibeMiner, follow …”).

Share the onboarding flow (or a draft) and we’ll integrate it into the docs and site.

---

## 5. Summary

| Boing provides | Use in VibeMiner |
|----------------|------------------|
| `boing-node` binary | Run as process; optional bundling or PATH detection. |
| `--validator`, `--rpc-port`, `--data-dir`, `--p2p_listen`, `--bootnodes` | Command line for “Start node” / “Start validator”. |
| RPC on port 8545 | Status (e.g. `boing_chainHeight`), future wallet/tx features. |
| `boing_faucetRequest` (testnet) or web faucet | “Get testnet BOING” in app or link. |
| Bootnode list (TESTNET.md, website) | So the node joins the right network. |

No separate miner binary; no custom daemon protocol—just the node binary and JSON-RPC.

---

*Boing Network — Authentic. Decentralized. Optimal. Sustainable.*
