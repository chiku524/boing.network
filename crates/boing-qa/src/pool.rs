//! Community QA pool — pending queue, voting, and outcomes for edge cases (Unsure).
//!
//! When automation returns Unsure, the deployment is added to the pending queue.
//! Pool members vote Allow or Reject. After quorum or deadline T, the item is resolved.
//! See QUALITY-ASSURANCE-NETWORK.md §8.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use boing_primitives::{AccountId, Hash};

/// Outcome of a pool vote or resolution.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PoolOutcome {
    Allow,
    Reject,
}

/// Single vote from a pool member.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum QaPoolVote {
    Allow,
    Reject,
    Abstain,
}

/// A deployment pending QA pool review.
#[derive(Clone, Debug)]
pub struct PendingQaItem {
    pub tx_hash: Hash,
    pub bytecode_hash: [u8; 32],
    pub deployer: AccountId,
    pub entered_at: Instant,
    pub votes: HashMap<AccountId, QaPoolVote>,
}

impl PendingQaItem {
    pub fn new(tx_hash: Hash, bytecode_hash: [u8; 32], deployer: AccountId) -> Self {
        Self {
            tx_hash,
            bytecode_hash,
            deployer,
            entered_at: Instant::now(),
            votes: HashMap::new(),
        }
    }

    /// Count Allow and Reject votes (excluding Abstain).
    pub fn vote_counts(&self) -> (usize, usize) {
        let mut allow = 0;
        let mut reject = 0;
        for v in self.votes.values() {
            match v {
                QaPoolVote::Allow => allow += 1,
                QaPoolVote::Reject => reject += 1,
                QaPoolVote::Abstain => {}
            }
        }
        (allow, reject)
    }

    /// Whether the item has reached the deadline.
    pub fn is_expired(&self, max_time: Duration) -> bool {
        self.entered_at.elapsed() >= max_time
    }
}

/// Policy when deadline expires without quorum.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DefaultOnExpiry {
    Reject,
    Allow,
}

/// In-memory pending QA queue. Production: on-chain or persistence layer.
pub struct PendingQaQueue {
    inner: Mutex<PendingQaQueueInner>,
    /// Maximum time an item can stay in the pool.
    max_time: Duration,
    /// Minimum fraction of pool members that must vote for a decision (e.g. 0.5 = 50%).
    quorum_fraction: f64,
    /// Minimum fraction of votes that must be Allow for Allow outcome (e.g. 2/3).
    allow_threshold: f64,
    /// Outcome when deadline expires without quorum.
    default_on_expiry: DefaultOnExpiry,
}

struct PendingQaQueueInner {
    items: HashMap<Hash, PendingQaItem>,
    /// Pool members (AccountIds) who can vote.
    pool_members: Vec<AccountId>,
}

impl PendingQaQueue {
    pub fn new(
        max_time: Duration,
        quorum_fraction: f64,
        allow_threshold: f64,
        default_on_expiry: DefaultOnExpiry,
    ) -> Self {
        Self {
            inner: Mutex::new(PendingQaQueueInner {
                items: HashMap::new(),
                pool_members: Vec::new(),
            }),
            max_time,
            quorum_fraction,
            allow_threshold,
            default_on_expiry,
        }
    }

    pub fn with_pool_members(self, members: Vec<AccountId>) -> Self {
        self.inner.lock().unwrap().pool_members = members;
        self
    }

    /// Add an item that received Unsure from automation.
    pub fn add(&self, item: PendingQaItem) -> Result<(), PoolError> {
        let mut inner = self.inner.lock().unwrap();
        if inner.items.contains_key(&item.tx_hash) {
            return Err(PoolError::Duplicate);
        }
        inner.items.insert(item.tx_hash, item);
        Ok(())
    }

    /// Record a vote from a pool member.
    pub fn vote(&self, tx_hash: Hash, voter: AccountId, vote: QaPoolVote) -> Result<(), PoolError> {
        let mut inner = self.inner.lock().unwrap();
        if !inner.pool_members.contains(&voter) {
            return Err(PoolError::NotPoolMember);
        }
        let item = inner.items.get_mut(&tx_hash).ok_or(PoolError::NotFound)?;
        item.votes.insert(voter, vote);
        Ok(())
    }

    /// Resolve an item: check if quorum + threshold met, or if expired apply default.
    pub fn resolve(&self, tx_hash: Hash) -> Option<PoolOutcome> {
        let mut inner = self.inner.lock().unwrap();
        let item = inner.items.get(&tx_hash)?;
        let pool_size = inner.pool_members.len().max(1);
        let (allow, reject) = item.vote_counts();
        let total_votes = allow + reject;

        if item.is_expired(self.max_time) {
            let _ = inner.items.remove(&tx_hash);
            return Some(match self.default_on_expiry {
                DefaultOnExpiry::Reject => PoolOutcome::Reject,
                DefaultOnExpiry::Allow => PoolOutcome::Allow,
            });
        }

        let quorum_met = (total_votes as f64 / pool_size as f64) >= self.quorum_fraction;
        if !quorum_met {
            return None;
        }

        let allow_ratio = allow as f64 / total_votes as f64;
        let reject_ratio = reject as f64 / total_votes as f64;

        if allow_ratio >= self.allow_threshold {
            inner.items.remove(&tx_hash);
            Some(PoolOutcome::Allow)
        } else if reject_ratio >= self.allow_threshold {
            inner.items.remove(&tx_hash);
            Some(PoolOutcome::Reject)
        } else {
            None
        }
    }

    /// Get a pending item by tx hash.
    pub fn get(&self, tx_hash: &Hash) -> Option<PendingQaItem> {
        self.inner.lock().unwrap().items.get(tx_hash).cloned()
    }

    /// List all pending items.
    pub fn list(&self) -> Vec<PendingQaItem> {
        self.inner.lock().unwrap().items.values().cloned().collect()
    }

    /// Remove expired items and return their outcomes.
    pub fn prune_expired(&self) -> Vec<(Hash, PoolOutcome)> {
        let mut inner = self.inner.lock().unwrap();
        let mut resolved = Vec::new();
        let to_remove: Vec<_> = inner
            .items
            .iter()
            .filter(|(_, item)| item.is_expired(self.max_time))
            .map(|(h, _)| *h)
            .collect();
        for h in to_remove {
            if inner.items.remove(&h).is_some() {
                resolved.push((
                    h,
                    match self.default_on_expiry {
                        DefaultOnExpiry::Reject => PoolOutcome::Reject,
                        DefaultOnExpiry::Allow => PoolOutcome::Allow,
                    },
                ));
            }
        }
        resolved
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn pool_add_vote_resolve() {
        let queue = PendingQaQueue::new(
            Duration::from_secs(60),
            0.5,
            2.0 / 3.0,
            DefaultOnExpiry::Reject,
        )
        .with_pool_members(vec![
            AccountId::from_bytes([1u8; 32]),
            AccountId::from_bytes([2u8; 32]),
            AccountId::from_bytes([3u8; 32]),
        ]);

        let tx_hash = Hash([4u8; 32]);
        let item = PendingQaItem::new(
            tx_hash,
            [5u8; 32],
            AccountId::from_bytes([6u8; 32]),
        );
        queue.add(item).unwrap();

        queue
            .vote(tx_hash, AccountId::from_bytes([1u8; 32]), QaPoolVote::Allow)
            .unwrap();
        queue
            .vote(tx_hash, AccountId::from_bytes([2u8; 32]), QaPoolVote::Allow)
            .unwrap();
        queue
            .vote(tx_hash, AccountId::from_bytes([3u8; 32]), QaPoolVote::Reject)
            .unwrap();

        let out = queue.resolve(tx_hash);
        assert_eq!(out, Some(PoolOutcome::Allow)); // 2/3 Allow
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PoolError {
    #[error("Item already in pool")]
    Duplicate,
    #[error("Voter is not a pool member")]
    NotPoolMember,
    #[error("Item not found")]
    NotFound,
}
