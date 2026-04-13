-- Universal contract deploy index (all `ContractDeploy*` txs observed on chain).
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingest_state (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contract_deployments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_hex TEXT NOT NULL UNIQUE,
  block_height INTEGER NOT NULL,
  tx_index INTEGER NOT NULL,
  tx_id_hex TEXT NOT NULL,
  sender_hex TEXT NOT NULL,
  payload_kind TEXT NOT NULL,
  purpose_category TEXT,
  asset_name TEXT,
  asset_symbol TEXT
);

CREATE INDEX IF NOT EXISTS idx_contract_deployments_id ON contract_deployments (id);
CREATE INDEX IF NOT EXISTS idx_contract_deployments_block ON contract_deployments (block_height, tx_index);
