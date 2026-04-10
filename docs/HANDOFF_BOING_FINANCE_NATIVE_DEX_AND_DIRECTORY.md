# Handoff: boing.finance — native DEX, indexer, directory API, protocol dependencies

This document is for engineers working in the **boing.finance** repository. It complements **boing.network** docs: [HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md](HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md) (ops + Worker), [BOING-DAPP-INTEGRATION.md](BOING-DAPP-INTEGRATION.md) (SDK patterns), and [HANDOFF-DEPENDENT-PROJECTS.md](HANDOFF-DEPENDENT-PROJECTS.md) §4.

**Canonical upstream:** [`Boing-Network/boing.network`](https://github.com/Boing-Network/boing.network) — `boing-sdk`, Worker `workers/native-dex-indexer/`, RPC specs.

---

## 1. What you already have (typical boing.finance layout)

| Area | Typical location | Upstream reference |
|------|------------------|-------------------|
| Indexer JSON (full document) | `REACT_APP_BOING_NATIVE_DEX_INDEXER_STATS_URL` or Pages `GET /api/native-dex-indexer-stats` | Same shape as Worker `GET /stats`; optional `pools_page` / `pools_page_size` |
| CLI / CI indexer | `.github/workflows/native-dex-indexer.yml` | Builds artifact; optional **`upload-r2`** when GitHub **Variables** + Cloudflare **secrets** set — see [HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md](HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md) §2.2 |
| Env overrides | `REACT_APP_BOING_NATIVE_*` pool, factory, routers, vault, share | [RPC-API-SPEC.md](RPC-API-SPEC.md) env table; SDK **`buildNativeDexIntegrationOverridesFromProcessEnv`** |
| Wallet / simulate | Boing Express + **`boing_simulateTransaction`** | [BOING-DAPP-INTEGRATION.md](BOING-DAPP-INTEGRATION.md) §4 |

---

## 2. New: D1 directory API (server-driven pool pagination)

**Problem:** The full indexer JSON can grow with many pools. **boing.network** exposes a **cursor-paginated** HTTP API on the Cloudflare Worker (not JSON-RPC).

**Worker base URL (example deploy):** `https://boing-native-dex-indexer.nico-chikuji.workers.dev` — replace with your team’s production hostname when known ([HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md](HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md) §6).

**Endpoints:**

- `GET {base}/v1/directory/meta` → `{ api, poolCount, latestSyncBatch }`
- `GET {base}/v1/directory/pools?limit=&cursor=` → `{ pools, nextCursor, hasMore, limit, cursor, api }`  
  First page: omit `cursor`. Next: `cursor=<last poolHex from previous response>`. `limit` default 20, max 100.

**SDK (pin or `file:../boing-sdk`):**

- `fetchNativeDexDirectoryMeta`, `fetchNativeDexDirectoryPoolsPage`, `collectAllNativeDexDirectoryPools` — [`boing-sdk/src/nativeDexDirectoryApi.ts`](../boing-sdk/src/nativeDexDirectoryApi.ts)

**Suggested frontend env:**

- `REACT_APP_BOING_NATIVE_DEX_DIRECTORY_BASE_URL` — Worker **origin only** (no path), e.g. `https://boing-native-dex-indexer.….workers.dev`  
  (You may instead overload a single URL that includes `/v1/directory/pools`; then strip to origin before calling `fetchNativeDexDirectoryMeta`, or call meta with a derived URL — keep one clear convention in code.)

**Pools UI behavior:**

1. Load **page 1** from the directory API when `REACT_APP_*` is set and `poolCount` from meta is large enough to justify it (or always use directory for the table skeleton).
2. Continue to merge rows with **`remoteIndexerStats`** (or full `/stats`) **by `poolHex`** so 24h volume, TVL hints, and `tokenDirectory` stay fresh — directory rows are the **same** `NativeDexIndexerPoolRow` shape from the last sync batch.

**Verification (from boing.network clone):**

```bash
cd /path/to/boing.network
npm run verify-native-dex-directory-worker
# optional: BOING_NATIVE_DEX_DIRECTORY_BASE_URL=https://your-worker.workers.dev npm run verify-native-dex-directory-worker
```

---

## 3. Protocol / node: not solvable in boing.finance alone

These require **boing-node / protocol** design and rollout. **Normative drafts and checklists** live in:

**[PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md](PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md)**

| Track | What boing.finance should do when ready |
|--------|----------------------------------------|
| **§1 Unsigned read-only simulate** | **`boing_simulateContractCall`** is implemented on current **`boing-node`**; **`boing-sdk`** **`simulateContractCall`**. Set **`REACT_APP_BOING_RPC_UNSIGNED_SIMULATE_METHOD=boing_simulateContractCall`** when RPC supports it; probe first. Fallback: **`boing_simulateTransaction`**. |
| **§2 LP positions & vault routing** | Replace or narrow **`REACT_APP_BOING_NATIVE_DEX_VAULT_POOL_MAP_JSON`** when RPC or indexer exposes **vault → pool** and **user positions**; adjust LP UI to the chosen **position model** (NFT vs share token vs vault). |
| **§3 Subgraph-style history** | If product needs receipt-level history, **pool lifecycle**, or reorg-safe attribution, plan a **dedicated indexer** (or node extension); the D1 directory remains a **materialized snapshot**, not an event store. |

---

## 4. Ops reminders (shared with protocol team)

- **Manual D1 refresh:** Worker secret `DIRECTORY_SYNC_SECRET` + `POST /v1/directory/sync` with `Authorization: Bearer …` — [HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md](HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md) §2.1  
- **`poolCount: 0`** until first cron or successful manual sync is **expected**.  
- **R2 upload job:** optional; requires bucket creation + GitHub vars — same handoff §2.2.

---

## 5. Doc map (boing.finance engineer)

| Topic | Doc |
|-------|-----|
| dApp + SDK checklist | [BOING-DAPP-INTEGRATION.md](BOING-DAPP-INTEGRATION.md) |
| RPC methods + canonical pool table | [RPC-API-SPEC.md](RPC-API-SPEC.md) |
| Native DEX capability limits | [BOING-NATIVE-DEX-CAPABILITY.md](BOING-NATIVE-DEX-CAPABILITY.md) |
| LP vault / share token VM | [NATIVE-AMM-LP-VAULT.md](NATIVE-AMM-LP-VAULT.md), [NATIVE-LP-SHARE-TOKEN.md](NATIVE-LP-SHARE-TOKEN.md) |
| Protocol drafts (simulate, positions, indexing) | [PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md](PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md) |
| Cross-repo alignment | [THREE-CODEBASE-ALIGNMENT.md](THREE-CODEBASE-ALIGNMENT.md), [HANDOFF-DEPENDENT-PROJECTS.md](HANDOFF-DEPENDENT-PROJECTS.md) |

---

## 6. One-line summary for issue trackers

**boing.finance:** wire optional **`REACT_APP_BOING_NATIVE_DEX_DIRECTORY_BASE_URL`**, paginate Pools UI via **`boing-sdk`** directory helpers, merge with indexer stats by **`poolHex`**; keep R2/GitHub vars in sync with ops. **Protocol:** implement unsigned simulate RPC, LP position discovery, and/or subgraph-class indexer per **PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md**.
