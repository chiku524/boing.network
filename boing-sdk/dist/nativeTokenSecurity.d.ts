/**
 * Optional **native token deploy security** metadata (wizard parity with EVM “security features”).
 *
 * The default Boing **reference fungible** bytecode is minimal (`transfer` / single `mint_first`). DApps that
 * ship **custom bytecode** can still commit the user’s security choices on-chain via **`description_hash`**
 * (Blake3 over canonical JSON). Indexers, explorers, and QA reviewers can decode the same JSON shape.
 *
 * For the **secured** fungible, **`buildReferenceFungibleSecuredDeployMetaTx`** maps these fields into
 * **`0xFD` init** storage (on-chain enforcement) when `nativeTokenSecurity` is passed — see
 * **`referenceFungibleSecuredConfigFromNativeTokenSecurity`**. **`renounceOwnership`** is still metadata-only
 * (admin must call renounce selector after deploy). **`timelock`** uses **`chainContext.chainHeight`** +
 * **`timelockDelay`** as a **transfer-unlock block height**.
 *
 * Boing VM **`BlockHeight` (`0x40`)** and **`Timestamp` (`0x41`)** opcodes support time/block-gated rules.
 */
/** Mirrors boing.finance `DeployToken.jsx` `SECURITY_FEATURES` / wizard toggles (all optional on input). */
export type NativeTokenSecurityFeaturesInput = {
    renounceMint?: boolean;
    enableFreezing?: boolean;
    enableBlacklist?: boolean;
    maxTxAmount?: string;
    renounceOwnership?: boolean;
    antiBot?: boolean;
    /** Cooldown between transfers (e.g. seconds); empty string means disabled. */
    cooldownPeriod?: string;
    antiWhale?: boolean;
    pauseFunction?: boolean;
    timelock?: boolean;
    /** Admin timelock delay (dApp-defined units, often seconds). */
    timelockDelay?: string;
    maxWallet?: boolean;
    maxWalletPercentage?: string;
};
/** Canonical JSON-ready object (every known key present). */
export type NativeTokenSecurityFeaturesNormalized = {
    schema: 'boing.native_token_security.v1';
    renounceMint: boolean;
    enableFreezing: boolean;
    enableBlacklist: boolean;
    maxTxAmount: string;
    renounceOwnership: boolean;
    antiBot: boolean;
    cooldownPeriod: string;
    antiWhale: boolean;
    pauseFunction: boolean;
    timelock: boolean;
    timelockDelay: string;
    maxWallet: boolean;
    maxWalletPercentage: string;
};
/**
 * Stable object for hashing / logging (fixed key order via explicit construction).
 */
export declare function normalizeNativeTokenSecurity(input: NativeTokenSecurityFeaturesInput | undefined): NativeTokenSecurityFeaturesNormalized;
/**
 * Blake3-256 digest of UTF-8 JSON, as **`0x` + 64 hex** (fits `description_hash` on `contract_deploy_meta`).
 */
export declare function descriptionHashHexFromNativeTokenSecurity(input: NativeTokenSecurityFeaturesInput | undefined): `0x${string}`;
//# sourceMappingURL=nativeTokenSecurity.d.ts.map