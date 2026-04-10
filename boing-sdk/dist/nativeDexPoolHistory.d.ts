/**
 * Collect native AMM **`Log2`** events for pools over a block range (materialized snapshot input).
 * Used by the **`native-dex-indexer`** Worker D1 table **`directory_pool_events`** — **not** reorg-safe;
 * see [PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md](../docs/PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md) §3.
 */
import type { BoingClient } from './client.js';
import { type NativeAmmLog2Kind, type NativeAmmRpcLogParsed } from './nativeAmmLogs.js';
export type NativeDexMaterializedPoolEvent = {
    kind: NativeAmmLog2Kind;
    poolHex: string;
    blockHeight: number;
    txId: string;
    logIndex: number;
    callerHex: string;
    /** Stringified integers for JSON columns. */
    payload: Record<string, string>;
};
export declare function materializeNativeAmmPoolEvent(ev: NativeAmmRpcLogParsed, poolHexLower: string): NativeDexMaterializedPoolEvent;
export type CollectNativeDexPoolEventsOptions = {
    /** Inclusive; clamped to `>= 0`. */
    fromBlock: number;
    /** Inclusive. */
    toBlock: number;
    maxConcurrent?: number;
};
/**
 * For each pool, **`boing_getLogs`** over **`[fromBlock, toBlock]`** and return parsed native AMM **`Log2`** rows.
 */
export declare function collectNativeDexPoolEventsForPools(client: BoingClient, poolHexes: readonly string[], opts: CollectNativeDexPoolEventsOptions): Promise<NativeDexMaterializedPoolEvent[]>;
//# sourceMappingURL=nativeDexPoolHistory.d.ts.map