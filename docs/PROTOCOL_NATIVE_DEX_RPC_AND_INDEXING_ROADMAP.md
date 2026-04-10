# Protocol roadmap: native DEX RPC, LP positions, and indexer-scale history

> **Status:** Draft for **protocol / node / indexer** owners. Nothing in this document is **binding as implemented behavior** until **`boing-node`** ships it and [RPC-API-SPEC.md](RPC-API-SPEC.md) lists the method. **dApps** (e.g. **boing.finance**) should treat this as the **target integration contract**.

| § | Topic |
|---|--------|
| **§1** | Unsigned read-only **`contract_call`** simulation — **`boing_simulateContractCall`** (draft name) |
| **§2** | LP position models **A / B / C**, vault → pool, user positions |
| **§3** | Subgraph-class history, D1 Worker scope, pipelines, reorgs |
| **§4** | How to update specs and handoffs when something **ships** |

**Related:** [RPC-API-SPEC.md](RPC-API-SPEC.md), [HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md](HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md) §3, [HANDOFF_BOING_FINANCE_NATIVE_DEX_AND_DIRECTORY.md](HANDOFF_BOING_FINANCE_NATIVE_DEX_AND_DIRECTORY.md), [INDEXER-RECEIPT-AND-LOG-INGESTION.md](INDEXER-RECEIPT-AND-LOG-INGESTION.md), [OBSERVER-HOSTED-SERVICE.md](OBSERVER-HOSTED-SERVICE.md).

**Reference implementation today:** `boing_simulateTransaction` builds a **`SignedTransaction`**, snapshots state, runs **`vm.execute_with_context`**, returns JSON with **`gas_used`**, **`success`**, **`return_data`**, **`logs`**, **`suggested_access_list`**, **`access_list_covers_suggestion`** — see `crates/boing-node/src/rpc.rs` (`"boing_simulateTransaction"` arm). **`boing-sdk`** **`SimulateResult`** — `types.ts`.

---

## 1. Unsigned read-only `contract_call` simulation (JSON-RPC)

> **Implemented in `boing-node`:** **`boing_simulateContractCall`** — see [RPC-API-SPEC.md](RPC-API-SPEC.md) § **boing_simulateContractCall** and **`cargo test -p boing-node --test simulate_contract_call_rpc`**. **`boing-sdk`:** **`BoingClient.simulateContractCall`**. Remaining ecosystem steps (Express docs, **boing.finance** **`REACT_APP_BOING_RPC_UNSIGNED_SIMULATE_METHOD`**) may still be open.

### 1.1 Goals

| # | Goal |
|---|------|
| G1 | Let dApps **dry-run VM calldata** against a **contract `AccountId`** without building a full **`SignedTransaction`**. |
| G2 | Keep **response shape** aligned with **`boing_simulateTransaction`** so **`boing-sdk`** can reuse **`SimulateResult`** (or a documented subset/extension). |
| G3 | Support optional **caller** (**`sender`**) and **historical / tip** state (**`at_block`**). |
| G4 | **No state commit** on the node’s committed chain (same spirit as current simulate). |
| G5 | **One stable method name** in **`boing_rpcSupportedMethods`**, catalog, and OpenAPI. |
| G6 | **Operator control**: public RPC may disable or rate-limit; document policy. |

### 1.2 Problem statement

Today **`boing_simulateTransaction`** accepts **`[hex_signed_tx]`** only. Callers must choose nonce, fee fields, and sign — wasteful for **read-only quote** paths. An **`eth_call`-style** RPC reduces friction while preserving Boing rules (**32-byte accounts**, **access lists**, VM calldata layout).

### 1.3 Proposed method name (draft)

| Choice | Name |
|--------|------|
| **Recommended** | **`boing_simulateContractCall`** |
| Alternates (pick **one** globally) | `boing_call`, `boing_estimateContractCall`, `boing_simulateCall` |

Must not collide with the Method index in [RPC-API-SPEC.md](RPC-API-SPEC.md) § Method index.

### 1.4 Positional vs object params — implementer decision

| Style | Params | Pros | Cons |
|-------|--------|------|------|
| **Positional array** | JSON array, same pattern as **`boing_simulateTransaction`** | Consistent with many **`boing_*`** methods; simple wire format | Awkward for future optional fields; order must stay frozen or versioned |
| **Single object** | One JSON object in **`params`** | Extensible; self-documenting fields | Differs from **`[hex_signed_tx]`**; catalog must spell out object schema |

**Recommendation for `boing-node`:** support **positional** as the **canonical** wire form for v1:

```text
[ contract_hex, calldata_hex, sender_hex?, at_block? ]
```

- **`sender_hex`**: omit or `null` for protocol-defined default caller (must be documented in RPC-API-SPEC when shipped).
- **`at_block`**: integer height, or string **`"latest"`**, or (only if defined) **`"pending"`**.

If product needs **object** form later, add **`boing_simulateContractCallEx`** or a **versioned params** union — do **not** silently accept both shapes in one method without documenting precedence.

**Optional object form (draft, if implementers choose object-only for v1):**

```json
{
  "contract": "0x…64 hex…",
  "calldata": "0x…",
  "sender": "0x…",
  "at_block": "latest",
  "access_list": { "read": ["0x…"], "write": ["0x…"] }
}
```

### 1.5 Request fields (normative draft)

| Field | Required | Type | Description |
|--------|----------|------|-------------|
| **contract** | yes | `0x` + 64 hex | Target contract **`AccountId`**. |
| **calldata** | yes | hex string | VM calldata (low selector byte + 32-byte words per [NATIVE-AMM-CALLDATA.md](NATIVE-AMM-CALLDATA.md) and native DEX specs). |
| **sender** | no | `0x` + 64 hex | Simulated **signer / caller** for permission and balance semantics. |
| **at_block** | no | `number` ≥ 0 \| `"latest"` \| `"pending"` | State view for simulation; default **`latest`** committed tip. |
| **access_list** | no | `{ read: string[], write: string[] }` | If omitted: implementation defines empty vs auto-expand vs error (must be specified in RPC-API-SPEC when shipped). |

**Open implementation questions** (resolve before marking spec **stable**):

- Max **calldata** length and **gas** budget for this RPC vs full-tx simulate.
- Whether **unsigned** simulate requires **non-empty access_list** or merges **`suggested_access_list`** on failure (mirror wallet retry UX).

### 1.6 Result alignment with `boing_simulateTransaction`

The JSON result **SHOULD** expose the same keys as today’s simulate success/failure branches, so clients map to **`SimulateResult`**:

| JSON key | Type | Success | Failure (VM error) | Notes |
|----------|------|---------|-------------------|--------|
| **gas_used** | number | from VM | `0` (match current simulate error path) | Same as `rpc.rs` simulate arm |
| **success** | boolean | `true` | `false` | |
| **return_data** | string (hex) | encoded buffer | `"0x"` | |
| **logs** | array | `execution_logs_to_json` | `[]` | Same element shape as receipt logs |
| **error** | string? | absent | human-readable | Optional on failure |
| **suggested_access_list** | `{read, write}` | heuristic from **synthetic** tx | same | Implementation builds internal **`Transaction`** / access list for suggestion |
| **access_list_covers_suggestion** | boolean | per request list vs suggestion | same | If request has no list, define **`false`** or document other rule |

**Implementation note:** node code will likely **construct an internal unsigned or synthetic `Transaction`** with **`contract_call`** payload, run the same **`execute_with_context`** path (or a shared helper), and serialize like the existing simulate handler.

### 1.7 Errors (draft)

| Code | When |
|------|------|
| **-32602** | Invalid params (wrong arity, malformed hex, calldata too long, bad `at_block`). |
| **-32601** | Method disabled (operator policy) or not registered. |
| **-32000** | Internal / execution harness error (timeout, OOM); message safe for logs. |

Use **-32602** with a clear **`message`** for all client-fixable input errors.

### 1.8 JSON-RPC examples (draft)

**Request (positional, minimal):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "boing_simulateContractCall",
  "params": [
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "0x0102030405"
  ]
}
```

**Response (success):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "gas_used": 12345,
    "success": true,
    "return_data": "0x",
    "logs": [],
    "suggested_access_list": { "read": [], "write": [] },
    "access_list_covers_suggestion": true
  }
}
```

**Response (failure):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "gas_used": 0,
    "success": false,
    "error": "…",
    "return_data": "0x",
    "logs": [],
    "suggested_access_list": { "read": [], "write": [] },
    "access_list_covers_suggestion": false
  }
}
```

### 1.9 Seven-step rollout (ecosystem)

| Step | Owner | Deliverable |
|------|--------|-------------|
| **1** | **Node** | Implement **`boing_simulateContractCall`** in **`crates/boing-node/src/rpc.rs`**, shared execution path with **`boing_simulateTransaction`** where possible; optional **`BOING_RPC_*`** flag to disable on public endpoints. |
| **2** | **Node** | Append method to **`BOING_RPC_SUPPORTED_METHODS`** and router; update **`crates/boing-node/schemas/developer_api.json`** (or generated OpenAPI source) if applicable. |
| **3** | **Docs (this repo)** | Add full method section + Method index entry in [RPC-API-SPEC.md](RPC-API-SPEC.md); remove or shrink “draft” sketch under **`boing_simulateTransaction`**. |
| **4** | **boing-sdk** | **`simulateContractCall(client, …)`** returning **`SimulateResult`**; **`probeBoingRpcCapabilities`** / doctor strings if needed; unit tests with mocked JSON. |
| **5** | **boing.finance** | Set **`REACT_APP_BOING_RPC_UNSIGNED_SIMULATE_METHOD=boing_simulateContractCall`** (or final name); gate UI on **`probe`** / method existence. |
| **6** | **Boing Express** | If dApps call via **`window.boing.request`**, document optional passthrough or implement shim in [BOING-EXPRESS-WALLET.md](BOING-EXPRESS-WALLET.md). |
| **7** | **Node QA** | **`cargo test -p boing-node`** — new **`tests/simulate_contract_call_rpc.rs`** (or extend **`simulate_rpc.rs`**): happy path, invalid hex, disabled RPC, optional **`at_block`** regression. |

**Acceptance criteria (§1 done):**

- Public testnet RPC (where enabled) returns **`-32601`** only when policy disables the method; otherwise valid calls return **`result`** matching §1.6.
- **RPC-API-SPEC** and **`boing_getRpcOpenApi`** agree on params and result.
- **boing-sdk** documents the method in README / typed client.

---

## 2. LP NFT / position model and automatic vault → pool routing

### 2.1 Problem

Static env such as **`REACT_APP_BOING_NATIVE_DEX_VAULT_POOL_MAP_JSON`** does not scale. **Vault → pool** and **user positions** need discoverable **on-chain layout** and/or **indexer APIs**.

### 2.2 Position models A / B / C

| Model | Label | On-chain artifact | Discovery pattern | Pros | Cons |
|-------|-------|-------------------|-------------------|------|------|
| **A** | LP **share fungible** | Per-pool or vault-issued fungible ([NATIVE-LP-SHARE-TOKEN.md](NATIVE-LP-SHARE-TOKEN.md)) | **`boing_getBalance`** / **`boing_getAccount`** on share token; map token ↔ pool via factory/vault storage or events | Familiar ERC-20-like UX; easy balance read | One token contract per pool or shared minter complexity |
| **B** | **Position NFT** | Non-fungible position token (reference NFT or new program) | **`owner_of`**, **`token_uri`**; enumeration via **indexer** or optional **`boing_*`** read | Uniswap V3–style position granularity | Needs enumeration story (indexer almost always) |
| **C** | **Vault-only** | Shares only in **vault** storage ([NATIVE-AMM-LP-VAULT.md](NATIVE-AMM-LP-VAULT.md)) | Documented **storage keys** + **`boing_getContractStorage`**; events for deposits | Fewer deployed contracts | Per-user reads heavier; UX needs indexer for “my positions” |

The protocol **MUST** declare which model(s) are **canonical per network** (testnet vs mainnet may differ during migration).

### 2.3 Deliverables

| Deliverable | Description | Primary owner |
|-------------|-------------|----------------|
| **Vault → pool** | Deterministic rule: e.g. vault storage word **→** pool **`AccountId`**, or factory event, or **`boing_getNetworkInfo.end_user`** extension | Protocol VM + docs |
| **User positions** | For model **A**: balances per share token + pool id; **B**: NFT ids per owner; **C**: vault-internal shares — exposed via **logs + storage** or **indexer HTTP** | Protocol + optional indexer |
| **Spec** | Update [NATIVE-AMM-LP-VAULT.md](NATIVE-AMM-LP-VAULT.md), [NATIVE-LP-SHARE-TOKEN.md](NATIVE-LP-SHARE-TOKEN.md), [NATIVE-AMM-INTEGRATION-CHECKLIST.md](NATIVE-AMM-INTEGRATION-CHECKLIST.md) | Docs |
| **SDK** | **`fetchUserNativeDexLpPositions`**-style helper (name TBD) wrapping RPC and/or indexer URL from env | **boing-sdk** |
| **App** | **boing.finance** LP portfolio: drop or narrow static **`VAULT_POOL_MAP`** when RPC/indexer supplies mappings | **boing.finance** |

**Optional indexer API shapes (illustrative — not normative until an indexer ships):**

- `GET /v1/lp/positions?owner=0x…` → `[{ pool_hex, vault_hex?, share_token_hex?, balance_raw, updated_at_block }]`
- `GET /v1/lp/vault/{vault_hex}/pool` → `{ pool_hex }`

### 2.4 Checklists by track

**Protocol / docs**

1. Freeze **model A/B/C** (or hybrid) per network.  
2. Publish **storage keys**, **event topics**, and **vault → pool** derivation.  
3. Optionally extend **`boing_getNetworkInfo.end_user`** with structured **`lp_vault_pool_map`** only if static map remains operator-curated (prefer on-chain derivation).  
4. If enumeration cannot be done via bounded **`boing_getLogs`**, explicitly **require** an indexer for “my positions” UX.

**boing-sdk**

1. Add read helpers for chosen model (storage + logs parsers).  
2. Optional: **`fetchVaultPoolMapping(client, vaultHex)`** if single storage read suffices.  
3. Tests: fixtures from **testnet** receipts or mocked RPC.

**boing.finance**

1. Replace **`VAULT_POOL_MAP`** with SDK + RPC defaults when available.  
2. LP UI: show **source** badge (`rpc` / `indexer` / `env_fallback`).  
3. Document env in app README / handoff.

### 2.5 Shipped (boing.network — partial)

**Not** a full “my positions across all pools” indexer API; this covers **model A** reads that dApps can compose today:

| Piece | Where | Notes |
|-------|--------|------|
| Vault → pool / share token | **`fetchNativeAmmLpVaultStorageSnapshot`** (`boing-sdk` **`nativeAmmLpVault.ts`**) | Single **`boing_getContractStorage`** sweep per vault. |
| Vault helpers | **`resolveNativeAmmVaultPoolMapping`**, **`resolveNativeAmmVaultPoolMappings`**, **`fetchNativeDexLpVaultSharePositionForOwner`** (`nativeDexLpPositions.ts`) | Wraps vault snapshot + share balance read. |
| LP share balance key + read | **`lpShareTokenBalanceStorageKeyHex`**, **`fetchLpShareTokenBalanceRaw`** (`nativeLpShareToken.ts`) | XOR mask **`BOING_LP_SHARE_BAL_V1`** (see **`native_lp_share_token.rs`**). |

**Still open at protocol / product level:** canonical model per network (**§2.2**), position **NFT** (**B**) enumeration, vault-only (**C**) “my deposits” without share token, and optional **`GET /v1/lp/…`** HTTP on the Worker.

---

## 3. Subgraph-class and receipt-level history

### 3.1 What the native-dex-indexer D1 Worker **is**

- A **materialized snapshot** of **`pools[]`** from the same indexer logic as **`GET /stats`** ([HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md](HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md)).  
- **Cursor pagination** for **large** pool lists (`GET /v1/directory/pools`).  
- **Bounded pool “history” snapshot:** table **`directory_pool_events`** + **`GET /v1/history/pool/{pool_hex}/events`** — parsed native AMM **`Log2`** rows (**swap / addLiquidity / removeLiquidity**) collected over the same **`NATIVE_DEX_INDEXER_LOG_SCAN_BLOCKS`** window as indexer stats, **newest-first** pages. **`boing-sdk`:** **`collectNativeDexPoolEventsForPools`**, **`fetchNativeDexDirectoryPoolEventsPage`**.  
- **Refreshed** on cron (~15m) or **`POST /v1/directory/sync`**.  
- **Cheap read** for catalog UIs when paired with full stats merge by **`poolHex`**.

### 3.2 What the D1 Worker **is not**

- **Not** a subgraph: no arbitrary GraphQL over historical events.  
- **Not** reorg-safe history: rows (including **`directory_pool_events`**) reflect **last sync** and a **bounded block window**; no canonical chain rewind semantics, **`indexed_tip_hash`**, or replay idempotency as in **§3.5**.  
- **Not** per-user swap history, PnL, or multihop **receipt attribution**.  
- **Not** a replacement for **`boing_getLogs`** backfill for analytics.

### 3.3 Example product queries (drive indexer design)

These typically **exceed** D1 directory capability and imply **§3.4** pipeline work:

| ID | Query (product language) | Suggested store (illustrative) |
|----|---------------------------|---------------------------------|
| **Q1** | All **swaps** for pool **P** between blocks **B0–B1** with **tx_hash**, **amount_in**, **amount_out**, **sender** | Table **`dex_swaps`** keyed by `(block_height, tx_hash, log_index)` |
| **Q2** | **Pools** created from **factory** with **first_liquidity_block** | Table **`dex_pools_lifecycle`** |
| **Q3** | **User U**’s **add/remove liquidity** events aggregated per pool | Table **`dex_lp_events`** + materialized **`user_pool_totals`** |
| **Q4** | **Multihop** tx: list **inner** pool touches and **per-hop** amounts from **one** receipt | Denormalized **`dex_multihop_legs`** or JSON array on **`dex_swaps`** |
| **Q5** | **24h volume** time-series per pool (not just current window from indexer stats) | **`dex_swap_stats_daily`** rollups |

### 3.4 Pipeline options

| Option | Pros | Cons |
|--------|------|------|
| **External indexer** (dedicated service + Postgres/ClickHouse) | Subgraph-like schemas; horizontal scale | Ops + reorg logic |
| **Extend Observer / OBS-1** ([OBSERVER-HOSTED-SERVICE.md](OBSERVER-HOSTED-SERVICE.md)) | Reuse ingest + rewind patterns | Product-specific tables still must be designed |
| **New heavy `boing_*` RPC** | No extra deploy | Risk of abuse, large responses, node bloat |

**Recommendation:** keep **D1 directory** as **catalog**; put **history** on a **bounded read API** (indexer) with **rate limits**.

### 3.5 Reorg and idempotency (normative for indexers)

| Rule | Detail |
|------|--------|
| **Primary key** | Events unique by **`(block_height, block_hash, log_index)`** or **`(block_hash, tx_hash, log_index)`** — document chosen key. |
| **Reorg** | On parent hash mismatch at height **H**, **delete or mark stale** rows for **H..tip_old**, rewind to common ancestor, **replay** ([INDEXER-RECEIPT-AND-LOG-INGESTION.md](INDEXER-RECEIPT-AND-LOG-INGESTION.md)). |
| **Read API** | Expose **`indexed_tip_height`**, **`indexed_tip_hash`**, **`schema_version`** so clients detect skew. |
| **Idempotent writes** | Upserts on natural key; no duplicate swaps on replay. |

### 3.6 Rollout checklist (subgraph-class)

| Step | Owner | Deliverable |
|------|--------|-------------|
| 1 | **Product** | Prioritize **3–5** queries from §3.3 (must include **Q1**-class if “explorer swaps” is P0). |
| 2 | **Infra** | Choose pipeline (**Observer** vs standalone worker + DB). |
| 3 | **Schema** | Versioned **`v1`** migrations; public **`schema_version`** in API. |
| 4 | **boing.finance** | Read-only **`NEXT_PUBLIC_*`** / **`REACT_APP_*`** base URL for indexer; **no** tx submit through indexer. |
| 5 | **Docs** | SLAs, rate limits, and “not the same as Boing JSON-RPC” disclaimer. |
| 6 | **boing-sdk** (optional) | Typed client for indexer **`/v1/...`** if API stabilizes. |

### 3.7 Shipped (boing.network — bounded snapshot only)

| Piece | Notes |
|-------|------|
| D1 **`0002_directory_pool_events.sql`** | Table **`directory_pool_events`** (includes **`caller_hex`** for indexing). Apply after **`0001`**. |
| D1 **`0003_pool_events_caller_and_tip.sql`** | Table **`directory_indexer_tip`** (singleton row) + index **`idx_dpe_caller_id`**. |
| Worker **`GET /v1/history/pool/{pool_hex}/events`** | Cursor = D1 row **`id`** (`nextCursor`); `limit` default 50, max 200. |
| Worker **`GET /v1/history/user/{caller_hex}/events`** | Same window as pool events; rows where native AMM **`Log2`** **`caller`** matches (bounded snapshot, not “all receipts for user”). |
| Worker **`GET /v1/lp/vault/{vault_hex}/mapping`** | Live RPC: vault storage → **`poolHex` / `shareTokenHex`** (**model A** discovery). |
| Worker **`GET /v1/lp/positions`** | **`501`** — aggregated positions need model-specific enumeration (documented JSON **`detail`**). |
| **`GET /v1/directory/meta`** | **`eventCount`**, optional **`indexedTipHeight`** / **`indexedTipBlockHash`** (compare to chain for skew; Worker does **not** rewind — **§3.5** full reorg handling still open). |
| **SDK** | **`collectNativeDexPoolEventsForPools`**, pool/user event parsers + **`fetchNativeDexDirectoryPoolEventsPage`**, **`fetchNativeDexDirectoryUserEventsPage`**. |

**Still open:** **§3.3** Q2–Q5-class pipelines, **§3.5** rewind/replay/idempotent canonical history, multihop attribution, **§2 B** NFT mint enumeration without a dedicated indexer.

---

## 4. Document maintenance when something ships

When **§1**, **§2**, or **§3** capabilities move from draft to **released**:

### 4.1 Always update (boing.network repo)

| Artifact | Action |
|----------|--------|
| [RPC-API-SPEC.md](RPC-API-SPEC.md) | Method index, full method section, error codes; remove “draft / not implemented” wording for that feature. |
| **OpenAPI / catalog** | Regenerate or edit so **`boing_getRpcOpenApi`** and **`GET /openapi.json`** match. |
| **This file** | Add a **“Shipped”** subsection under the relevant § with **`boing-node` version** (or indexer **API version**) and link to **CHANGELOG / release notes**; strike or archive conflicting draft text. |
| [HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md](HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md) §3 | Shorten “still open” bullets; link to stable spec. |
| [HANDOFF_BOING_FINANCE_NATIVE_DEX_AND_DIRECTORY.md](HANDOFF_BOING_FINANCE_NATIVE_DEX_AND_DIRECTORY.md) §3 | Update env vars and “when ready” table. |
| [BOING-DAPP-INTEGRATION.md](BOING-DAPP-INTEGRATION.md) | Remove “future only” caveats for shipped RPCs; add integration pointers. |

### 4.2 Cross-repo / consumers

| Consumer | Action |
|----------|--------|
| **boing-sdk** | Release note; **`SDK_VERSION`** / npm version bump; typed methods documented. |
| **boing.finance** | Default env templates; remove feature flags when stable. |
| **Boing Express** | [BOING-EXPRESS-WALLET.md](BOING-EXPRESS-WALLET.md) method table + version compatibility. |
| **THREE-CODEBASE-ALIGNMENT.md** | If URLs, method names, or required RPC surface change. |

### 4.3 Git / review discipline

- Protocol PR that adds JSON-RPC **MUST** touch **RPC-API-SPEC** + **`rpc.rs`** list in the **same** PR (or follow-up PR same release).  
- Mark **BREAKING** if params or result keys change after first stable release.

---

## 5. Revision history (editorial)

| Date | Change |
|------|--------|
| 2026-04-10 | Full roadmap document: §1 goals, **`boing_simulateContractCall`** positional recommendation, **`SimulateResult`** / `rpc.rs` alignment, errors, JSON-RPC examples, seven-step rollout + acceptance criteria; §2 models A/B/C with pros/cons, deliverables, protocol/SDK/app checklists; §3 D1 scope, queries Q1–Q5, pipelines, reorg norms, rollout; §4 maintenance + cross-repo + PR discipline. |
| 2026-04-10 | §2.5 / §3.7: document partial **`boing-sdk`** + Worker ship for vault→pool/share reads and bounded **`directory_pool_events`** HTTP; clarify “snapshot / not §3.5” for pool events. |
