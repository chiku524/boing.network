//! Print `0x`-hex of **reference-token / reference-NFT** bytecode for ops / CI / debugging.
//!
//! - [`boing_execution::smoke_contract_bytecode`] — **not** a user fungible (no balances).
//! - [`boing_execution::reference_fungible_template_bytecode`] — balances + `transfer` / `mint_first`
//!   ([BOING-REFERENCE-TOKEN.md](../../docs/BOING-REFERENCE-TOKEN.md)); deploy with purpose **`token`**.
//! - [`boing_execution::reference_nft_collection_template_bytecode`] — minimal **collection**
//!   implementing [BOING-REFERENCE-NFT.md](../../docs/BOING-REFERENCE-NFT.md) selectors (`owner_of`,
//!   `transfer_nft`, `set_metadata_hash`) + lazy admin; deploy with purpose **`nft`** / **`NFT`**.
//!
//! ```text
//! cargo run -p boing-execution --example dump_reference_token_artifacts
//! ```
//!
//! Stdout: line **1** = smoke, line **2** = fungible template, line **3** = NFT collection.

fn print_hex(label: &str, code: &[u8]) {
    eprintln!("// {label}: {} bytes", code.len());
    print!("0x");
    for b in code {
        print!("{b:02x}");
    }
    println!();
}

fn main() {
    print_hex(
        "smoke_contract_bytecode (tests / pool hooks only — not a balances token)",
        &boing_execution::smoke_contract_bytecode(),
    );
    print_hex(
        "reference_fungible_template_bytecode (QA: purpose token)",
        &boing_execution::reference_fungible_template_bytecode(),
    );
    print_hex(
        "reference_nft_collection_template_bytecode (QA: purpose nft/NFT)",
        &boing_execution::reference_nft_collection_template_bytecode(),
    );
}
