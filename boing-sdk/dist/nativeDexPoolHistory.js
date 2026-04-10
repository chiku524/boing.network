/**
 * Collect native AMM **`Log2`** events for pools over a block range (materialized snapshot input).
 * Used by the **`native-dex-indexer`** Worker D1 table **`directory_pool_events`** — **not** reorg-safe;
 * see [PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md](../docs/PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md) §3.
 */
import { validateHex32 } from './hex.js';
import { getLogsChunked } from './indexerBatch.js';
import { filterMapNativeAmmRpcLogs, } from './nativeAmmLogs.js';
function payloadFromParsed(ev) {
    switch (ev.kind) {
        case 'swap':
            return {
                direction: ev.direction.toString(),
                amountIn: ev.amountIn.toString(),
                amountOutAfterFee: ev.amountOutAfterFee.toString(),
            };
        case 'addLiquidity':
            return {
                amountA: ev.amountA.toString(),
                amountB: ev.amountB.toString(),
                lpMinted: ev.lpMinted.toString(),
            };
        case 'removeLiquidity':
            return {
                liquidityBurned: ev.liquidityBurned.toString(),
                amountAOut: ev.amountAOut.toString(),
                amountBOut: ev.amountBOut.toString(),
            };
        default:
            return {};
    }
}
export function materializeNativeAmmPoolEvent(ev, poolHexLower) {
    return {
        kind: ev.kind,
        poolHex: poolHexLower,
        blockHeight: ev.block_height,
        txId: ev.tx_id,
        logIndex: ev.log_index,
        callerHex: ev.callerHex,
        payload: payloadFromParsed(ev),
    };
}
/**
 * For each pool, **`boing_getLogs`** over **`[fromBlock, toBlock]`** and return parsed native AMM **`Log2`** rows.
 */
export async function collectNativeDexPoolEventsForPools(client, poolHexes, opts) {
    const fromB = Math.max(0, Math.floor(opts.fromBlock));
    const toB = Math.max(fromB, Math.floor(opts.toBlock));
    const out = [];
    const maxConcurrent = opts.maxConcurrent ?? 1;
    for (const raw of poolHexes) {
        let pool;
        try {
            pool = validateHex32(String(raw).trim()).toLowerCase();
        }
        catch {
            continue;
        }
        try {
            const logs = await getLogsChunked(client, { fromBlock: fromB, toBlock: toB, address: pool }, { maxConcurrent });
            const parsed = filterMapNativeAmmRpcLogs(logs);
            for (const ev of parsed) {
                if (ev.address && ev.address.toLowerCase() !== pool)
                    continue;
                out.push(materializeNativeAmmPoolEvent(ev, pool));
            }
        }
        catch {
            /* skip pool on RPC errors */
        }
    }
    out.sort((a, b) => {
        if (a.blockHeight !== b.blockHeight)
            return a.blockHeight - b.blockHeight;
        const c = a.txId.localeCompare(b.txId);
        if (c !== 0)
            return c;
        return a.logIndex - b.logIndex;
    });
    return out;
}
