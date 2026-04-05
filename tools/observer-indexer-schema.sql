-- Minimal SQLite / Cloudflare D1 schema for a hosted observer ingestion plane.
-- Normative behavior: docs/OBSERVER-HOSTED-SERVICE.md, docs/INDEXER-RECEIPT-AND-LOG-INGESTION.md
-- SDK gap helpers: boing-sdk `summarizeIndexerFetchGaps`, `mergeInclusiveHeightRanges`, `nextContiguousIndexedHeightAfterOmittedFetch`

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingest_cursor (
  chain_id TEXT NOT NULL PRIMARY KEY,
  last_committed_height INTEGER NOT NULL,
  last_committed_block_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  readiness_lag_guard_armed INTEGER NOT NULL DEFAULT 0
);

-- Inclusive [from_height, to_height] ranges where the upstream RPC returned no block (pruned / incomplete).
-- Merge overlapping rows in application code (`mergeInclusiveHeightRanges` in boing-sdk) before insert, or replace.
CREATE TABLE IF NOT EXISTS block_height_gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id TEXT NOT NULL,
  from_height INTEGER NOT NULL,
  to_height INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT 'pruned',
  recorded_at INTEGER NOT NULL,
  CHECK (from_height >= 0),
  CHECK (from_height <= to_height)
);

CREATE INDEX IF NOT EXISTS idx_block_height_gaps_chain_from ON block_height_gaps (chain_id, from_height);

CREATE TABLE IF NOT EXISTS blocks (
  height INTEGER NOT NULL PRIMARY KEY,
  block_hash TEXT NOT NULL,
  parent_hash TEXT NOT NULL,
  block_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blocks_parent ON blocks (parent_hash);
CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks (block_hash);

CREATE TABLE IF NOT EXISTS transactions (
  tx_id TEXT NOT NULL PRIMARY KEY,
  block_height INTEGER NOT NULL,
  tx_index INTEGER NOT NULL,
  sender TEXT,
  payload_kind TEXT,
  raw_hex TEXT,
  UNIQUE (block_height, tx_index)
);

CREATE INDEX IF NOT EXISTS idx_transactions_block ON transactions (block_height, tx_index);

CREATE TABLE IF NOT EXISTS receipts (
  tx_id TEXT NOT NULL PRIMARY KEY,
  success INTEGER NOT NULL,
  gas_used TEXT NOT NULL,
  return_data TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_id TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_height INTEGER NOT NULL,
  address TEXT,
  topics_json TEXT NOT NULL,
  data_hex TEXT NOT NULL,
  UNIQUE (tx_id, log_index)
);

CREATE INDEX IF NOT EXISTS idx_logs_address ON logs (address);
CREATE INDEX IF NOT EXISTS idx_logs_block ON logs (block_height);
