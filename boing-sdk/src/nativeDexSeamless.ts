/**
 * Copy, preflight, and one-shot tx helpers for native Boing DEX integration.
 * Reinforces that Boing is **not** a drop-in Uniswap/EVM router and keeps flows **Boing-RPC-only**.
 */

import type { BoingClient } from './client.js';
import type { NativeDexIntegrationDefaults } from './dexIntegration.js';
import { bytesToHex, validateHex32 } from './hex.js';
import { encodeNativeAmmSwapCalldata } from './nativeAmm.js';
import {
  buildNativeConstantProductContractCallTx,
  buildNativeDexMultihopRouterContractCallTx,
  mergeNativeDexMultihopRouterAccessListWithSimulation,
  type NativePoolAccessListOptions,
} from './nativeAmmPool.js';
import type { CpSwapRoute } from './nativeDexRouting.js';
import {
  encodeNativeDexMultihopRouterCalldata128FromRoute,
  encodeNativeDexMultihopRouterCalldata160FromRoute,
  minOutPerHopFromQuotedRouteSlippageBps,
  uniqueSortedTokenHex32FromCpRoute,
} from './nativeDexRouting.js';
import { assertBoingRpcEnvironment, type BoingRpcPreflightError } from './preflightGate.js';
import type { SimulateResult } from './types.js';

/** Short line for tooltips / footers. */
export const BOING_NATIVE_DEX_NOT_EVM_TAGLINE =
  'Boing native DEX uses 32-byte account ids, explicit access lists, and VM-specific calldata—not a paste-any-Uniswap-address router.';

/** Bullet list for onboarding modals or docs snippets. */
export const BOING_NATIVE_DEX_NOT_EVM_BULLETS = [
  'Accounts are 32-byte Boing AccountIds (64 hex chars), not 20-byte Ethereum contract addresses.',
  'Each `contract_call` needs calldata per NATIVE-AMM / NATIVE-DEX specs plus explicit `access_list` read/write sets.',
  'Pool, factory, multihop router, ledger forwarders, and LP vault/share ids resolve via RPC `end_user` hints, `fetchNativeDexIntegrationDefaults`, env overrides, or CREATE2 prediction—there is no universal router ABI.',
] as const;

export function formatBoingNativeDexNotEvmDisclaimer(): string {
  const bullets = BOING_NATIVE_DEX_NOT_EVM_BULLETS.map((b) => `• ${b}`).join('\n');
  return `${BOING_NATIVE_DEX_NOT_EVM_TAGLINE}\n\n${bullets}`;
}

/**
 * Surfaces missing operator hints so UIs can link to ops runbooks instead of failing silently.
 */
export function describeNativeDexDefaultGaps(defaults: NativeDexIntegrationDefaults): readonly string[] {
  const out: string[] = [];
  if (defaults.nativeCpPoolAccountHex == null) {
    out.push(
      'No resolved native constant-product pool id: set node env BOING_CANONICAL_NATIVE_CP_POOL, use chain 6913 embedded fallback, or pass a pool override in your app.',
    );
  }
  if (defaults.nativeDexFactoryAccountHex == null) {
    out.push(
      'No native DEX factory id: set BOING_CANONICAL_NATIVE_DEX_FACTORY on the node or pass a factory override so directory scans and pair resolution can run.',
    );
  }
  if (defaults.nativeDexMultihopSwapRouterAccountHex == null) {
    out.push(
      'No native multihop swap router id: set BOING_CANONICAL_NATIVE_DEX_MULTIHOP_SWAP_ROUTER, use chain 6913 embedded fallback, or pass a router override to submit bundled multi-pool swaps in one tx.',
    );
  }
  return out;
}

/** RPC methods a typical native DEX dApp (read + simulate + logs) expects from **boing-node**. */
export const BOING_NATIVE_DEX_TOOLKIT_RPC_METHODS = [
  'boing_getNetworkInfo',
  'boing_simulateTransaction',
  'boing_getLogs',
  'boing_getContractStorage',
] as const satisfies readonly string[];

/**
 * {@link assertBoingRpcEnvironment} with {@link BOING_NATIVE_DEX_TOOLKIT_RPC_METHODS}.
 * Throws {@link BoingRpcPreflightError} when the endpoint is missing methods or failing discovery.
 */
export async function assertBoingNativeDexToolkitRpc(client: BoingClient) {
  return assertBoingRpcEnvironment(client, {
    requiredMethods: [...BOING_NATIVE_DEX_TOOLKIT_RPC_METHODS],
  });
}

/** User-facing text when {@link assertBoingNativeDexToolkitRpc} fails (QA / pruned / old node). */
export function formatNativeDexToolkitPreflightForUi(err: BoingRpcPreflightError): string {
  const lines = [
    'This screen needs a Boing JSON-RPC endpoint that supports simulate, bounded logs, contract storage, and network info.',
    'Deploy and sensitive paths stay gated by protocol QA—use the SDK preflight helpers and show users a clear review step.',
    '',
    ...err.doctor.messages,
  ];
  return lines.join('\n');
}

/**
 * One-shot **`contract_call`** object for **`boing_sendTransaction`** / Boing Express: native CP **`swap`** calldata + pool access list.
 */
export function buildNativeCpPoolSwapExpressTx(input: {
  senderHex32: string;
  poolHex32: string;
  direction: bigint;
  amountIn: bigint;
  minOut: bigint;
  poolAccessListOptions?: NativePoolAccessListOptions;
}): ReturnType<typeof buildNativeConstantProductContractCallTx> {
  const calldata = bytesToHex(
    encodeNativeAmmSwapCalldata(input.direction, input.amountIn, input.minOut),
  );
  return buildNativeConstantProductContractCallTx(
    input.senderHex32,
    input.poolHex32,
    calldata,
    input.poolAccessListOptions,
  );
}

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
export type BuildNativeDexMultihopSwapExpressTxFromRoute160Input =
  BuildNativeDexMultihopSwapExpressTxFromRoute128Input & {
    finalRecipientHex32: string;
  };

function mergeMultihopPoolAccessListOptions(
  route: CpSwapRoute,
  base: NativePoolAccessListOptions | undefined,
  includeVenueTokenAccounts: boolean | undefined
): NativePoolAccessListOptions | undefined {
  const fromRoute = includeVenueTokenAccounts ? uniqueSortedTokenHex32FromCpRoute(route) : [];
  const fromBase = base?.additionalAccountsHex32 ?? [];
  if (fromRoute.length === 0 && fromBase.length === 0 && !base) return undefined;
  if (fromRoute.length === 0 && fromBase.length === 0) return base;
  const set = new Set<string>();
  for (const x of fromBase) set.add(validateHex32(x).toLowerCase());
  for (const x of fromRoute) set.add(x);
  return {
    ...base,
    additionalAccountsHex32: [...set].sort(),
  };
}

/**
 * Recompute **`access_list`** after **`boing_simulateTransaction`** using {@link mergeNativeDexMultihopRouterAccessListWithSimulation}.
 * **`poolHex32List`** and **`poolAccessListOptions`** should match the pools / extras used to build **`tx`**.
 */
export function applyNativeDexMultihopSimulationToContractCallTx(
  tx: {
    type: 'contract_call';
    contract: string;
    calldata: string;
    access_list: { read: string[]; write: string[] };
  },
  input: {
    senderHex32: string;
    poolHex32List: readonly string[];
    sim: SimulateResult;
    poolAccessListOptions?: NativePoolAccessListOptions;
  }
): {
  type: 'contract_call';
  contract: string;
  calldata: string;
  access_list: { read: string[]; write: string[] };
} {
  const access_list = mergeNativeDexMultihopRouterAccessListWithSimulation(
    input.senderHex32,
    tx.contract,
    input.poolHex32List,
    input.sim,
    input.poolAccessListOptions
  );
  return { ...tx, access_list };
}

function resolveMultihopMinOutPerHop(
  route: CpSwapRoute,
  minOutPerHop: readonly bigint[] | undefined,
  slippageBps: bigint | undefined
): bigint[] {
  if (minOutPerHop != null) {
    if (minOutPerHop.length !== route.hops.length) {
      throw new RangeError('minOutPerHop length must match route.hops.length');
    }
    return [...minOutPerHop];
  }
  if (slippageBps !== undefined) {
    return minOutPerHopFromQuotedRouteSlippageBps(route, slippageBps);
  }
  throw new Error('Pass minOutPerHop or slippageBps');
}

export function buildNativeDexMultihopSwapExpressTxFromRoute128(
  input: BuildNativeDexMultihopSwapExpressTxFromRoute128Input
): ReturnType<typeof buildNativeDexMultihopRouterContractCallTx> {
  if (input.route.hops.length < 2) {
    throw new RangeError('multihop route must have at least 2 hops');
  }
  const minOutPerHop = resolveMultihopMinOutPerHop(
    input.route,
    input.minOutPerHop,
    input.slippageBps
  );
  const calldata = bytesToHex(
    encodeNativeDexMultihopRouterCalldata128FromRoute(input.route, { minOutPerHop }),
  );
  const pools = input.route.hops.map((h) => h.venue.poolHex);
  const poolOpts = mergeMultihopPoolAccessListOptions(
    input.route,
    input.poolAccessListOptions,
    input.includeVenueTokenAccounts
  );
  return buildNativeDexMultihopRouterContractCallTx(
    input.senderHex32,
    input.routerHex32,
    calldata,
    pools,
    poolOpts,
  );
}

export function buildNativeDexMultihopSwapExpressTxFromRoute160(
  input: BuildNativeDexMultihopSwapExpressTxFromRoute160Input
): ReturnType<typeof buildNativeDexMultihopRouterContractCallTx> {
  if (input.route.hops.length < 2) {
    throw new RangeError('multihop route must have at least 2 hops');
  }
  const minOutPerHop = resolveMultihopMinOutPerHop(
    input.route,
    input.minOutPerHop,
    input.slippageBps
  );
  const calldata = bytesToHex(
    encodeNativeDexMultihopRouterCalldata160FromRoute(input.route, {
      minOutPerHop,
      routerAccountHex32: input.routerHex32,
      finalRecipientHex32: input.finalRecipientHex32,
    }),
  );
  const pools = input.route.hops.map((h) => h.venue.poolHex);
  const poolOpts = mergeMultihopPoolAccessListOptions(
    input.route,
    input.poolAccessListOptions,
    input.includeVenueTokenAccounts
  );
  return buildNativeDexMultihopRouterContractCallTx(
    input.senderHex32,
    input.routerHex32,
    calldata,
    pools,
    poolOpts,
  );
}
