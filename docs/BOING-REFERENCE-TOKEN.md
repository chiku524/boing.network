# Boing reference fungible layout (off-chain standard)

This document defines a **recommended** calldata layout for fungible-token-style contracts on the **Boing VM**. It is **not** a consensus-enforced transaction type: deployers ship ordinary `ContractDeploy` bytecode that implements (or ignores) this ABI. All deploys still pass **protocol QA** (`boing-qa`).

## Principles

- **Boing VM only.** Opcodes and semantics are Boing-defined (`TECHNICAL-SPECIFICATION.md` §7, [BOING-VM-INDEPENDENCE.md](BOING-VM-INDEPENDENCE.md)).
- **Storage layout** is contract-defined. A common pattern is **balance mapping**: `SLOAD` / `SSTORE` with key = holder `AccountId` (32 bytes) and value = balance as a 32-byte big-endian word (practical amounts often use the low 16 bytes as `u128`).
- **Access control** uses **`CALLER`** (`0x33`) to push the **immediate caller** `AccountId` and compare with stored roles (e.g. minter). At **top-level** that is the transaction signer; if a **pool or router** contract uses nested **`Call` (`0xf1`)** to invoke your token, **`Caller` inside the token** is that **contract’s** id (like `msg.sender` being the pool on other chains), not the end-user.

## Calldata (reference)

Total **96 bytes** per call:

| Offset | Length | Content |
|--------|--------|---------|
| 0 | 32 | Selector word: 31 zero bytes + one-byte selector in the **last** byte (index 31). |
| 32 | 32 | `to` — recipient `AccountId` |
| 64 | 32 | `amount` — unsigned amount; reference encoding uses big-endian `u128` in the **low 16 bytes** (high 16 bytes zero). |

### Selectors (reference)

| Selector (low byte) | Name | Intended meaning |
|---------------------|------|------------------|
| `0x01` | `transfer` | Move `amount` from `CALLER` balance to `to` (contract must enforce balances). |
| `0x02` | `mint_first` | **Example** hook for “first minter” or treasury bootstrap; concrete rules belong in contract bytecode + docs. |

### Rust / SDK helpers

- Rust: `boing_execution::encode_transfer_calldata`, `encode_mint_first_calldata`, constants `SELECTOR_TRANSFER`, `SELECTOR_MINT_FIRST`.
- TypeScript: `boing-sdk` — `encodeReferenceTransferCalldata`, `encodeReferenceMintFirstCalldata`.

## Canonical deploy template (pinned bytecode)

dApps that want **EVM-style “form only”** deploy should ship **versioned** Boing VM bytecode implementing this calldata layout, submit **`contract_deploy_meta`**, and hide hex behind an **Advanced** panel until ops publishes a default binary.

- **Status table, env keys, and handoff for frontends:** [BOING-CANONICAL-DEPLOY-ARTIFACTS.md](BOING-CANONICAL-DEPLOY-ARTIFACTS.md)
- **SDK helpers:** `boing-sdk` — `buildContractDeployMetaTx`, `resolveReferenceFungibleTemplateBytecodeHex` (pinned default + env override)
- **Canonical template:** `boing_execution::reference_fungible_template_bytecode()` — balances + `transfer` / `mint_first`; QA purpose **`token`** ([EXECUTION-PARITY-TASK-LIST.md](EXECUTION-PARITY-TASK-LIST.md) **C6**).

## Smoke contract

`boing_execution::smoke_contract_bytecode()` is a minimal program used in tests: it stores the caller, emits `LOG0` over the first four calldata bytes, and returns the caller id. It is **not** a token.

## NFTs

See **[BOING-REFERENCE-NFT.md](BOING-REFERENCE-NFT.md)** for the reference NFT calldata layout (`owner_of`, `transfer_nft`, optional metadata hash).

## QA

Token and NFT deploys should use purpose categories (`token`, `NFT`, …) as required by `QUALITY-ASSURANCE-NETWORK.md`. Bytecode must remain within the **Boing VM opcode whitelist** and well-formedness rules.
