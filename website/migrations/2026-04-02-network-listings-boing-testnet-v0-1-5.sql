-- Refresh Boing testnet node zips to GitHub release testnet-v0.1.5 (SHA256 from GitHub release asset digests).
-- Apply (from website/): wrangler d1 execute boing-network-db --remote --file=./migrations/2026-04-02-network-listings-boing-testnet-v0-1-5.sql
--
-- `functions/api/networks.js` rewrites stale testnet-v0.1.0–v0.1.4 URLs to v0.1.5 after Workers deploy;
-- this migration keeps D1 authoritative.

INSERT OR REPLACE INTO network_listings (id, node_download_url, node_command_template, node_binary_sha256, updated_at)
VALUES (
  'boing-devnet',
  'https://github.com/chiku524/boing.network/releases/download/testnet-v0.1.5/release-windows-x86_64.zip',
  'boing-node-windows-x86_64.exe --data-dir {dataDir} --p2p-listen /ip4/0.0.0.0/tcp/4001 --bootnodes /ip4/73.84.106.121/tcp/4001,/ip4/73.84.106.121/tcp/4001 --rpc-port 8545 --faucet-enable',
  '9d5f9abf5872721b9c435e69ccbe539ad3105e677dc6927f713f905cd00ae7bf',
  datetime('now')
);

INSERT OR REPLACE INTO network_listings (id, node_download_url, node_command_template, node_binary_sha256, updated_at)
VALUES (
  'boing-devnet-linux',
  'https://github.com/chiku524/boing.network/releases/download/testnet-v0.1.5/release-linux-x86_64.zip',
  'boing-node-linux-x86_64 --data-dir {dataDir} --p2p-listen /ip4/0.0.0.0/tcp/4001 --bootnodes /ip4/73.84.106.121/tcp/4001,/ip4/73.84.106.121/tcp/4001 --rpc-port 8545 --faucet-enable',
  'd502e00dc4c97a2e2223c868d8ec3c5ac087d4c17e2eaf20f0f9d21636090dfa',
  datetime('now')
);

INSERT OR REPLACE INTO network_listings (id, node_download_url, node_command_template, node_binary_sha256, updated_at)
VALUES (
  'boing-devnet-macos',
  'https://github.com/chiku524/boing.network/releases/download/testnet-v0.1.5/release-macos-aarch64.zip',
  'boing-node-macos-aarch64 --data-dir {dataDir} --p2p-listen /ip4/0.0.0.0/tcp/4001 --bootnodes /ip4/73.84.106.121/tcp/4001,/ip4/73.84.106.121/tcp/4001 --rpc-port 8545 --faucet-enable',
  '2a7ce8f3df050dfbc336edd0b943c3a558a0be32ec8bd273b5ff66be899c399c',
  datetime('now')
);
