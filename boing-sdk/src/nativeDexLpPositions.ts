/**
 * Resolve native LP **vault → pool / share token** from on-chain storage (model **A** path) and
 * read **LP share balances** for an owner. Replaces static env maps when the vault is configured.
 *
 * See [NATIVE-AMM-LP-VAULT.md](../docs/NATIVE-AMM-LP-VAULT.md), [PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md](../docs/PROTOCOL_NATIVE_DEX_RPC_AND_INDEXING_ROADMAP.md) §2.
 */

import type { BoingClient } from './client.js';
import { validateHex32 } from './hex.js';
import { mapWithConcurrencyLimit } from './indexerBatch.js';
import { fetchNativeAmmLpVaultStorageSnapshot } from './nativeAmmLpVault.js';
import { fetchLpShareTokenBalanceRaw } from './nativeLpShareToken.js';

export type NativeAmmVaultPoolResolution = {
  vaultHex: `0x${string}`;
  configured: boolean;
  poolHex: `0x${string}` | null;
  shareTokenHex: `0x${string}` | null;
};

/**
 * Read **`configure(pool, share)`** storage for one vault (`boing_getContractStorage`).
 */
export async function resolveNativeAmmVaultPoolMapping(
  client: BoingClient,
  vaultHex32: string,
): Promise<NativeAmmVaultPoolResolution> {
  const vaultHex = validateHex32(vaultHex32).toLowerCase() as `0x${string}`;
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
export async function resolveNativeAmmVaultPoolMappings(
  client: BoingClient,
  vaultHexes: readonly string[],
  concurrency: number = 4,
): Promise<NativeAmmVaultPoolResolution[]> {
  return mapWithConcurrencyLimit([...vaultHexes], concurrency, (v) =>
    resolveNativeAmmVaultPoolMapping(client, v),
  );
}

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
export async function fetchNativeDexLpVaultSharePositionForOwner(
  client: BoingClient,
  input: { vaultHex32: string; ownerHex32: string },
): Promise<NativeDexLpVaultSharePositionForOwner> {
  const vaultHex = validateHex32(input.vaultHex32).toLowerCase() as `0x${string}`;
  const ownerHex = validateHex32(input.ownerHex32).toLowerCase() as `0x${string}`;
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
  } catch (e) {
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
