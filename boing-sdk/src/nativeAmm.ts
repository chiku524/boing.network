/**
 * Native constant-product pool calldata (Boing VM). See `docs/NATIVE-AMM-CALLDATA.md`.
 * Reserves and amounts should stay ≤ `Number.MAX_SAFE_INTEGER` / u64 range for VM `Mul` parity.
 */

import { bytesToHex, hexToBytes, validateHex32 } from './hex.js';

/** `swap` selector (low byte of word0). */
export const SELECTOR_NATIVE_AMM_SWAP = 0x10;
/** `add_liquidity` selector. */
export const SELECTOR_NATIVE_AMM_ADD_LIQUIDITY = 0x11;
/** `remove_liquidity` selector (LP burn + pro-rata withdrawal). */
export const SELECTOR_NATIVE_AMM_REMOVE_LIQUIDITY = 0x12;
/** **v2 pool:** one-time `set_tokens(token_a, token_b)`. */
export const SELECTOR_NATIVE_AMM_SET_TOKENS = 0x13;
/** **v3/v4 pool:** `set_swap_fee_bps(fee)` — **64-byte** calldata; only when **total LP == 0**; **`1 ≤ fee ≤ 10_000`**. */
export const SELECTOR_NATIVE_AMM_SET_SWAP_FEE_BPS = 0x14;

/** Swap fee in basis points on **output** (matches `native_amm::NATIVE_CP_SWAP_FEE_BPS`). */
export const NATIVE_CP_SWAP_FEE_BPS = 30;

/** Build 32-byte `Log2` **topic0** (UTF-8 ASCII + zero pad), matching `native_amm` constants. */
export function nativeAmmLogTopic0Utf8(ascii: string): Uint8Array {
  const u8 = new Uint8Array(32);
  const enc = new TextEncoder().encode(ascii);
  if (enc.length > 32) {
    throw new RangeError('native AMM topic0 label too long');
  }
  u8.set(enc);
  return u8;
}

/** `Log2` topic0 hex for a successful **`swap`** (see `NATIVE-AMM-CALLDATA.md` § Logs). */
export const NATIVE_AMM_TOPIC_SWAP_HEX = bytesToHex(nativeAmmLogTopic0Utf8('BOING_NATIVEAMM_SWAP_V1'));
/** `Log2` topic0 hex for **`add_liquidity`**. */
export const NATIVE_AMM_TOPIC_ADD_LIQUIDITY_HEX = bytesToHex(
  nativeAmmLogTopic0Utf8('BOING_NATIVEAMM_ADDLP_V1')
);
/** `Log2` topic0 hex for **`remove_liquidity`**. */
export const NATIVE_AMM_TOPIC_REMOVE_LIQUIDITY_HEX = bytesToHex(
  nativeAmmLogTopic0Utf8('BOING_NATIVEAMM_RMLP_V1')
);

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

/** 128-byte `swap` calldata: direction 0 = A→B, 1 = B→A. */
export function encodeNativeAmmSwapCalldata(direction: bigint, amountIn: bigint, minOut: bigint): Uint8Array {
  const out = new Uint8Array(128);
  out.set(selectorWord(SELECTOR_NATIVE_AMM_SWAP), 0);
  out.set(amountWord(direction), 32);
  out.set(amountWord(amountIn), 64);
  out.set(amountWord(minOut), 96);
  return out;
}

/** 128-byte `add_liquidity` calldata. */
export function encodeNativeAmmAddLiquidityCalldata(
  amountA: bigint,
  amountB: bigint,
  minLiquidity: bigint
): Uint8Array {
  const out = new Uint8Array(128);
  out.set(selectorWord(SELECTOR_NATIVE_AMM_ADD_LIQUIDITY), 0);
  out.set(amountWord(amountA), 32);
  out.set(amountWord(amountB), 64);
  out.set(amountWord(minLiquidity), 96);
  return out;
}

/** 128-byte `remove_liquidity` calldata. */
export function encodeNativeAmmRemoveLiquidityCalldata(
  liquidityBurn: bigint,
  minA: bigint,
  minB: bigint
): Uint8Array {
  const out = new Uint8Array(128);
  out.set(selectorWord(SELECTOR_NATIVE_AMM_REMOVE_LIQUIDITY), 0);
  out.set(amountWord(liquidityBurn), 32);
  out.set(amountWord(minA), 64);
  out.set(amountWord(minB), 96);
  return out;
}

/** **v2:** 96-byte `set_tokens` — each id is 32-byte account hex (`0x` + 64 hex). Use `0x` + 64 zeros for “no token” on that side. */
export function encodeNativeAmmSetTokensCalldata(tokenAHex32: string, tokenBHex32: string): Uint8Array {
  const out = new Uint8Array(96);
  out.set(selectorWord(SELECTOR_NATIVE_AMM_SET_TOKENS), 0);
  out.set(hexToBytes(validateHex32(tokenAHex32)), 32);
  out.set(hexToBytes(validateHex32(tokenBHex32)), 64);
  return out;
}

/** **v3/v4:** 64-byte `set_swap_fee_bps` calldata (`native_amm::encode_set_swap_fee_bps_calldata`). */
export function encodeNativeAmmSetSwapFeeBpsCalldata(feeBps: bigint): Uint8Array {
  if (feeBps < 1n || feeBps > 10_000n) {
    throw new RangeError('feeBps must satisfy 1 <= feeBps <= 10000');
  }
  const out = new Uint8Array(64);
  out.set(selectorWord(SELECTOR_NATIVE_AMM_SET_SWAP_FEE_BPS), 0);
  out.set(amountWord(feeBps), 32);
  return out;
}

export function encodeNativeAmmSwapCalldataHex(direction: bigint, amountIn: bigint, minOut: bigint): string {
  return bytesToHex(encodeNativeAmmSwapCalldata(direction, amountIn, minOut));
}

export function encodeNativeAmmAddLiquidityCalldataHex(
  amountA: bigint,
  amountB: bigint,
  minLiquidity: bigint = 0n
): string {
  return bytesToHex(encodeNativeAmmAddLiquidityCalldata(amountA, amountB, minLiquidity));
}

export function encodeNativeAmmRemoveLiquidityCalldataHex(
  liquidityBurn: bigint,
  minA: bigint,
  minB: bigint
): string {
  return bytesToHex(encodeNativeAmmRemoveLiquidityCalldata(liquidityBurn, minA, minB));
}

export function encodeNativeAmmSetTokensCalldataHex(tokenAHex32: string, tokenBHex32: string): string {
  return bytesToHex(encodeNativeAmmSetTokensCalldata(tokenAHex32, tokenBHex32));
}

export function encodeNativeAmmSetSwapFeeBpsCalldataHex(feeBps: bigint): string {
  return bytesToHex(encodeNativeAmmSetSwapFeeBpsCalldata(feeBps));
}

/** Raw CP step (no swap fee): Δout = ⌊ r_out · Δin / (r_in + Δin) ⌋. */
export function constantProductAmountOutNoFee(
  reserveIn: bigint,
  reserveOut: bigint,
  amountIn: bigint
): bigint {
  if (reserveIn < 0n || reserveOut < 0n || amountIn < 0n) {
    throw new RangeError('reserves and amountIn must be non-negative');
  }
  const denom = reserveIn + amountIn;
  if (denom === 0n) return 0n;
  return (reserveOut * amountIn) / denom;
}

/**
 * Amount out after an explicit **output-side** fee in basis points (`native_amm::constant_product_amount_out_after_fee_with_bps`).
 * **`feeBps`** must be **`0`…`10000`** (inclusive). For **v3/v4** pools, if storage at `swap_fee_bps_key` reads **`0`**, treat as **`NATIVE_CP_SWAP_FEE_BPS`** before quoting.
 */
export function constantProductAmountOutWithFeeBps(
  reserveIn: bigint,
  reserveOut: bigint,
  amountIn: bigint,
  feeBps: bigint
): bigint {
  if (feeBps < 0n || feeBps > 10_000n) {
    throw new RangeError('feeBps must satisfy 0 <= feeBps <= 10000');
  }
  const dy = constantProductAmountOutNoFee(reserveIn, reserveOut, amountIn);
  const keep = 10000n - feeBps;
  return (dy * keep) / 10000n;
}

/**
 * Amount out after pool swap fee (output-side): same as **`constantProductAmountOutWithFeeBps`** with **`NATIVE_CP_SWAP_FEE_BPS`**.
 */
export function constantProductAmountOut(
  reserveIn: bigint,
  reserveOut: bigint,
  amountIn: bigint
): bigint {
  return constantProductAmountOutWithFeeBps(reserveIn, reserveOut, amountIn, BigInt(NATIVE_CP_SWAP_FEE_BPS));
}
