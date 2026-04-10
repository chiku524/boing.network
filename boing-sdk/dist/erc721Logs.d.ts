/**
 * ERC-721 **`Transfer(address,address,uint256)`** log parsing for indexer-style **`boing_getLogs`** rows.
 * Topic0 matches Ethereum’s canonical event signature (same as widely used EVM tooling).
 */
import type { RpcLogEntry } from './types.js';
/** `keccak256("Transfer(address,address,uint256)")` topic0 (lowercase `0x` + 64 hex). */
export declare const ERC721_TRANSFER_TOPIC0_HEX: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
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
export declare function tryParseErc721TransferRpcLog(entry: RpcLogEntry): Erc721TransferParsed | null;
export declare function filterMapErc721TransferRpcLogs(entries: readonly RpcLogEntry[]): Erc721TransferParsed[];
//# sourceMappingURL=erc721Logs.d.ts.map