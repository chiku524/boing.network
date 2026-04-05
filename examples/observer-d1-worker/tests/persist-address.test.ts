import { describe, expect, it } from 'vitest';
import { normalizeLogContractAddress } from '../src/persist-d1.js';

describe('normalizeLogContractAddress', () => {
  it('accepts 0x + 64 hex', () => {
    expect(normalizeLogContractAddress('0x' + 'AB'.repeat(32))).toBe('0x' + 'ab'.repeat(32));
  });
  it('accepts bare 64 hex', () => {
    expect(normalizeLogContractAddress('bb'.repeat(32))).toBe('0x' + 'bb'.repeat(32));
  });
  it('rejects wrong length or type', () => {
    expect(normalizeLogContractAddress('0x00')).toBeNull();
    expect(normalizeLogContractAddress(null)).toBeNull();
    expect(normalizeLogContractAddress(1 as unknown as string)).toBeNull();
  });
});
