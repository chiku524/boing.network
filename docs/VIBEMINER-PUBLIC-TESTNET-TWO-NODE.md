# VibeMiner on Windows — public testnet (validator + full node)

**Goal:** Run **one validator** and **one full node** on separate Windows PCs with VibeMiner, both **joined to the same public Boing testnet** (not a private genesis lab).

**Bottom line:** This layout is **enough** for healthy testnet participation. You do **not** need Docker, systemd, or a Cloudflare tunnel unless you also want to **publish** JSON-RPC to the internet (separate goal).

---

## What you already satisfy

| Need | VibeMiner + official listing |
|------|------------------------------|
| Correct **`boing-node` build** | Zips from **`GET https://boing.network/api/networks`** (merged with app defaults); bump when the network bumps the tag. |
| **Bootnodes + P2P** | Presets pass **`--bootnodes`** and **`--p2p-listen`**; your nodes dial into the mesh. |
| **Same chain / genesis** | Same download + same network id as other testnet participants. |
| **Validator** | One machine with **`--validator`** and a staked account that can propose when elected. |
| **Full node** | Second machine **without** **`--validator`** — syncs, relays gossip, serves **local** RPC for your tools. |

---

## A. Automated checklist (repo — start here)

From a clone of **`boing.network`** on any machine that can reach **your** node and the internet (same PC as VibeMiner is fine):

```bash
npm run vibeminer-public-testnet-preflight
```

**What it checks**

| Step | Meaning |
|------|--------|
| **Outbound TCP to bootnodes** | Opens raw TCP to each deduped **`/ip4/.../tcp/4001`** in **`BOING_BOOTNODES`** (defaults match [website bootnode fallbacks](https://github.com/Boing-Network/boing.network/blob/main/website/src/config/testnet.ts)). **Warn-only by default:** many networks time out this probe while **`boing-node`** still dials libp2p. Set **`BOING_PREFLIGHT_BOOTNODE_TCP_STRICT=1`** to fail the run when every probe times out. |
| **`GET /api/networks`** | Reads **`meta.boing_testnet_download_tag`** so you can compare with the zip your VibeMiner listing uses. |
| **Local `boing_clientVersion`** | Shown next to the official tag for a quick “stale binary?” smell test. |
| **Tip + `chain_id` + sync** | Same logic as **`npm run compare-local-public-tip`** (`boing_chainHeight`, **`boing_getNetworkInfo`**, **`boing_getSyncState`** on local). If **both** heights are **0**, the report adds a **warning** (matching tips at genesis height is not proof of live testnet sync — use explorer or **`npm run check-testnet-rpc`**). |

**Environment**

| Variable | Default | Purpose |
|----------|---------|---------|
| **`BOING_LOCAL_RPC_URL`** | `http://127.0.0.1:8545` | Your VibeMiner / local node JSON-RPC. |
| **`BOING_PUBLIC_RPC_URL`** | `https://testnet-rpc.boing.network` | Reference tip + `chain_id`. |
| **`BOING_BOOTNODES`** | testnet defaults | Comma-separated multiaddrs; override if your listing uses different bootnodes. |
| **`BOING_OFFICIAL_NETWORKS_URL`** | `https://boing.network/api/networks` | Source for official download tag. |
| **`BOING_SYNC_MAX_LAG`** | `256` | Max blocks local may trail public before exit **2**. |
| **`BOING_PREFLIGHT_SKIP_TCP`** | unset | Set to **`1`** to skip bootnode TCP checks (e.g. locked-down CI). |
| **`BOING_PREFLIGHT_BOOTNODE_TCP_STRICT`** | unset | Set to **`1`** to treat “no TCP connect to any bootnode” as a hard failure (**exit 3**) after JSON-RPC checks pass. |
| **`BOING_BOOTNODE_TCP_TIMEOUT_MS`** | `12000` | Per-target TCP probe timeout. |
| **`BOING_PROBE_LOCAL_P2P`** | unset | Set to **`1`** to probe **`127.0.0.1:BOING_LOCAL_P2P_PORT`** (default **4001**) for a listening P2P port. |

**Lighter check (tip only)**

```bash
npm run compare-local-public-tip
```

**Exit codes (`vibeminer-public-testnet-preflight`)**

| Code | Meaning |
|------|--------|
| **0** | Chain tip within **`BOING_SYNC_MAX_LAG`**, no **`chain_id`** mismatch when both sides report ids. Bootnode TCP failures are **warnings** unless strict mode (see below). |
| **1** | Local or public JSON-RPC unreachable / parse failure. |
| **2** | Local tip too far behind public (**sync / bootnodes / binary**). |
| **3** | **`BOING_PREFLIGHT_BOOTNODE_TCP_STRICT=1`**, JSON-RPC checks passed, but **no** bootnode TCP probe succeeded — tighten firewall / ISP path or confirm bootnode reachability from the **same host** that runs the node. |
| **4** | **`chain_id`** mismatch between local and public **`boing_getNetworkInfo`**. |

---

## B. Manual checklist (operator — cannot be fully scripted)

- [ ] **Router / Windows Firewall:** allow **outbound TCP 4001** (and to bootnode IPs). Prefer **inbound TCP 4001** for healthier mesh (optional but recommended).
- [ ] **Validator keys:** only **one** live validator process per staked identity; never duplicate the same validator keys on two PCs.
- [ ] **Full node:** second PC without **`--validator`** — separate data dir and keys as usual in VibeMiner.
- [ ] **Listing alignment:** both PCs use the **same** Boing testnet network entry (same bootnode string and same node download URL / tag after merges from **`/api/networks`**).
- [ ] **Optional:** Cloudflare tunnel / public DNS only if **you** need to serve RPC to others; not required to stay joined to testnet.
- [ ] **Optional:** Indexer / Workers for analytics — not required for consensus or local dev against **public** RPC.

---

## C. Related docs and commands

- [VIBEMINER-INTEGRATION.md](VIBEMINER-INTEGRATION.md) — listings, **`/api/networks`**, §5.2 native AMM expectations.
- [TESTNET.md](TESTNET.md) — bootnodes, chain id **6913** (`0x1b01`), join flow.
- [RUNBOOK.md](RUNBOOK.md) §8 — public RPC, tunnel **530** / **1033** behavior.
- [PRE-VIBEMINER-NODE-COMMANDS.md](PRE-VIBEMINER-NODE-COMMANDS.md) — **`preflight-rpc`**, **`check-testnet-rpc`** (tutorial package; uses **`boing-sdk`**).

---

*Boing Network — Authentic. Decentralized. Optimal. Sustainable.*
