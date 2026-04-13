# Deploy registry indexer (Cloudflare Worker)

Materializes **every contract deploy** (`ContractDeploy*`) seen on a Boing chain into **D1**, using
`boing-sdk` helpers that match node address rules (nonce-derived + CREATE2 + init-code).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness JSON. |
| GET | `/v1/deployments?limit=&cursor=` | Paginate rows (`cursor` = last `id` from previous page; default `0`). |
| GET | `/v1/deployments/stream?since_id=` | **SSE** stream of new rows + `ping` events (2.5s cadence). |

## Sync model

- **Cron** (default: every minute) advances **`next_height`** in D1 and ingests up to **`DEPLOY_REGISTRY_MAX_BLOCKS_PER_TICK`** blocks per tick.
- **Push-style clients** should open **`/v1/deployments/stream`** or subscribe to **`boing_newHeads`** on the node and refetch **`/v1/deployments`** after each head.

## Setup

1. `npm install`
2. Create D1: `npx wrangler d1 create boing-deploy-registry`
3. Put `database_id` into `wrangler.toml`
4. `npx wrangler d1 migrations apply boing-deploy-registry --local`
5. `npm run dev` — set `DEPLOY_REGISTRY_RPC_URL` if not using `[vars]` in `wrangler.toml`

## Trust / scope

This index is **existence-only** (contracts whose deploy txs appear in blocks you successfully fetched). It is **not** a token safety or spam filter.
