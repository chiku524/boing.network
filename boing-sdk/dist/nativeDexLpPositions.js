/**
 * Resolve native LP **vault → pool / share token** from on-chain storage (model **A** path) and
 * read **LP share balances** for an owner. Replaces static env maps when the vault is configured.
 *
 * See [NATIVE-AMM-LP-VAULT.md](../docs/NATIVE-AMM-LP-VAULT.md), [PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md](../docs/PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md) §2.
 */
import { validateHex32 } from './hex.js';
import { mapWithConcurrencyLimit } from './indexerBatch.js';
import { fetchNativeAmmLpVaultStorageSnapshot } from './nativeAmmLpVault.js';
import { fetchLpShareTokenBalanceRaw } from './nativeLpShareToken.js';
/**
 * Read **`configure(pool, share)`** storage for one vault (`boing_getContractStorage`).
 */
export async function resolveNativeAmmVaultPoolMapping(client, vaultHex32) {
    const vaultHex = validateHex32(vaultHex32).toLowerCase();
    const snap = await fetchNativeAmmLpVaultStorageSnapshot(client, vaultHex);
    return {
        vaultHex,
        configured: snap.configured,
        poolHex: snap.poolHex,
        shareTokenHex: snap.shareTokenHex,
    };
}
/**
 * Parallel **`resolveNativeAmmVaultPoolMapping`** (bounded concurrency).
 */
export async function resolveNativeAmmVaultPoolMappings(client, vaultHexes, concurrency = 4) {
    return mapWithConcurrencyLimit([...vaultHexes], concurrency, (v) => resolveNativeAmmVaultPoolMapping(client, v));
}
/**
 * **Model A (vault + share token):** resolve vault storage, then read holder balance on the share token.
 * Does not prove minter is the vault — use **`fetchNativeAmmLpVaultProductReadiness`** for product gating.
 */
export async function fetchNativeDexLpVaultSharePositionForOwner(client, input) {
    const vaultHex = validateHex32(input.vaultHex32).toLowerCase();
    const ownerHex = validateHex32(input.ownerHex32).toLowerCase();
    const snap = await fetchNativeAmmLpVaultStorageSnapshot(client, vaultHex);
    if (!snap.configured || snap.shareTokenHex == null) {
        return {
            vaultHex,
            ownerHex,
            poolHex: snap.poolHex,
            shareTokenHex: snap.shareTokenHex,
            shareBalanceRaw: null,
            note: snap.configured ? 'vault_missing_share_token' : 'vault_not_configured',
        };
    }
    try {
        const shareBalanceRaw = await fetchLpShareTokenBalanceRaw(client, snap.shareTokenHex, ownerHex);
        return {
            vaultHex,
            ownerHex,
            poolHex: snap.poolHex,
            shareTokenHex: snap.shareTokenHex,
            shareBalanceRaw,
            note: 'ok',
        };
    }
    catch (e) {
        return {
            vaultHex,
            ownerHex,
            poolHex: snap.poolHex,
            shareTokenHex: snap.shareTokenHex,
            shareBalanceRaw: null,
            note: e instanceof Error ? e.message : String(e),
        };
    }
}
