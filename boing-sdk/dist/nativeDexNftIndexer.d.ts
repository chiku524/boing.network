/**
 * Collect latest **ERC-721 `Transfer`** ownership rows for one contract over a block range.
 * Used by **`native-dex-indexer`** D1 table **`directory_nft_owner`** (snapshot per sync).
 */
import type { BoingClient } from './client.js';
export type NativeDexIndexedNftOwnerRow = {
    contractHex: string;
    /** Decimal string (arbitrary size uint256). */
    tokenIdDec: string;
    ownerHex: string;
    lastBlockHeight: number;
    txId: string;
    logIndex: number;
};
export type CollectNftOwnersFromErc721TransfersOptions = {
    fromBlock: number;
    toBlock: number;
    maxConcurrent?: number;
};
/**
 * **`boing_getLogs`** on **`contractHex`** for **`Transfer`**, then fold to **last** owner per **`tokenId`**
 * within the merged log order `(block_height, tx_index, log_index)`.
 */
export declare function collectNftOwnersFromErc721Transfers(client: BoingClient, contractHex32: string, opts: CollectNftOwnersFromErc721TransfersOptions): Promise<NativeDexIndexedNftOwnerRow[]>;
export { ERC721_TRANSFER_TOPIC0_HEX } from './erc721Logs.js';
//# sourceMappingURL=nativeDexNftIndexer.d.ts.map