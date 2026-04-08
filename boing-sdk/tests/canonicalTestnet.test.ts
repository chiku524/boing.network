import { describe, expect, it } from 'vitest';
import { CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX } from '../src/canonicalTestnet.js';
import { validateHex32 } from '../src/hex.js';

describe('canonicalTestnet', () => {
  it('exports normalized 32-byte pool id matching docs / boing.finance', () => {
    expect(CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX).toBe(
      '0xce4f819369630e89c4634112fdf01e1907f076bc30907f0402591abfca66518d',
    );
    expect(validateHex32(CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX)).toBe(
      CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX,
    );
  });
});
