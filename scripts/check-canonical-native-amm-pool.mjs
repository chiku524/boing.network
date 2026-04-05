#!/usr/bin/env node
/**
 * Verify public (or local) RPC can read the canonical native CP pool's reserve A slot.
 * No boing-sdk build — raw JSON-RPC only.
 *
 *   npm run check-canonical-pool
 *   BOING_RPC_URL=https://testnet-rpc.boing.network/ npm run check-canonical-pool
 *   BOING_POOL_HEX=0x... BOING_RPC_URL=... node scripts/check-canonical-native-amm-pool.mjs
 *
 * Exit 0: boing_getContractStorage returned a 32-byte word for reserve A key.
 * Exit 1: RPC error, wrong shape, or missing method.
 *
 * Optional strict mode (CI):
 *   BOING_REQUIRE_NONZERO_RESERVE=1  — exit 1 if reserve A word is all zeros (wrong chain, undeployed pool, or drained).
 *
 * Note: Without strict mode, all-zero reserve still exits 0 — RPC round-trip succeeded.
 * Compare with docs: docs/RPC-API-SPEC.md § Native constant-product AMM.
 */
const requireNonzeroReserve =
  process.env.BOING_REQUIRE_NONZERO_RESERVE === '1' ||
  process.env.BOING_REQUIRE_NONZERO_RESERVE === 'true';
const DEFAULT_POOL =
  '0xffaa1290614441902ba813bf3bd8bf057624e0bd4f16160a9d32cd65d3f4d0c2';
/** `native_amm::reserve_a_key` — k[31] = 0x01 */
const RESERVE_A_KEY = `0x${'00'.repeat(31)}01`;

const pool = (process.env.BOING_POOL_HEX ?? DEFAULT_POOL).trim();
const base = (process.env.BOING_RPC_URL ?? 'https://testnet-rpc.boing.network/').replace(/\/$/, '');

async function rpc(method, params) {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) {
    return { ok: false, error: j.error };
  }
  return { ok: true, result: j.result };
}

function isZeroWord(hex) {
  const h = hex.replace(/^0x/i, '').toLowerCase();
  return /^0+$/.test(h);
}

async function main() {
  const height = await rpc('boing_chainHeight', []);
  if (!height.ok) {
    console.error(
      JSON.stringify(
        { ok: false, phase: 'chainHeight', rpc: base, error: height.error },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const storage = await rpc('boing_getContractStorage', [pool, RESERVE_A_KEY]);
  if (!storage.ok) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          phase: 'boing_getContractStorage',
          rpc: base,
          pool,
          key: RESERVE_A_KEY,
          error: storage.error,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const value = storage.result?.value;
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          phase: 'parse',
          rpc: base,
          pool,
          message: 'expected result.value as 0x + 64 hex',
          raw: storage.result,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const reserveZero = isZeroWord(value);
  const out = {
    ok: true,
    rpc: base,
    pool,
    chainHeight: height.result,
    reserveA_storage_word: value,
    reserveA_all_zero: reserveZero,
    requireNonzeroReserve,
    hint: reserveZero
      ? 'Reserve A is zero — pool may have no liquidity on this chain, or this RPC is not the same network as the canonical deploy.'
      : 'Reserve A non-zero — pool contract readable on this RPC.',
  };

  if (requireNonzeroReserve && reserveZero) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: 'BOING_REQUIRE_NONZERO_RESERVE: reserve A is zero',
          rpc: base,
          pool,
          chainHeight: height.result,
          reserveA_storage_word: value,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
