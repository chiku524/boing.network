/**
 * Boing SDK — TypeScript/JavaScript client for Boing Network.
 *
 * Provides a typed RPC client for all node methods (chain height, balance, account,
 * blocks, proofs, simulation, submit, QA check, faucet, etc.) and hex utilities.
 *
 * For submitting transactions, the node expects hex-encoded bincode-serialized
 * SignedTransaction (from the Rust CLI or a future signing library). Use
 * `client.submitTransaction(hexSignedTx)` with a hex string produced by the CLI
 * or another signer.
 */

export const SDK_VERSION = '0.1.0';

import { BoingClient } from './client.js';
export { BoingClient } from './client.js';
export type { BoingClientConfig } from './client.js';
export { BoingRpcError } from './errors.js';
export {
  ensureHex,
  bytesToHex,
  hexToBytes,
  accountIdToHex,
  hexToAccountId,
  validateHex32,
} from './hex.js';
export type {
  AccountBalance,
  AccountState,
  Block,
  BlockHeader,
  AccountProof,
  VerifyProofResult,
  SimulateResult,
  SubmitTransactionResult,
  RegisterDappResult,
  SubmitIntentResult,
  QaCheckResult,
  QaCheckResponse,
  QaPoolConfigResult,
  QaPoolItemSummary,
  QaPoolListResult,
  QaPoolVoteResult,
  OperatorApplyQaPolicyResult,
  QaRegistryResult,
  FaucetResult,
  JsonRpcResponse,
} from './types.js';

/**
 * Create a Boing RPC client.
 * @param config - Node URL string (e.g. "http://localhost:8545") or config object (baseUrl, fetch?, timeoutMs?).
 */
export function createClient(config: string | import('./client.js').BoingClientConfig): BoingClient {
  return new BoingClient(config);
}
