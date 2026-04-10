/**
 * Collect latest **ERC-721 `Transfer`** ownership rows for one contract over a block range.
 * Used by **`native-dex-indexer`** D1 table **`directory_nft_owner`** (snapshot per sync).
 */
import { ERC721_TRANSFER_TOPIC0_HEX, filterMapErc721TransferRpcLogs } from './erc721Logs.js';
import { validateHex32 } from './hex.js';
import { getLogsChunked } from './indexerBatch.js';
/**
 * **`boing_getLogs`** on **`contractHex`** for **`Transfer`**, then fold to **last** owner per **`tokenId`**
 * within the merged log order `(block_height, tx_index, log_index)`.
 */
export async function collectNftOwnersFromErc721Transfers(client, contractHex32, opts) {
    const contract = validateHex32(String(contractHex32).trim()).toLowerCase();
    const fromB = Math.max(0, Math.floor(opts.fromBlock));
    const toB = Math.max(fromB, Math.floor(opts.toBlock));
    const logs = await getLogsChunked(client, {
        fromBlock: fromB,
        toBlock: toB,
        address: contract,
        topics: [ERC721_TRANSFER_TOPIC0_HEX],
    }, { maxConcurrent: opts.maxConcurrent ?? 1 });
    const parsed = filterMapErc721TransferRpcLogs(logs);
    const latest = new Map();
    for (const t of parsed) {
        const tokenIdDec = t.tokenId.toString(10);
        const prev = latest.get(tokenIdDec);
        if (prev == null ||
            t.blockHeight > prev.lastBlockHeight ||
            (t.blockHeight === prev.lastBlockHeight && t.txId.localeCompare(prev.txId) > 0) ||
            (t.blockHeight === prev.lastBlockHeight && t.txId === prev.txId && t.logIndex > prev.logIndex)) {
            latest.set(tokenIdDec, {
                contractHex: contract,
                tokenIdDec,
                ownerHex: t.toHex,
                lastBlockHeight: t.blockHeight,
                txId: t.txId,
                logIndex: t.logIndex,
            });
        }
    }
    return [...latest.values()].sort((a, b) => {
        if (a.lastBlockHeight !== b.lastBlockHeight)
            return a.lastBlockHeight - b.lastBlockHeight;
        const c = a.txId.localeCompare(b.txId);
        if (c !== 0)
            return c;
        return a.logIndex - b.logIndex;
    });
}
export { ERC721_TRANSFER_TOPIC0_HEX } from './erc721Logs.js';
