-- Parent hash at indexed tip (for chain linkage; Worker still does not replay deep reorgs automatically).
ALTER TABLE directory_indexer_tip ADD COLUMN parent_block_hash TEXT;
