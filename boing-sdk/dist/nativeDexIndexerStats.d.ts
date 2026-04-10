/**
 * Native CP DEX indexer stats (pools, AMM log aggregates, optional reserve history, 24h swap window via block timestamps).
 * Used by boing.finance CLI/Pages and boing.network Cloudflare Workers (KV-backed history).
 */
import type { BoingClient } from './client.js';
import { type NativeDexIntegrationOverrides } from './dexIntegration.js';
import { type CpPoolVenue } from './nativeDexRouting.js';
export type NativeDexIndexerHistoryPoint = {
    t: number;
    ra: string;
    rb: string;
};
export type NativeDexIndexerPersistedDoc = {
    history: Record<string, NativeDexIndexerHistoryPoint[]>;
    lastHeadHeight?: number;
    savedAt?: number;
};
/** Load/save full persisted JSON (same shape as CLI state file). */
export interface NativeDexIndexerHistoryStore {
    get(): Promise<string | null>;
    put(body: string): Promise<void>;
}
export type NativeDexIndexerTokenMeta = {
    id: string;
    symbol: string;
    name: string;
};
export type NativeDexIndexerStatsOptions = {
    overrides?: NativeDexIntegrationOverrides;
    /** Inclusive factory `register_pair` scan from this block (omit / NaN to skip). */
    registerFromBlock?: number;
    /** Max inclusive block span for `boing_getLogs` per pool (clamped 1..50000). */
    logScanBlocks?: number;
    /** When set, merge reserve samples and return accumulated `history`. */
    historyStore?: NativeDexIndexerHistoryStore | null;
    /** Defaults to `Date.now()`. */
    nowMs?: number;
    /** JSON string: token hex → USD per atomic unit (+ optional default / defaulta / defaultb). */
    tokenUsdJson?: string;
    /** JSON array of `{ id, symbol?, name? }` merged into `tokenDirectory`. */
    tokenDirectoryExtraJson?: string;
};
export type NativeDexIndexerPoolRow = {
    poolHex: string;
    tokenAHex: string;
    tokenBHex: string;
    /** Swaps in the full `[head - logScanBlocks + 1, head]` window. */
    swapCount: number;
    swapCount24h: number;
    /** Alias for UIs that read `swaps24h`. */
    swaps24h: number;
    /** Sum of `amountIn` for swaps whose block time is within the last 24h (UTC wall vs `nowMs`). */
    volume24hApprox: string;
    /** Sum of `amountIn` for all swaps in the scan window. */
    volumeScanWindowApprox: string;
    tvlApprox: string;
    /** Present when `tokenUsdJson` maps prices for at least one leg. */
    tvlUsdApprox?: string;
    note: string;
};
export type NativeDexIndexerStatsPayload = {
    updatedAt: string;
    note: string;
    headHeight: number | null;
    pools: NativeDexIndexerPoolRow[];
    history: Record<string, NativeDexIndexerHistoryPoint[]>;
    tokenDirectory: NativeDexIndexerTokenMeta[];
};
export declare function parseNativeDexIndexerPersistedDoc(raw: string | null | undefined): NativeDexIndexerPersistedDoc;
export declare function appendVenuesToHistoryDoc(doc: NativeDexIndexerPersistedDoc, venues: readonly CpPoolVenue[], headHeight: number, nowMs: number, maxPerPool?: number): NativeDexIndexerPersistedDoc;
/**
 * Build DEX override map from a plain env object (Cloudflare `env`, etc.).
 */
export declare function buildDexOverridesFromPlainEnv(env: Record<string, string | undefined> | null | undefined): NativeDexIntegrationOverrides;
/**
 * Core indexer run (RPC via `client`). Does not create the client.
 */
export declare function buildNativeDexIndexerStatsForClient(client: BoingClient, opts?: NativeDexIndexerStatsOptions): Promise<NativeDexIndexerStatsPayload>;
//# sourceMappingURL=nativeDexIndexerStats.d.ts.map