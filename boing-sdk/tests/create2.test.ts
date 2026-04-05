import { describe, expect, it } from 'vitest';
import {
  NATIVE_CP_POOL_CREATE2_SALT_V1,
  NATIVE_CP_POOL_CREATE2_SALT_V2,
  NATIVE_CP_POOL_CREATE2_SALT_V3,
  NATIVE_CP_POOL_CREATE2_SALT_V4,
  nativeCpPoolCreate2SaltV1Hex,
  nativeCpPoolCreate2SaltV2Hex,
  nativeCpPoolCreate2SaltV3Hex,
  nativeCpPoolCreate2SaltV4Hex,
  predictCreate2ContractAddress,
  predictNativeCpPoolCreate2Address,
} from '../src/create2.js';

describe('create2', () => {
  it('predictCreate2ContractAddress matches boing-primitives (golden vector)', () => {
    const deployer = '0x' + '01'.repeat(32);
    const salt = hexToBytes32('0x' + '02'.repeat(32));
    const bytecode = new Uint8Array([0x61]);
    const got = predictCreate2ContractAddress(deployer, salt, bytecode);
    expect(got).toBe(
      '0xcacda7ffcf1df2735ba211f486838721fc1100a6fa088961f11571b20718f146'
    );
  });

  it('NATIVE_CP_POOL_CREATE2_SALT_V1 matches Rust label length and hex helper', () => {
    const enc = new TextEncoder().encode('BOING_NATIVECP_C2V1');
    expect(enc.length).toBeLessThanOrEqual(32);
    expect(NATIVE_CP_POOL_CREATE2_SALT_V1.length).toBe(32);
    let nonzero = 0;
    for (let i = 0; i < 32; i++) {
      if (NATIVE_CP_POOL_CREATE2_SALT_V1[i] !== 0) nonzero++;
    }
    expect(nonzero).toBe(enc.length);
    expect(nativeCpPoolCreate2SaltV1Hex()).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('NATIVE_CP_POOL_CREATE2_SALT_V2 matches Rust label', () => {
    const enc = new TextEncoder().encode('BOING_NATIVECP_C2V2');
    expect(NATIVE_CP_POOL_CREATE2_SALT_V2.length).toBe(32);
    expect(nativeCpPoolCreate2SaltV2Hex()).toMatch(/^0x[0-9a-f]{64}$/);
    for (let i = 0; i < enc.length; i++) {
      expect(NATIVE_CP_POOL_CREATE2_SALT_V2[i]).toBe(enc[i]);
    }
  });

  it('NATIVE_CP_POOL_CREATE2_SALT_V3 and V4 match Rust labels', () => {
    for (const [salt, label, hexFn] of [
      [NATIVE_CP_POOL_CREATE2_SALT_V3, 'BOING_NATIVECP_C2V3', nativeCpPoolCreate2SaltV3Hex],
      [NATIVE_CP_POOL_CREATE2_SALT_V4, 'BOING_NATIVECP_C2V4', nativeCpPoolCreate2SaltV4Hex],
    ] as const) {
      const enc = new TextEncoder().encode(label);
      expect(salt.length).toBe(32);
      expect(hexFn()).toMatch(/^0x[0-9a-f]{64}$/);
      for (let i = 0; i < enc.length; i++) {
        expect(salt[i]).toBe(enc[i]);
      }
    }
  });

  it('predictNativeCpPoolCreate2Address is stable for empty bytecode shape', () => {
    const deployer = '0x' + 'ab'.repeat(32);
    const bc = new Uint8Array([0x00, 0xfe]);
    const a = predictNativeCpPoolCreate2Address(deployer, bc);
    const b = predictNativeCpPoolCreate2Address(deployer, bc);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

function hexToBytes32(h: string): Uint8Array {
  const raw = h.replace(/^0x/i, '');
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
