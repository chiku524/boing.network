/**
 * Native CP DEX indexer stats (pools, AMM log aggregates, optional reserve history, 24h swap window via block timestamps).
 * Used by boing.finance CLI/Pages and boing.network Cloudflare Workers (KV-backed history).
 */

import type { BoingClient } from './client.js';
import { fetchNativeDexIntegrationDefaults, type NativeDexIntegrationOverrides } from './dexIntegration.js';
import { isBoingRpcMethodNotFound } from './errors.js';
import { getLogsChunked, mapWithConcurrencyLimit } from './indexerBatch.js';
import { fetchNativeDexDirectorySnapshot } from './nativeDexDirectory.js';
import { filterMapNativeAmmRpcLogs } from './nativeAmmLogs.js';
import {
  NATIVE_CONSTANT_PRODUCT_TOKEN_A_KEY_HEX,
  NATIVE_CONSTANT_PRODUCT_TOKEN_B_KEY_HEX,
} from './nativeAmmPool.js';
import { hydrateCpPoolVenuesFromRpc, type CpPoolVenue } from './nativeDexRouting.js';
import { validateHex32 } from './hex.js';

const SYNTH_A = '0x0000000000000000000000000000000000000000000000000000000000000e01' as const;
const SYNTH_B = '0x0000000000000000000000000000000000000000000000000000000000000e02' as const;
const MAX_HISTORY_PER_POOL = 200;
const MAX_BLOCK_HEADERS_FOR_24H = 512;

export type NativeDexIndexerHistoryPoint = { t: number; ra: string; rb: string };

export type NativeDexIndexerPersistedDoc = {
  history: Record<string, NativeDexIndexerHistoryPoint[]>;
  lastHeadHeight?: number;
  savedAt?: number;
};

/** Load/save full persisted JSON (same shape as CLI state file). */
export interface NativeDexIndexerHistoryStore {
  get(): Promise<string | null>;
  put(body: string): Promise<void>;
}

export type NativeDexIndexerTokenMeta = {
  id: string;
  symbol: string;
  name: string;
};

export type NativeDexIndexerStatsOptions = {
  overrides?: NativeDexIntegrationOverrides;
  /** Inclusive factory `register_pair` scan from this block (omit / NaN to skip). */
  registerFromBlock?: number;
  /** Max inclusive block span for `boing_getLogs` per pool (clamped 1..50000). */
  logScanBlocks?: number;
  /** When set, merge reserve samples and return accumulated `history`. */
  historyStore?: NativeDexIndexerHistoryStore | null;
  /** Defaults to `Date.now()`. */
  nowMs?: number;
  /** JSON string: token hex → USD per atomic unit (+ optional default / defaulta / defaultb). */
  tokenUsdJson?: string;
  /** JSON array of `{ id, symbol?, name? }` merged into `tokenDirectory`. */
  tokenDirectoryExtraJson?: string;
};

export type NativeDexIndexerPoolRow = {
  poolHex: string;
  tokenAHex: string;
  tokenBHex: string;
  /** From **`boing_listDexPools.createdAtHeight`** when the node supports discovery RPC (merged after stats build). */
  createdAtHeight?: number;
  /** From **`boing_listDexPools`** when merged (same source as **`tokenADecimals`** on RPC pool rows). */
  tokenADecimals?: number;
  /** From **`boing_listDexPools`** when merged. */
  tokenBDecimals?: number;
  /** On-chain reserve A (decimal string); aligns with `boing_listDexPools.reserveA` when present. */
  reserveA?: string;
  /** On-chain reserve B (decimal string); aligns with `boing_listDexPools.reserveB` when present. */
  reserveB?: string;
  /** Swaps in the full `[head - logScanBlocks + 1, head]` window. */
  swapCount: number;
  swapCount24h: number;
  /** Alias for UIs that read `swaps24h`. */
  swaps24h: number;
  /** Sum of `amountIn` for swaps whose block time is within the last 24h (UTC wall vs `nowMs`). */
  volume24hApprox: string;
  /** Sum of `amountIn` for all swaps in the scan window. */
  volumeScanWindowApprox: string;
  tvlApprox: string;
  /** Present when `tokenUsdJson` maps prices for at least one leg. */
  tvlUsdApprox?: string;
  note: string;
};

export type NativeDexIndexerStatsPayload = {
  /**
   * HTTP discovery mirror version (`docs/HANDOFF_Boing_Network_Global_Token_Discovery.md` §4).
   * Present on indexer **`/stats`** payloads built by **`buildNativeDexIndexerStatsForClient`**.
   */
  schemaVersion?: number;
  updatedAt: string;
  note: string;
  headHeight: number | null;
  pools: NativeDexIndexerPoolRow[];
  history: Record<string, NativeDexIndexerHistoryPoint[]>;
  tokenDirectory: NativeDexIndexerTokenMeta[];
  /** Alias of **`tokenDirectory`** for RPC-aligned consumers (`boing_listDexTokens`-style naming). */
  tokens?: NativeDexIndexerTokenMeta[];
};

function storageWordToAccountHex(valueHex: string | undefined): string | null {
  if (!valueHex || typeof valueHex !== 'string') return null;
  try {
    const v = validateHex32(valueHex.trim());
    if (/^0x0+$/i.test(v)) return null;
    return `0x${v.slice(2).toLowerCase()}`;
  } catch {
    return null;
  }
}

async function fetchNativeCpPoolTokenRow(
  client: BoingClient,
  poolHex32: string,
): Promise<{ poolHex: string; tokenAHex: string; tokenBHex: string }> {
  const pool = validateHex32(poolHex32.trim()) as `0x${string}`;
  const [wa, wb] = await Promise.all([
    client.getContractStorage(pool, NATIVE_CONSTANT_PRODUCT_TOKEN_A_KEY_HEX),
    client.getContractStorage(pool, NATIVE_CONSTANT_PRODUCT_TOKEN_B_KEY_HEX),
  ]);
  let tokenAHex = storageWordToAccountHex(wa.value);
  let tokenBHex = storageWordToAccountHex(wb.value);
  if (!tokenAHex && !tokenBHex) {
    tokenAHex = SYNTH_A;
    tokenBHex = SYNTH_B;
  } else {
    tokenAHex = tokenAHex || SYNTH_A;
    tokenBHex = tokenBHex || SYNTH_B;
  }
  return { poolHex: pool, tokenAHex, tokenBHex };
}

export function parseNativeDexIndexerPersistedDoc(raw: string | null | undefined): NativeDexIndexerPersistedDoc {
  if (!raw) return { history: {} };
  try {
    const p = JSON.parse(raw) as unknown;
    if (p && typeof p === 'object' && p !== null && 'history' in p) {
      const h = (p as { history: unknown }).history;
      if (h && typeof h === 'object') {
        return { history: { ...(h as Record<string, NativeDexIndexerHistoryPoint[]>) } };
      }
    }
  } catch {
    /* ignore */
  }
  return { history: {} };
}

export function appendVenuesToHistoryDoc(
  doc: NativeDexIndexerPersistedDoc,
  venues: readonly CpPoolVenue[],
  headHeight: number,
  nowMs: number,
  maxPerPool: number = MAX_HISTORY_PER_POOL,
): NativeDexIndexerPersistedDoc {
  const history: Record<string, NativeDexIndexerHistoryPoint[]> = { ...doc.history };
  for (const v of venues) {
    const k = v.poolHex.toLowerCase();
    const ra = v.reserveA.toString();
    const rb = v.reserveB.toString();
    const arr = Array.isArray(history[k]) ? [...history[k]!] : [];
    const last = arr[arr.length - 1];
    if (!last || last.ra !== ra || last.rb !== rb) {
      arr.push({ t: nowMs, ra, rb });
    }
    history[k] = arr.slice(-maxPerPool);
  }
  return { history, lastHeadHeight: headHeight, savedAt: nowMs };
}

function parseUsdMap(json: string | undefined): Record<string, string> {
  if (!json?.trim()) return {};
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    if (!o || typeof o !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(o)) {
      const k = key.trim().toLowerCase();
      if (k === 'default' || k === 'defaulta' || k === 'defaultb') {
        out[k] = String(val);
        continue;
      }
      if (!/^0x[0-9a-f]{64}$/i.test(k)) continue;
      out[`0x${k.slice(2).toLowerCase()}`] = String(val);
    }
    return out;
  } catch {
    return {};
  }
}

function estimatePoolTvlUsd(
  tokenAHex: string,
  tokenBHex: string,
  reserveA: bigint,
  reserveB: bigint,
  usdMap: Record<string, string>,
): number | null {
  const keys = Object.keys(usdMap);
  if (keys.length === 0) return null;
  const a = tokenAHex.trim().toLowerCase();
  const b = tokenBHex.trim().toLowerCase();
  const pa = usdMap[a] ?? usdMap.defaulta ?? usdMap.default ?? null;
  const pb = usdMap[b] ?? usdMap.defaultb ?? usdMap.default ?? null;
  if (pa == null && pb == null) return null;
  try {
    const ra = Number(reserveA);
    const rb = Number(reserveB);
    const fa = pa != null ? parseFloat(String(pa)) : 0;
    const fb = pb != null ? parseFloat(String(pb)) : 0;
    if (!Number.isFinite(ra) || !Number.isFinite(rb) || !Number.isFinite(fa) || !Number.isFinite(fb)) return null;
    const partA = pa != null ? ra * fa : 0;
    const partB = pb != null ? rb * fb : 0;
    const tvl = partA + partB;
    return Number.isFinite(tvl) ? tvl : null;
  } catch {
    return null;
  }
}

function blockTimestampToMs(ts: number): number {
  if (!Number.isFinite(ts)) return 0;
  return ts < 1e12 ? ts * 1000 : ts;
}

async function fetchBlockTimeMap(client: BoingClient, heights: readonly number[]): Promise<Map<number, number>> {
  const uniq = [...new Set(heights.filter((h) => Number.isInteger(h) && h >= 0))].slice(0, MAX_BLOCK_HEADERS_FOR_24H);
  const m = new Map<number, number>();
  if (uniq.length === 0) return m;
  const blocks = await mapWithConcurrencyLimit(uniq, 4, (h) => client.getBlockByHeight(h, false));
  for (let i = 0; i < uniq.length; i++) {
    const h = uniq[i]!;
    const b = blocks[i];
    const raw = b?.header?.timestamp;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      m.set(h, blockTimestampToMs(raw));
    }
  }
  return m;
}

function tokenDirectoryFromVenues(venues: readonly CpPoolVenue[]): NativeDexIndexerTokenMeta[] {
  const by = new Map<string, NativeDexIndexerTokenMeta>();
  for (const v of venues) {
    for (const raw of [v.tokenAHex, v.tokenBHex]) {
      const id = validateHex32(raw.trim()) as string;
      const low = id.toLowerCase();
      if (by.has(low)) continue;
      by.set(low, {
        id: low,
        symbol: `${id.slice(0, 8)}…${id.slice(-4)}`,
        name: `Pool token ${id.slice(0, 10)}…`,
      });
    }
  }
  return [...by.values()].sort((x, y) => x.symbol.localeCompare(y.symbol));
}

function mergeTokenDirectoryExtra(
  base: NativeDexIndexerTokenMeta[],
  extraJson: string | undefined,
): NativeDexIndexerTokenMeta[] {
  if (!extraJson?.trim()) return base;
  try {
    const arr = JSON.parse(extraJson) as unknown;
    if (!Array.isArray(arr)) return base;
    const by = new Map(base.map((t) => [t.id.toLowerCase(), { ...t }]));
    for (const row of arr) {
      if (!row || typeof row !== 'object') continue;
      const idRaw = (row as { id?: unknown; address?: unknown }).id ?? (row as { address?: unknown }).address;
      if (typeof idRaw !== 'string') continue;
      let id: string;
      try {
        id = validateHex32(idRaw.trim()) as string;
      } catch {
        continue;
      }
      const low = id.toLowerCase();
      const symbol = String((row as { symbol?: unknown }).symbol || base.find((b) => b.id === low)?.symbol || '').slice(
        0,
        16,
      );
      const name = String((row as { name?: unknown }).name || '').slice(0, 80);
      by.set(low, {
        id: low,
        symbol: symbol || `${id.slice(0, 8)}…`,
        name: name || `Token ${id.slice(0, 10)}…`,
      });
    }
    return [...by.values()].sort((x, y) => x.symbol.localeCompare(y.symbol));
  } catch {
    return base;
  }
}

/**
 * Build DEX override map from a plain env object (Cloudflare `env`, etc.).
 */
export function buildDexOverridesFromPlainEnv(env: Record<string, string | undefined> | null | undefined): NativeDexIntegrationOverrides {
  const o: NativeDexIntegrationOverrides = {};
  if (!env || typeof env !== 'object') return o;
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = env[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return '';
  };
  const pool = pick('REACT_APP_BOING_NATIVE_AMM_POOL', 'VITE_BOING_NATIVE_AMM_POOL', 'BOING_NATIVE_AMM_POOL');
  const fac = pick(
    'REACT_APP_BOING_NATIVE_VM_DEX_FACTORY',
    'VITE_BOING_NATIVE_VM_DEX_FACTORY',
    'BOING_NATIVE_VM_DEX_FACTORY',
    'BOING_DEX_FACTORY_HEX',
  );
  const hop = pick(
    'REACT_APP_BOING_NATIVE_VM_SWAP_ROUTER',
    'VITE_BOING_NATIVE_VM_SWAP_ROUTER',
    'BOING_NATIVE_VM_SWAP_ROUTER',
    'BOING_NATIVE_DEX_MULTIHOP_SWAP_ROUTER',
  );
  const l2 = pick(
    'REACT_APP_BOING_NATIVE_DEX_LEDGER_ROUTER_V2',
    'VITE_BOING_NATIVE_DEX_LEDGER_ROUTER_V2',
    'BOING_NATIVE_DEX_LEDGER_ROUTER_V2',
  );
  const l3 = pick(
    'REACT_APP_BOING_NATIVE_DEX_LEDGER_ROUTER_V3',
    'VITE_BOING_NATIVE_DEX_LEDGER_ROUTER_V3',
    'BOING_NATIVE_DEX_LEDGER_ROUTER_V3',
  );
  const vault = pick('REACT_APP_BOING_NATIVE_AMM_LP_VAULT', 'VITE_BOING_NATIVE_AMM_LP_VAULT', 'BOING_NATIVE_AMM_LP_VAULT');
  const share = pick(
    'REACT_APP_BOING_NATIVE_AMM_LP_SHARE_TOKEN',
    'VITE_BOING_NATIVE_AMM_LP_SHARE_TOKEN',
    'BOING_NATIVE_AMM_LP_SHARE_TOKEN',
  );
  if (pool) o.nativeCpPoolAccountHex = pool;
  if (fac) o.nativeDexFactoryAccountHex = fac;
  if (hop) o.nativeDexMultihopSwapRouterAccountHex = hop;
  if (l2) o.nativeDexLedgerRouterV2AccountHex = l2;
  if (l3) o.nativeDexLedgerRouterV3AccountHex = l3;
  if (vault) o.nativeAmmLpVaultAccountHex = vault;
  if (share) o.nativeLpShareTokenAccountHex = share;
  return o;
}

type ListDexPoolsDiscoveryMerge = {
  createdAtHeight?: number;
  tokenADecimals?: number;
  tokenBDecimals?: number;
};

async function mergePoolDiscoveryFromListDexPoolsRpc(
  client: BoingClient,
  factoryHex: string | null | undefined,
  pools: NativeDexIndexerPoolRow[],
): Promise<void> {
  if (!factoryHex?.trim() || pools.length === 0) return;
  let factoryNorm: string;
  try {
    factoryNorm = validateHex32(factoryHex.trim()) as string;
  } catch {
    return;
  }
  try {
    const map = new Map<string, ListDexPoolsDiscoveryMerge>();
    let cursor: string | null = null;
    for (;;) {
      const page = await client.listDexPoolsPage({ factory: factoryNorm, cursor, limit: 500 });
      for (const p of page.pools) {
        const k = p.poolHex.toLowerCase();
        const cur: ListDexPoolsDiscoveryMerge = { ...map.get(k) };
        if (typeof p.createdAtHeight === 'number' && Number.isFinite(p.createdAtHeight)) {
          cur.createdAtHeight = p.createdAtHeight;
        }
        if (typeof p.tokenADecimals === 'number' && Number.isFinite(p.tokenADecimals)) {
          cur.tokenADecimals = p.tokenADecimals;
        }
        if (typeof p.tokenBDecimals === 'number' && Number.isFinite(p.tokenBDecimals)) {
          cur.tokenBDecimals = p.tokenBDecimals;
        }
        map.set(k, cur);
      }
      const next = page.nextCursor;
      if (!next) break;
      cursor = next;
    }
    for (const row of pools) {
      const m = map.get(row.poolHex.toLowerCase());
      if (!m) continue;
      if (m.createdAtHeight !== undefined) row.createdAtHeight = m.createdAtHeight;
      if (m.tokenADecimals !== undefined) row.tokenADecimals = m.tokenADecimals;
      if (m.tokenBDecimals !== undefined) row.tokenBDecimals = m.tokenBDecimals;
    }
  } catch (e) {
    if (isBoingRpcMethodNotFound(e)) return;
    throw e;
  }
}

/**
 * Core indexer run (RPC via `client`). Does not create the client.
 */
export async function buildNativeDexIndexerStatsForClient(
  client: BoingClient,
  opts: NativeDexIndexerStatsOptions = {},
): Promise<NativeDexIndexerStatsPayload> {
  const logScanBlocks = Math.min(Math.max(1, opts.logScanBlocks ?? 8000), 50_000);
  const registerFromBlock = opts.registerFromBlock ?? NaN;
  const nowMs = opts.nowMs ?? Date.now();
  const cutoffMs = nowMs - 86_400_000;
  const usdMap = parseUsdMap(opts.tokenUsdJson);

  const ov =
    opts.overrides && Object.keys(opts.overrides).length > 0 ? opts.overrides : undefined;

  const d = await fetchNativeDexIntegrationDefaults(client, ov);
  const poolHex = d.nativeCpPoolAccountHex;
  if (!poolHex) {
    return {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      note: 'No native CP pool in RPC defaults / overrides',
      headHeight: null,
      pools: [],
      history: {},
      tokenDirectory: [],
      tokens: [],
    };
  }

  const row = await fetchNativeCpPoolTokenRow(client, poolHex);
  let venues = await hydrateCpPoolVenuesFromRpc(client, [row], { concurrency: 4 });

  let registerMeta: { count?: number; fromBlock?: number; error?: string } | null = null;

  if (Number.isFinite(registerFromBlock) && registerFromBlock >= 0) {
    try {
      const snap = await fetchNativeDexDirectorySnapshot(client, {
        overrides: ov,
        registerLogs: { fromBlock: registerFromBlock },
      });
      const logs = snap.registerLogs;
      registerMeta = { count: Array.isArray(logs) ? logs.length : 0, fromBlock: registerFromBlock };
      if (logs?.length) {
        const rows = logs.map((l) => ({
          poolHex: l.poolHex,
          tokenAHex: l.tokenAHex,
          tokenBHex: l.tokenBHex,
        }));
        const dirVenues = await hydrateCpPoolVenuesFromRpc(client, rows, { concurrency: 4 });
        const byPool = new Map<string, CpPoolVenue>();
        for (const venue of [...venues, ...dirVenues]) {
          byPool.set(venue.poolHex.toLowerCase(), venue);
        }
        venues = [...byPool.values()];
      }
    } catch (e) {
      registerMeta = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  const lightSnap = await fetchNativeDexDirectorySnapshot(client, { overrides: ov });
  const headHeight = typeof lightSnap.headHeight === 'number' ? lightSnap.headHeight : null;

  let history: Record<string, NativeDexIndexerHistoryPoint[]> = {};
  if (opts.historyStore) {
    const raw = await opts.historyStore.get();
    const doc = parseNativeDexIndexerPersistedDoc(raw);
    const next = appendVenuesToHistoryDoc(doc, venues, headHeight ?? 0, nowMs);
    await opts.historyStore.put(JSON.stringify(next));
    history = next.history;
  }

  const pools: NativeDexIndexerPoolRow[] = [];

  for (const v of venues) {
    const pool = v.poolHex.toLowerCase();
    let swapCount = 0;
    let volumeInSum = 0n;
    let addLiquidityCount = 0;
    let removeLiquidityCount = 0;
    let swapCount24h = 0;
    let volume24h = 0n;

    if (headHeight != null && Number.isFinite(headHeight)) {
      const toB = Math.floor(headHeight);
      const fromB = Math.max(0, toB - logScanBlocks + 1);
      try {
        const logs = await getLogsChunked(
          client,
          { fromBlock: fromB, toBlock: toB, address: pool },
          { maxConcurrent: 1 },
        );
        const parsed = filterMapNativeAmmRpcLogs(logs);
        const swapHeights: number[] = [];
        for (const ev of parsed) {
          if (ev.address && ev.address.toLowerCase() !== pool) continue;
          switch (ev.kind) {
            case 'swap':
              swapCount += 1;
              volumeInSum += ev.amountIn;
              swapHeights.push(ev.block_height);
              break;
            case 'addLiquidity':
              addLiquidityCount += 1;
              break;
            case 'removeLiquidity':
              removeLiquidityCount += 1;
              break;
            default:
              break;
          }
        }
        const timeMap = await fetchBlockTimeMap(client, swapHeights);
        for (const ev of parsed) {
          if (ev.kind !== 'swap') continue;
          if (ev.address && ev.address.toLowerCase() !== pool) continue;
          const tms = timeMap.get(ev.block_height);
          if (tms != null && tms >= cutoffMs) {
            swapCount24h += 1;
            volume24h += ev.amountIn;
          }
        }
      } catch {
        /* zeros */
      }
    }

    const tvlUsd = estimatePoolTvlUsd(v.tokenAHex, v.tokenBHex, v.reserveA, v.reserveB, usdMap);

    const rowOut: NativeDexIndexerPoolRow = {
      poolHex: v.poolHex,
      tokenAHex: v.tokenAHex,
      tokenBHex: v.tokenBHex,
      reserveA: v.reserveA.toString(),
      reserveB: v.reserveB.toString(),
      swapCount,
      swapCount24h,
      swaps24h: swapCount24h,
      volume24hApprox: volume24h.toString(),
      volumeScanWindowApprox: volumeInSum.toString(),
      tvlApprox: `reserveA=${v.reserveA.toString()} reserveB=${v.reserveB.toString()}`,
      note: `window ${logScanBlocks} blocks · swapsWindow ${swapCount} · addLiq ${addLiquidityCount} · remLiq ${removeLiquidityCount}`,
    };
    if (tvlUsd != null && Number.isFinite(tvlUsd)) {
      rowOut.tvlUsdApprox = tvlUsd.toFixed(4);
    }
    pools.push(rowOut);
  }

  const tokenDirectory = mergeTokenDirectoryExtra(tokenDirectoryFromVenues(venues), opts.tokenDirectoryExtraJson);

  const noteParts = [
    'boing-sdk nativeDexIndexerStats v2 · volume24h uses block header timestamps (cap unique headers)',
    headHeight != null ? `head ${headHeight}` : 'no head',
    `scanBlocks ${logScanBlocks}`,
  ];
  if (registerMeta) noteParts.push(`registerLogs ${JSON.stringify(registerMeta)}`);

  await mergePoolDiscoveryFromListDexPoolsRpc(client, d.nativeDexFactoryAccountHex, pools);

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    note: noteParts.join(' · '),
    headHeight,
    pools,
    history,
    tokenDirectory,
    tokens: tokenDirectory,
  };
}
