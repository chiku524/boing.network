# Handoff: DEX discovery for consumer apps (`boing.finance`, `boing.observer`, `boing.express`)

**Audience:** Maintainers of Boing-facing UIs, explorers, and API surfaces  
**Source of truth (this repo):** `docs/RPC-API-SPEC.md` § *boing_listDexPools / boing_listDexTokens / boing_getDexToken*, `docs/HANDOFF_Boing_Network_Global_Token_Discovery.md`, `crates/boing-node/schemas/developer_api.json`  
**SDK:** **`boing-sdk@^0.3.1`** on [npm](https://www.npmjs.com/package/boing-sdk) — `BoingClient.listDexPoolsPage`, `listDexTokensPage`, `getDexToken`, related types (`DexPoolListRow`, `DexTokenListRow`, diagnostics types).

**Universal deploy feed (all `ContractDeploy*`, not DEX-only):** [HANDOFF_Universal_Contract_Deploy_Indexer.md](HANDOFF_Universal_Contract_Deploy_Indexer.md) and `workers/deploy-registry-indexer`.

---

## 1. Does publishing `boing-sdk` mean there is a “global token DEX”?

**No.** Publishing the SDK only ships **TypeScript client helpers and types**. It does **not** deploy contracts, create pools, or turn on trading by itself.

What **does** exist (when you point clients at a **current Boing node** that exposes the methods and has a configured factory):


| Concept                                 | Reality                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **“Global token list” in an EVM sense** | Still **not** a thing: there is no chain-wide “list every token account” RPC.                                                                                                                                                                                                             |
| **DEX-derived discovery**               | **Yes (L1):** `**boing_listDexTokens`** returns every **32-byte token id that appears in at least one pool** registered under the configured **native DEX factory** (plus filters). That is the deliberate **trade-relevant** universe—same design spirit as major DEX UIs (pools first). |
| **Liquidity / swaps**                   | Unchanged: pools and swaps are whatever is already deployed on-chain; discovery only **surfaces** them via RPC.                                                                                                                                                                           |


So: **global DEX-derived token *discovery*** (paginated, verifiable from factory + pool state) is what shipped—not a new magical “global DEX” product.

---

## 2. Integration checklist (all three projects)

1. **Node / RPC** — Target JSON-RPC must implement `**boing_listDexPools`**, `**boing_listDexTokens`**, `**boing_getDexToken**` (see spec). Operators set `**BOING_CANONICAL_NATIVE_DEX_FACTORY**` (or clients pass `**params.factory**` per call).
2. **Dependency** — Pin **`boing-sdk@^0.3.1`** (or newer). Breaking note for TS: **`DexPoolListRow`** requires **`tokenADecimals`** / **`tokenBDecimals`** if you construct rows locally; parsing node JSON is unchanged for current nodes.
3. **Pagination** — Treat `**nextCursor**` as opaque; pool cursors are implementation-defined (`**i{index}**` today); token cursors use last `**id**`.
4. **Fast path** — Use `**light: true**` (or `**enrich: false**`) when you only need directory + reserves and can skip `**createdAtHeight**` / `**firstSeenHeight**` / deploy metadata scans.
5. **Trust UX** — Discovery = **existence**, not endorsement (spam / low-liquidity pools may still appear; use `**minReserveProduct**` / `**minLiquidityWei**` on token listing where appropriate).

---

## 3. `boing.finance`

**Goal:** Prefer **L1 discovery** for native token/pool pickers and fall back to **L2 indexer JSON** for enrichment (TVL, history, labels), matching the architecture in [HANDOFF_Boing_Network_Global_Token_Discovery.md](HANDOFF_Boing_Network_Global_Token_Discovery.md).

**Suggested work:**


| Area                   | Action                                                                                                                                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dependencies**       | Bump **`boing-sdk`** to **`^0.3.1`**; run through swap / pool flows.                                                                                                                                                                                                                    |
| **Native token lists** | Where you today merge **venues + indexer + env**, also merge pages from `**listDexTokensPage**` (and optionally `**listDexPoolsPage**` for pool-centric views). Respect `**factory**` from network defaults or user override if you support multiple directories later.                 |
| **Decimals**           | Use `**tokenADecimals` / `tokenBDecimals**` from `**listDexPoolsPage**` for pool rows; `**decimals**` on token rows from `**listDexTokensPage**` / `**getDexToken**`. Optional: align with node operator `**BOING_DEX_TOKEN_DECIMALS_JSON**` if you document overrides for power users. |
| **Indexer URL**        | Keep `**resolveNativeDexIndexerStatsUrl()**` and `**tokens` / `tokenDirectory**` compatibility; indexer stats built with `**buildNativeDexIndexerStatsForClient**` already merge `**createdAtHeight**` and per-leg decimals from `**boing_listDexPools**` when RPC supports it.         |
| **RPC capability**     | Use `**boing_rpcSupportedMethods**` / `**boing_getRpcMethodCatalog**` (or `**preflightRpc**`) to detect discovery methods and degrade gracefully on older nodes.                                                                                                                        |


**Copy:** Mirror or link this repo’s implementation note into `boing.finance/docs/` if you keep a parallel handoff file there.

---

## 4. `boing.observer` (explorer / telemetry)

**Typical goals:** Surface **registered pools**, **two hop tokens**, and **links** into account / transaction views without reimplementing factory storage layout.

**Suggested work:**


| Area                         | Action                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **“Pools” or “DEX” section** | Page `**boing_listDexPools**` with the same `**factory**` as the network’s canonical factory (from `**boing_getNetworkInfo.end_user.canonical_native_dex_factory**` when present). Show `**poolHex**`, `**tokenAHex**`, `**tokenBHex**`, `**reserveA` / `reserveB**`, `**createdAtHeight**`, `**feeBps**`, `**tokenADecimals` / `tokenBDecimals**`. |
| **Token directory page**     | Page `**boing_listDexTokens**` for the DEX-derived universe; show `**poolCount**`, `**firstSeenHeight**`, `**metadataSource**`, `**decimals**`.                                                                                                                                                                                                     |
| **Account detail**           | If the account id appears in `**boing_getDexToken**` (non-null), show a **“In DEX universe”** badge and link to token/pool views.                                                                                                                                                                                                                   |
| **Diagnostics**              | For internal ops dashboards only, call with `**includeDiagnostics: true**` to inspect `**receiptScans**`, `**receiptScanCapped**`, deploy-scan stats—avoid exposing raw diagnostics to end users unless you explain caps.                                                                                                                           |
| **Implementation**           | Prefer `**boing-sdk**` + shared `**validateHex32**` patterns so hex handling stays consistent with `**boing.finance**`.                                                                                                                                                                                                                             |


---

## 5. `boing.express` (API / gateway / automation)

**Typical goals:** Stable **HTTP or server-side** access to discovery for partners, scripts, or BFFs—without each integrator parsing bincode or factory storage.

**Suggested work:**


| Area            | Action                                                                                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Passthrough** | If `**boing.express**` proxies Boing JSON-RPC, forward `**boing_listDexPools**`, `**boing_listDexTokens**`, `**boing_getDexToken**` unchanged and document them in your **OpenAPI** / partner docs (params: `**factory**`, `**cursor**`, `**limit**`, `**light**`, `**includeDiagnostics**`, token filters). |
| **Caching**     | Discovery reads are **state reads** at a height; cache keys should include `**factory` + cursor + limit + light`** (and filter params). Invalidate or shorten TTL near tip if you need freshness for reserves.                                                                                               |
| **Rate limits** | Align with node `**boing_health.rpc_surface`** and HTTP rate limits; prefer **server-side** pagination over client loops that hammer `**limit=500`**.                                                                                                                                                        |
| **Auth**        | If you add API keys, do not conflate **authenticated API access** with **token safety**; discovery remains **existence-only**.                                                                                                                                                                               |


*(Adjust section titles if `**boing.express*`* is not an API gateway—reuse the same RPC contract bullets for whatever surface exposes Boing to integrators.)*

---

## 6. Quick reference — RPC methods (names only)


| Method                    | Role                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `**boing_listDexPools`**  | Paginated pools under a factory + live reserves + `**createdAtHeight`** (+ per-leg decimals). |
| `**boing_listDexTokens*`* | Paginated **DEX-derived token set** (tokens that appear in any listed pool under filters).    |
| `**boing_getDexToken`**   | Single-row lookup or `**null`**.                                                              |


Environment and operator knobs (node): `**BOING_CANONICAL_NATIVE_DEX_FACTORY`**, `**BOING_DEX_TOKEN_METADATA_SCAN_BLOCKS`**, `**BOING_DEX_DISCOVERY_MAX_RECEIPT_SCANS**`, `**BOING_DEX_TOKEN_DECIMALS_JSON**` — see `**docs/RPC-API-SPEC.md**` and `**tools/boing-node-public-testnet.env.example**`.

---

## 7. Verification

- **From repo:** `cargo test -p boing-node --test native_dex_factory_rpc_happy_path`  
- **SDK:** `npm test` in `**boing-sdk/`** (includes `**nativeDexDiscoveryRpc`** tests).

---

*Keep this file aligned with `boing-sdk` releases and any RPC field additions (update §2–§6 and npm version line).*