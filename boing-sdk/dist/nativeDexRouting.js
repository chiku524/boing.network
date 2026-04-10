/**
 * Constant-product **routing** and **quote aggregation** over Boing native pools (pure math + optional RPC hydrate).
 * No external chains. Execution still uses **`contract_call`** / multihop router encoders elsewhere in the SDK.
 */
import { fetchNativeDexDirectorySnapshot } from './nativeDexDirectory.js';
import { validateHex32 } from './hex.js';
import { mapWithConcurrencyLimit } from './indexerBatch.js';
import { NATIVE_CP_SWAP_FEE_BPS, constantProductAmountOutWithFeeBps, encodeNativeAmmSwapCalldata, encodeNativeAmmSwapToCalldata, } from './nativeAmm.js';
import { encodeNativeDexSwap2RouterCalldata128, encodeNativeDexSwap2RouterCalldata160, encodeNativeDexSwap3RouterCalldata128, encodeNativeDexSwap3RouterCalldata160, encodeNativeDexSwap4RouterCalldata128, encodeNativeDexSwap4RouterCalldata160, encodeNativeDexSwap5RouterCalldata128, encodeNativeDexSwap5RouterCalldata160, encodeNativeDexSwap6RouterCalldata128, encodeNativeDexSwap6RouterCalldata160, } from './nativeDexSwap2Router.js';
import { fetchNativeConstantProductPoolSnapshot, fetchNativeConstantProductSwapFeeBps, } from './nativeAmmPool.js';
function normHex32(h) {
    return validateHex32(h).toLowerCase();
}
function effectiveFeeBps(raw) {
    return raw === 0n ? BigInt(NATIVE_CP_SWAP_FEE_BPS) : raw;
}
/**
 * Exact output quote for **`tokenIn` → opposite side** on one venue (fails if **`tokenIn`** is not **`tokenA`** or **`tokenB`**).
 */
export function quoteCpPoolSwap(venue, tokenInHex, amountIn) {
    if (amountIn < 0n)
        throw new RangeError('amountIn must be non-negative');
    const a = normHex32(venue.tokenAHex);
    const b = normHex32(venue.tokenBHex);
    const tin = normHex32(tokenInHex);
    if (tin === a) {
        const amountOut = constantProductAmountOutWithFeeBps(venue.reserveA, venue.reserveB, amountIn, venue.feeBps);
        return { amountOut, tokenOutHex: b, directionForSwapCalldata: 0n };
    }
    if (tin === b) {
        const amountOut = constantProductAmountOutWithFeeBps(venue.reserveB, venue.reserveA, amountIn, venue.feeBps);
        return { amountOut, tokenOutHex: a, directionForSwapCalldata: 1n };
    }
    throw new Error('quoteCpPoolSwap: tokenIn is not a pool token');
}
/** Rank venues that list **`(tokenIn, tokenOut)`** by **`amountOut`** for a given **`amountIn`** (best first). */
export function rankDirectCpPools(venues, tokenInHex, tokenOutHex, amountIn) {
    const tout = normHex32(tokenOutHex);
    const out = [];
    for (const v of venues) {
        let q;
        try {
            q = quoteCpPoolSwap(v, tokenInHex, amountIn);
        }
        catch {
            continue;
        }
        if (q.tokenOutHex === tout && q.amountOut > 0n) {
            out.push({ venue: v, amountOut: q.amountOut, directionForSwapCalldata: q.directionForSwapCalldata });
        }
    }
    out.sort((x, y) => (x.amountOut > y.amountOut ? -1 : x.amountOut < y.amountOut ? 1 : 0));
    return out;
}
/** First route with **≥ 2** hops, or **`undefined`** (skips direct single-pool rows). */
export function pickFirstMultihopCpRoute(routes) {
    return routes.find((r) => r.hops.length >= 2);
}
/**
 * Unique **`tokenA`** / **`tokenB`** ids across **`route.hops`** (**sorted** hex). Pass as **`additionalAccountsHex32`** when pools **`CALL`** reference-token contracts (v2+).
 */
export function uniqueSortedTokenHex32FromCpRoute(route) {
    const seen = new Set();
    for (const h of route.hops) {
        seen.add(normHex32(h.venue.tokenAHex));
        seen.add(normHex32(h.venue.tokenBHex));
    }
    return [...seen].sort();
}
/** Maximum sequential pool **`Call`s** supported by canonical multihop router bytecode (selectors **`0xE5`–`0xEE`**). */
export const NATIVE_DEX_MULTIHOP_ROUTER_MAX_POOLS = 6;
/**
 * Basis points denominator for {@link minOutFloorAfterSlippageBps} (**10000** = 100%).
 * Example: **`50`** bps ⇒ allow **0.5%** worse execution vs the quoted amount.
 */
export const NATIVE_DEX_SLIPPAGE_BPS_SCALE = 10000n;
/**
 * Floor of **`amountOut * (SCALE - slippageBps) / SCALE`** — conservative per-hop **`minOut`** for multihop **`swap`** / **`swap_to`** inners.
 */
export function minOutFloorAfterSlippageBps(amountOut, slippageBps) {
    if (amountOut < 0n)
        throw new RangeError('amountOut must be non-negative');
    if (slippageBps < 0n || slippageBps > NATIVE_DEX_SLIPPAGE_BPS_SCALE) {
        throw new RangeError(`slippageBps must satisfy 0 <= slippageBps <= ${NATIVE_DEX_SLIPPAGE_BPS_SCALE.toString()}`);
    }
    return (amountOut * (NATIVE_DEX_SLIPPAGE_BPS_SCALE - slippageBps)) / NATIVE_DEX_SLIPPAGE_BPS_SCALE;
}
/** One slippage floor per {@link CpSwapRoute} hop, aligned with {@link RouteHop.amountOut} order. */
export function minOutPerHopFromQuotedRouteSlippageBps(route, slippageBps) {
    return route.hops.map((h) => minOutFloorAfterSlippageBps(h.amountOut, slippageBps));
}
function edgesFromToken(venues, currentToken) {
    const t = normHex32(currentToken);
    const hit = [];
    for (const v of venues) {
        const a = normHex32(v.tokenAHex);
        const b = normHex32(v.tokenBHex);
        if (a === t || b === t)
            hit.push(v);
    }
    return hit;
}
/**
 * Enumerate simple CP paths (**no** same-pool reuse) up to **`maxHops`** pools; returns routes sorted by **`amountOut`** (best first).
 * Default **`maxHops`** matches on-chain multihop router capacity ({@link NATIVE_DEX_MULTIHOP_ROUTER_MAX_POOLS}); pass a lower value for large **`venues`** sets.
 */
export function findBestCpRoutes(venues, tokenInHex, tokenOutHex, amountIn, options) {
    const maxHops = options?.maxHops ?? NATIVE_DEX_MULTIHOP_ROUTER_MAX_POOLS;
    const maxRoutes = options?.maxRoutes ?? 32;
    if (maxHops < 1)
        throw new RangeError('maxHops must be >= 1');
    if (maxHops > NATIVE_DEX_MULTIHOP_ROUTER_MAX_POOLS) {
        throw new RangeError(`maxHops cannot exceed ${NATIVE_DEX_MULTIHOP_ROUTER_MAX_POOLS} (multihop router cap)`);
    }
    const tin = normHex32(tokenInHex);
    const tout = normHex32(tokenOutHex);
    if (tin === tout) {
        return [{ hops: [], tokenInHex: tin, tokenOutHex: tout, amountIn, amountOut: amountIn }];
    }
    const routes = [];
    function dfs(currentToken, amount, path, visitedPools) {
        if (routes.length >= maxRoutes)
            return;
        for (const v of edgesFromToken(venues, currentToken)) {
            const ph = normHex32(v.poolHex);
            if (visitedPools.has(ph))
                continue;
            let q;
            try {
                q = quoteCpPoolSwap(v, currentToken, amount);
            }
            catch {
                continue;
            }
            if (q.amountOut === 0n)
                continue;
            const hop = {
                venue: v,
                tokenInHex: currentToken,
                tokenOutHex: q.tokenOutHex,
                amountIn: amount,
                amountOut: q.amountOut,
                directionForSwapCalldata: q.directionForSwapCalldata,
            };
            if (normHex32(q.tokenOutHex) === tout) {
                routes.push({
                    hops: [...path, hop],
                    tokenInHex: tin,
                    tokenOutHex: tout,
                    amountIn,
                    amountOut: q.amountOut,
                });
                continue;
            }
            if (path.length + 1 >= maxHops)
                continue;
            visitedPools.add(ph);
            dfs(q.tokenOutHex, q.amountOut, [...path, hop], visitedPools);
            visitedPools.delete(ph);
            if (routes.length >= maxRoutes)
                return;
        }
    }
    dfs(tin, amountIn, [], new Set());
    routes.sort((a, b) => (a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0));
    return routes.slice(0, maxRoutes);
}
/** Best route or **`undefined`** when none. */
export function findBestCpRoute(venues, tokenInHex, tokenOutHex, amountIn, options) {
    return findBestCpRoutes(venues, tokenInHex, tokenOutHex, amountIn, options)[0];
}
/**
 * Build **128-byte** inner **`swap`** calldata for a quoted {@link CpSwapRoute} (**2–6** hops).
 * Pair with **`contract_call`** targeting the multihop router account.
 */
export function encodeNativeDexMultihopRouterCalldata128FromRoute(route, options) {
    const n = route.hops.length;
    if (n < 2 || n > NATIVE_DEX_MULTIHOP_ROUTER_MAX_POOLS) {
        throw new RangeError(`multihop router expects 2..${NATIVE_DEX_MULTIHOP_ROUTER_MAX_POOLS} hops, got ${n}`);
    }
    if (options.minOutPerHop.length !== n) {
        throw new RangeError('minOutPerHop length must match route.hops.length');
    }
    const pools = route.hops.map((h) => validateHex32(h.venue.poolHex));
    const inners = route.hops.map((hop, i) => encodeNativeAmmSwapCalldata(hop.directionForSwapCalldata, hop.amountIn, options.minOutPerHop[i]));
    switch (n) {
        case 2:
            return encodeNativeDexSwap2RouterCalldata128(pools[0], inners[0], pools[1], inners[1]);
        case 3:
            return encodeNativeDexSwap3RouterCalldata128(pools[0], inners[0], pools[1], inners[1], pools[2], inners[2]);
        case 4:
            return encodeNativeDexSwap4RouterCalldata128(pools[0], inners[0], pools[1], inners[1], pools[2], inners[2], pools[3], inners[3]);
        case 5:
            return encodeNativeDexSwap5RouterCalldata128(pools[0], inners[0], pools[1], inners[1], pools[2], inners[2], pools[3], inners[3], pools[4], inners[4]);
        case 6:
            return encodeNativeDexSwap6RouterCalldata128(pools[0], inners[0], pools[1], inners[1], pools[2], inners[2], pools[3], inners[3], pools[4], inners[4], pools[5], inners[5]);
        default:
            throw new RangeError(`unsupported hop count ${n}`);
    }
}
/**
 * Build **160-byte** inner **`swap_to`** (v5 pool) calldata for a quoted {@link CpSwapRoute}.
 * Intermediate hops send output to **`routerAccountHex32`**; the last hop sends to **`finalRecipientHex32`**.
 */
export function encodeNativeDexMultihopRouterCalldata160FromRoute(route, options) {
    const n = route.hops.length;
    if (n < 2 || n > NATIVE_DEX_MULTIHOP_ROUTER_MAX_POOLS) {
        throw new RangeError(`multihop router expects 2..${NATIVE_DEX_MULTIHOP_ROUTER_MAX_POOLS} hops, got ${n}`);
    }
    if (options.minOutPerHop.length !== n) {
        throw new RangeError('minOutPerHop length must match route.hops.length');
    }
    const router = validateHex32(options.routerAccountHex32);
    const finalRecip = validateHex32(options.finalRecipientHex32);
    const pools = route.hops.map((h) => validateHex32(h.venue.poolHex));
    const inners = route.hops.map((hop, i) => {
        const recip = i === n - 1 ? finalRecip : router;
        return encodeNativeAmmSwapToCalldata(hop.directionForSwapCalldata, hop.amountIn, options.minOutPerHop[i], recip);
    });
    switch (n) {
        case 2:
            return encodeNativeDexSwap2RouterCalldata160(pools[0], inners[0], pools[1], inners[1]);
        case 3:
            return encodeNativeDexSwap3RouterCalldata160(pools[0], inners[0], pools[1], inners[1], pools[2], inners[2]);
        case 4:
            return encodeNativeDexSwap4RouterCalldata160(pools[0], inners[0], pools[1], inners[1], pools[2], inners[2], pools[3], inners[3]);
        case 5:
            return encodeNativeDexSwap5RouterCalldata160(pools[0], inners[0], pools[1], inners[1], pools[2], inners[2], pools[3], inners[3], pools[4], inners[4]);
        case 6:
            return encodeNativeDexSwap6RouterCalldata160(pools[0], inners[0], pools[1], inners[1], pools[2], inners[2], pools[3], inners[3], pools[4], inners[4], pools[5], inners[5]);
        default:
            throw new RangeError(`unsupported hop count ${n}`);
    }
}
/**
 * Same as {@link encodeNativeDexMultihopRouterCalldata128FromRoute} with **`minOutPerHop`** from
 * {@link minOutPerHopFromQuotedRouteSlippageBps}.
 */
export function encodeNativeDexMultihopRouterCalldata128FromRouteWithSlippage(route, slippageBps) {
    return encodeNativeDexMultihopRouterCalldata128FromRoute(route, {
        minOutPerHop: minOutPerHopFromQuotedRouteSlippageBps(route, slippageBps),
    });
}
/**
 * Same as {@link encodeNativeDexMultihopRouterCalldata160FromRoute} with **`minOutPerHop`** from
 * {@link minOutPerHopFromQuotedRouteSlippageBps}.
 */
export function encodeNativeDexMultihopRouterCalldata160FromRouteWithSlippage(route, routerAccountHex32, finalRecipientHex32, slippageBps) {
    return encodeNativeDexMultihopRouterCalldata160FromRoute(route, {
        minOutPerHop: minOutPerHopFromQuotedRouteSlippageBps(route, slippageBps),
        routerAccountHex32,
        finalRecipientHex32,
    });
}
/**
 * Even-split **aggregation heuristic**: divide **`totalAmountIn`** across the top **`poolCount`** direct pools (by full-size quote rank), sum outputs.
 * Not an optimal CEX splitter; useful for UI estimates and incremental liquidity use.
 */
export function quoteCpEvenSplitAcrossDirectPools(venues, tokenInHex, tokenOutHex, totalAmountIn, poolCount) {
    if (poolCount < 1)
        throw new RangeError('poolCount must be >= 1');
    if (totalAmountIn < 0n)
        throw new RangeError('totalAmountIn must be non-negative');
    const ranked = rankDirectCpPools(venues, tokenInHex, tokenOutHex, totalAmountIn);
    const n = Math.min(poolCount, ranked.length);
    if (n === 0 || totalAmountIn === 0n) {
        return { rankedPools: ranked, allocations: [], totalOut: 0n };
    }
    const base = totalAmountIn / BigInt(n);
    const rem = Number(totalAmountIn % BigInt(n));
    const allocations = [];
    let totalOut = 0n;
    for (let i = 0; i < n; i++) {
        const row = ranked[i];
        const ai = base + (i < rem ? 1n : 0n);
        if (ai === 0n)
            continue;
        const q = quoteCpPoolSwap(row.venue, tokenInHex, ai);
        allocations.push({
            venue: row.venue,
            amountIn: ai,
            amountOut: q.amountOut,
            directionForSwapCalldata: q.directionForSwapCalldata,
        });
        totalOut += q.amountOut;
    }
    return { rankedPools: ranked, allocations, totalOut };
}
function dedupePoolRows(rows) {
    const m = new Map();
    for (const r of rows) {
        const k = normHex32(r.poolHex);
        if (!m.has(k))
            m.set(k, r);
    }
    return [...m.values()];
}
/**
 * Hydrate **`CpPoolVenue`** rows from Boing RPC (reserves + fee bps per pool). **Boing-only.**
 */
export async function hydrateCpPoolVenuesFromRpc(client, rows, options) {
    const uniq = dedupePoolRows(rows);
    const concurrency = options?.concurrency ?? 8;
    return mapWithConcurrencyLimit(uniq, concurrency, async (r) => {
        const poolHex = validateHex32(r.poolHex);
        const tokenAHex = validateHex32(r.tokenAHex);
        const tokenBHex = validateHex32(r.tokenBHex);
        const [snap, feeRaw] = await Promise.all([
            fetchNativeConstantProductPoolSnapshot(client, poolHex),
            fetchNativeConstantProductSwapFeeBps(client, poolHex),
        ]);
        return {
            poolHex,
            tokenAHex,
            tokenBHex,
            reserveA: snap.reserveA,
            reserveB: snap.reserveB,
            feeBps: effectiveFeeBps(feeRaw),
        };
    });
}
/**
 * **Boing-only** pipeline: directory **`register_pair`** log range → hydrate venues → best CP route(s).
 * Pair with **`encodeNativeDexMultihopRouterCalldata128FromRoute`** / **`encodeNativeDexMultihopRouterCalldata160FromRoute`** or **`pickFirstMultihopCpRoute`** + **`buildNativeDexMultihopSwapExpressTxFromRoute128`** when executing multihop on-chain.
 */
export async function fetchCpRoutingFromDirectoryLogs(client, tokenInHex, tokenOutHex, amountIn, options) {
    const snapshot = await fetchNativeDexDirectorySnapshot(client, {
        overrides: options.overrides,
        registerLogs: options.registerLogs,
    });
    const logs = snapshot.registerLogs ?? [];
    const rows = logs.map((l) => ({
        poolHex: l.poolHex,
        tokenAHex: l.tokenAHex,
        tokenBHex: l.tokenBHex,
    }));
    const venues = await hydrateCpPoolVenuesFromRpc(client, rows, {
        concurrency: options.hydrateConcurrency,
    });
    const routes = findBestCpRoutes(venues, tokenInHex, tokenOutHex, amountIn, {
        maxHops: options.maxHops,
        maxRoutes: options.maxRoutes,
    });
    return { snapshot, venues, routes };
}
