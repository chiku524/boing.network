/**
 * Build **`0xFD` + init** deploy payloads for the secured reference fungible, matching
 * `boing_execution::reference_fungible_secured_deploy_bytecode` / init layout.
 *
 * Runtime bytes are pinned from `defaultReferenceFungibleSecuredRuntimeBytecodeHex.ts`
 * (regenerated with `embed-reference-fungible-secured-template-hex.mjs`).
 */
import { type NativeTokenSecurityFeaturesInput } from './nativeTokenSecurity.js';
/** Mirrors `reference_fungible_secured` flag words (u32). */
export declare const FLAG_DENYLIST = 1;
export declare const FLAG_MAX_TX = 2;
export declare const FLAG_MAX_WALLET = 4;
export declare const FLAG_ANTI_BOT = 8;
export declare const FLAG_COOLDOWN = 16;
export declare const FLAG_NO_MINT = 32;
export declare const FLAG_TRANSFER_UNLOCK = 64;
export type ReferenceFungibleSecuredConfigBytes = {
    flags: number;
    maxTx: bigint;
    maxWallet: bigint;
    antiBotExtraBlocks: bigint;
    antiBotMaxAmount: bigint;
    cooldownSecs: bigint;
    transferUnlockHeight: bigint;
    initialPaused: boolean;
};
/**
 * Init bytecode only (no `0xFD` prefix), matching `reference_fungible_secured_init_bytecode`.
 */
export declare function referenceFungibleSecuredInitBytecode(config: ReferenceFungibleSecuredConfigBytes, runtime: Uint8Array): Uint8Array;
/** Full deploy: `0xFD || init` (init `RETURN`s runtime). */
export declare function referenceFungibleSecuredDeployBytecode(config: ReferenceFungibleSecuredConfigBytes, runtime?: Uint8Array): Uint8Array;
export declare function referenceFungibleSecuredDeployBytecodeHex(config: ReferenceFungibleSecuredConfigBytes, runtime?: Uint8Array): `0x${string}`;
export type SecuredWizardBuildContext = {
    /**
     * Current height from `boing_chainHeight` — **required** when `timelock` is enabled in
     * `nativeTokenSecurity` so `transfer_unlock_height` can be set (`FLAG_TRANSFER_UNLOCK`).
     */
    chainHeight?: bigint;
    /**
     * Total supply (base units) planned for the initial `mint_first`, used with `maxWalletPercentage`
     * / anti-whale percentage to derive `max_wallet`.
     */
    mintFirstTotalSupplyWei?: bigint;
};
/**
 * Map wizard / `boing.native_token_security.v1` fields to secured init storage (on-chain enforcement).
 *
 * - **renounceOwnership**: not applied at deploy (admin is deployer); use admin `0x05` after deploy.
 * - **timelock**: maps to transfer-unlock **block height** = `chainHeight + timelockDelay` (both decimals).
 */
export declare function referenceFungibleSecuredConfigFromNativeTokenSecurity(input: NativeTokenSecurityFeaturesInput | undefined, ctx?: SecuredWizardBuildContext): ReferenceFungibleSecuredConfigBytes;
export declare function buildReferenceFungibleSecuredDeployBytecodeHexFromNativeTokenSecurity(input: NativeTokenSecurityFeaturesInput | undefined, ctx?: SecuredWizardBuildContext): `0x${string}`;
//# sourceMappingURL=referenceFungibleSecuredDeployBytecode.d.ts.map