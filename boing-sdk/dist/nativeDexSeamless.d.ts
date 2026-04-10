/**
 * Copy, preflight, and one-shot tx helpers for native Boing DEX integration.
 * Reinforces that Boing is **not** a drop-in Uniswap/EVM router and keeps flows **Boing-RPC-only**.
 */
import type { BoingClient } from './client.js';
import type { NativeDexIntegrationDefaults } from './dexIntegration.js';
import { buildNativeConstantProductContractCallTx, buildNativeDexMultihopRouterContractCallTx, type NativePoolAccessListOptions } from './nativeAmmPool.js';
import type { CpSwapRoute } from './nativeDexRouting.js';
import { type BoingRpcPreflightError } from './preflightGate.js';
import type { SimulateResult } from './types.js';
/** Short line for tooltips / footers. */
export declare const BOING_NATIVE_DEX_NOT_EVM_TAGLINE = "Boing native DEX uses 32-byte account ids, explicit access lists, and VM-specific calldata\u2014not a paste-any-Uniswap-address router.";
/** Bullet list for onboarding modals or docs snippets. */
export declare const BOING_NATIVE_DEX_NOT_EVM_BULLETS: readonly ["Accounts are 32-byte Boing AccountIds (64 hex chars), not 20-byte Ethereum contract addresses.", "Each `contract_call` needs calldata per NATIVE-AMM / NATIVE-DEX specs plus explicit `access_list` read/write sets.", "Pool, factory, multihop router, ledger forwarders, and LP vault/share ids resolve via RPC `end_user` hints, `fetchNativeDexIntegrationDefaults`, env overrides, or CREATE2 prediction—there is no universal router ABI."];
export declare function formatBoingNativeDexNotEvmDisclaimer(): string;
/**
 * Surfaces missing operator hints so UIs can link to ops runbooks instead of failing silently.
 */
export declare function describeNativeDexDefaultGaps(defaults: NativeDexIntegrationDefaults): readonly string[];
/** RPC methods a typical native DEX dApp (read + simulate + logs) expects from **boing-node**. */
export declare const BOING_NATIVE_DEX_TOOLKIT_RPC_METHODS: readonly ["boing_getNetworkInfo", "boing_simulateTransaction", "boing_getLogs", "boing_getContractStorage"];
/**
 * {@link assertBoingRpcEnvironment} with {@link BOING_NATIVE_DEX_TOOLKIT_RPC_METHODS}.
 * Throws {@link BoingRpcPreflightError} when the endpoint is missing methods or failing discovery.
 */
export declare function assertBoingNativeDexToolkitRpc(client: BoingClient): Promise<import("./rpcDoctor.js").BoingRpcDoctorResult>;
/** User-facing text when {@link assertBoingNativeDexToolkitRpc} fails (QA / pruned / old node). */
export declare function formatNativeDexToolkitPreflightForUi(err: BoingRpcPreflightError): string;
/**
 * One-shot **`contract_call`** object for **`boing_sendTransaction`** / Boing Express: native CP **`swap`** calldata + pool access list.
 */
export declare function buildNativeCpPoolSwapExpressTx(input: {
    senderHex32: string;
    poolHex32: string;
    direction: bigint;
    amountIn: bigint;
    minOut: bigint;
    poolAccessListOptions?: NativePoolAccessListOptions;
}): ReturnType<typeof buildNativeConstantProductContractCallTx>;
/** Multihop router **`contract_call`** from a quoted {@link CpSwapRoute} (**128-byte** pool inners). Pass **`minOutPerHop`** or **`slippageBps`** (explicit **`minOutPerHop`** wins when set). */
export type BuildNativeDexMultihopSwapExpressTxFromRoute128Input = {
    senderHex32: string;
    routerHex32: string;
    route: CpSwapRoute;
    minOutPerHop?: readonly bigint[];
    slippageBps?: bigint;
    /**
     * When **`true`**, append {@link uniqueSortedTokenHex32FromCpRoute} to **`additionalAccountsHex32`**
     * (reference-token pools that **`CALL`** token contracts during **`swap`**).
     */
    includeVenueTokenAccounts?: boolean;
    poolAccessListOptions?: NativePoolAccessListOptions;
};
/** Multihop router **`contract_call`** with **160-byte** **`swap_to`** inners (v5 pools). */
export type BuildNativeDexMultihopSwapExpressTxFromRoute160Input = BuildNativeDexMultihopSwapExpressTxFromRoute128Input & {
    finalRecipientHex32: string;
};
/**
 * Recompute **`access_list`** after **`boing_simulateTransaction`** using {@link mergeNativeDexMultihopRouterAccessListWithSimulation}.
 * **`poolHex32List`** and **`poolAccessListOptions`** should match the pools / extras used to build **`tx`**.
 */
export declare function applyNativeDexMultihopSimulationToContractCallTx(tx: {
    type: 'contract_call';
    contract: string;
    calldata: string;
    access_list: {
        read: string[];
        write: string[];
    };
}, input: {
    senderHex32: string;
    poolHex32List: readonly string[];
    sim: SimulateResult;
    poolAccessListOptions?: NativePoolAccessListOptions;
}): {
    type: 'contract_call';
    contract: string;
    calldata: string;
    access_list: {
        read: string[];
        write: string[];
    };
};
export declare function buildNativeDexMultihopSwapExpressTxFromRoute128(input: BuildNativeDexMultihopSwapExpressTxFromRoute128Input): ReturnType<typeof buildNativeDexMultihopRouterContractCallTx>;
export declare function buildNativeDexMultihopSwapExpressTxFromRoute160(input: BuildNativeDexMultihopSwapExpressTxFromRoute160Input): ReturnType<typeof buildNativeDexMultihopRouterContractCallTx>;
//# sourceMappingURL=nativeDexSeamless.d.ts.map