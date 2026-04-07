/**
 * Build **`0xFD` + init** deploy payloads for the secured reference fungible, matching
 * `boing_execution::reference_fungible_secured_deploy_bytecode` / init layout.
 *
 * Runtime bytes are pinned from `defaultReferenceFungibleSecuredRuntimeBytecodeHex.ts`
 * (regenerated with `embed-reference-fungible-secured-template-hex.mjs`).
 */
import { DEFAULT_REFERENCE_FUNGIBLE_SECURED_RUNTIME_BYTECODE_HEX } from './defaultReferenceFungibleSecuredRuntimeBytecodeHex.js';
import { bytesToHex, hexToBytes } from './hex.js';
import { normalizeNativeTokenSecurity, } from './nativeTokenSecurity.js';
const CONTRACT_DEPLOY_INIT_CODE_MARKER = 0xfd;
const Op = {
    Stop: 0x00,
    Add: 0x01,
    Lt: 0x10,
    Eq: 0x14,
    IsZero: 0x15,
    Caller: 0x33,
    BlockHeight: 0x40,
    MLoad: 0x51,
    MStore: 0x52,
    SLoad: 0x54,
    SStore: 0x55,
    JumpI: 0x57,
    Push32: 0x7f,
    Return: 0xf3,
};
/** Mirrors `reference_fungible_secured` flag words (u32). */
export const FLAG_DENYLIST = 0x01;
export const FLAG_MAX_TX = 0x02;
export const FLAG_MAX_WALLET = 0x04;
export const FLAG_ANTI_BOT = 0x08;
export const FLAG_COOLDOWN = 0x10;
export const FLAG_NO_MINT = 0x20;
export const FLAG_TRANSFER_UNLOCK = 0x40;
const U128_MAX = (1n << 128n) - 1n;
const U64_MAX = (1n << 64n) - 1n;
const DEFAULT_ANTI_BOT_EXTRA_BLOCKS = 100n;
function keyLastByte(b) {
    const k = new Uint8Array(32);
    k[31] = b & 0xff;
    return k;
}
function wordZero() {
    return new Uint8Array(32);
}
function wordOne() {
    const w = new Uint8Array(32);
    w[31] = 1;
    return w;
}
function wordU32(n) {
    const w = new Uint8Array(32);
    new DataView(w.buffer).setUint32(28, n >>> 0, false);
    return w;
}
function wordU64(n) {
    const w = new Uint8Array(32);
    const v = n <= U64_MAX ? n : U64_MAX;
    new DataView(w.buffer).setBigUint64(24, v, false);
    return w;
}
function amountWord(amount) {
    const w = new Uint8Array(32);
    let v = amount <= U128_MAX ? amount : U128_MAX;
    for (let i = 31; i >= 16; i--) {
        w[i] = Number(v & 0xffn);
        v >>= 8n;
    }
    return w;
}
function push32(w) {
    const out = new Uint8Array(33);
    out[0] = Op.Push32;
    out.set(w, 1);
    return out;
}
function u8(b) {
    return new Uint8Array([b & 0xff]);
}
function concatBytes(...parts) {
    const n = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) {
        out.set(p, o);
        o += p.length;
    }
    return out;
}
function emitRuntimeToMemory(runtime) {
    const padLen = (Math.ceil(runtime.length / 32) | 0) * 32;
    const rt = new Uint8Array(padLen);
    rt.set(runtime, 0);
    const chunks = [];
    for (let off = 0; off < padLen; off += 32) {
        chunks.push(push32(rt.subarray(off, off + 32)));
        chunks.push(push32(wordU64(BigInt(off))));
        chunks.push(u8(Op.MStore));
    }
    return concatBytes(...chunks);
}
/**
 * Init bytecode only (no `0xFD` prefix), matching `reference_fungible_secured_init_bytecode`.
 */
export function referenceFungibleSecuredInitBytecode(config, runtime) {
    const refSecAdminKey = keyLastByte(0xc1);
    const refSecAntiBotEndKey = keyLastByte(0xc7);
    const refSecFlagsKey = keyLastByte(0xc3);
    const refSecMaxTxKey = keyLastByte(0xc4);
    const refSecMaxWalletKey = keyLastByte(0xc5);
    const refSecAntiBotMaxKey = keyLastByte(0xc8);
    const refSecCooldownSecsKey = keyLastByte(0xc9);
    const refSecXferUnlockKey = keyLastByte(0xca);
    const refSecPausedKey = keyLastByte(0xc6);
    const parts = [
        u8(Op.Caller),
        push32(refSecAdminKey),
        u8(Op.SStore),
        u8(Op.BlockHeight),
        push32(wordU64(config.antiBotExtraBlocks)),
        u8(Op.Add),
        push32(refSecAntiBotEndKey),
        u8(Op.SStore),
        push32(wordU32(config.flags >>> 0)),
        push32(refSecFlagsKey),
        u8(Op.SStore),
        push32(amountWord(config.maxTx)),
        push32(refSecMaxTxKey),
        u8(Op.SStore),
        push32(amountWord(config.maxWallet)),
        push32(refSecMaxWalletKey),
        u8(Op.SStore),
        push32(amountWord(config.antiBotMaxAmount)),
        push32(refSecAntiBotMaxKey),
        u8(Op.SStore),
        push32(wordU64(config.cooldownSecs)),
        push32(refSecCooldownSecsKey),
        u8(Op.SStore),
        push32(wordU64(config.transferUnlockHeight)),
        push32(refSecXferUnlockKey),
        u8(Op.SStore),
        push32(config.initialPaused ? wordOne() : wordZero()),
        push32(refSecPausedKey),
        u8(Op.SStore),
        emitRuntimeToMemory(runtime),
        push32(wordU64(BigInt(runtime.length))),
        push32(wordZero()),
        u8(Op.Return),
        u8(Op.Stop),
    ];
    return concatBytes(...parts);
}
/** Full deploy: `0xFD || init` (init `RETURN`s runtime). */
export function referenceFungibleSecuredDeployBytecode(config, runtime) {
    const rt = runtime ??
        hexToBytes(DEFAULT_REFERENCE_FUNGIBLE_SECURED_RUNTIME_BYTECODE_HEX);
    const init = referenceFungibleSecuredInitBytecode(config, rt);
    return concatBytes(u8(CONTRACT_DEPLOY_INIT_CODE_MARKER), init);
}
export function referenceFungibleSecuredDeployBytecodeHex(config, runtime) {
    return bytesToHex(referenceFungibleSecuredDeployBytecode(config, runtime));
}
function parseDecimalU128(label, s) {
    const t = s.trim();
    if (!t)
        return 0n;
    if (!/^[0-9]+$/.test(t)) {
        throw new Error(`${label}: expected non-negative decimal integer, got ${JSON.stringify(s)}`);
    }
    const v = BigInt(t);
    if (v > U128_MAX) {
        throw new Error(`${label}: value exceeds uint128`);
    }
    return v;
}
function parseDecimalU64(label, s) {
    const t = s.trim();
    if (!t)
        return 0n;
    if (!/^[0-9]+$/.test(t)) {
        throw new Error(`${label}: expected non-negative decimal integer, got ${JSON.stringify(s)}`);
    }
    const v = BigInt(t);
    if (v > U64_MAX) {
        throw new Error(`${label}: value exceeds uint64`);
    }
    return v;
}
/**
 * Map wizard / `boing.native_token_security.v1` fields to secured init storage (on-chain enforcement).
 *
 * - **renounceOwnership**: not applied at deploy (admin is deployer); use admin `0x05` after deploy.
 * - **timelock**: maps to transfer-unlock **block height** = `chainHeight + timelockDelay` (both decimals).
 */
export function referenceFungibleSecuredConfigFromNativeTokenSecurity(input, ctx = {}) {
    const n = normalizeNativeTokenSecurity(input);
    let flags = 0;
    let maxTx = 0n;
    let maxWallet = 0n;
    let antiBotExtraBlocks = 0n;
    let antiBotMaxAmount = 0n;
    let cooldownSecs = 0n;
    let transferUnlockHeight = 0n;
    let initialPaused = false;
    if (n.enableBlacklist || n.enableFreezing) {
        flags |= FLAG_DENYLIST;
    }
    if (n.renounceMint) {
        flags |= FLAG_NO_MINT;
    }
    if (n.pauseFunction) {
        initialPaused = true;
    }
    const maxTxV = parseDecimalU128('maxTxAmount', n.maxTxAmount);
    if (maxTxV > 0n) {
        flags |= FLAG_MAX_TX;
        maxTx = maxTxV;
    }
    const wantWalletCap = n.maxWallet || n.antiWhale;
    const pctRaw = n.maxWalletPercentage.trim();
    const supply = ctx.mintFirstTotalSupplyWei;
    if (wantWalletCap) {
        flags |= FLAG_MAX_WALLET;
        if (pctRaw && supply !== undefined && supply > 0n) {
            const pct = parseDecimalU128('maxWalletPercentage', pctRaw);
            if (pct > 100n) {
                throw new Error('maxWalletPercentage: must be 0–100');
            }
            maxWallet = (supply * pct) / 100n;
        }
        else if (maxTxV > 0n) {
            maxWallet = maxTxV;
        }
        else {
            throw new Error('maxWallet / antiWhale: set maxWalletPercentage and mintFirstTotalSupplyWei on the deploy builder, or set maxTxAmount to use as the per-wallet cap');
        }
    }
    if (n.antiBot) {
        flags |= FLAG_ANTI_BOT;
        antiBotExtraBlocks = DEFAULT_ANTI_BOT_EXTRA_BLOCKS;
        antiBotMaxAmount = maxTxV > 0n ? maxTxV : U128_MAX;
    }
    const cd = parseDecimalU64('cooldownPeriod', n.cooldownPeriod);
    if (cd > 0n) {
        flags |= FLAG_COOLDOWN;
        cooldownSecs = cd;
    }
    if (n.timelock) {
        const delay = parseDecimalU64('timelockDelay', n.timelockDelay);
        if (ctx.chainHeight === undefined) {
            throw new Error('nativeTokenSecurity.timelock: pass chainContext.chainHeight (from boing_chainHeight) so transfer unlock height can be set on-chain');
        }
        flags |= FLAG_TRANSFER_UNLOCK;
        transferUnlockHeight = ctx.chainHeight + delay;
        if (transferUnlockHeight > U64_MAX) {
            transferUnlockHeight = U64_MAX;
        }
    }
    return {
        flags,
        maxTx,
        maxWallet,
        antiBotExtraBlocks,
        antiBotMaxAmount,
        cooldownSecs,
        transferUnlockHeight,
        initialPaused,
    };
}
export function buildReferenceFungibleSecuredDeployBytecodeHexFromNativeTokenSecurity(input, ctx = {}) {
    const cfg = referenceFungibleSecuredConfigFromNativeTokenSecurity(input, ctx);
    return referenceFungibleSecuredDeployBytecodeHex(cfg);
}
