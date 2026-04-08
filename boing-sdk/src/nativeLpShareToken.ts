/**
 * LP share token calldata (minter-gated `mint` + `transfer`) + Express / JSON-RPC access lists.
 * Matches `boing_execution::native_lp_share_token`.
 * See `docs/NATIVE-LP-SHARE-TOKEN.md`.
 */

import { mergeAccessListWithSimulation } from './accessList.js';
import type { BoingClient } from './client.js';
import { bytesToHex, decodeBoingStorageWordAccountId, ensureHex, hexToBytes, validateHex32 } from './hex.js';
import type { SimulateResult } from './types.js';

/** `transfer(to, amount)` — **96** bytes. */
export const SELECTOR_LP_SHARE_TRANSFER = 0x01;
/** `mint(to, amount)` — **96** bytes; only minter may call. */
export const SELECTOR_LP_SHARE_MINT = 0x06;
/** `set_minter_once(minter)` — **64** bytes. */
export const SELECTOR_LP_SHARE_SET_MINTER_ONCE = 0x07;

/** Storage key for minter slot (`k[31] == 0xb1`), 32-byte word. */
export const LP_SHARE_MINTER_KEY_U8: Uint8Array = (() => {
  const k = new Uint8Array(32);
  k[31] = 0xb1;
  return k;
})();

/** `boing_getContractStorage` key for LP share **minter** (`native_lp_share_token::LP_SHARE_MINTER_KEY`). */
export const LP_SHARE_MINTER_KEY_HEX = validateHex32(bytesToHex(LP_SHARE_MINTER_KEY_U8)) as `0x${string}`;

/**
 * Read designated **minter** `AccountId` for the LP share token, or **`null`** if unset (all-zero word).
 */
export async function fetchLpShareTokenMinterAccountHex(
  client: BoingClient,
  shareHex32: string
): Promise<`0x${string}` | null> {
  const share = validateHex32(shareHex32);
  const w = await client.getContractStorage(share, LP_SHARE_MINTER_KEY_HEX);
  return decodeBoingStorageWordAccountId(w.value);
}

function selectorWord(selector: number): Uint8Array {
  const w = new Uint8Array(32);
  w[31] = selector & 0xff;
  return w;
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

export function encodeLpShareTransferCalldata(toHex32: string, amount: bigint): Uint8Array {
  const out = new Uint8Array(96);
  out.set(selectorWord(SELECTOR_LP_SHARE_TRANSFER));
  out.set(hexToBytes(validateHex32(toHex32)), 32);
  out.set(amountWord(amount), 64);
  return out;
}

export function encodeLpShareTransferCalldataHex(toHex32: string, amount: bigint): string {
  return bytesToHex(encodeLpShareTransferCalldata(toHex32, amount));
}

export function encodeLpShareMintCalldata(toHex32: string, amount: bigint): Uint8Array {
  const out = new Uint8Array(96);
  out.set(selectorWord(SELECTOR_LP_SHARE_MINT));
  out.set(hexToBytes(validateHex32(toHex32)), 32);
  out.set(amountWord(amount), 64);
  return out;
}

export function encodeLpShareMintCalldataHex(toHex32: string, amount: bigint): string {
  return bytesToHex(encodeLpShareMintCalldata(toHex32, amount));
}

export function encodeLpShareSetMinterOnceCalldata(minterHex32: string): Uint8Array {
  const out = new Uint8Array(64);
  out.set(selectorWord(SELECTOR_LP_SHARE_SET_MINTER_ONCE));
  out.set(hexToBytes(validateHex32(minterHex32)), 32);
  return out;
}

export function encodeLpShareSetMinterOnceCalldataHex(minterHex32: string): string {
  return bytesToHex(encodeLpShareSetMinterOnceCalldata(minterHex32));
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

/** `read` / `write`: signer + share token contract (parallel-scheduling minimum). */
export function buildLpShareTokenAccessList(
  senderHex32: string,
  shareTokenHex32: string
): { read: string[]; write: string[] } {
  const s = validateHex32(senderHex32).toLowerCase();
  const c = validateHex32(shareTokenHex32).toLowerCase();
  return { read: [s, c], write: [s, c] };
}

export function buildLpShareTokenContractCallTx(
  senderHex32: string,
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
    contract: validateHex32(shareTokenHex32).toLowerCase(),
    calldata: normalizeCalldataHex(calldataHex),
    access_list: buildLpShareTokenAccessList(senderHex32, shareTokenHex32),
  };
}

export function mergeLpShareTokenAccessListWithSimulation(
  senderHex32: string,
  shareTokenHex32: string,
  sim: SimulateResult
): { read: string[]; write: string[] } {
  const base = buildLpShareTokenAccessList(senderHex32, shareTokenHex32);
  return mergeAccessListWithSimulation(base.read, base.write, sim);
}
