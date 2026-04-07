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
import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex } from '@noble/hashes/utils';
function bool(v, defaultFalse = false) {
    if (v === undefined || v === null)
        return defaultFalse;
    return Boolean(v);
}
function str(v) {
    return typeof v === 'string' ? v.trim() : '';
}
/**
 * Stable object for hashing / logging (fixed key order via explicit construction).
 */
export function normalizeNativeTokenSecurity(input) {
    return {
        schema: 'boing.native_token_security.v1',
        renounceMint: bool(input?.renounceMint),
        enableFreezing: bool(input?.enableFreezing),
        enableBlacklist: bool(input?.enableBlacklist),
        maxTxAmount: str(input?.maxTxAmount),
        renounceOwnership: bool(input?.renounceOwnership),
        antiBot: bool(input?.antiBot),
        cooldownPeriod: str(input?.cooldownPeriod),
        antiWhale: bool(input?.antiWhale),
        pauseFunction: bool(input?.pauseFunction),
        timelock: bool(input?.timelock),
        timelockDelay: str(input?.timelockDelay),
        maxWallet: bool(input?.maxWallet),
        maxWalletPercentage: str(input?.maxWalletPercentage),
    };
}
/**
 * Blake3-256 digest of UTF-8 JSON, as **`0x` + 64 hex** (fits `description_hash` on `contract_deploy_meta`).
 */
export function descriptionHashHexFromNativeTokenSecurity(input) {
    const norm = normalizeNativeTokenSecurity(input);
    const json = JSON.stringify(norm);
    const digest = blake3(new TextEncoder().encode(json));
    const h = bytesToHex(digest);
    if (h.length !== 64) {
        throw new Error('descriptionHashHexFromNativeTokenSecurity: unexpected digest length');
    }
    return `0x${h}`;
}
