# Observer ingest reference (JSON + SQLite)

Single-writer demos aligned with [`tools/observer-indexer-schema.sql`](../../tools/observer-indexer-schema.sql):

1. **JSON** — **`lastIndexedHeight`** + **`gapRanges`** in a file (minimal).
2. **SQLite** — same plus **`blocks` / `transactions` / `receipts` / `logs`** via Node’s built-in **`node:sqlite`** (**Node.js 22+**; may log an experimental warning).

Not production-grade: no HTTP API, no reorg rewind. For a hosted cron + **D1**, see [`examples/observer-d1-worker`](../observer-d1-worker/).

Shared fetch logic lives in **`scripts/lib/ingest-fetch-tick.mjs`** (used by both entry scripts).

## Setup

```bash
cd examples/observer-ingest-reference
npm install
```

Requires **`boing-sdk`** built (`npm run build` in `boing-sdk` if `dist/` is missing).

## Usage

```bash
# Plan + fetch one tick (throws on pruned holes unless you omit)
BOING_RPC_URL=http://127.0.0.1:8545 npm run ingest-tick

# Pruned RPC: record gaps and only advance contiguous cursor
BOING_RPC_URL=... BOING_OMIT_MISSING=1 npm run ingest-tick

# After archive backfill for heights 100–200, shrink stored gaps (then run a normal tick)
BOING_GAP_CLEAR_FROM=100 BOING_GAP_CLEAR_TO=200 npm run ingest-tick

# Preview without writing
BOING_WRITE_STATE=0 npm run ingest-tick

# SQLite file (persists blocks/receipts/logs + cursor + gaps)
BOING_SQLITE_PATH=./observer.sqlite BOING_RPC_URL=http://127.0.0.1:8545 npm run ingest-sqlite-tick

# SQLite dry-run (no DB writes)
BOING_SQLITE_PATH=./observer.sqlite BOING_WRITE_STATE=0 npm run ingest-sqlite-tick
```

Repo root delegates: **`npm run observer-ingest-ref-tick`**, **`npm run observer-ingest-sqlite-tick`** (run **`npm install`** in this package first).

## Env

| Variable | Role |
|----------|------|
| `BOING_RPC_URL` | JSON-RPC base URL |
| `BOING_OBSERVER_STATE_PATH` | State file (default `./observer-ingest-state.json`) |
| `BOING_CHAIN_ID` | Stored in state (default `unknown`) |
| `BOING_MAX_BLOCKS_PER_TICK` | Passed to **`planIndexerCatchUp`** |
| `BOING_MAX_CONCURRENT` | Fetch concurrency (default `1`) |
| `BOING_OMIT_MISSING` | `1` → **`onMissingBlock: 'omit'`** + union new gaps |
| `BOING_GAP_CLEAR_FROM` / `BOING_GAP_CLEAR_TO` | Inclusive range to **`subtractInclusiveRangeFromRanges`** from stored gaps |
| `BOING_WRITE_STATE` | Set `0` to skip **`writeFileSync`** (JSON) or SQLite writes |
| `BOING_SQLITE_PATH` | **Required** for **`ingest-sqlite-tick`** — path to SQLite file (created + migrated on first run) |

## State shape

```json
{
  "stateVersion": 1,
  "chainId": "unknown",
  "lastIndexedHeight": -1,
  "gapRanges": [{ "fromHeight": 10, "toHeight": 12 }]
}
```

See also: [`docs/OBSERVER-HOSTED-SERVICE.md`](../../docs/OBSERVER-HOSTED-SERVICE.md), [`docs/INDEXER-RECEIPT-AND-LOG-INGESTION.md`](../../docs/INDEXER-RECEIPT-AND-LOG-INGESTION.md).
