import { describe, expect, it } from 'vitest';
import { lpShareTokenBalanceStorageKeyHex } from '../src/nativeLpShareToken.js';

describe('lpShareTokenBalanceStorageKeyHex', () => {
  it('XORs holder id with BOING_LP_SHARE_BAL_V1 mask (32 bytes)', () => {
    const holder = '0x' + '00'.repeat(32);
    const key = lpShareTokenBalanceStorageKeyHex(holder);
    const expectedXor = new Uint8Array(32);
    expectedXor.set(new TextEncoder().encode('BOING_LP_SHARE_BAL_V1'));
    const exp = '0x' + [...expectedXor].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(key.toLowerCase()).toBe(exp.toLowerCase());
  });
});
