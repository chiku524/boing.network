//! Transaction mempool — pending transactions awaiting inclusion in a block.
//! Runs protocol QA on ContractDeploy before accepting; rejects with structured reason when QA fails.

use std::collections::{BTreeMap, HashMap};
use std::sync::Mutex;

use boing_primitives::{AccountId, SignedTransaction};
use boing_qa::{check_contract_deploy_full_with_metadata, RuleRegistry, QaReject, QaResult};

/// Default max pending transactions per sender (matches SECURITY-STANDARDS / RateLimitConfig).
pub const DEFAULT_MAX_PENDING_PER_SENDER: usize = 16;

/// In-memory mempool. Tracks pending transactions by sender nonce.
pub struct Mempool {
    inner: Mutex<MempoolInner>,
    max_pending_per_sender: usize,
    /// QA rule registry (blocklist, content blocklist, etc.). Replace via [Mempool::with_qa_registry] or governance.
    qa_registry: RuleRegistry,
}

impl Default for Mempool {
    fn default() -> Self {
        Self::new()
    }
}

/// Default rule registry for QA (max bytecode size, etc.). Can be replaced with on-chain config later.
fn default_qa_registry() -> RuleRegistry {
    RuleRegistry::new()
}

#[derive(Default)]
struct MempoolInner {
    /// Pending txs by sender, then by nonce.
    by_sender: HashMap<AccountId, BTreeMap<u64, SignedTransaction>>,
    /// All tx IDs for dedup.
    by_id: HashMap<boing_primitives::Hash, ()>,
    /// Count of pending txs.
    len: usize,
}

impl Mempool {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(MempoolInner::default()),
            max_pending_per_sender: DEFAULT_MAX_PENDING_PER_SENDER,
            qa_registry: default_qa_registry(),
        }
    }

    pub fn with_max_pending_per_sender(mut self, max: usize) -> Self {
        self.max_pending_per_sender = max.max(1);
        self
    }

    /// Use a custom QA rule registry (e.g. loaded from file or from governance). Content blocklist and other rules are applied from this registry.
    pub fn with_qa_registry(mut self, registry: RuleRegistry) -> Self {
        self.qa_registry = registry;
        self
    }

    /// Insert a signed transaction. Rejects duplicates, invalid nonces, per-sender cap, and ContractDeploy that fail QA.
    pub fn insert(&self, signed: SignedTransaction) -> Result<(), MempoolError> {
        signed.verify().map_err(|_| MempoolError::InvalidSignature)?;
        if let Some((bytecode, purpose, desc_hash, asset_name, asset_symbol)) = signed.tx.payload.as_contract_deploy() {
            let registry = &self.qa_registry;
            match check_contract_deploy_full_with_metadata(
                bytecode,
                purpose,
                desc_hash,
                asset_name,
                asset_symbol,
                registry,
            ) {
                QaResult::Reject(reject) => return Err(MempoolError::QaRejected(reject)),
                QaResult::Unsure => return Err(MempoolError::QaPendingPool),
                QaResult::Allow => {}
            }
        }
        let tx_id = signed.tx.id();
        let mut inner = self.inner.lock().unwrap();
        if inner.by_id.contains_key(&tx_id) {
            return Err(MempoolError::Duplicate);
        }
        let sender = signed.tx.sender;
        let nonce = signed.tx.nonce;
        let is_replacement = inner.by_sender.get(&sender).map(|m| m.contains_key(&nonce)).unwrap_or(false);
        if !is_replacement {
            let sender_count = inner.by_sender.get(&sender).map(|m| m.len()).unwrap_or(0);
            if sender_count >= self.max_pending_per_sender {
                return Err(MempoolError::PendingLimitExceeded {
                    sender,
                    limit: self.max_pending_per_sender,
                });
            }
        }
        let prev = inner.by_sender.entry(sender).or_default().insert(nonce, signed);
        if let Some(old_signed) = prev {
            inner.by_id.remove(&old_signed.tx.id());
        } else {
            inner.len += 1;
        }
        inner.by_id.insert(tx_id, ());
        Ok(())
    }

    /// Remove and return signed transactions up to `max` for block inclusion.
    /// Returns txs in nonce order (per sender). Callers can re-insert on failure (e.g. consensus).
    pub fn drain_for_block(&self, max: usize) -> Vec<SignedTransaction> {
        let mut inner = self.inner.lock().unwrap();
        let mut candidates: Vec<(AccountId, u64)> = Vec::new();
        for (sender, by_nonce) in inner.by_sender.iter() {
            for nonce in by_nonce.keys() {
                candidates.push((*sender, *nonce));
            }
        }
        candidates.sort_by(|a, b| a.1.cmp(&b.1).then_with(|| a.0.0.cmp(&b.0.0)));
        let mut out = Vec::with_capacity(max.min(candidates.len()));
        for (sender, nonce) in candidates.into_iter().take(max) {
            if let Some(by_nonce) = inner.by_sender.get_mut(&sender) {
                if let Some(signed) = by_nonce.remove(&nonce) {
                    inner.by_id.remove(&signed.tx.id());
                    inner.len = inner.len.saturating_sub(1);
                    out.push(signed);
                }
            }
        }
        out
    }

    /// Re-insert signed transactions (e.g. after block production or consensus failure).
    /// Duplicates are skipped; invalid signatures are skipped. Used to restore txs when a block is not committed.
    pub fn reinsert(&self, signed_txs: Vec<SignedTransaction>) {
        for signed in signed_txs {
            let _ = self.insert(signed);
        }
    }

    /// Number of pending transactions.
    pub fn len(&self) -> usize {
        self.inner.lock().unwrap().len
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[derive(Debug, thiserror::Error)]
pub enum MempoolError {
    #[error("Duplicate transaction")]
    Duplicate,
    #[error("Invalid signature")]
    InvalidSignature,
    #[error("Pending limit exceeded: sender has too many pending txs (max {limit})")]
    PendingLimitExceeded { sender: AccountId, limit: usize },
    /// Protocol QA rejected this deployment; rule_id and message give user feedback.
    #[error("QA rejected: {0}")]
    QaRejected(QaReject),
    /// Deployment referred to community QA pool (Unsure); not accepted until pool decides.
    #[error("Deployment referred to community QA pool")]
    QaPendingPool,
}
