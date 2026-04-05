#!/usr/bin/env node
/**
 * Run the full Vitest suite and print why optional RPC integration tests may be skipped.
 *
 * Usage:
 *   npm run verify
 *   BOING_INTEGRATION_RPC_URL=http://127.0.0.1:8545 npm run verify
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const result = spawnSync('npx', ['vitest', 'run'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

const code = result.status ?? 1;

console.log('');
console.log('— boing-sdk verify —');
if (!process.env.BOING_INTEGRATION_RPC_URL?.trim()) {
  console.log(
    'Live tests in tests/rpcIntegration.test.ts are SKIPPED: BOING_INTEGRATION_RPC_URL is not set.'
  );
  console.log(
    'They need a live Boing JSON-RPC endpoint (e.g. local boing-node on http://127.0.0.1:8545).'
  );
  console.log('To run them: BOING_INTEGRATION_RPC_URL=http://127.0.0.1:8545 npm run verify');
} else {
  console.log(
    'BOING_INTEGRATION_RPC_URL is set; rpcIntegration tests should pass (not skipped).'
  );
  console.log(
    'Note: if the RPC lacks boing_getSyncState or boing_getLogs (-32601), those tests use fallbacks or accept method-not-found.'
  );
  if (process.env.BOING_EXPECT_FULL_RPC === '1' || process.env.BOING_EXPECT_FULL_RPC === 'true') {
    console.log(
      'BOING_EXPECT_FULL_RPC is set: strict discovery, probeBoingRpcCapabilities (6/6 read probes), planIndexerCatchUp, and rpcSupportedMethods must include getBlockByHeight + getTransactionReceipt + getNetworkInfo.'
    );
  } else {
    console.log(
      'Set BOING_EXPECT_FULL_RPC=1 with a current boing-node to also run strict discovery / probe tests (see rpcIntegration.test.ts).'
    );
  }
}
console.log('');

process.exit(code);
