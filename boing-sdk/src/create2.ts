/**
 * Predict CREATE2 contract `AccountId` (matches `boing_primitives::create2_contract_address`).
 */

import { blake3 } from '@noble/hashes/blake3';
import { concatBytes } from './bincode.js';
import { bytesToHex, hexToBytes, validateHex32 } from './hex.js';

/** Domain separator: `b"boing.create2.v1\\0"` in Rust. */
const CREATE2_DOMAIN = concatBytes(new TextEncoder().encode('boing.create2.v1'), new Uint8Array([0]));

/** Same bytes as `boing_execution::native_amm::NATIVE_CP_POOL_CREATE2_SALT_V1`. */
export const NATIVE_CP_POOL_CREATE2_SALT_V1 = (() => {
  const label = new TextEncoder().encode('BOING_NATIVECP_C2V1');
  const out = new Uint8Array(32);
  out.set(label);
  return out;
})();

/** Same bytes as `boing_execution::native_amm::NATIVE_CP_POOL_CREATE2_SALT_V2` (token-hook pool bytecode). */
export const NATIVE_CP_POOL_CREATE2_SALT_V2 = (() => {
  const label = new TextEncoder().encode('BOING_NATIVECP_C2V2');
  const out = new Uint8Array(32);
  out.set(label);
  return out;
})();

/** Same bytes as `boing_execution::native_amm::NATIVE_CP_POOL_CREATE2_SALT_V3` (ledger-only + configurable swap fee). */
export const NATIVE_CP_POOL_CREATE2_SALT_V3 = (() => {
  const label = new TextEncoder().encode('BOING_NATIVECP_C2V3');
  const out = new Uint8Array(32);
  out.set(label);
  return out;
})();

/** Same bytes as `boing_execution::native_amm::NATIVE_CP_POOL_CREATE2_SALT_V4` (v2 hooks + configurable fee). */
export const NATIVE_CP_POOL_CREATE2_SALT_V4 = (() => {
  const label = new TextEncoder().encode('BOING_NATIVECP_C2V4');
  const out = new Uint8Array(32);
  out.set(label);
  return out;
})();

/** `0x` + 64 hex for {@link NATIVE_CP_POOL_CREATE2_SALT_V1}. */
export function nativeCpPoolCreate2SaltV1Hex(): string {
  return validateHex32(bytesToHex(NATIVE_CP_POOL_CREATE2_SALT_V1));
}

/** `0x` + 64 hex for {@link NATIVE_CP_POOL_CREATE2_SALT_V2}. */
export function nativeCpPoolCreate2SaltV2Hex(): string {
  return validateHex32(bytesToHex(NATIVE_CP_POOL_CREATE2_SALT_V2));
}

/** `0x` + 64 hex for {@link NATIVE_CP_POOL_CREATE2_SALT_V3}. */
export function nativeCpPoolCreate2SaltV3Hex(): string {
  return validateHex32(bytesToHex(NATIVE_CP_POOL_CREATE2_SALT_V3));
}

/** `0x` + 64 hex for {@link NATIVE_CP_POOL_CREATE2_SALT_V4}. */
export function nativeCpPoolCreate2SaltV4Hex(): string {
  return validateHex32(bytesToHex(NATIVE_CP_POOL_CREATE2_SALT_V4));
}

/**
 * `BLAKE3(domain || deployer_32 || salt_32 || BLAKE3(bytecode))`.
 */
export function predictCreate2ContractAddress(
  deployerHex: string,
  salt32: Uint8Array,
  bytecode: Uint8Array
): string {
  if (salt32.length !== 32) {
    throw new Error('create2 salt must be exactly 32 bytes');
  }
  const deployer = hexToBytes(validateHex32(deployerHex));
  const codeHash = blake3(bytecode);
  const preimage = concatBytes(CREATE2_DOMAIN, deployer, salt32, codeHash);
  return validateHex32(bytesToHex(blake3(preimage)));
}

/** Pool address for native CP bytecode + documented v1 salt (deployer = future deployer account). */
export function predictNativeCpPoolCreate2Address(deployerHex: string, poolBytecode: Uint8Array): string {
  return predictCreate2ContractAddress(deployerHex, NATIVE_CP_POOL_CREATE2_SALT_V1, poolBytecode);
}

/** **v2** pool (token `CALL` hooks) + documented v2 salt. */
export function predictNativeCpPoolV2Create2Address(deployerHex: string, poolBytecodeV2: Uint8Array): string {
  return predictCreate2ContractAddress(deployerHex, NATIVE_CP_POOL_CREATE2_SALT_V2, poolBytecodeV2);
}

/** **v3** pool (ledger-only + on-chain swap fee bps) + documented v3 salt. */
export function predictNativeCpPoolV3Create2Address(deployerHex: string, poolBytecodeV3: Uint8Array): string {
  return predictCreate2ContractAddress(deployerHex, NATIVE_CP_POOL_CREATE2_SALT_V3, poolBytecodeV3);
}

/** **v4** pool (v2 hooks + configurable fee) + documented v4 salt. */
export function predictNativeCpPoolV4Create2Address(deployerHex: string, poolBytecodeV4: Uint8Array): string {
  return predictCreate2ContractAddress(deployerHex, NATIVE_CP_POOL_CREATE2_SALT_V4, poolBytecodeV4);
}
