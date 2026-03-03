//! Boing VM — deterministic execution engine.

use boing_primitives::{hasher, AccountId, AccountState, Transaction, TransactionPayload};
use boing_state::StateStore;
use boing_qa::{check_contract_deploy, DEFAULT_MAX_BYTECODE_SIZE};

use crate::gas::base;
use super::interpreter::Interpreter;

/// Gas used by a transaction.
pub const GAS_PER_TRANSFER: u64 = 21_000;
pub const GAS_PER_CONTRACT_CALL: u64 = 100_000;
pub const GAS_PER_CONTRACT_DEPLOY: u64 = 200_000;

/// Minimal state for Transfer-only execution (used by parallel path).
pub trait TransferState {
    fn get(&self, id: &AccountId) -> Option<AccountState>;
    fn get_mut(&mut self, id: &AccountId) -> Option<&mut AccountState>;
    fn insert(&mut self, account: boing_primitives::Account);
}

impl TransferState for StateStore {
    fn get(&self, id: &AccountId) -> Option<AccountState> {
        self.get(id).cloned()
    }
    fn get_mut(&mut self, id: &AccountId) -> Option<&mut AccountState> {
        self.get_mut(id)
    }
    fn insert(&mut self, account: boing_primitives::Account) {
        self.insert(account);
    }
}

impl TransferState for super::parallel::ExecutionView {
    fn get(&self, id: &AccountId) -> Option<AccountState> {
        self.get(id)
    }
    fn get_mut(&mut self, id: &AccountId) -> Option<&mut AccountState> {
        self.get_mut(id)
    }
    fn insert(&mut self, account: boing_primitives::Account) {
        self.insert(account);
    }
}

/// Virtual machine for executing transactions.
pub struct Vm;

impl Vm {
    pub fn new() -> Self {
        Self
    }

    /// Execute Transfer tx against any TransferState (for parallel path).
    pub fn execute_transfer<S: TransferState>(
        &self,
        tx: &Transaction,
        state: &mut S,
    ) -> Result<u64, VmError> {
        let sender_state = state.get(&tx.sender).ok_or(VmError::AccountNotFound)?;
        if sender_state.nonce != tx.nonce {
            return Err(VmError::InvalidNonce {
                expected: sender_state.nonce,
                got: tx.nonce,
            });
        }
        let TransactionPayload::Transfer { to, amount } = &tx.payload else {
            return Err(VmError::NotImplemented("Not a Transfer"));
        };
        let sender_state = state.get_mut(&tx.sender).ok_or(VmError::AccountNotFound)?;
        sender_state.balance = sender_state
            .balance
            .checked_sub(*amount)
            .ok_or(VmError::InsufficientBalance)?;
        sender_state.nonce = sender_state
            .nonce
            .checked_add(1)
            .ok_or(VmError::NonceOverflow)?;
        let to_state = state.get_mut(to);
        match to_state {
            Some(s) => s.balance = s.balance.saturating_add(*amount),
            None => {
                state.insert(boing_primitives::Account {
                    id: *to,
                    state: boing_primitives::AccountState {
                        balance: *amount,
                        nonce: 0,
                        stake: 0,
                    },
                });
            }
        }
        Ok(GAS_PER_TRANSFER)
    }

    /// Execute a single transaction against the state.
    pub fn execute(&self, tx: &Transaction, state: &mut StateStore) -> Result<u64, VmError> {
        // Nonce validation
        let sender_state = state.get(&tx.sender).ok_or(VmError::AccountNotFound)?;
        if sender_state.nonce != tx.nonce {
            return Err(VmError::InvalidNonce {
                expected: sender_state.nonce,
                got: tx.nonce,
            });
        }

        let gas_used = match &tx.payload {
            TransactionPayload::Bond { amount } => {
                let sender_state = state.get_mut(&tx.sender).ok_or(VmError::AccountNotFound)?;
                sender_state.balance = sender_state
                    .balance
                    .checked_sub(*amount)
                    .ok_or(VmError::InsufficientBalance)?;
                sender_state.stake = sender_state.stake.saturating_add(*amount);
                sender_state.nonce = sender_state
                    .nonce
                    .checked_add(1)
                    .ok_or(VmError::NonceOverflow)?;
                base::BOND
            }
            TransactionPayload::Unbond { amount } => {
                let sender_state = state.get_mut(&tx.sender).ok_or(VmError::AccountNotFound)?;
                sender_state.stake = sender_state
                    .stake
                    .checked_sub(*amount)
                    .ok_or(VmError::InsufficientBalance)?;
                sender_state.balance = sender_state.balance.saturating_add(*amount);
                sender_state.nonce = sender_state
                    .nonce
                    .checked_add(1)
                    .ok_or(VmError::NonceOverflow)?;
                base::UNBOND
            }
            TransactionPayload::Transfer { to, amount } => {
                let sender_state = state.get_mut(&tx.sender).ok_or(VmError::AccountNotFound)?;
                sender_state.balance = sender_state
                    .balance
                    .checked_sub(*amount)
                    .ok_or(VmError::InsufficientBalance)?;
                sender_state.nonce = sender_state
                    .nonce
                    .checked_add(1)
                    .ok_or(VmError::NonceOverflow)?;

                let to_state = state.get_mut(to);
                match to_state {
                    Some(s) => {
                        s.balance = s.balance.saturating_add(*amount);
                    }
                    None => {
                        state.insert(boing_primitives::Account {
                            id: *to,
                            state: boing_primitives::AccountState {
                                balance: *amount,
                                nonce: 0,
                                stake: 0,
                            },
                        });
                    }
                }
                GAS_PER_TRANSFER
            }
            TransactionPayload::ContractCall { contract, calldata } => {
                self.execute_contract_call(state, tx, contract, calldata)?
            }
            TransactionPayload::ContractDeploy { bytecode }
            | TransactionPayload::ContractDeployWithPurpose { bytecode, .. }
            | TransactionPayload::ContractDeployWithPurposeAndMetadata { bytecode, .. } => {
                self.execute_contract_deploy(state, tx, bytecode)?
            }
        };
        Ok(gas_used)
    }

    fn execute_contract_deploy(&self, state: &mut StateStore, tx: &Transaction, bytecode: &[u8]) -> Result<u64, VmError> {
        // Defense in depth: run QA check before applying. Mempool already rejected bad deploys, but
        // blocks could come from network; this ensures we never apply bytecode that fails QA.
        match check_contract_deploy(bytecode, None, None, DEFAULT_MAX_BYTECODE_SIZE) {
            boing_qa::QaResult::Allow => {}
            boing_qa::QaResult::Reject(r) => {
                return Err(VmError::QaRejected {
                    rule_id: r.rule_id.0,
                    message: r.message,
                });
            }
            boing_qa::QaResult::Unsure => {
                return Err(VmError::QaPendingPool);
            }
        }

        let sender_state = state.get_mut(&tx.sender).ok_or(VmError::AccountNotFound)?;
        sender_state.nonce = sender_state
            .nonce
            .checked_add(1)
            .ok_or(VmError::NonceOverflow)?;

        let contract_addr = derive_contract_address(&tx.sender, tx.nonce);
        state.insert(boing_primitives::Account {
            id: contract_addr,
            state: boing_primitives::AccountState { balance: 0, nonce: 0, stake: 0 },
        });
        state.set_contract_code(contract_addr, bytecode.to_vec());
        Ok(GAS_PER_CONTRACT_DEPLOY)
    }

    fn execute_contract_call(
        &self,
        state: &mut StateStore,
        tx: &Transaction,
        contract: &AccountId,
        calldata: &[u8],
    ) -> Result<u64, VmError> {
        let sender_state = state.get_mut(&tx.sender).ok_or(VmError::AccountNotFound)?;
        sender_state.nonce = sender_state
            .nonce
            .checked_add(1)
            .ok_or(VmError::NonceOverflow)?;

        let code = state.get_contract_code(contract).ok_or(VmError::AccountNotFound)?.clone();
        let mut interpreter = Interpreter::new(code, GAS_PER_CONTRACT_CALL);
        let gas_used = interpreter.run(*contract, calldata, state)?;
        Ok(gas_used)
    }
}

impl Default for Vm {
    fn default() -> Self {
        Self::new()
    }
}

fn derive_contract_address(sender: &AccountId, nonce: u64) -> AccountId {
    let mut h = hasher();
    h.update(&sender.0);
    h.update(&nonce.to_le_bytes());
    let mut out = [0u8; 32];
    out.copy_from_slice(h.finalize().as_bytes());
    AccountId(out)
}

#[derive(Debug, thiserror::Error)]
pub enum VmError {
    #[error("Account not found")]
    AccountNotFound,
    #[error("Insufficient balance")]
    InsufficientBalance,
    #[error("Nonce overflow")]
    NonceOverflow,
    #[error("Invalid nonce: expected {expected}, got {got}")]
    InvalidNonce { expected: u64, got: u64 },
    #[error("Not implemented: {0}")]
    NotImplemented(&'static str),
    #[error("Out of gas")]
    OutOfGas,
    #[error("Stack underflow")]
    StackUnderflow,
    #[error("Invalid bytecode")]
    InvalidBytecode,
    #[error("Invalid jump destination")]
    InvalidJump,
    #[error("QA rejected: {rule_id} — {message}")]
    QaRejected { rule_id: String, message: String },
    #[error("QA pending pool (deployment referred to community)")]
    QaPendingPool,
}
