-- Speed lookups by block hash (e.g. GET /api/block?hash=...)
CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks (block_hash);
