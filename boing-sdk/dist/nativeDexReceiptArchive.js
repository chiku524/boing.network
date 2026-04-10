/**
 * Bounded **execution log** rows from **`boing_getBlockByHeight(..., true)`** (receipts included).
 * For optional **`directory_receipt_log`** in the native-dex-indexer Worker — not full-chain history.
 */
import { fetchBlocksWithReceiptsForHeightRange } from './indexerBatch.js';
import { iterBlockReceiptLogs, logTopic0 } from './receiptLogs.js';
/**
 * Walk **`[fromHeight, toHeight]`** inclusive; missing blocks are **omitted** (`onMissingBlock: 'omit'`).
 */
export async function collectArchivedReceiptLogRows(client, fromHeight, toHeight, options) {
    const fromB = Math.max(0, Math.floor(fromHeight));
    const toB = Math.max(fromB, Math.floor(toHeight));
    const maxRows = options?.maxRows ?? 3000;
    const bundles = await fetchBlocksWithReceiptsForHeightRange(client, fromB, toB, {
        onMissingBlock: 'omit',
        maxConcurrent: options?.maxConcurrent ?? 1,
    });
    const out = [];
    for (const { height, block } of bundles) {
        const bh = block.hash;
        const blockHash = typeof bh === 'string' && /^0x[0-9a-f]{64}$/i.test(bh) ? bh.toLowerCase() : null;
        for (const { receipt, log, logIndex } of iterBlockReceiptLogs(block)) {
            if (out.length >= maxRows)
                return out;
            let topic0Hex = null;
            try {
                topic0Hex = logTopic0(log) ?? null;
            }
            catch {
                topic0Hex = null;
            }
            const topics = log.topics ?? [];
            const topicsJson = JSON.stringify(topics.map((t) => String(t).toLowerCase()));
            const dataHex = String(log.data || '0x').toLowerCase();
            out.push({
                blockHeight: height,
                blockHash,
                txId: receipt.tx_id,
                logIndex,
                topic0Hex,
                topicsJson,
                dataHex,
            });
        }
    }
    return out;
}
