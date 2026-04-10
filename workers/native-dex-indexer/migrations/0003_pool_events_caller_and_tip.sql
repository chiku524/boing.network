-- Chain tip row for client skew checks (Worker does not rewind on reorg).
-- Note: `caller_hex` on `directory_pool_events` is created by `0002_directory_pool_events.sql` in this repo.
CREATE TABLE IF NOT EXISTS directory_indexer_tip (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  tip_height INTEGER,
  tip_block_hash TEXT,
  sync_batch_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dpe_caller_id ON directory_pool_events (caller_hex, id DESC);
