#!/usr/bin/env node
/**
 * Verify JSON-RPC on the public testnet URL (default: https://testnet-rpc.boing.network/).
 * Exits 0 if core + QA transparency methods succeed; non-zero if any check fails.
 *
 * Usage:
 *   node scripts/verify-public-testnet-rpc.mjs
 *   TESTNET_RPC_URL=https://testnet-rpc.boing.network/ node scripts/verify-public-testnet-rpc.mjs
 */
const raw = (process.env.TESTNET_RPC_URL || 'https://testnet-rpc.boing.network').trim();
const url = `${raw.replace(/\/+$/, '')}/`;

const checks = [
  { method: 'boing_chainHeight', params: [], name: 'chain height' },
  { method: 'boing_getQaRegistry', params: [], name: 'QA registry (explorer transparency)' },
  { method: 'boing_qaPoolConfig', params: [], name: 'QA pool config' },
];

async function rpc(method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

let failed = false;
console.log('RPC URL:', url);
for (const { method, params, name } of checks) {
  try {
    const j = await rpc(method, params);
    if (j.error) {
      failed = true;
      console.log(`FAIL  ${method} (${name}):`, j.error.message || JSON.stringify(j.error));
    } else {
      console.log(`OK    ${method} (${name})`);
    }
  } catch (e) {
    failed = true;
    console.log(`FAIL  ${method} (${name}):`, e instanceof Error ? e.message : e);
  }
}

if (failed) {
  console.log(`
If QA methods failed but chain height works, the node behind this URL is an older
boing-node build. On the primary machine that serves localhost:8545 to Cloudflare:
  1) git pull && cargo build --release
  2) Stop the old node; start the new binary with the same flags (see scripts/start-bootnode-1.* and INFRASTRUCTURE-SETUP.md).
  3) Keep cloudflared running (testnet-rpc.boing.network -> http://127.0.0.1:8545).
Re-run this script until all checks pass.
`);
  process.exit(1);
}

process.exit(0);
