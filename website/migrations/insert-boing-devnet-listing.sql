-- VibeMiner /api/networks D1 overrides (merged with static entries in functions/api/networks.js).
-- Canonical ids: boing-devnet (Windows), boing-devnet-linux, boing-devnet-macos.
--
-- After publishing GitHub release testnet-v0.1.3, refresh URLs + SHA256 from website/:
--   node scripts/network-listings-release-sql.mjs testnet-v0.1.3
--
-- Apply to remote D1:
--   npx wrangler d1 execute boing-network-db --remote --file=migrations/insert-boing-devnet-listing.sql

INSERT OR REPLACE INTO network_listings (id, node_download_url, node_command_template, node_binary_sha256, updated_at)
VALUES (
  'boing-devnet',
  'https://github.com/chiku524/boing.network/releases/download/testnet-v0.1.3/release-windows-x86_64.zip',
  'boing-node-windows-x86_64.exe --data-dir {dataDir} --p2p-listen /ip4/0.0.0.0/tcp/4001 --bootnodes /ip4/73.84.106.121/tcp/4001 --rpc-port 8545 --faucet-enable',
  '',
  datetime('now')
);

INSERT OR REPLACE INTO network_listings (id, node_download_url, node_command_template, node_binary_sha256, updated_at)
VALUES (
  'boing-devnet-linux',
  'https://github.com/chiku524/boing.network/releases/download/testnet-v0.1.3/release-linux-x86_64.zip',
  'boing-node-linux-x86_64 --data-dir {dataDir} --p2p-listen /ip4/0.0.0.0/tcp/4001 --bootnodes /ip4/73.84.106.121/tcp/4001 --rpc-port 8545 --faucet-enable',
  '',
  datetime('now')
);

INSERT OR REPLACE INTO network_listings (id, node_download_url, node_command_template, node_binary_sha256, updated_at)
VALUES (
  'boing-devnet-macos',
  'https://github.com/chiku524/boing.network/releases/download/testnet-v0.1.3/release-macos-aarch64.zip',
  'boing-node-macos-aarch64 --data-dir {dataDir} --p2p-listen /ip4/0.0.0.0/tcp/4001 --bootnodes /ip4/73.84.106.121/tcp/4001 --rpc-port 8545 --faucet-enable',
  '',
  datetime('now')
);
