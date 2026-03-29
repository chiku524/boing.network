//! Simple JSON-RPC over HTTP for Boing node.
//!
//! Supports boing_submitTransaction for submitting signed transactions.
//! Optional global rate limiting when RateLimitConfig.requests_per_sec > 0.
//! Optional testnet faucet (boing_faucetRequest) when --faucet-enable.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use axum::http::header::{HeaderName, HeaderValue, CONTENT_TYPE};
use axum::http::Method;
use tower_http::cors::{AllowOrigin, CorsLayer};
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tracing::info;

use crate::faucet::{self, testnet_faucet_account_id};
use crate::mempool::MempoolError;
use crate::node::{BoingNode, QaPoolVoteResult};
use crate::security::RateLimitConfig;
use boing_primitives::{
    AccessList, AccountId, Hash, SignedIntent, SignedTransaction, Transaction, TransactionPayload,
};
use boing_qa::pool::{PoolError, QaPoolVote};
use boing_qa::{
    check_contract_deploy_full_with_metadata, qa_pool_config_from_json, rule_registry_from_json, QaPoolExpiryPolicy,
    QaResult, RuleRegistry,
};

/// Shared node state for RPC and validator loop.
pub type NodeState = Arc<RwLock<BoingNode>>;

/// Per-account cooldown for faucet (testnet only).
pub type FaucetCooldown = Arc<std::sync::Mutex<HashMap<AccountId, Instant>>>;

/// RPC handler state: node + optional global rate limiter + optional testnet faucet.
#[derive(Clone)]
pub struct RpcState {
    pub node: NodeState,
    pub rate_limiter: Option<Arc<governor::DefaultDirectRateLimiter>>,
    /// When set, enables boing_faucetRequest (testnet only).
    pub faucet_signer: Option<Arc<ed25519_dalek::SigningKey>>,
    pub faucet_cooldown: Option<FaucetCooldown>,
    /// When set, `boing_qaPoolVote` and `boing_operatorApplyQaPolicy` require header `X-Boing-Operator: <token>`.
    pub operator_rpc_token: Option<Arc<str>>,
}

impl RpcState {
    fn operator_authorized(&self, headers: &HeaderMap) -> bool {
        match &self.operator_rpc_token {
            None => true,
            Some(expected) => headers
                .get("x-boing-operator")
                .and_then(|v| v.to_str().ok())
                .is_some_and(|v| v == expected.as_ref()),
        }
    }
}

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    #[allow(dead_code)]
    jsonrpc: Option<String>,
    id: Option<serde_json::Value>,
    method: String,
    params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: &'static str,
    id: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<serde_json::Value>,
}

fn rpc_error(id: Option<serde_json::Value>, code: i32, message: String) -> JsonRpcResponse {
    JsonRpcResponse {
        jsonrpc: "2.0",
        id,
        result: None,
        error: Some(JsonRpcError {
            code,
            message,
            data: None,
        }),
    }
}

fn rpc_error_with_data(
    id: Option<serde_json::Value>,
    code: i32,
    message: String,
    data: serde_json::Value,
) -> JsonRpcResponse {
    JsonRpcResponse {
        jsonrpc: "2.0",
        id,
        result: None,
        error: Some(JsonRpcError {
            code,
            message,
            data: Some(data),
        }),
    }
}

fn rpc_ok(id: Option<serde_json::Value>, result: serde_json::Value) -> JsonRpcResponse {
    JsonRpcResponse {
        jsonrpc: "2.0",
        id,
        result: Some(result),
        error: None,
    }
}

fn parse_hash32_hex(s: &str) -> Result<Hash, String> {
    let bytes = hex::decode(s.trim_start_matches("0x")).map_err(|e| e.to_string())?;
    if bytes.len() != 32 {
        return Err("tx_hash must be 32 bytes".into());
    }
    Hash::from_slice(&bytes).ok_or_else(|| "invalid hash".into())
}

fn parse_account_id_hex(s: &str) -> Result<AccountId, String> {
    let bytes = hex::decode(s.trim_start_matches("0x")).map_err(|e| e.to_string())?;
    if bytes.len() != 32 {
        return Err("account id must be 32 bytes".into());
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(AccountId(arr))
}

fn parse_qa_pool_vote(s: &str) -> Result<QaPoolVote, String> {
    match s.trim().to_ascii_lowercase().as_str() {
        "allow" => Ok(QaPoolVote::Allow),
        "reject" => Ok(QaPoolVote::Reject),
        "abstain" => Ok(QaPoolVote::Abstain),
        _ => Err("vote must be allow, reject, or abstain".into()),
    }
}

async fn handle_rpc(
    State(state): State<RpcState>,
    headers: HeaderMap,
    Json(req): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    if let Some(ref limiter) = state.rate_limiter {
        if limiter.check().is_err() {
            return (
                StatusCode::TOO_MANY_REQUESTS,
                Json(rpc_error(
                    req.id,
                    -32016,
                    "Rate limit exceeded. Try again later.".into(),
                )),
            );
        }
    }

    let node = &state.node;
    let id = req.id;

    let result = match req.method.as_str() {
        "boing_submitTransaction" => {
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let hex_tx = match params {
                Some(v) if !v.is_empty() => v[0].clone(),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [hex_signed_tx]".into()))),
            };
            match hex::decode(hex_tx.trim_start_matches("0x")) {
                Ok(bytes) => match bincode::deserialize::<SignedTransaction>(&bytes) {
                    Ok(signed) => {
                        let n = node.read().await;
                        match n.submit_transaction(signed) {
                            Ok(()) => {
                                info!("RPC: transaction submitted");
                                rpc_ok(id, serde_json::json!({"tx_hash": "ok"}))
                            }
                            Err(MempoolError::QaRejected(r)) => {
                                let mut data = serde_json::json!({ "rule_id": r.rule_id.0, "message": r.message });
                                if let Some(ref u) = r.doc_url {
                                    data["doc_url"] = serde_json::Value::String(u.clone());
                                }
                                rpc_error_with_data(id, -32050, format!("Deployment rejected by QA: {}", r.message), data)
                            }
                            Err(MempoolError::QaPendingPool(tx_hash)) => rpc_error_with_data(
                                id,
                                -32051,
                                "Deployment referred to community QA pool.".into(),
                                serde_json::json!({
                                    "tx_hash": format!("0x{}", hex::encode(tx_hash.0)),
                                }),
                            ),
                            Err(MempoolError::QaPoolEnqueue(msg)) => {
                                rpc_error(id, -32000, format!("QA pool enqueue failed: {}", msg))
                            }
                            Err(MempoolError::QaPoolDisabled) => rpc_error(
                                id,
                                -32054,
                                "QA pool is disabled by governance (configure administrators in qa_pool_config).".into(),
                            ),
                            Err(MempoolError::QaPoolFull) => rpc_error_with_data(
                                id,
                                -32055,
                                "QA pool is at capacity (max_pending_items).".into(),
                                serde_json::json!({ "reason": "pool_full" }),
                            ),
                            Err(MempoolError::QaPoolDeployerCap) => rpc_error_with_data(
                                id,
                                -32056,
                                "QA pool deployer pending limit exceeded.".into(),
                                serde_json::json!({ "reason": "deployer_cap" }),
                            ),
                            Err(e) => rpc_error(id, -32000, format!("{}", e)),
                        }
                    }
                    Err(e) => rpc_error(id, -32602, format!("Invalid transaction: {}", e)),
                },
                Err(e) => rpc_error(id, -32602, format!("Invalid hex: {}", e)),
            }
        }
        "boing_qaPoolList" => {
            let n = node.read().await;
            rpc_ok(
                id,
                serde_json::json!({ "items": n.qa_pool.list_summaries() }),
            )
        }
        "boing_qaPoolConfig" => {
            let n = node.read().await;
            let cfg = n.qa_pool.governance_config();
            let expiry = match cfg.default_on_expiry {
                QaPoolExpiryPolicy::Reject => "reject",
                QaPoolExpiryPolicy::Allow => "allow",
            };
            rpc_ok(
                id,
                serde_json::json!({
                    "max_pending_items": cfg.max_pending_items,
                    "max_pending_per_deployer": cfg.max_pending_per_deployer,
                    "review_window_secs": cfg.review_window_secs,
                    "quorum_fraction": cfg.quorum_fraction,
                    "allow_threshold_fraction": cfg.allow_threshold_fraction,
                    "reject_threshold_fraction": cfg.reject_threshold_fraction,
                    "default_on_expiry": expiry,
                    "dev_open_voting": cfg.dev_open_voting,
                    "administrator_count": cfg.administrator_accounts().len(),
                    "accepts_new_pending": cfg.accepts_new_pending(),
                    "pending_count": n.qa_pool.pending_len(),
                }),
            )
        }
        "boing_getQaRegistry" => {
            let n = node.read().await;
            let reg = n.mempool.qa_registry();
            match serde_json::to_value(reg) {
                Ok(v) => rpc_ok(id, v),
                Err(e) => rpc_error(id, -32000, format!("Failed to serialize QA registry: {}", e)),
            }
        }
        "boing_qaPoolVote" => {
            if !state.operator_authorized(&headers) {
                return (
                    StatusCode::OK,
                    Json(rpc_error(
                        id,
                        -32057,
                        "Operator authentication required: set X-Boing-Operator to match the node's BOING_OPERATOR_RPC_TOKEN."
                            .into(),
                    )),
                );
            }
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let (tx_hex, voter_hex, vote_s) = match params {
                Some(v) if v.len() >= 3 => (v[0].clone(), v[1].clone(), v[2].clone()),
                _ => {
                    return (
                        StatusCode::OK,
                        Json(rpc_error(
                            id,
                            -32602,
                            "Invalid params: expected [tx_hash_hex, voter_hex, allow|reject|abstain]".into(),
                        )),
                    );
                }
            };
            let tx_hash = match parse_hash32_hex(&tx_hex) {
                Ok(h) => h,
                Err(e) => return (StatusCode::OK, Json(rpc_error(id, -32602, e))),
            };
            let voter = match parse_account_id_hex(&voter_hex) {
                Ok(a) => a,
                Err(e) => return (StatusCode::OK, Json(rpc_error(id, -32602, e))),
            };
            let vote = match parse_qa_pool_vote(&vote_s) {
                Ok(v) => v,
                Err(e) => return (StatusCode::OK, Json(rpc_error(id, -32602, e))),
            };
            let n = node.read().await;
            match n.qa_pool_vote(tx_hash, voter, vote) {
                Ok(QaPoolVoteResult::Pending) => rpc_ok(id, serde_json::json!({ "outcome": "pending" })),
                Ok(QaPoolVoteResult::Rejected) => rpc_ok(id, serde_json::json!({ "outcome": "reject" })),
                Ok(QaPoolVoteResult::AllowedAdmitted) => {
                    rpc_ok(id, serde_json::json!({ "outcome": "allow", "mempool": true }))
                }
                Ok(QaPoolVoteResult::AllowedAlreadyInMempool) => rpc_ok(
                    id,
                    serde_json::json!({ "outcome": "allow", "mempool": false, "duplicate": true }),
                ),
                Ok(QaPoolVoteResult::AllowedMempoolFailed(msg)) => rpc_ok(
                    id,
                    serde_json::json!({ "outcome": "allow", "mempool": false, "error": msg }),
                ),
                Err(PoolError::NotFound) => {
                    rpc_error(id, -32052, "No pending QA pool item for that tx_hash.".into())
                }
                Err(PoolError::NotAdministrator) => {
                    rpc_error(id, -32053, "Voter is not a governance QA pool administrator.".into())
                }
                Err(e) => rpc_error(id, -32000, e.to_string()),
            }
        }
        "boing_operatorApplyQaPolicy" => {
            if !state.operator_authorized(&headers) {
                return (
                    StatusCode::OK,
                    Json(rpc_error(
                        id,
                        -32057,
                        "Operator authentication required: set X-Boing-Operator to match the node's BOING_OPERATOR_RPC_TOKEN."
                            .into(),
                    )),
                );
            }
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let (reg_json, pool_json) = match params {
                Some(v) if v.len() >= 2 => (v[0].clone(), v[1].clone()),
                _ => {
                    return (
                        StatusCode::OK,
                        Json(rpc_error(
                            id,
                            -32602,
                            "Invalid params: expected [qa_registry_json, qa_pool_config_json] (two JSON strings).".into(),
                        )),
                    );
                }
            };
            let registry = match rule_registry_from_json(reg_json.as_bytes()) {
                Ok(r) => r,
                Err(e) => {
                    return (
                        StatusCode::OK,
                        Json(rpc_error(id, -32602, format!("Invalid qa_registry JSON: {}", e))),
                    );
                }
            };
            let pool_cfg = match qa_pool_config_from_json(pool_json.as_bytes()) {
                Ok(c) => c,
                Err(e) => {
                    return (
                        StatusCode::OK,
                        Json(rpc_error(id, -32602, format!("Invalid qa_pool_config JSON: {}", e))),
                    );
                }
            };
            let mut n = node.write().await;
            n.set_qa_policy(registry, pool_cfg);
            info!("RPC: operator applied QA policy (registry + pool config)");
            rpc_ok(id, serde_json::json!({ "ok": true }))
        }
        "boing_chainHeight" => {
            let n = node.read().await;
            let height = n.chain.height();
            rpc_ok(id, serde_json::json!(height))
        }
        "boing_getBalance" => {
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let hex_account = match params {
                Some(v) if !v.is_empty() => v[0].clone(),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [hex_account_id]".into()))),
            };
            match hex::decode(hex_account.trim_start_matches("0x")) {
                Ok(bytes) if bytes.len() == 32 => {
                    let mut arr = [0u8; 32];
                    arr.copy_from_slice(&bytes);
                    let account_id = boing_primitives::AccountId(arr);
                    let n = node.read().await;
                    let balance = n.state.get(&account_id).map(|s| s.balance).unwrap_or(0);
                    rpc_ok(id, serde_json::json!({ "balance": balance.to_string() }))
                }
                _ => rpc_error(id, -32602, "Invalid account id: expected 32 bytes hex".into()),
            }
        }
        "boing_getAccount" => {
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let hex_account = match params {
                Some(v) if !v.is_empty() => v[0].clone(),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [hex_account_id]".into()))),
            };
            match hex::decode(hex_account.trim_start_matches("0x")) {
                Ok(bytes) if bytes.len() == 32 => {
                    let mut arr = [0u8; 32];
                    arr.copy_from_slice(&bytes);
                    let account_id = boing_primitives::AccountId(arr);
                    let n = node.read().await;
                    match n.state.get(&account_id) {
                        Some(s) => rpc_ok(id, serde_json::json!({
                            "balance": s.balance.to_string(),
                            "nonce": s.nonce,
                            "stake": s.stake.to_string()
                        })),
                        None => rpc_ok(id, serde_json::json!({
                            "balance": "0",
                            "nonce": 0,
                            "stake": "0"
                        })),
                    }
                }
                _ => rpc_error(id, -32602, "Invalid account id: expected 32 bytes hex".into()),
            }
        }
        "boing_getAccountProof" => {
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let hex_account = match params {
                Some(v) if !v.is_empty() => v[0].clone(),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [hex_account_id]".into()))),
            };
            match hex::decode(hex_account.trim_start_matches("0x")) {
                Ok(bytes) if bytes.len() == 32 => {
                    let mut arr = [0u8; 32];
                    arr.copy_from_slice(&bytes);
                    let account_id = boing_primitives::AccountId(arr);
                    let mut n = node.write().await;
                    if let Some(proof) = n.state.prove_account(&account_id) {
                        match bincode::serialize(&proof) {
                            Ok(ser) => rpc_ok(id, serde_json::json!({
                                "proof": hex::encode(ser),
                                "root": hex::encode(proof.root.0),
                                "value_hash": hex::encode(proof.value_hash.0)
                            })),
                            Err(e) => rpc_error(id, -32000, format!("Serialization error: {}", e)),
                        }
                    } else {
                        rpc_error(id, -32000, "Account not found".into())
                    }
                }
                _ => rpc_error(id, -32602, "Invalid account id: expected 32 bytes hex".into()),
            }
        }
        "boing_verifyAccountProof" => {
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let (hex_proof, hex_root) = match params {
                Some(v) if v.len() >= 2 => (v[0].clone(), v[1].clone()),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [hex_proof, hex_state_root]".into()))),
            };
            match hex::decode(hex_proof.trim_start_matches("0x")) {
                Ok(bytes) => match bincode::deserialize::<boing_state::MerkleProof>(&bytes) {
                    Ok(proof) => {
                        let root_bytes = hex::decode(hex_root.trim_start_matches("0x")).ok();
                        let expected_root = root_bytes
                            .as_ref()
                            .and_then(|b| boing_primitives::Hash::from_slice(b));
                        let valid = expected_root
                            .map(|r| proof.verify() && proof.root == r)
                            .unwrap_or(proof.verify());
                        rpc_ok(id, serde_json::json!({ "valid": valid }))
                    }
                    Err(e) => rpc_error(id, -32602, format!("Invalid proof: {}", e)),
                },
                Err(e) => rpc_error(id, -32602, format!("Invalid hex: {}", e)),
            }
        }
        "boing_simulateTransaction" => {
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let hex_tx = match params {
                Some(v) if !v.is_empty() => v[0].clone(),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [hex_signed_tx]".into()))),
            };
            match hex::decode(hex_tx.trim_start_matches("0x")) {
                Ok(bytes) => match bincode::deserialize::<SignedTransaction>(&bytes) {
                    Ok(signed) => {
                        let (mut state_copy, vm) = {
                            let n = node.read().await;
                            (
                                n.state.snapshot(),
                                boing_execution::Vm::with_qa_registry(n.mempool.qa_registry().clone()),
                            )
                        };
                        match vm.execute(&signed.tx, &mut state_copy) {
                            Ok(gas) => rpc_ok(id, serde_json::json!({"gas_used": gas, "success": true})),
                            Err(e) => rpc_ok(id, serde_json::json!({"gas_used": 0, "success": false, "error": format!("{}", e)})),
                        }
                    }
                    Err(e) => rpc_error(id, -32602, format!("Invalid transaction: {}", e)),
                },
                Err(e) => rpc_error(id, -32602, format!("Invalid hex: {}", e)),
            }
        }
        "boing_getBlockByHeight" => {
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<serde_json::Value>>(p).ok());
            let height = match params {
                Some(v) if !v.is_empty() => v[0].as_u64(),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [height: u64]".into()))),
            };
            let height = match height {
                Some(h) => h,
                None => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid height: expected u64".into()))),
            };
            let n = node.read().await;
            match n.chain.get_block_by_height(height) {
                Some(block) => {
                    let hash = block.hash();
                    let block_json = serde_json::to_value(&block).unwrap_or(serde_json::Value::Null);
                    let mut obj = block_json.as_object().cloned().unwrap_or_default();
                    obj.insert("hash".to_string(), serde_json::json!(hex::encode(hash.0)));
                    rpc_ok(id, serde_json::Value::Object(obj))
                }
                None => rpc_ok(id, serde_json::Value::Null),
            }
        }
        "boing_getBlockByHash" => {
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let hex_hash = match params {
                Some(v) if !v.is_empty() => v[0].clone(),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [hex_block_hash]".into()))),
            };
            let bytes = match hex::decode(hex_hash.trim_start_matches("0x")) {
                Ok(b) if b.len() == 32 => b,
                Ok(_) => return (StatusCode::OK, Json(rpc_error(id, -32602, "Hash must be 32 bytes".into()))),
                Err(e) => return (StatusCode::OK, Json(rpc_error(id, -32602, format!("Invalid hex: {}", e)))),
            };
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&bytes);
            let hash = boing_primitives::Hash(arr);
            let n = node.read().await;
            match n.chain.get_block_by_hash(&hash) {
                Some(block) => {
                    let block_json = serde_json::to_value(&block).unwrap_or(serde_json::Value::Null);
                    let mut obj = block_json.as_object().cloned().unwrap_or_default();
                    obj.insert("hash".to_string(), serde_json::json!(hex::encode(block.hash().0)));
                    rpc_ok(id, serde_json::Value::Object(obj))
                }
                None => rpc_ok(id, serde_json::Value::Null),
            }
        }
        "boing_registerDappMetrics" => {
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let (hex_contract, hex_owner) = match params {
                Some(v) if v.len() >= 2 => (v[0].clone(), v[1].clone()),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [hex_contract, hex_owner]".into()))),
            };
            let parse_account = |hex_s: &str| -> Result<boing_primitives::AccountId, String> {
                let bytes = hex::decode(hex_s.trim_start_matches("0x"))
                    .map_err(|e| format!("Invalid hex: {}", e))?;
                if bytes.len() != 32 {
                    return Err("Account ID must be 32 bytes".into());
                }
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                Ok(boing_primitives::AccountId(arr))
            };
            match (parse_account(&hex_contract), parse_account(&hex_owner)) {
                (Ok(contract), Ok(owner)) => {
                    let n = node.write().await;
                    n.dapp_registry.register(contract, owner);
                    info!("RPC: dApp registered contract={} owner={}", hex::encode(contract.0), hex::encode(owner.0));
                    rpc_ok(id, serde_json::json!({"registered": true, "contract": hex::encode(contract.0), "owner": hex::encode(owner.0)}))
                }
                (Err(e), _) | (_, Err(e)) => rpc_error(id, -32602, e),
            }
        }
        "boing_qaCheck" => {
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<serde_json::Value>>(p).ok());
            let hex_bytecode = match params.as_ref().and_then(|v| v.first()) {
                Some(serde_json::Value::String(s)) => s.clone(),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [hex_bytecode] or [hex_bytecode, purpose_category?, description_hash?, asset_name?, asset_symbol?]".into()))),
            };
            let bytecode = match hex::decode(hex_bytecode.trim_start_matches("0x")) {
                Ok(b) => b,
                Err(e) => return (StatusCode::OK, Json(rpc_error(id, -32602, format!("Invalid hex bytecode: {}", e)))),
            };
            let purpose = params.as_ref()
                .and_then(|v| v.get(1))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let desc_hash = params.as_ref()
                .and_then(|v| v.get(2))
                .and_then(|v| v.as_str())
                .and_then(|s| hex::decode(s.trim_start_matches("0x")).ok())
                .filter(|b| b.len() == 32);
            let asset_name = params.as_ref().and_then(|v| v.get(3)).and_then(|v| v.as_str()).map(|s| s.to_string());
            let asset_symbol = params.as_ref().and_then(|v| v.get(4)).and_then(|v| v.as_str()).map(|s| s.to_string());
            let registry = RuleRegistry::new();
            let result = check_contract_deploy_full_with_metadata(
                &bytecode,
                purpose.as_deref(),
                desc_hash.as_deref(),
                asset_name.as_deref(),
                asset_symbol.as_deref(),
                &registry,
            );
            let (result_str, rule_id, message, doc_url) = match result {
                QaResult::Allow => ("allow".to_string(), None, None, None),
                QaResult::Reject(r) => ("reject".to_string(), Some(r.rule_id.0), Some(r.message), r.doc_url),
                QaResult::Unsure => ("unsure".to_string(), None, Some("Deployment referred to community QA pool".into()), None),
            };
            let mut obj = serde_json::Map::new();
            obj.insert("result".to_string(), serde_json::Value::String(result_str));
            if let Some(rid) = rule_id {
                obj.insert("rule_id".to_string(), serde_json::Value::String(rid));
            }
            if let Some(msg) = message {
                obj.insert("message".to_string(), serde_json::Value::String(msg));
            }
            if let Some(u) = doc_url {
                obj.insert("doc_url".to_string(), serde_json::Value::String(u));
            }
            rpc_ok(id, serde_json::Value::Object(obj))
        }
        "boing_submitIntent" => {
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let hex_intent = match params {
                Some(v) if !v.is_empty() => v[0].clone(),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [hex_signed_intent]".into()))),
            };
            match hex::decode(hex_intent.trim_start_matches("0x")) {
                Ok(bytes) => match bincode::deserialize::<SignedIntent>(&bytes) {
                    Ok(signed) => {
                        let n = node.read().await;
                        match n.submit_intent(signed) {
                            Ok(intent_id) => {
                                info!("RPC: intent submitted");
                                rpc_ok(id, serde_json::json!({"intent_id": hex::encode(intent_id.0)}))
                            }
                            Err(e) => rpc_error(id, -32000, format!("{}", e)),
                        }
                    }
                    Err(e) => rpc_error(id, -32602, format!("Invalid intent: {}", e)),
                },
                Err(e) => rpc_error(id, -32602, format!("Invalid hex: {}", e)),
            }
        }
        "boing_faucetRequest" => {
            let Some(ref faucet_signer) = state.faucet_signer else {
                return (StatusCode::OK, Json(rpc_error(id, -32601, "Faucet not enabled on this node.".into())));
            };
            let Some(ref cooldown) = state.faucet_cooldown else {
                return (StatusCode::OK, Json(rpc_error(id, -32601, "Faucet not enabled on this node.".into())));
            };
            let params = req.params.and_then(|p| serde_json::from_value::<Vec<String>>(p).ok());
            let hex_account = match params {
                Some(v) if !v.is_empty() => v[0].clone(),
                _ => return (StatusCode::OK, Json(rpc_error(id, -32602, "Invalid params: expected [hex_account_id] (32 bytes hex)".into()))),
            };
            let to_bytes = match hex::decode(hex_account.trim_start_matches("0x")) {
                Ok(b) if b.len() == 32 => b,
                Ok(_) => return (StatusCode::OK, Json(rpc_error(id, -32602, "Account ID must be 32 bytes hex.".into()))),
                Err(e) => return (StatusCode::OK, Json(rpc_error(id, -32602, format!("Invalid hex: {}", e)))),
            };
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&to_bytes);
            let to_id = AccountId(arr);

            const COOLDOWN: Duration = Duration::from_secs(60);
            {
                let mut map = cooldown.lock().unwrap();
                if let Some(&last) = map.get(&to_id) {
                    if last.elapsed() < COOLDOWN {
                        return (
                            StatusCode::OK,
                            Json(rpc_error(
                                id,
                                -32016,
                                format!("Faucet cooldown: try again in {} seconds.", (COOLDOWN.as_secs()).saturating_sub(last.elapsed().as_secs())),
                            )),
                        );
                    }
                }
                map.insert(to_id, Instant::now());
            }

            let faucet_id = testnet_faucet_account_id();
            let n = node.write().await;
            let (nonce, balance_ok) = match n.state.get(&faucet_id) {
                Some(s) => (s.nonce, s.balance >= faucet::FAUCET_DISPENSE_AMOUNT),
                None => {
                    return (StatusCode::OK, Json(rpc_error(id, -32000, "Faucet account not initialized.".into())));
                }
            };
            if !balance_ok {
                return (StatusCode::OK, Json(rpc_error(id, -32000, "Faucet balance too low.".into())));
            }
            let tx = Transaction {
                nonce,
                sender: faucet_id,
                payload: TransactionPayload::Transfer {
                    to: to_id,
                    amount: faucet::FAUCET_DISPENSE_AMOUNT,
                },
                access_list: AccessList::new(vec![faucet_id, to_id], vec![faucet_id, to_id]),
            };
            let signed = SignedTransaction::new(tx, faucet_signer.as_ref());
            drop(n);
            let n = node.write().await;
            match n.submit_transaction(signed) {
                Ok(()) => {
                    info!("RPC: faucet sent {} to {}", faucet::FAUCET_DISPENSE_AMOUNT, hex::encode(to_id.0));
                    rpc_ok(id, serde_json::json!({
                        "ok": true,
                        "amount": faucet::FAUCET_DISPENSE_AMOUNT,
                        "to": hex::encode(to_id.0),
                        "message": "Check your wallet; tx is in the mempool."
                    }))
                }
                Err(e) => rpc_error(id, -32000, format!("Faucet submit failed: {}", e)),
            }
        }
        _ => rpc_error(
            id,
            -32601,
            format!("Method not found: {}", req.method),
        ),
    };

    (StatusCode::OK, Json(result))
}

/// Build the RPC router.
/// When `rate_limit` has `requests_per_sec > 0`, applies global rate limiting.
/// When `faucet_signer` is Some, enables boing_faucetRequest (testnet only).
pub fn rpc_router(
    node: NodeState,
    rate_limit: &RateLimitConfig,
    faucet_signer: Option<Arc<ed25519_dalek::SigningKey>>,
    operator_rpc_token: Option<Arc<str>>,
) -> Router {
    let rate_limiter = if rate_limit.requests_per_sec > 0 {
        let rps = NonZeroU32::new(rate_limit.requests_per_sec.max(1)).unwrap_or_else(|| NonZeroU32::new(1).unwrap());
        let burst = NonZeroU32::new(rate_limit.requests_per_sec.saturating_mul(2).max(10)).unwrap_or(rps);
        let quota = Quota::per_second(rps).allow_burst(burst);
        Some(Arc::new(RateLimiter::direct(quota)))
    } else {
        None
    };

    let (faucet_signer, faucet_cooldown) = if faucet_signer.is_some() {
        (faucet_signer, Some(Arc::new(std::sync::Mutex::new(HashMap::new()))))
    } else {
        (None, None)
    };

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(vec![
            HeaderValue::from_static("https://boing.observer"),
            HeaderValue::from_static("https://boing.express"),
            HeaderValue::from_static("https://boing.network"),
            HeaderValue::from_static("https://www.boing.network"),
            HeaderValue::from_static("https://boing.finance"),
            HeaderValue::from_static("https://www.boing.finance"),
            HeaderValue::from_static("https://bootnode2.boing.network"),
            HeaderValue::from_static("https://testnet-rpc-2.boing.network"),
            HeaderValue::from_static("http://localhost:3000"),
            HeaderValue::from_static("http://localhost:4321"),
            HeaderValue::from_static("http://127.0.0.1:3000"),
            HeaderValue::from_static("http://127.0.0.1:4321"),
            HeaderValue::from_static("http://localhost:5173"),
            HeaderValue::from_static("http://127.0.0.1:5173"),
        ]))
        .allow_methods([Method::POST, Method::OPTIONS])
        .allow_headers([
            CONTENT_TYPE,
            HeaderName::from_static("x-boing-operator"),
        ]);

    Router::new()
        .route("/", post(handle_rpc))
        .layer(cors)
        .with_state(RpcState {
            node,
            rate_limiter,
            faucet_signer,
            faucet_cooldown,
            operator_rpc_token,
        })
}
