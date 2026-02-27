#!/bin/bash
# Bootnode 1 — Primary (bootnode + faucet). Run on the machine with public IP and Cloudflare tunnel.
# Run start-cloudflare-tunnel in another terminal to expose RPC.
#
# Optional: Add --bootnodes /ip4/SECONDARY_IP/tcp/4001 once Bootnode 2 is running (for redundancy).

set -e
cd "$(dirname "$0")/.."

if [ ! -f target/release/boing-node ]; then
  echo "Building boing-node..."
  cargo build --release
fi

echo "Starting Bootnode 1 (validator + faucet)..."
echo "P2P: 0.0.0.0:4001"
echo "RPC: http://127.0.0.1:8545"
echo ""
echo "After starting, run start-cloudflare-tunnel in another terminal."
echo "Your public IP: curl -s ifconfig.me"
echo ""

# Add --bootnodes /ip4/SECONDARY_IP/tcp/4001 when Bootnode 2 is ready
./target/release/boing-node \
  --p2p-listen /ip4/0.0.0.0/tcp/4001 \
  --validator \
  --faucet-enable \
  --rpc-port 8545 \
  --data-dir ./bootnode1-data
