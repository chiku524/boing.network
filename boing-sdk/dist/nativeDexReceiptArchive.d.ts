/**
 * Bounded **execution log** rows from **`boing_getBlockByHeight(..., true)`** (receipts included).
 * For optional **`directory_receipt_log`** in the native-dex-indexer Worker — not full-chain history.
 */
import type { BoingClient } from './client.js';
export type NativeDexArchivedReceiptLogRow = {
    blockHeight: number;
    blockHash: string | null;
    txId: string;
    /** Index within **`receipt.logs`** for this transaction. */
    logIndex: number;
    topic0Hex: string | null;
    topicsJson: string;
    dataHex: string;
};
export type CollectArchivedReceiptLogRowsOptions = {
    maxConcurrent?: number;
    /** Safety cap per sync (default **3000**). */
    maxRows?: number;
};
/**
 * Walk **`[fromHeight, toHeight]`** inclusive; missing blocks are **omitted** (`onMissingBlock: 'omit'`).
 */
export declare function collectArchivedReceiptLogRows(client: BoingClient, fromHeight: number, toHeight: number, options?: CollectArchivedReceiptLogRowsOptions): Promise<NativeDexArchivedReceiptLogRow[]>;
//# sourceMappingURL=nativeDexReceiptArchive.d.ts.map