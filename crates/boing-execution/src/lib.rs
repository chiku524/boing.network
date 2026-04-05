//! Boing Execution — VM and parallel transaction scheduler
//!
//! Declared dependencies (access lists) enable deterministic parallel execution.

mod bytecode;
mod executor;
mod gas;
mod interpreter;
mod native_amm;
mod parallel;
pub mod reference_nft;
pub mod reference_token;
mod scheduler;
mod vm;

pub use bytecode::{gas as bytecode_gas, Opcode};
pub use executor::{BlockExecutor, ExecutionError};
pub use gas::GasConfig;
pub use interpreter::{Interpreter, StorageAccess, MAX_CALL_DEPTH};
pub use parallel::ExecutionView;
pub use scheduler::TransactionScheduler;
pub use reference_nft::{
    encode_owner_of_calldata, encode_set_metadata_hash_calldata, encode_transfer_nft_calldata,
    ref_nft_collection_admin_key, reference_nft_collection_template_bytecode,
    REF_NFT_METADATA_STORAGE_XOR, REF_NFT_OWNER_STORAGE_XOR, SELECTOR_OWNER_OF,
    SELECTOR_SET_METADATA_HASH, SELECTOR_TRANSFER_NFT, token_id_word,
};
pub use reference_token::{
    encode_mint_first_calldata, encode_transfer_calldata, ref_fungible_admin_key,
    ref_fungible_mint_once_key, reference_fungible_template_bytecode, smoke_contract_bytecode,
    REF_FUNGIBLE_BALANCE_XOR, SELECTOR_MINT_FIRST, SELECTOR_TRANSFER,
};
pub use native_amm::{
    constant_product_amount_out, constant_product_amount_out_after_fee,
    constant_product_amount_out_after_fee_with_bps, constant_product_pool_bytecode,
    constant_product_pool_bytecode_v2, constant_product_pool_bytecode_v3, constant_product_pool_bytecode_v4,
    encode_add_liquidity_calldata, encode_remove_liquidity_calldata, encode_set_swap_fee_bps_calldata,
    encode_set_tokens_calldata, encode_swap_calldata, lp_balance_storage_key, reserve_a_key, reserve_b_key,
    swap_fee_bps_key, token_a_key, token_b_key, tokens_configured_key, total_lp_supply_key,
    LP_BALANCE_STORAGE_XOR, NATIVE_AMM_TOPIC_ADD_LIQUIDITY, NATIVE_AMM_TOPIC_REMOVE_LIQUIDITY,
    NATIVE_AMM_TOPIC_SWAP, NATIVE_CP_POOL_CREATE2_SALT_V1, NATIVE_CP_POOL_CREATE2_SALT_V2,
    NATIVE_CP_POOL_CREATE2_SALT_V3, NATIVE_CP_POOL_CREATE2_SALT_V4, NATIVE_CP_SWAP_FEE_BPS,
    SELECTOR_ADD_LIQUIDITY, SELECTOR_REMOVE_LIQUIDITY, SELECTOR_SET_SWAP_FEE_BPS, SELECTOR_SET_TOKENS,
    SELECTOR_SWAP,
};
pub use vm::{TransferState, Vm, VmError, VmExecutionResult};
pub use boing_primitives::{Transaction, AccessList};
