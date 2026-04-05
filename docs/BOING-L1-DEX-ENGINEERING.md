# Engineering: DEX-style products on Boing L1 (non-EVM)

This document is for **protocol and VM engineers** shipping **factory / router / locker**-style DeFi on Boing L1. It complements **boing.finance** docs:

- [boing-l1-vs-evm-dex.md](https://github.com/Boing-Network/boing.finance/blob/main/docs/boing-l1-vs-evm-dex.md) (conceptual)
- [boing-l1-dex-roadmap.md](https://github.com/Boing-Network/boing.finance/blob/main/docs/boing-l1-dex-roadmap.md) (milestones)

## Facts about L1 today

- **Application contracts** are **Boing VM bytecode**, deployed via **`ContractDeploy`** (optional **Create2** salt, optional **0xFD** init prefix). See [TECHNICAL-SPECIFICATION.md](./TECHNICAL-SPECIFICATION.md) § deploy / init.
- **Calls** use **`ContractCall`** with Boing calldata words — not Solidity ABI on the wire. Reference layouts: [BOING-REFERENCE-TOKEN.md](./BOING-REFERENCE-TOKEN.md), [NATIVE-AMM-CALLDATA.md](./NATIVE-AMM-CALLDATA.md).
- **Native constant-product AMM** exists as **ledger-native** logic with a **fixed calldata interface** (swap / add / remove liquidity) — not a drop-in replacement for an arbitrary Solidity **DEXFactoryV2** graph.
- **QA** gates deploys (`boing_qaCheck`, registry, optional QA pool). New DEX bytecode must be classified and allowed like other deploy templates.
- **No EVM layer on L1** for user contracts: Solidity artifacts from external repos **do not execute** on Boing VM without a full reimplementation or translation (which does not exist today).

## What “porting the Solidity DEX” means in practice

Deliverables are **new Boing VM programs** (and possibly **off-chain indexers**) that implement the **same product requirements** as `DEXFactoryV2` / `DEXRouter` / `LiquidityLocker` / pairs — **not** the same bytecode.

Suggested work breakdown:

1. **Interface spec (Boing-native)**  
   - Function selectors / calldata layouts for: create pool, swap exact in/out, add/remove liquidity, lock LP representation (if any), admin hooks.  
   - Storage model (which account holds code, how pair accounts are derived — Create2 pattern is supported).

2. **VM implementation**  
   - Implement in the toolchain that produces valid Boing VM bytecode (interpreter opcodes, gas, `LOG0`–`LOG4` for indexers).

3. **QA & purpose**  
   - Register purposes / rules; ensure mempool and execution paths match [QUALITY-ASSURANCE-NETWORK.md](./QUALITY-ASSURANCE-NETWORK.md).

4. **Deploy on testnet**  
   - Publish **32-byte AccountId** hex for factory, router, locker (and pairs if applicable).

5. **SDK + dApp**  
   - **boing-sdk:** encoders for the new calldata (pattern: `nativeAmm.ts`, `callAbi.ts`).  
   - **boing.finance:** set `REACT_APP_BOING_NATIVE_VM_*` and implement read/write flows (roadmap Phase 2).

## Relationship to native AMM

The **canonical native CP pool** is one **specific** on-chain program with **known** selectors and storage keys (see SDK `nativeAmmPool.ts`, execution `native_amm.rs`). A **multi-pair factory** is a **different** program (or set of programs); reusing the native AMM **implementation** may inform math and safety, but **APIs and deployment topology** will differ.

## Checklist before boing.finance can “turn on” L1 DEX UI

- [ ] Calldata + receipt/log spec frozen for integrators.  
- [ ] At least **factory + router** AccountIds on the target network (locker if required by product).  
- [ ] **boing-sdk** encoders + simulation/submit helpers.  
- [ ] Optional: Observer / indexer lists pairs for the app without scanning the whole chain.

Until then, **boing.finance** correctly keeps `nativeVm.*` at zero and uses **native CP** + **EVM** stacks only where configured.
