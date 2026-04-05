/**
 * Parse native constant-product pool **`Log2`** rows (`topic0` + caller `topic1` + 96-byte `data`).
 * Matches `native_amm` emission and `docs/NATIVE-AMM-CALLDATA.md` § Logs.
 */

import {
  NATIVE_AMM_TOPIC_ADD_LIQUIDITY_HEX,
  NATIVE_AMM_TOPIC_REMOVE_LIQUIDITY_HEX,
  NATIVE_AMM_TOPIC_SWAP_HEX,
} from './nativeAmm.js';
import { decodeNativeAmmLogDataU128Triple } from './nativeAmmPool.js';
import { iterReceiptLogs, normalizeTopicWord } from './receiptLogs.js';
import type { ExecutionLog, ExecutionReceipt, RpcLogEntry } from './types.js';

const T0_SWAP = normalizeTopicWord(NATIVE_AMM_TOPIC_SWAP_HEX);
const T0_ADD = normalizeTopicWord(NATIVE_AMM_TOPIC_ADD_LIQUIDITY_HEX);
const T0_REMOVE = normalizeTopicWord(NATIVE_AMM_TOPIC_REMOVE_LIQUIDITY_HEX);

/** Discriminant for a parsed native AMM `Log2` event. */
export type NativeAmmLog2Kind = 'swap' | 'addLiquidity' | 'removeLiquidity';

export type NativeAmmLog2Event =
  | {
      kind: 'swap';
      callerHex: string;
      /** Calldata-style direction: `0` = A→B, `1` = B→A. */
      direction: bigint;
      amountIn: bigint;
      amountOutAfterFee: bigint;
    }
  | {
      kind: 'addLiquidity';
      callerHex: string;
      amountA: bigint;
      amountB: bigint;
      lpMinted: bigint;
    }
  | {
      kind: 'removeLiquidity';
      callerHex: string;
      liquidityBurned: bigint;
      amountAOut: bigint;
      amountBOut: bigint;
    };

/** `tryParseNativeAmmRpcLogEntry` result: parsed fields plus RPC placement. */
export type NativeAmmRpcLogParsed = NativeAmmLog2Event &
  Pick<RpcLogEntry, 'block_height' | 'tx_index' | 'tx_id' | 'log_index' | 'address'>;

function kindFromNormalizedTopic0(t0: string): NativeAmmLog2Kind | null {
  if (t0 === T0_SWAP) return 'swap';
  if (t0 === T0_ADD) return 'addLiquidity';
  if (t0 === T0_REMOVE) return 'removeLiquidity';
  return null;
}

/** True if `topic` (any casing / optional `0x`) is one of the three native AMM `Log2` topic0 values. */
export function isNativeAmmLog2Topic0(topic: string): boolean {
  try {
    return kindFromNormalizedTopic0(normalizeTopicWord(topic)) != null;
  } catch {
    return false;
  }
}

/**
 * True if `log` looks like a native AMM `Log2` (two topics, known topic0). Does not validate `data`.
 */
export function isNativeAmmLog2Shape(log: Pick<ExecutionLog, 'topics'>): boolean {
  if (log.topics.length !== 2) return false;
  return isNativeAmmLog2Topic0(log.topics[0]!);
}

/**
 * Parse one receipt / RPC log into a typed event, or `null` if shape or `data` does not match.
 */
export function tryParseNativeAmmLog2(log: Pick<ExecutionLog, 'topics' | 'data'>): NativeAmmLog2Event | null {
  try {
    if (log.topics.length !== 2) return null;
    const t0 = normalizeTopicWord(log.topics[0]!);
    const t1 = normalizeTopicWord(log.topics[1]!);
    const kind = kindFromNormalizedTopic0(t0);
    if (kind == null) return null;
    const [w0, w1, w2] = decodeNativeAmmLogDataU128Triple(log.data);
    const callerHex = t1;
    switch (kind) {
      case 'swap':
        return {
          kind: 'swap',
          callerHex,
          direction: w0,
          amountIn: w1,
          amountOutAfterFee: w2,
        };
      case 'addLiquidity':
        return {
          kind: 'addLiquidity',
          callerHex,
          amountA: w0,
          amountB: w1,
          lpMinted: w2,
        };
      case 'removeLiquidity':
        return {
          kind: 'removeLiquidity',
          callerHex,
          liquidityBurned: w0,
          amountAOut: w1,
          amountBOut: w2,
        };
    }
  } catch {
    return null;
  }
}

export function tryParseNativeAmmRpcLogEntry(entry: RpcLogEntry): NativeAmmRpcLogParsed | null {
  const event = tryParseNativeAmmLog2(entry);
  if (!event) return null;
  return {
    ...event,
    block_height: entry.block_height,
    tx_index: entry.tx_index,
    tx_id: entry.tx_id,
    log_index: entry.log_index,
    address: entry.address,
  };
}

/** Keep only `RpcLogEntry` rows that parse as native AMM `Log2`, with placement fields attached. */
export function filterMapNativeAmmRpcLogs(entries: readonly RpcLogEntry[]): NativeAmmRpcLogParsed[] {
  const out: NativeAmmRpcLogParsed[] = [];
  for (const e of entries) {
    const p = tryParseNativeAmmRpcLogEntry(e);
    if (p) out.push(p);
  }
  return out;
}

/** All successfully parsed native AMM logs in one receipt (in log order). */
export function collectNativeAmmLog2FromReceipt(
  receipt: ExecutionReceipt
): Array<{ logIndex: number; event: NativeAmmLog2Event }> {
  const out: Array<{ logIndex: number; event: NativeAmmLog2Event }> = [];
  for (const { log, logIndex } of iterReceiptLogs(receipt)) {
    const event = tryParseNativeAmmLog2(log);
    if (event) out.push({ logIndex, event });
  }
  return out;
}
