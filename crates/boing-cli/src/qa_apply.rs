//! `boing qa apply` — push QA registry and pool config via `boing_operatorApplyQaPolicy`.

use std::path::Path;

use serde_json::json;

pub async fn run(
    rpc_url: &str,
    registry_path: &Path,
    pool_path: &Path,
    operator_token: Option<&str>,
) -> anyhow::Result<()> {
    let registry_json = std::fs::read_to_string(registry_path)
        .map_err(|e| anyhow::anyhow!("read --registry: {}", e))?;
    let pool_json =
        std::fs::read_to_string(pool_path).map_err(|e| anyhow::anyhow!("read --pool: {}", e))?;

    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "boing_operatorApplyQaPolicy",
        "params": [registry_json, pool_json]
    });

    let client = reqwest::Client::new();
    let mut req = client.post(rpc_url).json(&body);
    if let Some(t) = operator_token {
        req = req.header("X-Boing-Operator", t);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Cannot connect to {}: {}. Is the node running?", rpc_url, e))?;

    if !resp.status().is_success() {
        anyhow::bail!("RPC returned {}: {}", resp.status(), resp.text().await?);
    }

    let text = resp.text().await?;
    let parsed: serde_json::Value = serde_json::from_str(&text)?;

    if let Some(err) = parsed.get("error") {
        let code = err.get("code").and_then(|v| v.as_i64()).unwrap_or(0);
        let msg = err.get("message").and_then(|v| v.as_str()).unwrap_or("Unknown error");
        anyhow::bail!("RPC error {}: {}", code, msg);
    }

    let ok = parsed
        .get("result")
        .and_then(|r| r.get("ok"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if ok {
        println!("✓ Applied QA policy on node (registry + pool config)");
    } else {
        println!("Unexpected result; check node logs. Body: {}", text);
    }

    Ok(())
}
