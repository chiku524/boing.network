//! Shared structured [`tracing`] fields for Boing workspace crates.
//!
//! Use stable keys for log aggregation: `boing_component`, `component_event`, `error_message`.
//! Avoid dotted keys (e.g. `boing.component`) — they break `tracing` macro parsing.

/// Warning on an operational / semantic error path.
pub fn component_warn(
    target: &'static str,
    boing_component: &'static str,
    component_event: &'static str,
    error_message: impl std::fmt::Display,
) {
    tracing::warn!(
        target = target,
        boing_component = boing_component,
        component_event = component_event,
        error_message = %error_message,
        "Boing component warning"
    );
}

/// Error-level structured log.
pub fn component_error(
    target: &'static str,
    boing_component: &'static str,
    component_event: &'static str,
    error_message: impl std::fmt::Display,
) {
    tracing::error!(
        target = target,
        boing_component = boing_component,
        component_event = component_event,
        error_message = %error_message,
        "Boing component error"
    );
}

/// Info-level structured log (lifecycle / milestones).
pub fn component_info(
    target: &'static str,
    boing_component: &'static str,
    component_event: &'static str,
    message: &'static str,
) {
    tracing::info!(
        target = target,
        boing_component = boing_component,
        component_event = component_event,
        message,
    );
}

/// Structured debug (same key names as warnings; enable with `RUST_LOG=...=debug`).
pub fn component_debug(
    target: &'static str,
    boing_component: &'static str,
    component_event: &'static str,
    message: &'static str,
) {
    tracing::debug!(
        target = target,
        boing_component = boing_component,
        component_event = component_event,
        message,
    );
}

/// JSON-RPC HTTP error envelope (node). `jsonrpc_id` is usually `Option<serde_json::Value>` at the call site.
pub fn jsonrpc_error_response(
    method: &str,
    jsonrpc_id: &impl std::fmt::Debug,
    code: i32,
    err_message: &str,
    has_data: bool,
    http_status: u16,
) {
    tracing::warn!(
        target = "boing_node::rpc",
        boing_component = "jsonrpc",
        component_event = "jsonrpc_error_response",
        rpc_method = %method,
        rpc_jsonrpc_id = ?jsonrpc_id,
        rpc_error_code = code,
        rpc_error_message = %err_message,
        rpc_error_has_data = has_data,
        http_status = http_status,
        "JSON-RPC error response"
    );
}
