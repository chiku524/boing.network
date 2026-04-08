/**
 * Native AMM LP vault calldata + Express / JSON-RPC access lists. Matches `boing_execution::native_amm_lp_vault`.
 * See `docs/NATIVE-AMM-LP-VAULT.md`.
 */

import { mergeAccessListWithSimulation } from './accessList.js';
import type { BoingClient } from './client.js';
import {
  bytesToHex,
  decodeBoingStorageWordAccountId,
  ensureHex,
  hexToBytes,
  validateHex32,
} from './hex.js';
import { decodeBoingStorageWordU128 } from './nativeAmmPool.js';
import { fetchLpShareTokenMinterAccountHex } from './nativeLpShareToken.js';
import type { SimulateResult } from './types.js';

/** `configure(pool, share_token)` — **96** bytes. */
export const SELECTOR_NATIVE_AMM_LP_VAULT_CONFIGURE = 0xc0;
/** `deposit_add(inner_add_liquidity_128, min_lp)` — **192** bytes. */
export const SELECTOR_NATIVE_AMM_LP_VAULT_DEPOSIT_ADD = 0xc1;

function nativeAmmLpVaultStorageKeyHex(lastByte: number): `0x${string}` {
  const k = new Uint8Array(32);
  k[31] = lastByte & 0xff;
  return validateHex32(bytesToHex(k)) as `0x${string}`;
}

/** `boing_getContractStorage` — non-zero after successful **`configure`**. */
export const NATIVE_AMM_LP_VAULT_KEY_CONFIGURED_HEX = nativeAmmLpVaultStorageKeyHex(0xd1);
/** Configured native CP **pool** `AccountId`. */
export const NATIVE_AMM_LP_VAULT_KEY_POOL_HEX = nativeAmmLpVaultStorageKeyHex(0xd2);
/** Configured **LP share token** `AccountId`. */
export const NATIVE_AMM_LP_VAULT_KEY_SHARE_TOKEN_HEX = nativeAmmLpVaultStorageKeyHex(0xd3);

export type NativeAmmLpVaultStorageSnapshot = {
  /** `configure` has been executed (configured word ≠ 0). */
  configured: boolean;
  poolHex: `0x${string}` | null;
  shareTokenHex: `0x${string}` | null;
};

/**
 * Read vault **`configure`** state from **`boing_getContractStorage`** (three parallel reads).
 */
export async function fetchNativeAmmLpVaultStorageSnapshot(
  client: BoingClient,
  vaultHex32: string
): Promise<NativeAmmLpVaultStorageSnapshot> {
  const vault = validateHex32(vaultHex32);
  const [wc, wp, ws] = await Promise.all([
    client.getContractStorage(vault, NATIVE_AMM_LP_VAULT_KEY_CONFIGURED_HEX),
    client.getContractStorage(vault, NATIVE_AMM_LP_VAULT_KEY_POOL_HEX),
    client.getContractStorage(vault, NATIVE_AMM_LP_VAULT_KEY_SHARE_TOKEN_HEX),
  ]);
  const configured = decodeBoingStorageWordU128(wc.value) !== 0n;
  return {
    configured,
    poolHex: decodeBoingStorageWordAccountId(wp.value),
    shareTokenHex: decodeBoingStorageWordAccountId(ws.value),
  };
}

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
export async function fetchNativeAmmLpVaultProductReadiness(
  client: BoingClient,
  input: {
    vaultHex32: string;
    shareHex32: string;
    expectedPoolHex32?: string | undefined;
  }
): Promise<NativeAmmLpVaultProductReadiness> {
  const vaultNorm = validateHex32(input.vaultHex32).toLowerCase() as `0x${string}`;
  const shareNorm = validateHex32(input.shareHex32).toLowerCase() as `0x${string}`;
  const expectedPool =
    input.expectedPoolHex32 != null && String(input.expectedPoolHex32).trim()
      ? (validateHex32(String(input.expectedPoolHex32).trim()).toLowerCase() as `0x${string}`)
      : undefined;

  let vaultRpcOk = true;
  let vaultRpcError: string | undefined;
  let vault: NativeAmmLpVaultStorageSnapshot = {
    configured: false,
    poolHex: null,
    shareTokenHex: null,
  };
  let shareMinterHex: `0x${string}` | null = null;

  try {
    vault = await fetchNativeAmmLpVaultStorageSnapshot(client, vaultNorm);
  } catch (e) {
    vaultRpcOk = false;
    vaultRpcError = e instanceof Error ? e.message : String(e);
  }

  let shareMinterReadError: string | undefined;
  try {
    shareMinterHex = await fetchLpShareTokenMinterAccountHex(client, shareNorm);
  } catch (e) {
    shareMinterReadError = e instanceof Error ? e.message : String(e);
  }

  const blockingReasons: string[] = [];
  if (!vaultRpcOk) {
    blockingReasons.push(vaultRpcError != null ? `vault_storage: ${vaultRpcError}` : 'vault_storage: error');
  }
  if (!vault.configured) {
    blockingReasons.push('vault_not_configured');
  }
  if (vault.shareTokenHex == null || vault.shareTokenHex.toLowerCase() !== shareNorm) {
    blockingReasons.push('vault_share_mismatch');
  }
  if (expectedPool != null && (vault.poolHex == null || vault.poolHex.toLowerCase() !== expectedPool)) {
    blockingReasons.push('vault_pool_mismatch');
  }
  if (shareMinterReadError != null) {
    blockingReasons.push(`share_minter_read: ${shareMinterReadError}`);
  } else if (shareMinterHex == null || shareMinterHex.toLowerCase() !== vaultNorm) {
    blockingReasons.push('share_minter_not_vault');
  }

  const depositAddReady = blockingReasons.length === 0;

  return {
    vaultRpcOk,
    ...(vaultRpcError != null ? { vaultRpcError } : {}),
    vault,
    shareMinterHex,
    depositAddReady,
    blockingReasons: depositAddReady ? [] : blockingReasons,
  };
}

function selectorWord(selector: number): Uint8Array {
  const w = new Uint8Array(32);
  w[31] = selector & 0xff;
  return w;
}

const CALldata_HEX_RE = /^[0-9a-fA-F]+$/;

function normalizeCalldataHex(calldataHex: string): string {
  const h = ensureHex(calldataHex.trim());
  const raw = h.slice(2);
  if (raw.length % 2 !== 0) {
    throw new Error('calldata must be even-length hex');
  }
  if (!CALldata_HEX_RE.test(raw)) {
    throw new Error('calldata: invalid hex');
  }
  return `0x${raw.toLowerCase()}`;
}

function sortedUniqueAccounts(hex32List: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of hex32List) {
    const h = validateHex32(x).toLowerCase();
    if (!seen.has(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  out.sort();
  return out;
}

function amountWord(amount: bigint): Uint8Array {
  const w = new Uint8Array(32);
  if (amount < 0n || amount > (1n << 128n) - 1n) {
    throw new RangeError('amount must fit in u128');
  }
  const be = new Uint8Array(16);
  let x = amount;
  for (let i = 15; i >= 0; i--) {
    be[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  w.set(be, 16);
  return w;
}

export function encodeNativeAmmLpVaultConfigureCalldata(poolHex32: string, shareTokenHex32: string): Uint8Array {
  const out = new Uint8Array(96);
  out.set(selectorWord(SELECTOR_NATIVE_AMM_LP_VAULT_CONFIGURE));
  out.set(hexToBytes(validateHex32(poolHex32)), 32);
  out.set(hexToBytes(validateHex32(shareTokenHex32)), 64);
  return out;
}

export function encodeNativeAmmLpVaultConfigureCalldataHex(poolHex32: string, shareTokenHex32: string): string {
  return bytesToHex(encodeNativeAmmLpVaultConfigureCalldata(poolHex32, shareTokenHex32));
}

export function encodeNativeAmmLpVaultDepositAddCalldata(innerAddLiquidity128: Uint8Array, minLp: bigint): Uint8Array {
  if (innerAddLiquidity128.length !== 128) {
    throw new Error('inner add_liquidity calldata must be 128 bytes');
  }
  const out = new Uint8Array(192);
  out.set(selectorWord(SELECTOR_NATIVE_AMM_LP_VAULT_DEPOSIT_ADD));
  out.set(innerAddLiquidity128, 32);
  out.set(amountWord(minLp), 160);
  return out;
}

export function encodeNativeAmmLpVaultDepositAddCalldataHex(
  innerAddLiquidity128: Uint8Array,
  minLp: bigint
): string {
  return bytesToHex(encodeNativeAmmLpVaultDepositAddCalldata(innerAddLiquidity128, minLp));
}

/** `read` / `write`: signer + vault (parallel scheduling minimum for configure-only). */
export function buildNativeAmmLpVaultConfigureAccessList(
  senderHex32: string,
  vaultHex32: string
): { read: string[]; write: string[] } {
  const accounts = sortedUniqueAccounts([senderHex32, vaultHex32]);
  return { read: accounts, write: [...accounts] };
}

/**
 * `read` / `write`: signer + vault + pool + share token (`deposit_add` nested `Call`s).
 */
export function buildNativeAmmLpVaultDepositAddAccessList(
  senderHex32: string,
  vaultHex32: string,
  poolHex32: string,
  shareTokenHex32: string
): { read: string[]; write: string[] } {
  const accounts = sortedUniqueAccounts([senderHex32, vaultHex32, poolHex32, shareTokenHex32]);
  return { read: accounts, write: [...accounts] };
}

export function mergeNativeAmmLpVaultConfigureAccessListWithSimulation(
  senderHex32: string,
  vaultHex32: string,
  sim: SimulateResult
): { read: string[]; write: string[] } {
  const base = buildNativeAmmLpVaultConfigureAccessList(senderHex32, vaultHex32);
  return mergeAccessListWithSimulation(base.read, base.write, sim);
}

export function mergeNativeAmmLpVaultDepositAddAccessListWithSimulation(
  senderHex32: string,
  vaultHex32: string,
  poolHex32: string,
  shareTokenHex32: string,
  sim: SimulateResult
): { read: string[]; write: string[] } {
  const base = buildNativeAmmLpVaultDepositAddAccessList(senderHex32, vaultHex32, poolHex32, shareTokenHex32);
  return mergeAccessListWithSimulation(base.read, base.write, sim);
}

export function buildNativeAmmLpVaultConfigureContractCallTx(
  senderHex32: string,
  vaultHex32: string,
  calldataHex: string
): {
  type: 'contract_call';
  contract: string;
  calldata: string;
  access_list: { read: string[]; write: string[] };
} {
  return {
    type: 'contract_call',
    contract: validateHex32(vaultHex32).toLowerCase(),
    calldata: normalizeCalldataHex(calldataHex),
    access_list: buildNativeAmmLpVaultConfigureAccessList(senderHex32, vaultHex32),
  };
}

export function buildNativeAmmLpVaultDepositAddContractCallTx(
  senderHex32: string,
  vaultHex32: string,
  poolHex32: string,
  shareTokenHex32: string,
  calldataHex: string
): {
  type: 'contract_call';
  contract: string;
  calldata: string;
  access_list: { read: string[]; write: string[] };
} {
  return {
    type: 'contract_call',
    contract: validateHex32(vaultHex32).toLowerCase(),
    calldata: normalizeCalldataHex(calldataHex),
    access_list: buildNativeAmmLpVaultDepositAddAccessList(senderHex32, vaultHex32, poolHex32, shareTokenHex32),
  };
}
