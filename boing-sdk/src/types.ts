/**
 * Types for Boing RPC results and params.
 */

/** Chain height (block number). */
export type ChainHeight = number;

/** Balance and stake are u128 as decimal strings. */
export interface AccountBalance {
  balance: string;
}

export interface AccountState {
  balance: string;
  nonce: number;
  stake: string;
}

export interface BlockHeader {
  parent_hash: string;
  height: number;
  timestamp: number;
  proposer: string;
  tx_root: string;
  state_root: string;
}

export interface Block {
  header: BlockHeader;
  transactions: unknown[];
}

export interface AccountProof {
  proof: string;
  root: string;
  value_hash: string;
}

export interface VerifyProofResult {
  valid: boolean;
}

export interface SimulateResult {
  gas_used: number;
  success: boolean;
  error?: string;
}

export interface SubmitTransactionResult {
  tx_hash: string;
}

export interface RegisterDappResult {
  registered: true;
  contract: string;
  owner: string;
}

export interface SubmitIntentResult {
  intent_id: string;
}

/** QA pre-flight result. */
export type QaCheckResult = 'allow' | 'reject' | 'unsure';

export interface QaCheckResponse {
  result: QaCheckResult;
  rule_id?: string;
  message?: string;
}

export interface FaucetResult {
  ok: true;
  amount: number;
  to: string;
  message: string;
}

/** Row from `boing_qaPoolList`. */
export interface QaPoolItemSummary {
  tx_hash: string;
  bytecode_hash: string;
  deployer: string;
  allow_votes: number;
  reject_votes: number;
  age_secs: number;
}

export interface QaPoolListResult {
  items: QaPoolItemSummary[];
}

/** Result of `boing_qaPoolConfig`. */
export interface QaPoolConfigResult {
  max_pending_items: number;
  max_pending_per_deployer: number;
  review_window_secs: number;
  quorum_fraction: number;
  allow_threshold_fraction: number;
  reject_threshold_fraction: number;
  default_on_expiry: 'reject' | 'allow';
  dev_open_voting: boolean;
  administrator_count: number;
  accepts_new_pending: boolean;
  pending_count: number;
}

/** Result of `boing_qaPoolVote`. */
export interface QaPoolVoteResult {
  outcome: 'pending' | 'reject' | 'allow';
  mempool?: boolean;
  duplicate?: boolean;
  error?: string;
}

/** Result of `boing_operatorApplyQaPolicy`. */
export interface OperatorApplyQaPolicyResult {
  ok: true;
}

/**
 * Effective protocol QA rule registry from `boing_getQaRegistry` (read-only).
 * `blocklist` entries are 32-byte arrays; `scam_patterns` are byte arrays.
 */
export interface QaRegistryResult {
  max_bytecode_size: number;
  blocklist: number[][];
  scam_patterns: number[][];
  always_review_categories: string[];
  content_blocklist: string[];
}

/** JSON-RPC 2.0 response. */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
