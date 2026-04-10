/**
 * Multihop swap router: **2–6** sequential pool `Call`s in one transaction.
 * Matches `boing_execution::native_dex_multihop_swap_router`. See `docs/NATIVE-DEX-MULTIHOP-SWAP-ROUTER.md`.
 */
/** **352-byte** outer calldata; **128-byte** inners (v1/v3 `swap`). */
export declare const SELECTOR_NATIVE_DEX_SWAP2_ROUTER_128 = 229;
/** **416-byte** outer calldata; **160-byte** inners (v5 `swap_to`). */
export declare const SELECTOR_NATIVE_DEX_SWAP2_ROUTER_160 = 230;
/** **512-byte** outer; **128-byte** inners. */
export declare const SELECTOR_NATIVE_DEX_SWAP3_ROUTER_128 = 231;
/** **608-byte** outer; **160-byte** inners. */
export declare const SELECTOR_NATIVE_DEX_SWAP3_ROUTER_160 = 232;
/** **672-byte** outer; **128-byte** inners. */
export declare const SELECTOR_NATIVE_DEX_SWAP4_ROUTER_128 = 233;
/** **800-byte** outer; **160-byte** inners. */
export declare const SELECTOR_NATIVE_DEX_SWAP4_ROUTER_160 = 234;
/** **832-byte** outer; **128-byte** inners. */
export declare const SELECTOR_NATIVE_DEX_SWAP5_ROUTER_128 = 235;
/** **992-byte** outer; **160-byte** inners. */
export declare const SELECTOR_NATIVE_DEX_SWAP5_ROUTER_160 = 236;
/** **992-byte** outer; **128-byte** inners. */
export declare const SELECTOR_NATIVE_DEX_SWAP6_ROUTER_128 = 237;
/** **1184-byte** outer; **160-byte** inners. */
export declare const SELECTOR_NATIVE_DEX_SWAP6_ROUTER_160 = 238;
export declare function encodeNativeDexSwap2RouterCalldata128(pool1Hex32: string, inner1_128: Uint8Array, pool2Hex32: string, inner2_128: Uint8Array): Uint8Array;
export declare function encodeNativeDexSwap2RouterCalldata128Hex(pool1Hex32: string, inner1_128: Uint8Array, pool2Hex32: string, inner2_128: Uint8Array): string;
export declare function encodeNativeDexSwap2RouterCalldata160(pool1Hex32: string, inner1_160: Uint8Array, pool2Hex32: string, inner2_160: Uint8Array): Uint8Array;
export declare function encodeNativeDexSwap2RouterCalldata160Hex(pool1Hex32: string, inner1_160: Uint8Array, pool2Hex32: string, inner2_160: Uint8Array): string;
export declare function encodeNativeDexSwap3RouterCalldata128(pool1Hex32: string, inner1_128: Uint8Array, pool2Hex32: string, inner2_128: Uint8Array, pool3Hex32: string, inner3_128: Uint8Array): Uint8Array;
export declare function encodeNativeDexSwap3RouterCalldata128Hex(pool1Hex32: string, inner1_128: Uint8Array, pool2Hex32: string, inner2_128: Uint8Array, pool3Hex32: string, inner3_128: Uint8Array): string;
export declare function encodeNativeDexSwap3RouterCalldata160(pool1Hex32: string, inner1_160: Uint8Array, pool2Hex32: string, inner2_160: Uint8Array, pool3Hex32: string, inner3_160: Uint8Array): Uint8Array;
export declare function encodeNativeDexSwap3RouterCalldata160Hex(pool1Hex32: string, inner1_160: Uint8Array, pool2Hex32: string, inner2_160: Uint8Array, pool3Hex32: string, inner3_160: Uint8Array): string;
export declare function encodeNativeDexSwap4RouterCalldata128(pool1Hex32: string, inner1_128: Uint8Array, pool2Hex32: string, inner2_128: Uint8Array, pool3Hex32: string, inner3_128: Uint8Array, pool4Hex32: string, inner4_128: Uint8Array): Uint8Array;
export declare function encodeNativeDexSwap4RouterCalldata128Hex(pool1Hex32: string, inner1_128: Uint8Array, pool2Hex32: string, inner2_128: Uint8Array, pool3Hex32: string, inner3_128: Uint8Array, pool4Hex32: string, inner4_128: Uint8Array): string;
export declare function encodeNativeDexSwap4RouterCalldata160(pool1Hex32: string, inner1_160: Uint8Array, pool2Hex32: string, inner2_160: Uint8Array, pool3Hex32: string, inner3_160: Uint8Array, pool4Hex32: string, inner4_160: Uint8Array): Uint8Array;
export declare function encodeNativeDexSwap4RouterCalldata160Hex(pool1Hex32: string, inner1_160: Uint8Array, pool2Hex32: string, inner2_160: Uint8Array, pool3Hex32: string, inner3_160: Uint8Array, pool4Hex32: string, inner4_160: Uint8Array): string;
export declare function encodeNativeDexSwap5RouterCalldata128(pool1Hex32: string, inner1_128: Uint8Array, pool2Hex32: string, inner2_128: Uint8Array, pool3Hex32: string, inner3_128: Uint8Array, pool4Hex32: string, inner4_128: Uint8Array, pool5Hex32: string, inner5_128: Uint8Array): Uint8Array;
export declare function encodeNativeDexSwap5RouterCalldata128Hex(pool1Hex32: string, inner1_128: Uint8Array, pool2Hex32: string, inner2_128: Uint8Array, pool3Hex32: string, inner3_128: Uint8Array, pool4Hex32: string, inner4_128: Uint8Array, pool5Hex32: string, inner5_128: Uint8Array): string;
export declare function encodeNativeDexSwap5RouterCalldata160(pool1Hex32: string, inner1_160: Uint8Array, pool2Hex32: string, inner2_160: Uint8Array, pool3Hex32: string, inner3_160: Uint8Array, pool4Hex32: string, inner4_160: Uint8Array, pool5Hex32: string, inner5_160: Uint8Array): Uint8Array;
export declare function encodeNativeDexSwap5RouterCalldata160Hex(pool1Hex32: string, inner1_160: Uint8Array, pool2Hex32: string, inner2_160: Uint8Array, pool3Hex32: string, inner3_160: Uint8Array, pool4Hex32: string, inner4_160: Uint8Array, pool5Hex32: string, inner5_160: Uint8Array): string;
export declare function encodeNativeDexSwap6RouterCalldata128(pool1Hex32: string, inner1_128: Uint8Array, pool2Hex32: string, inner2_128: Uint8Array, pool3Hex32: string, inner3_128: Uint8Array, pool4Hex32: string, inner4_128: Uint8Array, pool5Hex32: string, inner5_128: Uint8Array, pool6Hex32: string, inner6_128: Uint8Array): Uint8Array;
export declare function encodeNativeDexSwap6RouterCalldata128Hex(pool1Hex32: string, inner1_128: Uint8Array, pool2Hex32: string, inner2_128: Uint8Array, pool3Hex32: string, inner3_128: Uint8Array, pool4Hex32: string, inner4_128: Uint8Array, pool5Hex32: string, inner5_128: Uint8Array, pool6Hex32: string, inner6_128: Uint8Array): string;
export declare function encodeNativeDexSwap6RouterCalldata160(pool1Hex32: string, inner1_160: Uint8Array, pool2Hex32: string, inner2_160: Uint8Array, pool3Hex32: string, inner3_160: Uint8Array, pool4Hex32: string, inner4_160: Uint8Array, pool5Hex32: string, inner5_160: Uint8Array, pool6Hex32: string, inner6_160: Uint8Array): Uint8Array;
export declare function encodeNativeDexSwap6RouterCalldata160Hex(pool1Hex32: string, inner1_160: Uint8Array, pool2Hex32: string, inner2_160: Uint8Array, pool3Hex32: string, inner3_160: Uint8Array, pool4Hex32: string, inner4_160: Uint8Array, pool5Hex32: string, inner5_160: Uint8Array, pool6Hex32: string, inner6_160: Uint8Array): string;
//# sourceMappingURL=nativeDexSwap2Router.d.ts.map