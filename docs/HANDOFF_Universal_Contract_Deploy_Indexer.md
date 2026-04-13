# Handoff: Universal contract deploy listing + live updates

**Goal:** Offer an HTTP (and optional **SSE**) surface that lists **predicted contract account ids** for every **`ContractDeploy` / `ContractDeployWithPurpose` / `ContractDeployWithPurposeAndMetadata`** transaction, and stays current as new blocks are committed.

**This is not** `boing_listDexTokens` (DEX-scoped). It is a **chain-wide deploy feed** backed by an **indexer**.

---

## Components (this repo)

| Piece | Location |
|-------|-----------|
| **Extract + tx id** | `boing-sdk` — `extractUniversalContractDeploymentsFromBlock`, `transactionIdFromUnsignedRpcTransaction`, `rpcTransactionJsonToTransactionInput` (`universalContractDeployIndex.ts`). |
| **Hosted indexer** | `workers/deploy-registry-indexer` — Cloudflare Worker + **D1** + cron scan + **`GET /v1/deployments`** + **`GET /v1/deployments/stream`** (SSE). |

---

## Operator checklist

1. Deploy the Worker (`workers/deploy-registry-indexer`), create **D1**, run **migrations**.
2. Point **`DEPLOY_REGISTRY_RPC_URL`** at a node that returns full **`transactions`** on **`boing_getBlockByHeight`** (JSON shape matches `boing_primitives::Block` serde).
3. Tune **`DEPLOY_REGISTRY_MAX_BLOCKS_PER_TICK`** (default **8**) so cron stays within CPU limits; catch up may take multiple ticks.
4. Optionally lower cron interval in `wrangler.toml` once stable.

---

## Client integration

- **Pagination:** `GET /v1/deployments?cursor={last_id}&limit=100` — treat `nextCursor` as opaque.
- **Observability:** `GET /v1/status` — cursor vs chain tip, pending block estimate, effective ingest batch sizes.
- **Single contract:** `GET /v1/contract/0x…` (64 hex chars) when you only need one predicted deploy row.
- **Near-real-time:** open **`GET /v1/deployments/stream?since_id=`** (SSE) or combine **`BoingNewHeadsWs`** with periodic HTTP refresh.
- **Burst ingest (ops):** `POST /v1/sync` with `Authorization: Bearer <DEPLOY_REGISTRY_SYNC_SECRET>` runs one bounded pass (same limits as cron); set the secret with `wrangler secret put DEPLOY_REGISTRY_SYNC_SECRET`.
- **Verification:** recompute predicted addresses with **`predictNonceDerivedContractAddress`** / **`predictCreate2ContractAddress`** from the same deploy tx JSON if you need to audit the indexer.

---

## Limits

- **Missed blocks:** if RPC omits a height, the indexer advances past it (empty extract); use gap tooling (`boing-sdk` indexer gap helpers) or reseed **`next_height`** if you must backfill.
- **Not every “account”:** only **contract deploy** payloads; EOAs created outside deploy txs do not appear.
- **Worker SSE** is best-effort; clients should **reconnect** on disconnect and pass the last seen **`id`** as **`since_id`**.
