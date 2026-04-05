import { describe, expect, it } from 'vitest';
import {
  NATIVE_AMM_TOPIC_ADD_LIQUIDITY_HEX,
  NATIVE_AMM_TOPIC_REMOVE_LIQUIDITY_HEX,
  NATIVE_AMM_TOPIC_SWAP_HEX,
} from '../src/nativeAmm.js';
import {
  collectNativeAmmLog2FromReceipt,
  filterMapNativeAmmRpcLogs,
  isNativeAmmLog2Shape,
  isNativeAmmLog2Topic0,
  tryParseNativeAmmLog2,
  tryParseNativeAmmRpcLogEntry,
} from '../src/nativeAmmLogs.js';

const CALLER = '0x' + '11'.repeat(32);

function u128WordHex(n: bigint): string {
  const low16 = n.toString(16).padStart(32, '0').slice(-32);
  return '00'.repeat(16) + low16;
}

function tripleData(a: bigint, b: bigint, c: bigint): string {
  return `0x${u128WordHex(a)}${u128WordHex(b)}${u128WordHex(c)}`;
}

describe('nativeAmmLogs', () => {
  it('isNativeAmmLog2Topic0 matches the three constants', () => {
    expect(isNativeAmmLog2Topic0(NATIVE_AMM_TOPIC_SWAP_HEX)).toBe(true);
    expect(isNativeAmmLog2Topic0(NATIVE_AMM_TOPIC_ADD_LIQUIDITY_HEX)).toBe(true);
    expect(isNativeAmmLog2Topic0(NATIVE_AMM_TOPIC_REMOVE_LIQUIDITY_HEX)).toBe(true);
    expect(isNativeAmmLog2Topic0('0x' + '00'.repeat(32))).toBe(false);
  });

  it('tryParseNativeAmmLog2: swap', () => {
    const log = {
      topics: [NATIVE_AMM_TOPIC_SWAP_HEX, CALLER],
      data: tripleData(0n, 1000n, 180n),
    };
    const e = tryParseNativeAmmLog2(log);
    expect(e).toEqual({
      kind: 'swap',
      callerHex: CALLER.toLowerCase(),
      direction: 0n,
      amountIn: 1000n,
      amountOutAfterFee: 180n,
    });
    expect(isNativeAmmLog2Shape(log)).toBe(true);
  });

  it('tryParseNativeAmmLog2: addLiquidity', () => {
    const log = {
      topics: [NATIVE_AMM_TOPIC_ADD_LIQUIDITY_HEX, CALLER],
      data: tripleData(10n, 20n, 5n),
    };
    expect(tryParseNativeAmmLog2(log)).toEqual({
      kind: 'addLiquidity',
      callerHex: CALLER.toLowerCase(),
      amountA: 10n,
      amountB: 20n,
      lpMinted: 5n,
    });
  });

  it('tryParseNativeAmmLog2: removeLiquidity', () => {
    const log = {
      topics: [NATIVE_AMM_TOPIC_REMOVE_LIQUIDITY_HEX, CALLER],
      data: tripleData(3n, 40n, 50n),
    };
    expect(tryParseNativeAmmLog2(log)).toEqual({
      kind: 'removeLiquidity',
      callerHex: CALLER.toLowerCase(),
      liquidityBurned: 3n,
      amountAOut: 40n,
      amountBOut: 50n,
    });
  });

  it('tryParseNativeAmmLog2 returns null for wrong topic count or bad data', () => {
    expect(
      tryParseNativeAmmLog2({
        topics: [NATIVE_AMM_TOPIC_SWAP_HEX],
        data: tripleData(0n, 1n, 2n),
      })
    ).toBeNull();
    expect(
      tryParseNativeAmmLog2({
        topics: [NATIVE_AMM_TOPIC_SWAP_HEX, CALLER],
        data: '0x00',
      })
    ).toBeNull();
  });

  it('tryParseNativeAmmRpcLogEntry attaches placement', () => {
    const entry = {
      block_height: 7,
      tx_index: 0,
      tx_id: '0x' + 'aa'.repeat(32),
      log_index: 2,
      address: '0x' + 'bb'.repeat(32),
      topics: [NATIVE_AMM_TOPIC_SWAP_HEX, CALLER],
      data: tripleData(1n, 2n, 3n),
    };
    const p = tryParseNativeAmmRpcLogEntry(entry);
    expect(p).toMatchObject({
      kind: 'swap',
      block_height: 7,
      tx_index: 0,
      log_index: 2,
      direction: 1n,
      amountIn: 2n,
      amountOutAfterFee: 3n,
    });
  });

  it('filterMapNativeAmmRpcLogs keeps only parsable rows', () => {
    const good = {
      block_height: 1,
      tx_index: 0,
      tx_id: '0x' + 'cc'.repeat(32),
      log_index: 0,
      address: null,
      topics: [NATIVE_AMM_TOPIC_SWAP_HEX, CALLER],
      data: tripleData(0n, 1n, 2n),
    };
    const bad = { ...good, topics: ['0x' + '00'.repeat(32), CALLER] };
    const out = filterMapNativeAmmRpcLogs([bad, good]);
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('swap');
  });

  it('collectNativeAmmLog2FromReceipt scans receipt.logs', () => {
    const receipt = {
      tx_id: '0x' + 'dd'.repeat(32),
      block_height: 1,
      tx_index: 0,
      logs: [
        { topics: ['0x' + '00'.repeat(32)], data: '0x' },
        {
          topics: [NATIVE_AMM_TOPIC_ADD_LIQUIDITY_HEX, CALLER],
          data: tripleData(1n, 2n, 3n),
        },
      ],
    };
    const rows = collectNativeAmmLog2FromReceipt(receipt);
    expect(rows).toEqual([{ logIndex: 1, event: expect.objectContaining({ kind: 'addLiquidity' }) }]);
  });
});
