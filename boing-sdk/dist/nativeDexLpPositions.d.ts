/**
 * Resolve native LP **vault → pool / share token** from on-chain storage (model **A** path) and
 * read **LP share balances** for an owner. Replaces static env maps when the vault is configured.
 *
 * See [NATIVE-AMM-LP-VAULT.md](../docs/NATIVE-AMM-LP-VAULT.md), [PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md](../docs/PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md) §2.
 */
import type { BoingClient } from './client.js';
export type NativeAmmVaultPoolResolution = {
    vaultHex: `0x${string}`;
    configured: boolean;
    poolHex: `0x${string}` | null;
    shareTokenHex: `0x${string}` | null;
};
/**
 * Read **`configure(pool, share)`** storage for one vault (`boing_getContractStorage`).
 */
export declare function resolveNativeAmmVaultPoolMapping(client: BoingClient, vaultHex32: string): Promise<NativeAmmVaultPoolResolution>;
/**
 * Parallel **`resolveNativeAmmVaultPoolMapping`** (bounded concurrency).
 */
export declare function resolveNativeAmmVaultPoolMappings(client: BoingClient, vaultHexes: readonly string[], concurrency?: number): Promise<NativeAmmVaultPoolResolution[]>;
export type NativeDexLpVaultSharePositionForOwner = {
    vaultHex: `0x${string}`;
    ownerHex: `0x${string}`;
    poolHex: `0x${string}` | null;
    shareTokenHex: `0x${string}` | null;
    /** LP share units (u128) when vault configured and share token known; otherwise `null`. */
    shareBalanceRaw: bigint | null;
    note: string;
};
/**
 * **Model A (vault + share token):** resolve vault storage, then read holder balance on the share token.
 * Does not prove minter is the vault — use **`fetchNativeAmmLpVaultProductReadiness`** for product gating.
 */
export declare function fetchNativeDexLpVaultSharePositionForOwner(client: BoingClient, input: {
    vaultHex32: string;
    ownerHex32: string;
}): Promise<NativeDexLpVaultSharePositionForOwner>;
//# sourceMappingURL=nativeDexLpPositions.d.ts.map