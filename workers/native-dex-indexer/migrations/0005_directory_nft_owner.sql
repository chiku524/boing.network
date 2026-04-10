-- Latest owner per (contract, token_id) within the indexer scan window (ERC-721 Transfer snapshot).
CREATE TABLE IF NOT EXISTS directory_nft_owner (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_hex TEXT NOT NULL,
  token_id_dec TEXT NOT NULL,
  owner_hex TEXT NOT NULL,
  last_block_height INTEGER NOT NULL,
  tx_id TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  sync_batch_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  row_json TEXT NOT NULL,
  UNIQUE (contract_hex, token_id_dec)
);

CREATE INDEX IF NOT EXISTS idx_nft_owner_contract_id ON directory_nft_owner (contract_hex, owner_hex, id DESC);
