#!/usr/bin/env node
/**
 * Print which core read-only `boing_*` methods the RPC exposes (-32601 = missing).
 * Run after `npm run build` (uses compiled `dist/`).
 *
 * Env: BOING_RPC_URL — default http://127.0.0.1:8545
 */
import {
  countAvailableBoingRpcMethods,
  createClient,
  explainBoingRpcProbeGaps,
  probeBoingRpcCapabilities,
} from '../dist/index.js';

const rpc = process.env.BOING_RPC_URL ?? 'http://127.0.0.1:8545';

async function main() {
  const client = createClient(rpc);
  const probe = await probeBoingRpcCapabilities(client);
  const diagnosis = explainBoingRpcProbeGaps(probe);

  let catalogMethodCount = null;
  let openApiPresent = null;
  let preflight = null;
  try {
    preflight = await client.preflightRpc();
    catalogMethodCount = preflight.catalogMethodCount;
    openApiPresent = preflight.openApiPresent;
  } catch {
    /* older node */
  }

  const summary = {
    ok: true,
    rpc,
    clientVersion: probe.clientVersion,
    supportedMethodCount:
      probe.supportedMethods != null ? probe.supportedMethods.length : null,
    availableCount: countAvailableBoingRpcMethods(probe),
    methods: probe.methods,
    ...(catalogMethodCount != null ? { catalogMethodCount } : {}),
    ...(openApiPresent != null ? { openApiPresent } : {}),
    ...(preflight != null
      ? {
          preflightHealth: preflight.health,
          httpLiveOk: preflight.httpLiveOk,
          httpReadyOk: preflight.httpReadyOk,
          jsonrpcBatchOk: preflight.jsonrpcBatchOk,
          httpOpenApiJsonOk: preflight.httpOpenApiJsonOk,
          wellKnownBoingRpcOk: preflight.wellKnownBoingRpcOk,
          httpLiveJsonOk: preflight.httpLiveJsonOk,
        }
      : {}),
    ...(diagnosis != null ? { diagnosis } : {}),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
