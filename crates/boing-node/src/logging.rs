//! Structured tracing for the Boing node (`RUST_LOG`, default `info` in `main`).
//!
//! Stable field names match [`boing_telemetry`]: `boing_component`, `component_event`, `error_message`.
//!
//! Each HTTP JSON-RPC request also opens a tracing span **`rpc_http`** with **`method`**, **`path`**, and
//! **`request_id`** (from `x-request-id`) for correlating logs with clients.
//!
//! Plain-HTTP discovery (**`GET /openapi.json`**, **`GET /.well-known/boing-rpc`**) and JSON probes (**`/live.json`**, **`/ready.json`**) share the same middleware stack and headers where applicable.

/// P2P / network path failures (import, gossip admission, sync request).
pub fn log_p2p_event_warn(event: &'static str, error: &impl std::fmt::Display) {
    boing_telemetry::component_warn("boing_node::p2p", "p2p", event, error);
}

/// Persistence failures (disk / fs).
pub fn log_persistence_warn(operation: &'static str, error: &impl std::fmt::Display) {
    boing_telemetry::component_warn("boing_node::persistence", "persistence", operation, error);
}

/// Startup / fatal-style node errors.
pub fn log_node_error(context: &'static str, error: &impl std::fmt::Display) {
    boing_telemetry::component_error("boing_node", "node", context, error);
}
