-- Server-side pool directory (cursor pagination). Synced from indexer payload each cron / manual sync.
CREATE TABLE IF NOT EXISTS directory_pools (
  pool_hex TEXT PRIMARY KEY,
  token_a_hex TEXT NOT NULL,
  token_b_hex TEXT NOT NULL,
  sync_batch_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  row_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_directory_pools_token_a ON directory_pools (token_a_hex);
CREATE INDEX IF NOT EXISTS idx_directory_pools_token_b ON directory_pools (token_b_hex);
CREATE INDEX IF NOT EXISTS idx_directory_pools_sync_batch ON directory_pools (sync_batch_id);
