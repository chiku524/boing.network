//! Print **predicted CREATE2** addresses for the **native CP pool (v1)** and **native DEX aux** contracts
//! for a given **deployer** `AccountId` (64 hex chars). Use after `generate-operator-key` to refresh
//! repo constants (`sync-canonical-testnet-from-manifest.mjs`).
//!
//! ```bash
//! cargo run -p boing-execution --example print_native_create2_manifest -- 0x<DEPLOYER_64_HEX>
//! cargo run -p boing-execution --example print_native_create2_manifest -- 0x... > scripts/canonical-testnet-published.manifest.json
//! ```

use boing_execution::{
    constant_product_pool_bytecode, lp_share_token_bytecode, native_amm_lp_vault_bytecode,
    native_dex_factory_bytecode, native_dex_ledger_router_bytecode,
    native_dex_ledger_router_bytecode_v2, native_dex_ledger_router_bytecode_v3,
    native_dex_multihop_swap_router_bytecode, NATIVE_AMM_LP_VAULT_CREATE2_SALT_V1,
    NATIVE_CP_POOL_CREATE2_SALT_V1, NATIVE_DEX_FACTORY_CREATE2_SALT_V1,
    NATIVE_DEX_LEDGER_ROUTER_CREATE2_SALT_V1, NATIVE_DEX_LEDGER_ROUTER_CREATE2_SALT_V2,
    NATIVE_DEX_LEDGER_ROUTER_CREATE2_SALT_V3, NATIVE_DEX_MULTIHOP_SWAP_ROUTER_CREATE2_SALT_V1,
    NATIVE_LP_SHARE_TOKEN_CREATE2_SALT_V1,
};
use boing_primitives::{create2_contract_address, AccountId};

fn parse_deployer_hex(s: &str) -> AccountId {
    let raw = s.trim().trim_start_matches("0x").trim_start_matches("0X");
    let v = hex::decode(raw).unwrap_or_else(|e| {
        eprintln!("invalid deployer hex: {e}");
        std::process::exit(2);
    });
    if v.len() != 32 {
        eprintln!("deployer must be 32 bytes, got {}", v.len());
        std::process::exit(2);
    }
    let mut a = [0u8; 32];
    a.copy_from_slice(&v);
    AccountId(a)
}

fn main() {
    let deployer_hex = std::env::args().nth(1).unwrap_or_else(|| {
        eprintln!(
            "usage: cargo run -p boing-execution --example print_native_create2_manifest -- 0x<DEPLOYER_64_HEX>"
        );
        std::process::exit(2);
    });

    let deployer = parse_deployer_hex(&deployer_hex);
    let pool_bc = constant_product_pool_bytecode();
    let pool = create2_contract_address(&deployer, &NATIVE_CP_POOL_CREATE2_SALT_V1, &pool_bc);

    let factory = create2_contract_address(
        &deployer,
        &NATIVE_DEX_FACTORY_CREATE2_SALT_V1,
        &native_dex_factory_bytecode(),
    );
    let lr1 = create2_contract_address(
        &deployer,
        &NATIVE_DEX_LEDGER_ROUTER_CREATE2_SALT_V1,
        &native_dex_ledger_router_bytecode(),
    );
    let lr2 = create2_contract_address(
        &deployer,
        &NATIVE_DEX_LEDGER_ROUTER_CREATE2_SALT_V2,
        &native_dex_ledger_router_bytecode_v2(),
    );
    let lr3 = create2_contract_address(
        &deployer,
        &NATIVE_DEX_LEDGER_ROUTER_CREATE2_SALT_V3,
        &native_dex_ledger_router_bytecode_v3(),
    );
    let mh = create2_contract_address(
        &deployer,
        &NATIVE_DEX_MULTIHOP_SWAP_ROUTER_CREATE2_SALT_V1,
        &native_dex_multihop_swap_router_bytecode(),
    );
    let vault = create2_contract_address(
        &deployer,
        &NATIVE_AMM_LP_VAULT_CREATE2_SALT_V1,
        &native_amm_lp_vault_bytecode(),
    );
    let share = create2_contract_address(
        &deployer,
        &NATIVE_LP_SHARE_TOKEN_CREATE2_SALT_V1,
        &lp_share_token_bytecode(),
    );

    println!(
        "{}",
        serde_json::json!({
            "_comment": "Regenerate: cargo run -p boing-execution --example print_native_create2_manifest -- <DEPLOYER_HEX>; then: node scripts/sync-canonical-testnet-from-manifest.mjs <this-file>",
            "deployer": format!("0x{}", hex::encode(deployer.0)),
            "native_cp_pool_v1": format!("0x{}", hex::encode(pool.0)),
            "native_dex_factory": format!("0x{}", hex::encode(factory.0)),
            "native_dex_ledger_router_v1": format!("0x{}", hex::encode(lr1.0)),
            "native_dex_ledger_router_v2": format!("0x{}", hex::encode(lr2.0)),
            "native_dex_ledger_router_v3": format!("0x{}", hex::encode(lr3.0)),
            "native_dex_multihop_swap_router": format!("0x{}", hex::encode(mh.0)),
            "native_amm_lp_vault": format!("0x{}", hex::encode(vault.0)),
            "native_lp_share_token": format!("0x{}", hex::encode(share.0)),
        })
    );
}
