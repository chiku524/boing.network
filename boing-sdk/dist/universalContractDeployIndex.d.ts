/**
 * Extract **predicted contract deployment addresses** from **`boing_getBlockByHeight`** JSON
 * (matches `boing-node` / `boing_primitives` deploy address rules: nonce-derived and CREATE2, including
 * init-code CREATE2 double prediction).
 *
 * Use this in indexers that need a **chain-wide contract deploy feed** (not DEX-scoped discovery).
 */
import { type TransactionInput } from './bincode.js';
/** Leading deploy init-code marker — matches `CONTRACT_DEPLOY_INIT_CODE_MARKER` in `boing_primitives`. */
export declare const CONTRACT_DEPLOY_INIT_CODE_MARKER = 253;
export type UniversalContractDeployPayloadKind = 'ContractDeploy' | 'ContractDeployWithPurpose' | 'ContractDeployWithPurposeAndMetadata';
/** One predicted contract account created by a deploy transaction in a block. */
export type UniversalContractDeploymentRow = {
    contractHex: `0x${string}`;
    blockHeight: number;
    txIndex: number;
    /** BLAKE3(bincode(`Transaction`)) hex — matches `Transaction::id()` / receipt **`tx_id`**. */
    txIdHex: `0x${string}`;
    senderHex: `0x${string}`;
    payloadKind: UniversalContractDeployPayloadKind;
    purposeCategory?: string;
    assetName?: string;
    assetSymbol?: string;
};
/**
 * Map a **`Transaction`** object from **`boing_getBlockByHeight`** JSON into {@link TransactionInput}
 * for **`encodeTransaction`** / tx id hashing.
 */
export declare function rpcTransactionJsonToTransactionInput(txJson: unknown): TransactionInput;
/** `BLAKE3(bincode(Transaction))` hex — matches Rust `Transaction::id()`. */
export declare function transactionIdFromUnsignedRpcTransaction(txJson: unknown): `0x${string}`;
/** Extract deploys from a full **`Block`**-shaped JSON object (`header.height`, `transactions`). */
export declare function extractUniversalContractDeploymentsFromBlock(block: unknown): UniversalContractDeploymentRow[];
export declare function extractUniversalContractDeploymentsFromBlockJson(blockHeight: number, transactions: unknown[]): UniversalContractDeploymentRow[];
//# sourceMappingURL=universalContractDeployIndex.d.ts.map