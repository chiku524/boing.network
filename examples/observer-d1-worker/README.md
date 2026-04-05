# Observer D1 ingest worker (scheduled)

Cloudflare Worker + **D1** that runs **`planIndexerCatchUp`** → **`fetchBlocksWithReceiptsForHeightRange`** on a cron, then upserts **`blocks` / `transactions` / `receipts` / `logs`**, **`ingest_cursor`**, and **`block_height_gaps`**.

**Catch-up:** Cron fires on the schedule in **`wrangler.toml`** (**`[triggers]`**). Each invocation is one **tick**: reorg rewind (optional), plan up to **`min(head, finalized)`** heights (bounded by **`BOING_MAX_BLOCKS_PER_TICK`**), fetch full blocks + receipts, persist, update the cursor. Ticks repeat until the planner returns **idle** (nothing left to index). See [OBSERVER-HOSTED-SERVICE.md](../../docs/OBSERVER-HOSTED-SERVICE.md) §5.

Each tick **rewinds stale tips** when RPC block headers disagree with D1 (see **`src/reorg-rewind.ts`**), then extends the chain. Optional env **`BOING_DISABLE_REORG_REWIND`** skips that (not recommended in production).

## Prereqs

- Node 20+ for Wrangler
- A **reachable** `BOING_RPC_URL` from Cloudflare (public HTTPS RPC — `127.0.0.1` only works in local dev with tunnels)

## Setup

1. **`wrangler.toml`** is bound to the **`boing-observer-indexer`** D1 database (`database_id` in-repo). If the name is taken in your account, run **`npx wrangler d1 create <unique-name>`** and update **`database_name`** + **`database_id`** in **`wrangler.toml`** and **`package.json`** migration scripts.

2. Install and apply migrations (schema matches [`tools/observer-indexer-schema.sql`](../../tools/observer-indexer-schema.sql)):

   ```bash
   cd examples/observer-d1-worker
   npm install
   npm run d1:apply:local
   # sync Cloudflare D1 (already applied for the in-repo database_id):
   # npm run d1:apply:remote
   # New migrations (e.g. `0002_idx_blocks_hash.sql`, `0003_readiness_lag_guard_armed.sql`) require `d1:apply:remote` once per environment.
   ```

3. Local dev (HTTP RPC on your machine — use **[`wrangler dev`](https://developers.cloudflare.com/workers/wrangler/commands/#dev)** only if the Worker can reach your node; often you point **`BOING_RPC_URL`** at **`https://testnet-rpc.boing.network`** or similar):

   ```bash
   npx wrangler dev
   ```

   Trigger cron manually: `npx wrangler dev --test-scheduled`

4. Deploy: set secrets / vars for production RPC (Wrangler dashboard or `wrangler secret put` if you move URL to secret).

## Configuration

| Source | Purpose |
|--------|---------|
| **`wrangler.toml` `[vars]`** | `BOING_RPC_URL`, `BOING_CHAIN_ID`, `BOING_MAX_BLOCKS_PER_TICK`, `BOING_OMIT_MISSING`, optional **`BOING_CORS_ORIGINS`**, **`BOING_APP_VERSION`**, **`BOING_MAX_REORG_REWIND_STEPS`**, **`BOING_DISABLE_REORG_REWIND`**, **`BOING_READINESS_MAX_LAG_FINALIZED`** (lag **503** only after **`readiness_lag_guard_armed`** — see below), **`BOING_READINESS_ARM_WHEN_LAG_LTE`** (arm when **`lagVsFinalized ≤`** this; default **128** in code if unset), optional **`BOING_READ_CACHE_MAX_AGE`** (positive seconds → **`public, max-age=…`** on successful block / tx / receipt / batch reads; capped at **86400**; default **`no-store`**) |
| **Cron** | Default every 3 minutes (`*/3 * * * *`) — tune under **`[triggers]`** |

## Read API (minimal)

JSON responses use CORS from **`BOING_CORS_ORIGINS`** (see **`src/cors.ts`**) and **`X-Content-Type-Options: nosniff`** on JSON. By default **`Cache-Control: no-store`**; set **`BOING_READ_CACHE_MAX_AGE`** (e.g. **`60`**) to allow short CDN/browser caching on **200** responses for **`/api/block`**, **`/api/transaction`**, **`/api/receipt`**, and **`/api/transactions/batch`** / **`/api/receipts/batch`** (not readiness, sync, logs, or lists).

After deploy:

| Method | Path | Notes |
|--------|------|-------|
| **GET** | **`/ingest-status`** (alias **`/api/ingest-status`**) | Cursor + gaps; **`?chain_id=`** optional |
| **GET** | **`/api/gaps?chain_id=`** | Raw **`block_height_gaps`** rows + merged **`gapRanges`** (same merge as ingest-status) |
| **GET** | **`/api/version`** | **`service`** + **`version`** (`BOING_APP_VERSION` or fallback) |
| **GET** | **`/api/stats`** | Row counts + block height min/max |
| **GET** | **`/api/sync`** | RPC **`boing_getSyncState`** vs cursor + **`lagVsRpcHead`** / **`lagVsFinalized`** + **`readinessLagGuardArmed`** / readiness env echo |
| **GET** / **HEAD** | **`/api/readiness`** | D1 **`SELECT 1`**, RPC tips; **`BOING_READINESS_MAX_LAG_FINALIZED`** enforced only when **`readinessLagGuardArmed`** (set automatically after catch-up — migration **`0003`**); JSON includes **`readinessLagGuardArmed`**, **`readinessArmWhenLagLte`** |
| **GET** / **HEAD** | **`/api/tip`** | Max indexed **`height`** + **`block_hash`**, or **`{ indexed: false }`** on **GET** when empty; **HEAD** → **`200`** / **`404`** |
| **GET** / **HEAD** | **`/api/block?height=<n>`** or **`?hash=`** / **`?block_hash=`** (`0x` + 64 hex) | Full JSON on **GET**; **HEAD** returns **`200`** / **`404`** only (cheap existence check, no **`block_json`** read) |
| **GET** | **`/api/blocks?from_height=&to_height=`** | Block headers only; inclusive span ≤ **64** |
| **GET** | **`/api/blocks/recent?limit=`** | Newest headers first; default **16**, max **32** |
| **GET** / **HEAD** | **`/api/transaction?tx_id=<0x+64hex>`** | Full row on **GET**; **HEAD** → **`200`** / **`404`** |
| **GET** | **`/api/transactions/batch?tx_ids=<id1,id2,…>`** | Up to **32** comma-separated tx ids; returns **`transactions`**, **`missing`** |
| **GET** | **`/api/receipts/batch?tx_ids=…`** | Same **`tx_ids`** rules; returns **`receipts`**, **`missing`** |
| **GET** / **HEAD** | **`/api/receipt?tx_id=<0x+64hex>`** | Full row on **GET**; **HEAD** → **`200`** / **`404`** |
| **GET** | **`/api/logs?…`** | **`tx_id=`** OR **`block_height=`** OR **`from_height=`** + **`to_height=`** (span ≤ **128**). Optional **`address=`** / **`contract=`** and **`topic0`…`topic3`** (or **`topic_0`…`topic_3`**). **`limit`** default **500**, max **2048**. |
| **GET** | **`/api/txs?…`** | **`block_height=`** OR range (span ≤ **64**); **`limit`** as above |
| **GET** | **`/health`** | Plain **`ok`** |
| **GET** | **`/`** | JSON index of endpoints |

Ingested logs persist **`address`** when the receipt log object includes a valid 32-byte account id (for **`/api/logs?address=`** filters).

The legacy D1 database **`boing-observer-ingest`** was removed after migrating to **`boing-observer-indexer`**; only the DB named in **`wrangler.toml`** is used.

## Uptime and synthetic checks

| Endpoint | Use |
|----------|-----|
| **`GET /health`** | Worker liveness only (no D1/RPC). |
| **`GET /api/readiness`** or **`HEAD /api/readiness`** | **Recommended** for monitors: D1 **`SELECT 1`**, RPC tips (**`planIndexerChainTipsWithFallback`**), optional lag guard (**`BOING_READINESS_MAX_LAG_FINALIZED`**). **503** when not ready. |

**Lag guard:** With **`BOING_READINESS_MAX_LAG_FINALIZED`** set (template default **512**), **`/api/readiness`** stays **200** during large backlogs until a scheduled tick observes **`lagVsFinalized ≤ BOING_READINESS_ARM_WHEN_LAG_LTE`** (default **128**), then persists **`readiness_lag_guard_armed = 1`** and lag enforcement applies. Tune **`BOING_READINESS_ARM_WHEN_LAG_LTE`** so it arms only when you consider the indexer “caught up.” See [OBSERVER-HOSTED-SERVICE.md](../../docs/OBSERVER-HOSTED-SERVICE.md) §8.1.

**Monorepo probe** (from repo root):

```bash
npm run check-observer-readiness -- https://your-worker.workers.dev
BOING_OBSERVER_USE_HEAD=1 npm run check-observer-readiness -- https://your-worker.workers.dev
```

## Limits

- Small **`BOING_MAX_BLOCKS_PER_TICK`** to stay under Worker CPU limits.
- Reorg rewind RPC steps capped per tick (**`BOING_MAX_REORG_REWIND_STEPS`**, absolute max **65536**).
- If the first fetched block’s **`parent_hash`** does not match the cursor after the initial rewind, the worker runs **one** extra rewind + replan + refetch in the same tick (skipped when **`BOING_DISABLE_REORG_REWIND`** is set).
- Same persistence rules as [`examples/observer-ingest-reference`](../observer-ingest-reference/) (tx rows require receipt **`tx_id`** when receipts are present).

## Tests

```bash
npm test
```
