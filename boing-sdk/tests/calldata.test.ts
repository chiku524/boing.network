import { describe, expect, it } from 'vitest';
import {
  assertBoingCalldataWord,
  boingWordAccount,
  boingWordU128,
  encodeBoingCall,
  calldataAccountIdWord,
  calldataFixedWord32,
  calldataSelectorLastByte,
  calldataU128BeWord,
  concatCalldata,
} from '../src/calldata.js';
import { encodeReferenceTransferCalldata, SELECTOR_TRANSFER } from '../src/referenceToken.js';

describe('calldata', () => {
  it('calldataSelectorLastByte', () => {
    const w = calldataSelectorLastByte(0xab);
    expect(w.length).toBe(32);
    expect(w[31]).toBe(0xab);
    expect(w[0]).toBe(0);
  });

  it('calldataU128BeWord', () => {
    const w = calldataU128BeWord(1n);
    expect(w.length).toBe(32);
    expect(w[31]).toBe(1);
    expect(w[15]).toBe(0);
  });

  it('calldataAccountIdWord', () => {
    const id = '0x' + '01'.repeat(32);
    const w = calldataAccountIdWord(id);
    expect(w.length).toBe(32);
    expect(w[0]).toBe(1);
  });

  it('concatCalldata', () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3]);
    expect([...concatCalldata([a, b])]).toEqual([1, 2, 3]);
  });

  it('matches reference transfer layout', () => {
    const to = '0x' + '02'.repeat(32);
    const manual = concatCalldata([
      calldataSelectorLastByte(SELECTOR_TRANSFER),
      calldataAccountIdWord(to),
      calldataU128BeWord(42n),
    ]);
    const ref = encodeReferenceTransferCalldata(to, 42n);
    expect(Buffer.from(manual).equals(Buffer.from(ref))).toBe(true);
  });

  it('calldataFixedWord32 rejects bad length', () => {
    expect(() => calldataFixedWord32('0x01')).toThrow();
  });

  it('assertBoingCalldataWord rejects wrong length', () => {
    expect(() => assertBoingCalldataWord(new Uint8Array(31))).toThrow();
  });

  it('encodeBoingCall matches reference transfer', () => {
    const to = '0x' + '02'.repeat(32);
    const calldata = encodeBoingCall(SELECTOR_TRANSFER, [boingWordAccount(to), boingWordU128(99n)]);
    const ref = encodeReferenceTransferCalldata(to, 99n);
    expect(Buffer.from(calldata).equals(Buffer.from(ref))).toBe(true);
  });
});
