/**
 * ERC-721 **`Transfer(address,address,uint256)`** log parsing for indexer-style **`boing_getLogs`** rows.
 * Topic0 matches Ethereum’s canonical event signature (same as widely used EVM tooling).
 */

import { normalizeTopicWord } from './receiptLogs.js';
import type { RpcLogEntry } from './types.js';

/** `keccak256("Transfer(address,address,uint256)")` topic0 (lowercase `0x` + 64 hex). */
export const ERC721_TRANSFER_TOPIC0_HEX =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

function topicAddressToAccountHex32(topic: string): string | null {
  try {
    const t = normalizeTopicWord(topic);
    if (t.length !== 66) return null;
    const addr20 = t.slice(-40).toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(addr20)) return null;
    return (`0x${'00'.repeat(12)}${addr20}`) as string;
  } catch {
    return null;
  }
}

function topicUint256ToBigInt(topic: string): bigint | null {
  try {
    const t = normalizeTopicWord(topic);
    if (t.length !== 66) return null;
    return BigInt(t);
  } catch {
    return null;
  }
}

export type Erc721TransferParsed = {
  fromHex: `0x${string}`;
  toHex: `0x${string}`;
  tokenId: bigint;
  blockHeight: number;
  txId: string;
  logIndex: number;
};

/**
 * Parse one **`Transfer`** log (`4` topics: signature + indexed from + to + tokenId).
 */
export function tryParseErc721TransferRpcLog(entry: RpcLogEntry): Erc721TransferParsed | null {
  try {
    const t0 = normalizeTopicWord(entry.topics[0] ?? '');
    if (t0 !== ERC721_TRANSFER_TOPIC0_HEX) return null;
    if (entry.topics.length !== 4) return null;
    const from32 = topicAddressToAccountHex32(entry.topics[1]!);
    const to32 = topicAddressToAccountHex32(entry.topics[2]!);
    const tid = topicUint256ToBigInt(entry.topics[3]!);
    if (from32 == null || to32 == null || tid == null) return null;
    return {
      fromHex: from32.toLowerCase() as `0x${string}`,
      toHex: to32.toLowerCase() as `0x${string}`,
      tokenId: tid,
      blockHeight: entry.block_height,
      txId: entry.tx_id,
      logIndex: entry.log_index,
    };
  } catch {
    return null;
  }
}

export function filterMapErc721TransferRpcLogs(entries: readonly RpcLogEntry[]): Erc721TransferParsed[] {
  const out: Erc721TransferParsed[] = [];
  for (const e of entries) {
    const p = tryParseErc721TransferRpcLog(e);
    if (p) out.push(p);
  }
  return out;
}
