//! Security configuration and incident response types.
//!
//! See SECURITY-STANDARDS.md for full design.

use serde::{Deserialize, Serialize};

/// Rate limit configuration for DDoS resistance.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Max requests per second per peer (0 = disabled).
    pub requests_per_sec: u32,
    /// Max connections per IP (0 = disabled).
    pub connections_per_ip: u32,
    /// Max distinct pending nonces per sender in the mempool (applied at `boing-node` startup; HTTP RPC uses the same `RateLimitConfig` instance).
    pub pending_txs_per_sender: u32,
}

impl RateLimitConfig {
    pub fn default_mainnet() -> Self {
        Self {
            requests_per_sec: 100,
            connections_per_ip: 50,
            pending_txs_per_sender: 16,
        }
    }

    pub fn default_devnet() -> Self {
        Self {
            requests_per_sec: 1000,
            connections_per_ip: 100,
            pending_txs_per_sender: 64,
        }
    }
}

/// Severity level for security incidents.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum IncidentSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Incident report (for internal tracking and response).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IncidentReport {
    pub severity: IncidentSeverity,
    pub summary: String,
    pub component: String,
    pub timestamp_secs: u64,
}
