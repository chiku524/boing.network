/**
 * Native AMM LP vault calldata + Express / JSON-RPC access lists. Matches `boing_execution::native_amm_lp_vault`.
 * See `docs/NATIVE-AMM-LP-VAULT.md`.
 */
import type { BoingClient } from './client.js';
import type { SimulateResult } from './types.js';
/** `configure(pool, share_token)` — **96** bytes. */
export declare const SELECTOR_NATIVE_AMM_LP_VAULT_CONFIGURE = 192;
/** `deposit_add(inner_add_liquidity_128, min_lp)` — **192** bytes. */
export declare const SELECTOR_NATIVE_AMM_LP_VAULT_DEPOSIT_ADD = 193;
/** `boing_getContractStorage` — non-zero after successful **`configure`**. */
export declare const NATIVE_AMM_LP_VAULT_KEY_CONFIGURED_HEX: `0x${string}`;
/** Configured native CP **pool** `AccountId`. */
export declare const NATIVE_AMM_LP_VAULT_KEY_POOL_HEX: `0x${string}`;
/** Configured **LP share token** `AccountId`. */
export declare const NATIVE_AMM_LP_VAULT_KEY_SHARE_TOKEN_HEX: `0x${string}`;
export type NativeAmmLpVaultStorageSnapshot = {
    /** `configure` has been executed (configured word ≠ 0). */
    configured: boolean;
    poolHex: `0x${string}` | null;
    shareTokenHex: `0x${string}` | null;
};
/**
 * Read vault **`configure`** state from **`boing_getContractStorage`** (three parallel reads).
 */
export declare function fetchNativeAmmLpVaultStorageSnapshot(client: BoingClient, vaultHex32: string): Promise<NativeAmmLpVaultStorageSnapshot>;
export type NativeAmmLpVaultProductReadiness = {
    /** False when **`boing_getContractStorage`** fails for the vault (missing account, RPC error, etc.). */
    vaultRpcOk: boolean;
    vaultRpcError?: string;
    vault: NativeAmmLpVaultStorageSnapshot;
    /** From share token minter slot. */
    shareMinterHex: `0x${string}` | null;
    /**
     * Vault configured, share minter equals vault, stored share id matches **`shareHex32`**, and
     * **`expectedPoolHex32`** when provided equals stored pool.
     */
    depositAddReady: boolean;
    /** Human-readable blockers for UI (empty when **`depositAddReady`**). */
    blockingReasons: string[];
};
/**
 * Probe whether the **LP vault product path** is safe to expose (**`deposit_add`**): vault
 * **`configure(pool, share)`** done and LP share **`set_minter_once`** set the vault as minter.
 * Optional **`expectedPoolHex32`** enforces the configured pool matches integration defaults.
 */
export declare function fetchNativeAmmLpVaultProductReadiness(client: BoingClient, input: {
    vaultHex32: string;
    shareHex32: string;
    expectedPoolHex32?: string | undefined;
}): Promise<NativeAmmLpVaultProductReadiness>;
export declare function encodeNativeAmmLpVaultConfigureCalldata(poolHex32: string, shareTokenHex32: string): Uint8Array;
export declare function encodeNativeAmmLpVaultConfigureCalldataHex(poolHex32: string, shareTokenHex32: string): string;
export declare function encodeNativeAmmLpVaultDepositAddCalldata(innerAddLiquidity128: Uint8Array, minLp: bigint): Uint8Array;
export declare function encodeNativeAmmLpVaultDepositAddCalldataHex(innerAddLiquidity128: Uint8Array, minLp: bigint): string;
/** `read` / `write`: signer + vault (parallel scheduling minimum for configure-only). */
export declare function buildNativeAmmLpVaultConfigureAccessList(senderHex32: string, vaultHex32: string): {
    read: string[];
    write: string[];
};
/**
 * `read` / `write`: signer + vault + pool + share token (`deposit_add` nested `Call`s).
 */
export declare function buildNativeAmmLpVaultDepositAddAccessList(senderHex32: string, vaultHex32: string, poolHex32: string, shareTokenHex32: string): {
    read: string[];
    write: string[];
};
export declare function mergeNativeAmmLpVaultConfigureAccessListWithSimulation(senderHex32: string, vaultHex32: string, sim: SimulateResult): {
    read: string[];
    write: string[];
};
export declare function mergeNativeAmmLpVaultDepositAddAccessListWithSimulation(senderHex32: string, vaultHex32: string, poolHex32: string, shareTokenHex32: string, sim: SimulateResult): {
    read: string[];
    write: string[];
};
export declare function buildNativeAmmLpVaultConfigureContractCallTx(senderHex32: string, vaultHex32: string, calldataHex: string): {
    type: 'contract_call';
    contract: string;
    calldata: string;
    access_list: {
        read: string[];
        write: string[];
    };
};
export declare function buildNativeAmmLpVaultDepositAddContractCallTx(senderHex32: string, vaultHex32: string, poolHex32: string, shareTokenHex32: string, calldataHex: string): {
    type: 'contract_call';
    contract: string;
    calldata: string;
    access_list: {
        read: string[];
        write: string[];
    };
};
//# sourceMappingURL=nativeAmmLpVault.d.ts.map