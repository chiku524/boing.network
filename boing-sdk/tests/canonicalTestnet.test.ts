import { describe, expect, it } from 'vitest';
import { CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX } from '../src/canonicalTestnet.js';
import { validateHex32 } from '../src/hex.js';

describe('canonicalTestnet', () => {
  it('exports normalized 32-byte pool id matching docs / boing.finance', () => {
    expect(CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX).toBe(
      '0xffaa1290614441902ba813bf3bd8bf057624e0bd4f16160a9d32cd65d3f4d0c2',
    );
    expect(validateHex32(CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX)).toBe(
      CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX,
    );
  });
});
