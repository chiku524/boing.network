# Boing Network — Technical Specification

> **Purpose:** Single source of truth for all technical specifications: software stack, cryptography, data formats, bytecode, gas, RPC API, and protocol rules.  
> **References:** [BOING-NETWORK-ESSENTIALS.md](BOING-NETWORK-ESSENTIALS.md), [RPC-API-SPEC.md](RPC-API-SPEC.md), [QUALITY-ASSURANCE-NETWORK.md](QUALITY-ASSURANCE-NETWORK.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Cryptography](#3-cryptography)
4. [Data Structures](#4-data-structures)
5. [Serialization (Bincode)](#5-serialization-bincode)
6. [Transaction Signing](#6-transaction-signing)
7. [VM & Bytecode](#7-vm--bytecode)
8. [Gas Model](#8-gas-model)
9. [Protocol QA Rules](#9-protocol-qa-rules)
10. [Block & Ledger Structure](#10-block--ledger-structure)
11. [JSON-RPC API](#11-json-rpc-api)
12. [Networking](#12-networking)
13. [Implementation Crates](#13-implementation-crates)
14. [Cross-References](#14-cross-references)

---

## 1. Overview

Boing Network is an **L1 blockchain** built from first principles in Rust. It uses a custom stack-based VM, BLAKE3 for hashing, Ed25519 for signatures, PoS + HotStuff BFT for consensus, and protocol-enforced quality assurance for deployments.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| **Language** | Rust |
| **Hashing** | BLAKE3 |
| **Signatures** | Ed25519 (64-byte) |
| **Consensus** | PoS + HotStuff BFT |
| **State** | Sparse Merkle tree (Verkle target) |
| **Execution** | Custom VM (stack-based; opcodes inspired by EVM, simplified) |
| **Networking** | libp2p (TCP, Noise, gossipsub, request-response) |
| **Governance** | Phased (proposal → cooling → execution); time-locked |

---

## 3. Cryptography

### 3.1 Hashing — BLAKE3

- **Algorithm:** BLAKE3
- **Output:** 32 bytes
- **Usage:** Transaction ID, block hash, signable message, Merkle roots, account proofs

### 3.2 Signatures — Ed25519

- **Algorithm:** Ed25519 (ed25519-dalek)
- **Signature size:** 64 bytes
- **Public key:** 32 bytes (used as `AccountId`)
- **Usage:** Transaction authorization; sender's `AccountId` must equal signer's public key

### 3.3 Address (AccountId)

- **Size:** 32 bytes
- **Display:** 64 hex characters (optional `0x` prefix)
- **Derivation:** Typically from Ed25519 public key; raw 32 bytes otherwise

---

## 4. Data Structures

### 4.1 AccountId

```text
AccountId = [u8; 32]
```

32-byte opaque identifier. Typically derived from Ed25519 public key.

### 4.2 AccessList

```text
AccessList = {
  read:  Vec<AccountId>,
  write: Vec<AccountId>,
}
```

Declares accounts this transaction reads/writes. Enables parallel scheduling (txs with disjoint access lists run in parallel).

### 4.3 Transaction

```text
Transaction = {
  nonce:       u64,
  sender:      AccountId,
  payload:     TransactionPayload,
  access_list: AccessList,
}
```

**Transaction ID:** `BLAKE3(bincode(Transaction))` (32 bytes).

### 4.4 TransactionPayload

```text
TransactionPayload = enum {
  Transfer { to: AccountId, amount: u128 },
  Bond { amount: u128 },
  Unbond { amount: u128 },
  ContractCall { contract: AccountId, calldata: Vec<u8> },
  ContractDeploy { bytecode: Vec<u8> },
  ContractDeployWithPurpose {
    bytecode:           Vec<u8>,
    purpose_category:   String,
    description_hash:   Option<Vec<u8>>,
  },
}
```

### 4.5 AccountState

```text
AccountState = {
  balance: u128,
  nonce:   u64,
  stake:   u128,
}
```

- **balance:** Spendable BOING (smallest units)
- **nonce:** Sequence number for replay protection
- **stake:** Bonded stake (for validation)

### 4.6 Account

```text
Account = {
  id:    AccountId,
  state: AccountState,
}
```

### 4.7 BlockHeader

```text
BlockHeader = {
  parent_hash: Hash,
  height:      u64,
  timestamp:   u64,
  proposer:    AccountId,
  tx_root:     Hash,
  state_root:  Hash,
}
```

### 4.8 Block

```text
Block = {
  header:       BlockHeader,
  transactions: Vec<Transaction>,
}
```

**Block hash:** `BLAKE3(bincode(BlockHeader))`.

**Transaction root:** Merkle root of `tx.id()` for all transactions (binary tree).

### 4.9 SignedTransaction

```text
SignedTransaction = {
  tx:        Transaction,
  signature: Signature,
}
```

**Signature:** 64-byte Ed25519 over signable hash (see [§6 Transaction Signing](#6-transaction-signing)).

---

## 5. Serialization (Bincode)

All on-wire and stored structures use **bincode** (little-endian, compact format).

- **Transaction:** `bincode::serialize(&tx)` — used for tx ID and signing
- **SignedTransaction:** `bincode::serialize(&signed_tx)` — submitted to RPC as hex
- **Block/BlockHeader:** bincode for hashing and storage

**RPC submission:** `hex(bincode(SignedTransaction))` — e.g. `0x1234...`

---

## 6. Transaction Signing

### 6.1 Signable Message

```text
signable_message = BLAKE3(
  nonce.to_le_bytes() ||
  sender.0[32] ||
  bincode(payload) ||
  bincode(access_list)
)
```

- **nonce:** 8 bytes, little-endian
- **sender:** 32 bytes (AccountId)
- **payload:** bincode-serialized `TransactionPayload`
- **access_list:** bincode-serialized `AccessList`

### 6.2 Signature

```text
signature = Ed25519_sign(signable_message)
```

64-byte Ed25519 signature. Verifier uses `sender` as public key.

### 6.3 SignedTransaction

```text
SignedTransaction = { tx, signature }
```

Submit: `hex(bincode(SignedTransaction))` to `boing_submitTransaction([hex_signed_tx])`.

---

## 7. VM & Bytecode

### 7.1 VM Model

- **Type:** Stack-based, deterministic
- **Opcodes:** Inspired by EVM, simplified for auditability
- **Implementation:** `boing-execution` crate

### 7.2 Opcodes

| Opcode | Hex | Gas | Description |
|--------|-----|-----|-------------|
| **Stop** | `0x00` | 0 | Halt execution |
| **Add** | `0x01` | 3 | Add top two stack values |
| **Sub** | `0x02` | 3 | Subtract |
| **Mul** | `0x03` | 5 | Multiply |
| **MLoad** | `0x51` | 3 | Load from memory at offset |
| **MStore** | `0x52` | 3 | Store to memory |
| **SLoad** | `0x54` | 100 | Load from storage |
| **SStore** | `0x55` | 20,000 | Store to storage |
| **Jump** | `0x56` | 8 | Pop and jump to offset |
| **JumpI** | `0x57` | 10 | Conditional jump |
| **Push1** | `0x60` | 3 | Push 1-byte immediate |
| **Push2** | `0x61` | 3 | Push 2-byte immediate |
| **…** | … | 3 | … |
| **Push32** | `0x7f` | 3 | Push 32-byte immediate |
| **Return** | `0xf3` | 0 | Return memory slice |

**PUSH encoding:** For `0x60`..`0x7f`, immediate length = `byte - 0x5f` (PUSH1 = 1 byte, PUSH32 = 32 bytes).

### 7.3 Well-Formedness

- All bytes must decode to a valid opcode or be part of a PUSH immediate.
- PUSH immediates must have correct length (no truncated instructions).
- No jump targets to non-instruction boundaries.
- No trailing bytes at end of bytecode.

### 7.4 Bytecode Limits

- **Maximum size:** 32 KiB (32 × 1024 bytes) — enforced by protocol QA.

---

## 8. Gas Model

### 8.1 Base Costs (per transaction type)

| Tx Type | Base Gas |
|---------|----------|
| Transfer | 21,000 |
| ContractCall | 100,000 |
| ContractDeploy | 200,000 |
| Bond | 21,000 |
| Unbond | 21,000 |

### 8.2 Opcode Gas

See [§7.2 Opcodes](#72-opcodes). Contract execution adds opcode costs to base `CONTRACT_CALL` or `CONTRACT_DEPLOY`.

### 8.3 Adaptive Multiplier

- Base multiplier: 1.0
- Max multiplier: 2.0 (under congestion)
- Configurable via `GasConfig.multiplier_e4` (e.g. 10000 = 1.0, 15000 = 1.5)

---

## 9. Protocol QA Rules

Deployments must pass protocol QA before inclusion. See [QUALITY-ASSURANCE-NETWORK.md](QUALITY-ASSURANCE-NETWORK.md) for full design.

### 9.1 Bytecode Rules (Hard)

| Rule | Limit | rule_id |
|------|-------|---------|
| Bytecode size | ≤ 32 KiB | `MAX_BYTECODE_SIZE` |
| Valid opcodes only | Stop, Add, Sub, Mul, MLoad, MStore, SLoad, SStore, Jump, JumpI, Push1..Push32, Return | `INVALID_OPCODE` |
| Well-formed | No truncated PUSH, no trailing bytes | `MALFORMED_BYTECODE` |
| Not blocklisted | Bytecode hash not in blocklist | `BLOCKLIST_MATCH` |

### 9.2 Purpose (when declared)

- Valid categories: `dApp`, `token`, `NFT`, `meme`, `community`, `entertainment`, `tooling`, `other`
- Invalid category → `PURPOSE_DECLARATION_INVALID`
- Scam pattern match → `SCAM_PATTERN_MATCH`

### 9.3 Pre-flight Check

Use `boing_qaCheck([hex_bytecode]` or `boing_qaCheck([hex_bytecode, purpose_category, description_hash?])` before submit.

---

## 10. Block & Ledger Structure

- **Chain:** Linear chain of blocks
- **Block hash:** BLAKE3 of bincode-serialized `BlockHeader`
- **Tx root:** Merkle root of transaction IDs (binary tree)
- **State root:** Root of Sparse Merkle tree (or equivalent)

---

## 11. JSON-RPC API

### 11.1 Transport

- **Protocol:** JSON-RPC 2.0
- **Transport:** HTTP POST
- **Base URL:** `http://<host>:<rpc_port>/`
- **Default port:** 8545

### 11.2 Methods Summary

| Method | Params | Result |
|--------|--------|--------|
| `boing_submitTransaction` | `[hex_signed_tx]` | — |
| `boing_chainHeight` | `[]` | `u64` |
| `boing_getBalance` | `[hex_account_id]` | `{ balance: string }` |
| `boing_getAccount` | `[hex_account_id]` | `{ balance, nonce, stake }` |
| `boing_getBlockByHeight` | `[height]` | Block or `null` |
| `boing_getBlockByHash` | `[hex_block_hash]` | Block or `null` |
| `boing_getAccountProof` | `[hex_account_id]` | `{ proof, root, value_hash }` |
| `boing_verifyAccountProof` | `[hex_proof, hex_state_root]` | `{ valid: boolean }` |
| `boing_simulateTransaction` | `[hex_signed_tx]` | `{ gas_used, success, error? }` |
| `boing_registerDappMetrics` | `[hex_contract, hex_owner]` | `{ registered, contract, owner }` |
| `boing_submitIntent` | `[hex_signed_intent]` | `{ intent_id }` |
| `boing_qaCheck` | `[hex_bytecode]` or `[hex_bytecode, purpose, desc_hash?]` | `{ result, rule_id?, message? }` |
| `boing_faucetRequest` | `[hex_account_id]` | `{ ok, amount, to, message }` (testnet only) |

### 11.3 Error Codes

| Code | Meaning |
|------|---------|
| -32600 | Invalid Request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32000 | Server error |
| -32016 | Rate limit exceeded |
| -32050 | QA: Deployment rejected |
| -32051 | QA: Pending pool |

**Reference:** [RPC-API-SPEC.md](RPC-API-SPEC.md) for full method and error details.

---

## 12. Networking

### 12.1 Stack

- **Library:** libp2p
- **Transports:** TCP
- **Security:** Noise
- **Stream multiplexing:** yamux
- **Protocols:** gossipsub, request-response

### 12.2 Discovery

- mDNS (local)
- Bootstrap lists
- **Target:** DHT (Kademlia) + gossip-first overlay; bootnode rotation (see [DECENTRALIZATION-AND-NETWORKING.md](DECENTRALIZATION-AND-NETWORKING.md))

---

## 13. Implementation Crates

| Crate | Role |
|-------|------|
| `boing-primitives` | Types, BLAKE3, Ed25519, Transaction, Block, AccountId, SignedTransaction |
| `boing-consensus` | PoS + HotStuff BFT |
| `boing-state` | State store, state root, checkpoints |
| `boing-execution` | VM, bytecode, interpreter, BlockExecutor, TransactionScheduler |
| `boing-tokenomics` | Block emission, dApp incentives |
| `boing-governance` | Time-locked governance, slashing appeal |
| `boing-automation` | Scheduler, triggers, executor incentives, verification |
| `boing-qa` | Protocol QA: Allow/Reject/Unsure checks |
| `boing-cli` | `boing init`, `boing dev`, `boing deploy` |
| `boing-p2p` | libp2p networking |
| `boing-node` | Node binary (RPC, mempool, block producer, chain) |

---

## 14. Cross-References

| Document | Use for |
|----------|---------|
| [BOING-NETWORK-ESSENTIALS.md](BOING-NETWORK-ESSENTIALS.md) | Six pillars, design philosophy, quick reference |
| [BOING-BLOCKCHAIN-DESIGN-PLAN.md](BOING-BLOCKCHAIN-DESIGN-PLAN.md) | Full architecture, innovations, tokenomics |
| [RPC-API-SPEC.md](RPC-API-SPEC.md) | Complete RPC method specs and examples |
| [QUALITY-ASSURANCE-NETWORK.md](QUALITY-ASSURANCE-NETWORK.md) | QA design, automation, community pool; Appendix A: deployer checklist |
| [BOING-EXPRESS-WALLET.md](BOING-EXPRESS-WALLET.md) | Wallet integration, signing spec |
| [RUNBOOK.md](RUNBOOK.md) | Node operation, monitoring, incidents |
| [SECURITY-STANDARDS.md](SECURITY-STANDARDS.md) | Security requirements and practices |

---

**Source of truth:** `crates/boing-primitives`, `crates/boing-execution`, `crates/boing-qa`, `crates/boing-node`. This document reflects the implementation; when in doubt, refer to the code.

---

*Boing Network — Authentic. Decentralized. Optimal. Sustainable.*
