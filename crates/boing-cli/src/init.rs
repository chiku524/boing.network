//! `boing init` — Scaffold a new dApp project.

use std::fs;
use std::path::Path;

use tracing::info;

const TEMPLATE_CARGO: &str = r#"[package]
name = "{{name}}"
version = "0.1.0"
edition = "2021"
description = "dApp on Boing Network"

[dependencies]
# Add boing-network dependencies when publishing to crates.io

[lib]
crate-type = ["cdylib", "rlib"]
"#;

const TEMPLATE_README: &str = r#"# My Boing dApp

Built with [Boing SDK](https://github.com/chiku524/boing.network).

## Quick Start

```bash
boing dev          # Start local chain
boing deploy .     # Deploy to network
```

## Project Structure

- `src/` — Contract source
- `Cargo.toml` — Dependencies
"#;

const TEMPLATE_CONFIG: &str = r#"{
  "network": "local",
  "rpcUrl": "http://127.0.0.1:8545",
  "chainId": 1
}
"#;

/// Project name must be a valid directory/crate name: alphanumeric, hyphen, underscore.
fn validate_project_name(name: &str) -> anyhow::Result<()> {
    if name.is_empty() {
        anyhow::bail!("Project name cannot be empty");
    }
    if name.len() > 64 {
        anyhow::bail!("Project name must be at most 64 characters");
    }
    let valid = name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if !valid {
        anyhow::bail!(
            "Project name may only contain letters, numbers, hyphens, and underscores (got: {:?})",
            name
        );
    }
    if name.starts_with('-') || name.starts_with('_') {
        anyhow::bail!("Project name cannot start with '-' or '_'");
    }
    Ok(())
}

pub fn run(name: Option<String>, output: Option<String>) -> anyhow::Result<()> {
    let proj_name = name.unwrap_or_else(|| "my-boing-dapp".into());
    validate_project_name(&proj_name)?;

    let out_dir = output.unwrap_or_else(|| format!("./{}", proj_name));
    let out = Path::new(&out_dir);

    if out.exists() && out.read_dir()?.next().is_some() {
        anyhow::bail!("Directory {} is not empty. Use a different path or empty the directory.", out.display());
    }

    fs::create_dir_all(out)?;
    fs::create_dir_all(out.join("src"))?;

    let crate_name = proj_name.replace('-', "_");
    let cargo_content = TEMPLATE_CARGO.replace("{{name}}", &crate_name);
    fs::write(out.join("Cargo.toml"), cargo_content)?;
    fs::write(out.join("README.md"), TEMPLATE_README.replace("My Boing dApp", &proj_name))?;
    fs::write(out.join("boing.json"), TEMPLATE_CONFIG)?;
    fs::write(out.join("src").join("lib.rs"), "//! Boing dApp contract\n\n// Add your contract logic here\n")?;

    info!("Created project {} at {}", proj_name, out.display());
    println!("✓ Created project '{}' at {}", proj_name, out.display());
    println!("  Next: cd {} && boing dev", out_dir);

    Ok(())
}
