import { describe, expect, it } from 'vitest';
import { buildReferenceFungibleSecuredDeployMetaTx } from '../src/canonicalDeployArtifacts.js';
import { DEFAULT_REFERENCE_FUNGIBLE_SECURED_TEMPLATE_BYTECODE_HEX } from '../src/defaultReferenceFungibleSecuredTemplateBytecodeHex.js';
import {
  FLAG_DENYLIST,
  referenceFungibleSecuredConfigFromNativeTokenSecurity,
  referenceFungibleSecuredDeployBytecodeHex,
} from '../src/referenceFungibleSecuredDeployBytecode.js';

describe('referenceFungibleSecuredDeployBytecode', () => {
  it('default wizard config matches pinned secured deploy hex', () => {
    const cfg = referenceFungibleSecuredConfigFromNativeTokenSecurity({});
    const h = referenceFungibleSecuredDeployBytecodeHex(cfg).toLowerCase();
    expect(h).toBe(DEFAULT_REFERENCE_FUNGIBLE_SECURED_TEMPLATE_BYTECODE_HEX.toLowerCase());
  });

  it('undefined input matches pinned secured deploy hex', () => {
    const cfg = referenceFungibleSecuredConfigFromNativeTokenSecurity(undefined);
    const h = referenceFungibleSecuredDeployBytecodeHex(cfg).toLowerCase();
    expect(h).toBe(DEFAULT_REFERENCE_FUNGIBLE_SECURED_TEMPLATE_BYTECODE_HEX.toLowerCase());
  });

  it('enableBlacklist sets denylist flag and changes bytecode', () => {
    const cfg = referenceFungibleSecuredConfigFromNativeTokenSecurity({ enableBlacklist: true });
    expect(cfg.flags & FLAG_DENYLIST).toBe(FLAG_DENYLIST);
    const h = referenceFungibleSecuredDeployBytecodeHex(cfg).toLowerCase();
    expect(h).not.toBe(DEFAULT_REFERENCE_FUNGIBLE_SECURED_TEMPLATE_BYTECODE_HEX.toLowerCase());
  });

  it('timelock requires chainHeight', () => {
    expect(() =>
      referenceFungibleSecuredConfigFromNativeTokenSecurity({
        timelock: true,
        timelockDelay: '10',
      }),
    ).toThrow(/chainHeight/);
    const cfg = referenceFungibleSecuredConfigFromNativeTokenSecurity(
      { timelock: true, timelockDelay: '10' },
      { chainHeight: 100n },
    );
    expect(cfg.transferUnlockHeight).toBe(110n);
  });

  it('buildReferenceFungibleSecuredDeployMetaTx uses pinned hex without nativeTokenSecurity', () => {
    const a = buildReferenceFungibleSecuredDeployMetaTx({ assetName: 'S', assetSymbol: 's' });
    expect(a.bytecode.toLowerCase()).toBe(
      DEFAULT_REFERENCE_FUNGIBLE_SECURED_TEMPLATE_BYTECODE_HEX.toLowerCase(),
    );
    expect(a.description_hash).toBeUndefined();
  });

  it('buildReferenceFungibleSecuredDeployMetaTx encodes security in bytecode when nativeTokenSecurity set', () => {
    const tx = buildReferenceFungibleSecuredDeployMetaTx({
      assetName: 'S',
      assetSymbol: 's',
      nativeTokenSecurity: { antiBot: true },
    });
    expect(tx.description_hash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(tx.bytecode.toLowerCase()).not.toBe(
      DEFAULT_REFERENCE_FUNGIBLE_SECURED_TEMPLATE_BYTECODE_HEX.toLowerCase(),
    );
  });
});
