import { describe, expect, it } from 'vitest';
import {
  BoingReferenceCallDescriptors,
  abiArgAccount,
  abiArgU128,
  encodeBoingCallFromAbiArgs,
  encodeBoingCallFromDescriptor,
  encodeBoingCallTyped,
} from '../src/callAbi.js';
import { encodeReferenceTransferCalldata, SELECTOR_TRANSFER } from '../src/referenceToken.js';
import { encodeNativeAmmSwapCalldata } from '../src/nativeAmm.js';

describe('callAbi', () => {
  it('encodeBoingCallTyped matches reference transfer', () => {
    const to = '0x' + '03'.repeat(32);
    const calldata = encodeBoingCallTyped(SELECTOR_TRANSFER, ['account', 'u128'], [to, 7n]);
    const ref = encodeReferenceTransferCalldata(to, 7n);
    expect(Buffer.from(calldata).equals(Buffer.from(ref))).toBe(true);
  });

  it('encodeBoingCallFromAbiArgs matches reference transfer', () => {
    const to = '0x' + '04'.repeat(32);
    const calldata = encodeBoingCallFromAbiArgs(SELECTOR_TRANSFER, [
      abiArgAccount(to),
      abiArgU128(100n),
    ]);
    const ref = encodeReferenceTransferCalldata(to, 100n);
    expect(Buffer.from(calldata).equals(Buffer.from(ref))).toBe(true);
  });

  it('encodeBoingCallFromDescriptor token.transfer', () => {
    const to = '0x' + '05'.repeat(32);
    const d = BoingReferenceCallDescriptors.token.transfer;
    const calldata = encodeBoingCallFromDescriptor(d, [to, 1n]);
    expect(Buffer.from(calldata).equals(Buffer.from(encodeReferenceTransferCalldata(to, 1n)))).toBe(
      true
    );
  });

  it('encodeBoingCallFromDescriptor nativeAmm.swap', () => {
    const d = BoingReferenceCallDescriptors.nativeAmm.swap;
    const calldata = encodeBoingCallFromDescriptor(d, [0n, 50n, 1n]);
    const ref = encodeNativeAmmSwapCalldata(0n, 50n, 1n);
    expect(Buffer.from(calldata).equals(Buffer.from(ref))).toBe(true);
  });

  it('throws on arg count mismatch', () => {
    expect(() =>
      encodeBoingCallTyped(SELECTOR_TRANSFER, ['account', 'u128'], [0x0])
    ).toThrow('expected 2 values');
  });
});
