# Native DEX — operator deployment record (addresses & env)

Use this doc to **track what you actually deployed** on a given network. It complements:

- **Canonical CREATE2 predictions** (fixed deployer + bytecode): [OPS-CANONICAL-TESTNET-NATIVE-DEX-AUX.md](OPS-CANONICAL-TESTNET-NATIVE-DEX-AUX.md), JSON mirror [`scripts/canonical-testnet-dex-predicted.json`](../scripts/canonical-testnet-dex-predicted.json).
- **Published canonical CP pool** (separate ops freeze): [OPS-CANONICAL-TESTNET-NATIVE-AMM-POOL.md](OPS-CANONICAL-TESTNET-NATIVE-AMM-POOL.md).

**Why two kinds of addresses?**

- **CREATE2** deploys land at **predictable** ids (same deployer + salt + bytecode ⇒ same address everywhere). If the slot was **already taken**, tutorial scripts may fall back to **nonce-derived** ids — those differ per chain history and are **not** in the canonical JSON.
- Your **pair directory** and **pool** may be CREATE2 or nonce-derived depending on collisions and flags (`BOING_USE_CREATE2`, bootstrap auto-retry).

## 1. Copy the template locally (optional)

In the tutorial package:

```bash
cp examples/native-boing-tutorial/DEPLOYMENT-ADDRESSES.example.md DEPLOYMENT-ADDRESSES.local.md
```

`DEPLOYMENT-ADDRESSES.local.md` is **gitignored** — safe for secrets-adjacent notes (never paste **seeds** into git).

## 2. Record table (fill in)

| Role | `AccountId` (0x + 64 hex) | Deploy method | Notes |
|------|---------------------------|---------------|--------|
| **Deployer** (signer pubkey) | | Ed25519 from `BOING_SECRET_HEX` | Same hex as `senderHex` in script JSON |
| **RPC** | | URL | e.g. `https://testnet-rpc.boing.network` |
| **Native CP pool** | | CREATE2 / nonce | `BOING_POOL_HEX` |
| **Pair directory (factory)** | | CREATE2 / nonce | `BOING_DEX_FACTORY_HEX` for routes / `register_pair` |
| **Ledger router v1** | | CREATE2 / nonce | 128-byte inner calldata forward |
| **Ledger router v2** | | CREATE2 / nonce | 160-byte inner (e.g. v5 `swap_to`) |
| **Ledger router v3** | | CREATE2 / nonce | 192-byte inner (e.g. v5 `remove_liquidity_to`) |
| **Multihop / swap2 router** | | CREATE2 / nonce | 2–6 hops in one tx |
| **AMM LP vault** | | optional | [NATIVE-AMM-LP-VAULT.md](NATIVE-AMM-LP-VAULT.md) |
| **LP share token** | | optional | [NATIVE-LP-SHARE-TOKEN.md](NATIVE-LP-SHARE-TOKEN.md) |

**`register_pair` (directory):**

| Field | Value |
|-------|--------|
| `token_a` | |
| `token_b` | |
| `pool` | Must match your live pool id |

Use **real** reference-token ids for production; synthetic `0xaa…` / `0xbb…` is devnet-only.

## 3. Tutorial / dApp env cheat sheet

| Env / config | Typical value |
|--------------|----------------|
| `BOING_RPC_URL` | Your JSON-RPC |
| `BOING_POOL_HEX` | Native CP pool |
| `BOING_DEX_FACTORY_HEX` | Pair directory (merge override when RPC omits hint) |
| `TOKEN_IN` / `TOKEN_OUT` | For `print-native-dex-routes` |
| Node **`BOING_CANONICAL_NATIVE_*`** | Optional RPC **`end_user`** hints — factory, multihop router, ledger v2/v3, LP vault, share (see [RPC-API-SPEC.md](RPC-API-SPEC.md) env table) — [OPS-CANONICAL-TESTNET-NATIVE-DEX-AUX.md](OPS-CANONICAL-TESTNET-NATIVE-DEX-AUX.md) |
| **`BOING_VAULT_HEX`** | AMM LP vault `AccountId` — canonical CREATE2 (6913): `0x2b195b93a57b632ca3c1cf58cb7578542a6d58998116cddb8a6a50f1bd652f48` when matching [predicted JSON](../scripts/canonical-testnet-dex-predicted.json) |
| **`BOING_SHARE_HEX`** / CLI **`BOING_LP_SHARE_HEX`** | LP share token — canonical: `0x0618b4a6a30bc31822a0cdcf253ed2bcf642a6cecf26346ba655b63fccbde03c` (same source) |
| **`REACT_APP_BOING_NATIVE_AMM_LP_VAULT`** / **`REACT_APP_BOING_NATIVE_AMM_LP_SHARE_TOKEN`** | Same **0x + 64 hex** as vault / share for [boing.finance](https://boing.finance) native VM panel ([tutorial README §7i2](../examples/native-boing-tutorial/README.md)) |
| **`boing-sdk`** | `CANONICAL_BOING_TESTNET_NATIVE_AMM_LP_VAULT_HEX`, `CANONICAL_BOING_TESTNET_NATIVE_LP_SHARE_TOKEN_HEX` (`canonicalTestnetDex.ts`) |

## 4. Verify on RPC

- Pool: `npm run fetch-native-amm-reserves` with `BOING_POOL_HEX`.
- Factory: `boing_getLogs` / SDK helpers for `register_pair` `Log3` ([NATIVE-DEX-FACTORY.md](NATIVE-DEX-FACTORY.md)).
- Audit: repo root `npm run audit-native-dex-testnet` ([OPS-CANONICAL-TESTNET-NATIVE-DEX-AUX.md](OPS-CANONICAL-TESTNET-NATIVE-DEX-AUX.md) § Verification).
- **LP vault + share (after deploy):** there is no dedicated “code at address” RPC in the portable surface; treat **successful `deploy-native-dex-lp-aux-contracts`** JSON (**`predictedContractHex`**) plus **`canonical-testnet-dex-predicted.json`** as the source of truth. **Wire the product path:** (1) share token **`set_minter_once`** with minter = vault account, (2) vault **`configure(pool, share_token)`** — see [NATIVE-LP-SHARE-TOKEN.md](NATIVE-LP-SHARE-TOKEN.md) “End-to-end” and tutorial **`native-lp-share-submit-contract-call`** / **`native-amm-lp-vault-submit-contract-call`**.

## Appendix A — Example snapshot (public testnet, one operator)

**Not normative.** Illustrates a real path: **pool + directory** used **nonce** deploy (CREATE2 slots busy); **routers** matched **canonical CREATE2** predictions for deployer `0xc063512f…` (same as [`canonical-testnet-dex-predicted.json`](../scripts/canonical-testnet-dex-predicted.json)).

| Role | Account id |
|------|------------|
| RPC | `https://testnet-rpc.boing.network` |
| Deployer / sender | `0xc063512f42868f1278c59a1f61ec0944785c304dbc48dec7e4c41f70f666733f` |
| Native CP pool (v1, **nonce**) | `0x20a236ffa501f96204780e2b940b18f252d970a60400ce29531cc414cef60112` |
| Pair directory (**nonce**) | `0x5fffaea0269c6460a766e05bdd4584f87b3e0e39569b3a1a61231c1c2a506fc8` |
| Ledger router v1 (**CREATE2**, matches canonical) | `0x371b4cd7e3b88e06e6b89bdc86214918a7e7ec73b62deb7f9975e4166736d54d` |
| Multihop / swap2 router (**CREATE2**, matches canonical) | `0x8f8b2ecb6fd5dc7682e41ebe443d6116e0f4ae8247f67b4bfafec4dea2d861a3` |
| Ledger router v2 (**CREATE2**, matches canonical) | `0x60a232b91d6f86a61d037ea6ea0fb769897f983c8e0d399e3df5189d00868992` |
| Ledger router v3 (**CREATE2**, matches canonical) | `0xfb552619b27dacacba52b62d97cd171eabe4a74dac262ecb0e8735284d7555ba` |
| AMM LP vault (**CREATE2**, matches canonical) | `0x2b195b93a57b632ca3c1cf58cb7578542a6d58998116cddb8a6a50f1bd652f48` |
| LP share token (**CREATE2**, matches canonical) | `0x0618b4a6a30bc31822a0cdcf253ed2bcf642a6cecf26346ba655b63fccbde03c` |

**Canonical JSON differs for pool/factory** (those rows assume CREATE2 with no collision): pool `0xce4f8193…`, factory `0x12dff976…` in `canonical-testnet-dex-predicted.json`.

**LP contracts:** deployed with **`npm run deploy-native-dex-lp-aux-contracts`** using the same deployer and bytecode as the JSON; **`predictedContractHex`** in script output matches the vault / share rows above. **Not yet wired on-chain until** you run share **`set_minter_once`** (vault as minter) and vault **`configure(pool, share_token)`** with your **live** pool id ([NATIVE-AMM-LP-VAULT.md](NATIVE-AMM-LP-VAULT.md), [NATIVE-LP-SHARE-TOKEN.md](NATIVE-LP-SHARE-TOKEN.md)).

**Demo `register_pair` token placeholders:** `0x` + 64× `aa` and 64× `bb` (not production assets).

**Example reserves (ledger units):** reserve A `1000`, reserve B `2000`, total LP `1000` after seeding.

## Appendix B — Public testnet snapshot (`deploy-native-dex-full-stack`, operator `0x3b6a27…`)

**Recorded:** 2026-04-05. **Source:** `examples/native-boing-tutorial` → `npm run deploy-native-dex-full-stack` JSON (`ok: true` end-to-end).

**Not normative for the monorepo canonical JSON.** This is a **concrete deploy** on **`https://testnet-rpc.boing.network`** with deployer / `senderHex` **`0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29`**. Script phases reported **`create2: true`** for every contract below (no nonce fallback in this run).

| Role | `AccountId` (0x + 64 hex) | Notes |
|------|---------------------------|--------|
| **RPC** | — | `https://testnet-rpc.boing.network` |
| **Deployer** (Ed25519 pubkey) | `0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29` | Same as `senderHex` in script JSON |
| **Native CP pool** (v1) | `0x7247ddc3180fdc4d3fd1e716229bfa16bad334a07d28aa9fda9ad1bfa7bdacc3` | `pool.predictedPoolHex` |
| **Pair directory (factory)** | `0x58112627fc84618a27b82e9af82bc9a51761c6d3cca1260c93d56d22b6c481a1` | `dexDirectory.predictedFactoryHex` |
| **Multihop / swap2 router** | `0xf801cd1aa5ec402f89a2f394b49e6b0c136264d8945b16a4a6a81a188b18acc1` | `routers.results.swap2MultihopRouter.predictedContractHex` |
| **Ledger router v2** | `0x33334ff73c44c93335ac5e69938a52ea65fa77b062d1961ed22c131adaa31e0f` | `routers.results.ledgerRouterV2.predictedContractHex` |
| **Ledger router v3** | `0x2c90ffcddeb2683219b4b8143a91d7b93f249bcb0d9523c8b4f2111de668b79a` | `routers.results.ledgerRouterV3.predictedContractHex` |
| **AMM LP vault** | `0x937d09ee8e4dcc521c812566ad4930792e74ad004ecb3ae2cc73dc015813aa8d` | `lpAux.results.ammLpVault.predictedContractHex` |
| **LP share token** | `0x101201403f573e5b1d6d5c6b93d52d12c68957f4a228d5dad76e78c747044421` | `lpAux.results.lpShareToken.predictedContractHex` |
| **Ledger router v1** | — | **Not deployed** in this run (default aux bundle: swap2 + ledger v2/v3 only; set **`BOING_AUX_INCLUDE_LEDGER_V1=1`** to add v1). |

**`register_pair`:** `registerPairSubmitted: false` — the directory contract exists, but this bootstrap did **not** submit **`register_pair`**. To register a pair on-chain, re-run bootstrap with **`BOING_BOOTSTRAP_REGISTER_PAIR=1`** and valid **`BOING_DEX_TOKEN_A_HEX` / `BOING_DEX_TOKEN_B_HEX`** (see [tutorial README](../examples/native-boing-tutorial/README.md)).

**LP wiring (this run):** `lpShareSetMinter` (**`set_minter_once`**, vault as minter) and `lpVaultConfigure` (**`configure`**, pool + share) both **`ok: true`**.

**Summary mirror** (same ids as `summary` in script stdout): `poolHex` = pool row; `vaultHex` = vault row; `shareHex` = share row.

### B.1 — `boing-node` RPC hints (`BOING_CANONICAL_NATIVE_*`)

Paste on operators / VibeMiner-injected env so **`boing_getNetworkInfo`**.**`end_user`** matches this deploy (see [RPC-API-SPEC.md](RPC-API-SPEC.md)):

```bash
BOING_CANONICAL_NATIVE_CP_POOL=0x7247ddc3180fdc4d3fd1e716229bfa16bad334a07d28aa9fda9ad1bfa7bdacc3
BOING_CANONICAL_NATIVE_DEX_FACTORY=0x58112627fc84618a27b82e9af82bc9a51761c6d3cca1260c93d56d22b6c481a1
BOING_CANONICAL_NATIVE_DEX_MULTIHOP_SWAP_ROUTER=0xf801cd1aa5ec402f89a2f394b49e6b0c136264d8945b16a4a6a81a188b18acc1
BOING_CANONICAL_NATIVE_DEX_LEDGER_ROUTER_V2=0x33334ff73c44c93335ac5e69938a52ea65fa77b062d1961ed22c131adaa31e0f
BOING_CANONICAL_NATIVE_DEX_LEDGER_ROUTER_V3=0x2c90ffcddeb2683219b4b8143a91d7b93f249bcb0d9523c8b4f2111de668b79a
BOING_CANONICAL_NATIVE_AMM_LP_VAULT=0x937d09ee8e4dcc521c812566ad4930792e74ad004ecb3ae2cc73dc015813aa8d
BOING_CANONICAL_NATIVE_LP_SHARE_TOKEN=0x101201403f573e5b1d6d5c6b93d52d12c68957f4a228d5dad76e78c747044421
```

### B.2 — **boing.finance** / Vite overrides (`REACT_APP_*` / `VITE_*`)

Same ids as §B.1, using names consumed by **`buildNativeDexIntegrationOverridesFromProcessEnv()`** in **`boing-sdk`** ([`dexIntegration.ts`](../boing-sdk/src/dexIntegration.ts)):

```bash
REACT_APP_BOING_NATIVE_AMM_POOL=0x7247ddc3180fdc4d3fd1e716229bfa16bad334a07d28aa9fda9ad1bfa7bdacc3
REACT_APP_BOING_NATIVE_VM_DEX_FACTORY=0x58112627fc84618a27b82e9af82bc9a51761c6d3cca1260c93d56d22b6c481a1
REACT_APP_BOING_NATIVE_VM_SWAP_ROUTER=0xf801cd1aa5ec402f89a2f394b49e6b0c136264d8945b16a4a6a81a188b18acc1
REACT_APP_BOING_NATIVE_DEX_LEDGER_ROUTER_V2=0x33334ff73c44c93335ac5e69938a52ea65fa77b062d1961ed22c131adaa31e0f
REACT_APP_BOING_NATIVE_DEX_LEDGER_ROUTER_V3=0x2c90ffcddeb2683219b4b8143a91d7b93f249bcb0d9523c8b4f2111de668b79a
REACT_APP_BOING_NATIVE_AMM_LP_VAULT=0x937d09ee8e4dcc521c812566ad4930792e74ad004ecb3ae2cc73dc015813aa8d
REACT_APP_BOING_NATIVE_AMM_LP_SHARE_TOKEN=0x101201403f573e5b1d6d5c6b93d52d12c68957f4a228d5dad76e78c747044421
```

(`VITE_BOING_NATIVE_*` mirrors exist for each `REACT_APP_*` key above.)
