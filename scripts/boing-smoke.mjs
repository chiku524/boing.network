#!/usr/bin/env node
/**
 * Golden-path RPC smoke: {@link doctorBoingRpcEnvironment} + stdout report.
 * Requires `npm run build` in boing-sdk (uses dist/).
 *
 * Env: **BOING_RPC_URL** (default http://127.0.0.1:8545)
 * Optional: **BOING_SMOKE_REQUIRED_METHODS** — comma-separated `boing_*` names (must appear in `boing_rpcSupportedMethods`).
 */
import {
  createClient,
  doctorBoingRpcEnvironment,
  formatBoingRpcDoctorReport,
} from '../boing-sdk/dist/index.js';

const rpc = process.env.BOING_RPC_URL ?? 'http://127.0.0.1:8545';
const requiredRaw = process.env.BOING_SMOKE_REQUIRED_METHODS ?? '';
const requiredMethods = requiredRaw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  const client = createClient(rpc);
  const result = await doctorBoingRpcEnvironment(client, {
    requiredMethods: requiredMethods.length > 0 ? requiredMethods : undefined,
  });
  console.log(formatBoingRpcDoctorReport(result));
  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
