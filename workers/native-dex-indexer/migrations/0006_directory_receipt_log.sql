-- Optional bounded execution-log snapshot from `boing_getBlockByHeight(..., include_receipts: true)`.
-- Enabled when Worker var `NATIVE_DEX_INDEXER_RECEIPT_ARCHIVE_BLOCKS` > 0.
CREATE TABLE IF NOT EXISTS directory_receipt_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_height INTEGER NOT NULL,
  block_hash TEXT,
  tx_id TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  topic0_hex TEXT,
  topics_json TEXT NOT NULL,
  data_hex TEXT NOT NULL,
  sync_batch_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  row_json TEXT NOT NULL,
  UNIQUE (block_height, tx_id, log_index)
);

CREATE INDEX IF NOT EXISTS idx_receipt_log_topic0_id ON directory_receipt_log (topic0_hex, id DESC);
