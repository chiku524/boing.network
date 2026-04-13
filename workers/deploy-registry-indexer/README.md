# Deploy registry indexer (Cloudflare Worker)

Materializes **every contract deploy** (`ContractDeploy*`) seen on a Boing chain into **D1**, using
`boing-sdk` helpers that match node address rules (nonce-derived + CREATE2 + init-code).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness JSON. |
| GET | `/v1/status` | Ingest cursor, chain tip, **blocks pending** estimate, effective `maxBlocksPerTick` / `parallelFetches`. |
| GET | `/v1/deployments?limit=&cursor=` | Paginate rows (`cursor` = last `id` from previous page; default `0`). |
| GET | `/v1/deployments/stream?since_id=` | **SSE** stream of new rows + `ping` when idle (~2.5s); **~100ms** between polls when rows are flowing. |
| GET | `/v1/contract/{0x…64}` | Lookup one deployment row by predicted contract account id. |
| POST | `/v1/sync` | Run **one bounded** ingest pass (same limits as cron). Requires `DEPLOY_REGISTRY_SYNC_SECRET` and header `Authorization: Bearer <secret>`. Configure with `npm run secret:sync`. |

## Sync model

- **Cron** (default: every minute) advances **`next_height`** in D1 and ingests up to **`DEPLOY_REGISTRY_MAX_BLOCKS_PER_TICK`** blocks per tick.
- Each tick issues up to **`DEPLOY_REGISTRY_PARALLEL_FETCHES`** concurrent **`boing_getBlockByHeight`** calls, then **batches D1 inserts** (up to 100 statements per `batch()` round-trip) for all deploy rows in those blocks.
- **Push-style clients** should open **`/v1/deployments/stream`** or subscribe to **`boing_newHeads`** on the node and refetch **`/v1/deployments`** after each head.
- **Catch-up:** tune **`DEPLOY_REGISTRY_MAX_BLOCKS_PER_TICK`** / **`DEPLOY_REGISTRY_PARALLEL_FETCHES`**, or call **`POST /v1/sync`** in a loop (with auth) to drain backlog faster than cron alone.

## Setup

1. `npm install`
2. Create D1: `npx wrangler d1 create boing-deploy-registry`
3. Put `database_id` into `wrangler.toml`
4. `npx wrangler d1 migrations apply boing-deploy-registry --local`
5. `npm run dev` — set `DEPLOY_REGISTRY_RPC_URL` if not using `[vars]` in `wrangler.toml`

## Trust / scope

This index is **existence-only** (contracts whose deploy txs appear in blocks you successfully fetched). It is **not** a token safety or spam filter.
