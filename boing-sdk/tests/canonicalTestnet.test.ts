import { describe, expect, it } from 'vitest';
import { CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX } from '../src/canonicalTestnet.js';
import { validateHex32 } from '../src/hex.js';

describe('canonicalTestnet', () => {
  it('exports normalized 32-byte pool id matching docs / boing.finance', () => {
    expect(CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX).toBe(
      '0x7247ddc3180fdc4d3fd1e716229bfa16bad334a07d28aa9fda9ad1bfa7bdacc3',
    );
    expect(validateHex32(CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX)).toBe(
      CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX,
    );
  });
});
