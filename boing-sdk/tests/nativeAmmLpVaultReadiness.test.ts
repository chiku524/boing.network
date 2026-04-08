import { describe, expect, it } from 'vitest';
import {
  NATIVE_AMM_LP_VAULT_KEY_CONFIGURED_HEX,
  NATIVE_AMM_LP_VAULT_KEY_POOL_HEX,
  NATIVE_AMM_LP_VAULT_KEY_SHARE_TOKEN_HEX,
  fetchNativeAmmLpVaultProductReadiness,
  fetchNativeAmmLpVaultStorageSnapshot,
} from '../src/nativeAmmLpVault.js';
import {
  LP_SHARE_MINTER_KEY_HEX,
  fetchLpShareTokenMinterAccountHex,
} from '../src/nativeLpShareToken.js';

const vault = ('0x' + '11'.repeat(32)).toLowerCase();
const pool = ('0x' + '22'.repeat(32)).toLowerCase();
const share = ('0x' + '33'.repeat(32)).toLowerCase();

function wordOne() {
  const z = '00'.repeat(31) + '01';
  return `0x${z}`;
}

function wordZero() {
  return `0x${'00'.repeat(32)}`;
}

function wordAccount(hex32: string) {
  return hex32.toLowerCase();
}

describe('native AMM LP vault storage + product readiness', () => {
  it('fetchNativeAmmLpVaultStorageSnapshot reads configured + pool + share', async () => {
    const client = {
      async getContractStorage(contract: string, key: string) {
        expect(contract).toBe(vault);
        if (key === NATIVE_AMM_LP_VAULT_KEY_CONFIGURED_HEX) return { value: wordOne() };
        if (key === NATIVE_AMM_LP_VAULT_KEY_POOL_HEX) return { value: wordAccount(pool) };
        if (key === NATIVE_AMM_LP_VAULT_KEY_SHARE_TOKEN_HEX) return { value: wordAccount(share) };
        throw new Error(`unexpected key ${key}`);
      },
    };
    const snap = await fetchNativeAmmLpVaultStorageSnapshot(client as never, vault);
    expect(snap.configured).toBe(true);
    expect(snap.poolHex?.toLowerCase()).toBe(pool);
    expect(snap.shareTokenHex?.toLowerCase()).toBe(share);
  });

  it('fetchLpShareTokenMinterAccountHex reads minter slot', async () => {
    const client = {
      async getContractStorage(contract: string, key: string) {
        expect(contract).toBe(share);
        expect(key).toBe(LP_SHARE_MINTER_KEY_HEX);
        return { value: wordAccount(vault) };
      },
    };
    const m = await fetchLpShareTokenMinterAccountHex(client as never, share);
    expect(m?.toLowerCase()).toBe(vault);
  });

  it('fetchNativeAmmLpVaultProductReadiness is true when vault configured and minter is vault', async () => {
    const storage = new Map<string, string>([
      [`${vault}|${NATIVE_AMM_LP_VAULT_KEY_CONFIGURED_HEX.toLowerCase()}`, wordOne()],
      [`${vault}|${NATIVE_AMM_LP_VAULT_KEY_POOL_HEX.toLowerCase()}`, wordAccount(pool)],
      [`${vault}|${NATIVE_AMM_LP_VAULT_KEY_SHARE_TOKEN_HEX.toLowerCase()}`, wordAccount(share)],
      [`${share}|${LP_SHARE_MINTER_KEY_HEX.toLowerCase()}`, wordAccount(vault)],
    ]);
    const client = {
      async getContractStorage(contract: string, key: string) {
        const k = `${contract.toLowerCase()}|${key.toLowerCase()}`;
        const v = storage.get(k);
        if (v == null) throw new Error(`missing ${k}`);
        return { value: v };
      },
    };
    const r = await fetchNativeAmmLpVaultProductReadiness(client as never, {
      vaultHex32: vault,
      shareHex32: share,
      expectedPoolHex32: pool,
    });
    expect(r.depositAddReady).toBe(true);
    expect(r.blockingReasons).toEqual([]);
  });

  it('fetchNativeAmmLpVaultProductReadiness blocks when minter unset', async () => {
    const storage = new Map<string, string>([
      [`${vault}|${NATIVE_AMM_LP_VAULT_KEY_CONFIGURED_HEX.toLowerCase()}`, wordOne()],
      [`${vault}|${NATIVE_AMM_LP_VAULT_KEY_POOL_HEX.toLowerCase()}`, wordAccount(pool)],
      [`${vault}|${NATIVE_AMM_LP_VAULT_KEY_SHARE_TOKEN_HEX.toLowerCase()}`, wordAccount(share)],
      [`${share}|${LP_SHARE_MINTER_KEY_HEX.toLowerCase()}`, wordZero()],
    ]);
    const client = {
      async getContractStorage(contract: string, key: string) {
        const k = `${contract.toLowerCase()}|${key.toLowerCase()}`;
        const v = storage.get(k);
        if (v == null) throw new Error(`missing ${k}`);
        return { value: v };
      },
    };
    const r = await fetchNativeAmmLpVaultProductReadiness(client as never, {
      vaultHex32: vault,
      shareHex32: share,
      expectedPoolHex32: pool,
    });
    expect(r.depositAddReady).toBe(false);
    expect(r.blockingReasons.some((x) => x === 'share_minter_not_vault')).toBe(true);
  });
});
