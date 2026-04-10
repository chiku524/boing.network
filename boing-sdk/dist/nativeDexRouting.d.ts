/**
 * Constant-product **routing** and **quote aggregation** over Boing native pools (pure math + optional RPC hydrate).
 * No external chains. Execution still uses **`contract_call`** / multihop router encoders elsewhere in the SDK.
 */
import type { BoingClient } from './client.js';
import type { NativeDexIntegrationOverrides } from './dexIntegration.js';
import { type NativeDexDirectorySnapshot } from './nativeDexDirectory.js';
/** One tradeable CP pool with oriented reserves (A/B match on-chain slot semantics). */
export type CpPoolVenue = {
    poolHex: `0x${string}`;
    tokenAHex: `0x${string}`;
    tokenBHex: `0x${string}`;
    reserveA: bigint;
    reserveB: bigint;
    /** Output-side fee bps; use **`NATIVE_CP_SWAP_FEE_BPS`** when on-chain reads **`0`**. */
    feeBps: bigint;
};
export type CpQuoteResult = {
    amountOut: bigint;
    tokenOutHex: string;
    /** Native AMM **`swap`** direction: **`0`** = A→B, **`1`** = B→A. */
    directionForSwapCalldata: bigint;
};
/**
 * Exact output quote for **`tokenIn` → opposite side** on one venue (fails if **`tokenIn`** is not **`tokenA`** or **`tokenB`**).
 */
export declare function quoteCpPoolSwap(venue: CpPoolVenue, tokenInHex: string, amountIn: bigint): CpQuoteResult;
/** Rank venues that list **`(tokenIn, tokenOut)`** by **`amountOut`** for a given **`amountIn`** (best first). */
export declare function rankDirectCpPools(venues: readonly CpPoolVenue[], tokenInHex: string, tokenOutHex: string, amountIn: bigint): Array<{
    venue: CpPoolVenue;
    amountOut: bigint;
    directionForSwapCalldata: bigint;
}>;
export type RouteHop = {
    venue: CpPoolVenue;
    tokenInHex: string;
    tokenOutHex: string;
    amountIn: bigint;
    amountOut: bigint;
    directionForSwapCalldata: bigint;
};
export type CpSwapRoute = {
    hops: RouteHop[];
    tokenInHex: string;
    tokenOutHex: string;
    amountIn: bigint;
    amountOut: bigint;
};
/** First route with **≥ 2** hops, or **`undefined`** (skips direct single-pool rows). */
export declare function pickFirstMultihopCpRoute(routes: readonly CpSwapRoute[]): CpSwapRoute | undefined;
/**
 * Unique **`tokenA`** / **`tokenB`** ids across **`route.hops`** (**sorted** hex). Pass as **`additionalAccountsHex32`** when pools **`CALL`** reference-token contracts (v2+).
 */
export declare function uniqueSortedTokenHex32FromCpRoute(route: CpSwapRoute): string[];
/** Maximum sequential pool **`Call`s** supported by canonical multihop router bytecode (selectors **`0xE5`–`0xEE`**). */
export declare const NATIVE_DEX_MULTIHOP_ROUTER_MAX_POOLS = 6;
/**
 * Basis points denominator for {@link minOutFloorAfterSlippageBps} (**10000** = 100%).
 * Example: **`50`** bps ⇒ allow **0.5%** worse execution vs the quoted amount.
 */
export declare const NATIVE_DEX_SLIPPAGE_BPS_SCALE = 10000n;
/**
 * Floor of **`amountOut * (SCALE - slippageBps) / SCALE`** — conservative per-hop **`minOut`** for multihop **`swap`** / **`swap_to`** inners.
 */
export declare function minOutFloorAfterSlippageBps(amountOut: bigint, slippageBps: bigint): bigint;
/** One slippage floor per {@link CpSwapRoute} hop, aligned with {@link RouteHop.amountOut} order. */
export declare function minOutPerHopFromQuotedRouteSlippageBps(route: CpSwapRoute, slippageBps: bigint): bigint[];
/**
 * Enumerate simple CP paths (**no** same-pool reuse) up to **`maxHops`** pools; returns routes sorted by **`amountOut`** (best first).
 * Default **`maxHops`** matches on-chain multihop router capacity ({@link NATIVE_DEX_MULTIHOP_ROUTER_MAX_POOLS}); pass a lower value for large **`venues`** sets.
 */
export declare function findBestCpRoutes(venues: readonly CpPoolVenue[], tokenInHex: string, tokenOutHex: string, amountIn: bigint, options?: {
    maxHops?: number;
    maxRoutes?: number;
}): CpSwapRoute[];
/** Best route or **`undefined`** when none. */
export declare function findBestCpRoute(venues: readonly CpPoolVenue[], tokenInHex: string, tokenOutHex: string, amountIn: bigint, options?: {
    maxHops?: number;
    maxRoutes?: number;
}): CpSwapRoute | undefined;
export type EncodeNativeDexMultihopFromRouteOptions128 = {
    /** One minimum output per hop; length must equal **`route.hops.length`**. */
    minOutPerHop: readonly bigint[];
};
export type EncodeNativeDexMultihopFromRouteOptions160 = {
    minOutPerHop: readonly bigint[];
    /** Multihop router **`AccountId`**; intermediate **`swap_to`** deliveries use this address. */
    routerAccountHex32: string;
    /** Final hop **`swap_to`** recipient (typically the trader). */
    finalRecipientHex32: string;
};
/**
 * Build **128-byte** inner **`swap`** calldata for a quoted {@link CpSwapRoute} (**2–6** hops).
 * Pair with **`contract_call`** targeting the multihop router account.
 */
export declare function encodeNativeDexMultihopRouterCalldata128FromRoute(route: CpSwapRoute, options: EncodeNativeDexMultihopFromRouteOptions128): Uint8Array;
/**
 * Build **160-byte** inner **`swap_to`** (v5 pool) calldata for a quoted {@link CpSwapRoute}.
 * Intermediate hops send output to **`routerAccountHex32`**; the last hop sends to **`finalRecipientHex32`**.
 */
export declare function encodeNativeDexMultihopRouterCalldata160FromRoute(route: CpSwapRoute, options: EncodeNativeDexMultihopFromRouteOptions160): Uint8Array;
/**
 * Same as {@link encodeNativeDexMultihopRouterCalldata128FromRoute} with **`minOutPerHop`** from
 * {@link minOutPerHopFromQuotedRouteSlippageBps}.
 */
export declare function encodeNativeDexMultihopRouterCalldata128FromRouteWithSlippage(route: CpSwapRoute, slippageBps: bigint): Uint8Array;
/**
 * Same as {@link encodeNativeDexMultihopRouterCalldata160FromRoute} with **`minOutPerHop`** from
 * {@link minOutPerHopFromQuotedRouteSlippageBps}.
 */
export declare function encodeNativeDexMultihopRouterCalldata160FromRouteWithSlippage(route: CpSwapRoute, routerAccountHex32: string, finalRecipientHex32: string, slippageBps: bigint): Uint8Array;
/**
 * Even-split **aggregation heuristic**: divide **`totalAmountIn`** across the top **`poolCount`** direct pools (by full-size quote rank), sum outputs.
 * Not an optimal CEX splitter; useful for UI estimates and incremental liquidity use.
 */
export declare function quoteCpEvenSplitAcrossDirectPools(venues: readonly CpPoolVenue[], tokenInHex: string, tokenOutHex: string, totalAmountIn: bigint, poolCount: number): {
    rankedPools: Array<{
        venue: CpPoolVenue;
        amountOut: bigint;
        directionForSwapCalldata: bigint;
    }>;
    allocations: Array<{
        venue: CpPoolVenue;
        amountIn: bigint;
        amountOut: bigint;
        directionForSwapCalldata: bigint;
    }>;
    totalOut: bigint;
};
export type PoolTokenRow = {
    poolHex: string;
    tokenAHex: string;
    tokenBHex: string;
};
/**
 * Hydrate **`CpPoolVenue`** rows from Boing RPC (reserves + fee bps per pool). **Boing-only.**
 */
export declare function hydrateCpPoolVenuesFromRpc(client: BoingClient, rows: readonly PoolTokenRow[], options?: {
    concurrency?: number;
}): Promise<CpPoolVenue[]>;
export type FetchCpRoutingFromDirectoryLogsOptions = {
    overrides?: NativeDexIntegrationOverrides;
    registerLogs: {
        fromBlock: number;
        toBlock?: number;
    };
    maxHops?: number;
    maxRoutes?: number;
    hydrateConcurrency?: number;
};
/**
 * **Boing-only** pipeline: directory **`register_pair`** log range → hydrate venues → best CP route(s).
 * Pair with **`encodeNativeDexMultihopRouterCalldata128FromRoute`** / **`encodeNativeDexMultihopRouterCalldata160FromRoute`** or **`pickFirstMultihopCpRoute`** + **`buildNativeDexMultihopSwapExpressTxFromRoute128`** when executing multihop on-chain.
 */
export declare function fetchCpRoutingFromDirectoryLogs(client: BoingClient, tokenInHex: string, tokenOutHex: string, amountIn: bigint, options: FetchCpRoutingFromDirectoryLogsOptions): Promise<{
    snapshot: NativeDexDirectorySnapshot;
    venues: CpPoolVenue[];
    routes: CpSwapRoute[];
}>;
//# sourceMappingURL=nativeDexRouting.d.ts.map