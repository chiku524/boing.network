//! `boing dev` — Start local dev chain.
//!
//! Tries, in order: (1) `boing-node` next to this binary, (2) `boing-node` in PATH,
//! (3) `cargo run -p boing-node` when run from repo.

use std::path::PathBuf;
use std::process::{Command, Stdio};

use tracing::info;

/// Resolve the boing-node executable: same-dir, then PATH, then None (use cargo).
fn find_boing_node() -> Option<PathBuf> {
    // Same directory as the running `boing` binary (e.g. target/release/)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let node = parent.join("boing-node");
            if node.is_file() {
                return Some(node);
            }
            #[cfg(windows)]
            {
                let node_exe = parent.join("boing-node.exe");
                if node_exe.is_file() {
                    return Some(node_exe);
                }
            }
        }
    }
    // PATH
    which::which("boing-node").ok()
}

pub async fn run(port: u16) -> anyhow::Result<()> {
    let node_args = [
        "--validator",
        "--rpc-port",
        &port.to_string(),
        "--data-dir",
        "./.boing-dev-data",
    ];

    let (mut child, used_cargo) = if let Some(node_path) = find_boing_node() {
        info!("Using boing-node at {}", node_path.display());
        let child = Command::new(&node_path)
            .args(node_args)
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| {
                boing_telemetry::component_warn(
                    "boing_cli::dev",
                    "cli",
                    "spawn_boing_node_failed",
                    format!("{}: {e}", node_path.display()),
                );
                anyhow::anyhow!(
                    "Failed to start boing-node at {}: {}",
                    node_path.display(),
                    e
                )
            })?;
        (child, false)
    } else {
        // Fallback: run from repo via cargo
        info!("boing-node not in PATH; using cargo run -p boing-node (run from repo root)");
        let child = Command::new("cargo")
            .args([
                "run",
                "-p",
                "boing-node",
                "--",
                "--validator",
                "--rpc-port",
                &port.to_string(),
                "--data-dir",
                "./.boing-dev-data",
            ])
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| {
                boing_telemetry::component_warn(
                    "boing_cli::dev",
                    "cli",
                    "spawn_cargo_boing_node_failed",
                    &e,
                );
                anyhow::anyhow!(
                    "Failed to run `cargo run -p boing-node`: {}. Install boing-node or run from the repo root.",
                    e
                )
            })?;
        (child, true)
    };

    info!("Started Boing dev node on port {}", port);
    println!("✓ Boing dev chain running at http://127.0.0.1:{}", port);
    println!("  RPC: boing_submitTransaction, boing_chainHeight, boing_simulateTransaction");
    println!("  Genesis proposer funded with 1,000,000 BOING");
    if used_cargo {
        println!("  Tip: install binaries with `cargo install --path crates/boing-cli` and `cargo install --path crates/boing-node` for `boing dev` without repo.");
    }
    println!("  Press Ctrl+C to stop");

    let status = child.wait();
    if let Err(e) = status {
        boing_telemetry::component_warn("boing_cli::dev", "cli", "wait_boing_node_failed", &e);
    }

    Ok(())
}
