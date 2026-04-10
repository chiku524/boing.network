-- Materialized native AMM Log2 rows per indexer sync window (snapshot; not reorg-safe history).
CREATE TABLE IF NOT EXISTS directory_pool_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pool_hex TEXT NOT NULL,
  block_height INTEGER NOT NULL,
  tx_id TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  sync_batch_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  caller_hex TEXT NOT NULL,
  row_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dpe_pool_id ON directory_pool_events (pool_hex, id DESC);
CREATE INDEX IF NOT EXISTS idx_dpe_sync_batch ON directory_pool_events (sync_batch_id);
