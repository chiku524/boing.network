-- Secondary indexes for common lookups; last_sync JSON blob in ingest_state (written by Worker).
CREATE INDEX IF NOT EXISTS idx_contract_deployments_tx_id ON contract_deployments (tx_id_hex);
CREATE INDEX IF NOT EXISTS idx_contract_deployments_sender ON contract_deployments (sender_hex);
