//! Governance JSON for the Unsure QA pool — administrators, anti-congestion caps, vote thresholds.
//!
//! Apply via governance proposal `target_key` [`GOVERNANCE_QA_POOL_CONFIG_KEY`] or load from `qa_pool_config.json` on the node.
//! Only listed **administrators** may vote unless `dev_open_voting` is true (local dev / testnet).

use boing_primitives::AccountId;
use serde::{Deserialize, Serialize};

/// JSON `default_on_expiry` field.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QaPoolExpiryPolicy {
    #[default]
    Reject,
    Allow,
}

fn default_max_pending() -> u32 {
    32
}

fn default_max_per_deployer() -> u32 {
    2
}

fn default_review_secs() -> u64 {
    7 * 24 * 60 * 60
}

fn default_quorum() -> f64 {
    0.5
}

fn default_threshold() -> f64 {
    2.0 / 3.0
}

/// Serializable governance payload for the QA pool. Keeps the queue **bounded** so administrator review cannot be flooded.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct QaPoolGovernanceConfig {
    /// 32-byte account IDs as hex strings (optional `0x`). Only these accounts may vote when `dev_open_voting` is false.
    #[serde(default)]
    pub administrators: Vec<String>,
    /// Max concurrent pending Unsure items globally. **Anti-congestion:** when reached, new Unsure submissions are refused.
    /// Set to `0` to disable the pool (no Unsure enqueue).
    #[serde(default = "default_max_pending")]
    pub max_pending_items: u32,
    /// Max pending pool slots per deployer (`0` = unlimited).
    #[serde(default = "default_max_per_deployer")]
    pub max_pending_per_deployer: u32,
    #[serde(default = "default_review_secs")]
    pub review_window_secs: u64,
    #[serde(default = "default_quorum")]
    pub quorum_fraction: f64,
    #[serde(default = "default_threshold")]
    pub allow_threshold_fraction: f64,
    #[serde(default = "default_threshold")]
    pub reject_threshold_fraction: f64,
    #[serde(default)]
    pub default_on_expiry: QaPoolExpiryPolicy,
    /// When true **and** `administrators` is empty, any account may vote (development / open testnet only).
    #[serde(default)]
    pub dev_open_voting: bool,
}

impl Default for QaPoolGovernanceConfig {
    fn default() -> Self {
        Self {
            administrators: Vec::new(),
            max_pending_items: default_max_pending(),
            max_pending_per_deployer: default_max_per_deployer(),
            review_window_secs: default_review_secs(),
            quorum_fraction: default_quorum(),
            allow_threshold_fraction: default_threshold(),
            reject_threshold_fraction: default_threshold(),
            default_on_expiry: QaPoolExpiryPolicy::Reject,
            dev_open_voting: false,
        }
    }
}

impl QaPoolGovernanceConfig {
    /// Production-style defaults: admin-only, bounded queue. **Administrators must be set** (empty list ⇒ pool will not accept Unsure until governance fills this).
    pub fn production_default() -> Self {
        Self::default()
    }

    /// Local tests and dev nodes: open voting, generous caps.
    pub fn development_default() -> Self {
        Self {
            administrators: Vec::new(),
            max_pending_items: 256,
            max_pending_per_deployer: 16,
            review_window_secs: 7 * 24 * 60 * 60,
            quorum_fraction: 0.5,
            allow_threshold_fraction: 2.0 / 3.0,
            reject_threshold_fraction: 2.0 / 3.0,
            default_on_expiry: QaPoolExpiryPolicy::Reject,
            dev_open_voting: true,
        }
    }

    /// Parse administrator hex strings to account IDs (invalid entries skipped).
    pub fn administrator_accounts(&self) -> Vec<AccountId> {
        self.administrators
            .iter()
            .filter_map(|s| parse_account_hex(s))
            .collect()
    }

    /// Whether new Unsure items may be enqueued (governance + capacity policy).
    pub fn accepts_new_pending(&self) -> bool {
        if self.max_pending_items == 0 {
            return false;
        }
        self.dev_open_voting || !self.administrator_accounts().is_empty()
    }

    /// True if `voter` may cast a pool vote under this config.
    pub fn voter_may_vote(&self, voter: AccountId) -> bool {
        let admins = self.administrator_accounts();
        if self.dev_open_voting && admins.is_empty() {
            return true;
        }
        admins.contains(&voter)
    }

    /// Effective electorate size for quorum math (minimum 1 when open mode).
    pub fn effective_electorate_size(&self) -> usize {
        let admins = self.administrator_accounts();
        if self.dev_open_voting && admins.is_empty() {
            1
        } else {
            admins.len().max(1)
        }
    }
}

fn parse_account_hex(s: &str) -> Option<AccountId> {
    let s = s.trim();
    let s = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex::decode(s).ok()?;
    if bytes.len() != 32 {
        return None;
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Some(AccountId(arr))
}

/// Governance proposal key for [`QaPoolGovernanceConfig`] JSON (`target_value`).
pub const GOVERNANCE_QA_POOL_CONFIG_KEY: &str = "qa_pool_config";

/// Deserialize pool config from JSON bytes (e.g. governance execution or `qa_pool_config.json`).
pub fn qa_pool_config_from_json(bytes: &[u8]) -> Result<QaPoolGovernanceConfig, serde_json::Error> {
    serde_json::from_slice(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn production_does_not_accept_without_admins() {
        let c = QaPoolGovernanceConfig::production_default();
        assert!(!c.accepts_new_pending());
    }

    #[test]
    fn development_accepts_with_open_voting() {
        let c = QaPoolGovernanceConfig::development_default();
        assert!(c.accepts_new_pending());
    }
}
