import { describe, expect, it } from 'vitest';
import { materializeNativeAmmPoolEvent } from '../src/nativeDexPoolHistory.js';
import type { NativeAmmRpcLogParsed } from '../src/nativeAmmLogs.js';

describe('materializeNativeAmmPoolEvent', () => {
  it('stringifies swap payload fields', () => {
    const ev: NativeAmmRpcLogParsed = {
      kind: 'swap',
      block_height: 10,
      tx_index: 0,
      tx_id: '0xab',
      log_index: 2,
      callerHex: '0x' + 'cc'.repeat(32),
      address: '0x' + 'dd'.repeat(32),
      direction: 1n,
      amountIn: 100n,
      amountOutAfterFee: 99n,
    };
    const m = materializeNativeAmmPoolEvent(ev, '0x' + 'dd'.repeat(32));
    expect(m.kind).toBe('swap');
    expect(m.blockHeight).toBe(10);
    expect(m.blockHash).toBeNull();
    expect(m.payload).toEqual({
      direction: '1',
      amountIn: '100',
      amountOutAfterFee: '99',
    });
  });
});
