/**
 * Finality / tip helpers for indexers using `boing_getSyncState`.
 * See `docs/RPC-API-SPEC.md` — today `head_height` and `finalized_height` match; they may diverge later.
 */

import type { BoingClient } from './client.js';
import { isBoingRpcMethodNotFound } from './errors.js';

export interface IndexerChainTips {
  headHeight: number;
  finalizedHeight: number;
  /**
   * Inclusive upper bound for **durable** indexing: min(head, finalized).
   * Prefer indexing only through this height until the node exposes lagging finalized semantics.
   */
  durableIndexThrough: number;
  /** Tip block hash (32-byte hex). */
  latestBlockHash: string;
}

/**
 * Read committed tip + finalized fields from the node (single RPC).
 */
export async function getIndexerChainTips(client: BoingClient): Promise<IndexerChainTips> {
  const s = await client.getSyncState();
  const headHeight = s.head_height;
  const finalizedHeight = s.finalized_height;
  return {
    headHeight,
    finalizedHeight,
    durableIndexThrough: Math.min(headHeight, finalizedHeight),
    latestBlockHash: s.latest_block_hash,
  };
}

/**
 * Clamp an inclusive `[fromHeight, toHeight]` so `toHeight` does not exceed `durableIndexThrough`.
 * Returns `null` if the range is empty after clamping or if `fromHeight > toHeight`.
 */
export function clampIndexerHeightRange(
  fromHeight: number,
  toHeight: number,
  durableIndexThrough: number
): { fromHeight: number; toHeight: number } | null {
  assertNonNegInt('fromHeight', fromHeight);
  assertNonNegInt('toHeight', toHeight);
  assertNonNegInt('durableIndexThrough', durableIndexThrough);
  if (fromHeight > toHeight) return null;
  const cappedTo = Math.min(toHeight, durableIndexThrough);
  if (fromHeight > cappedTo) return null;
  return { fromHeight, toHeight: cappedTo };
}

function assertNonNegInt(name: string, h: number): void {
  if (!Number.isInteger(h)) throw new TypeError(`${name} must be an integer`);
  if (h < 0) throw new RangeError(`${name} must be >= 0`);
}

function assertIndexerCursor(name: string, h: number): void {
  if (!Number.isInteger(h)) throw new TypeError(`${name} must be an integer`);
  if (h < -1) throw new RangeError(`${name} must be >= -1 (use -1 before genesis)`);
}

/** How {@link planIndexerChainTipsWithFallback} obtained {@link IndexerChainTips}. */
export type IndexerTipsSource = 'sync_state' | 'chain_height';

export interface PlanIndexerCatchUpOptions {
  /**
   * Cap one tick to at most this many block heights (inclusive count).
   * When unset, the planned range runs through the clamped durable tip.
   */
  maxBlocksPerTick?: number;
}

/** Result of {@link planIndexerCatchUp}: durable range `[fromHeight, toHeight]` to fetch next. */
export interface IndexerCatchUpPlan {
  tips: IndexerChainTips;
  tipsSource: IndexerTipsSource;
  fromHeight: number;
  toHeight: number;
}

/**
 * Like {@link getIndexerChainTips}, but when **`boing_getSyncState`** returns **-32601**,
 * builds tips from **`boing_chainHeight`** + **`boing_getBlockByHeight(tip, false)`** (needs block **`hash`**).
 */
export async function planIndexerChainTipsWithFallback(
  client: BoingClient
): Promise<{ tips: IndexerChainTips; tipsSource: IndexerTipsSource }> {
  try {
    const tips = await getIndexerChainTips(client);
    return { tips, tipsSource: 'sync_state' };
  } catch (e) {
    if (!isBoingRpcMethodNotFound(e)) throw e;
    const height = await client.chainHeight();
    const head = await client.getBlockByHeight(height, false);
    const hash = head?.hash;
    if (hash == null || !/^0x[0-9a-f]{64}$/i.test(hash)) {
      throw new Error(
        'Indexer fallback: boing_getSyncState missing and tip block has no hash — use a current boing-node RPC'
      );
    }
    const tips: IndexerChainTips = {
      headHeight: height,
      finalizedHeight: height,
      durableIndexThrough: height,
      latestBlockHash: hash,
    };
    return { tips, tipsSource: 'chain_height' };
  }
}

/**
 * One ingestion tick: load chain tips (with **`getSyncState`** fallback), then
 * **`clampIndexerHeightRange(lastIndexedHeight + 1, headHeight, durableIndexThrough)`**.
 * Returns **`null`** when there is nothing to index yet.
 *
 * @param lastIndexedHeight — height you have fully persisted (**`-1`** before genesis).
 */
export async function planIndexerCatchUp(
  client: BoingClient,
  lastIndexedHeight: number,
  options?: PlanIndexerCatchUpOptions
): Promise<IndexerCatchUpPlan | null> {
  assertIndexerCursor('lastIndexedHeight', lastIndexedHeight);
  const { tips, tipsSource } = await planIndexerChainTipsWithFallback(client);
  const nextFrom = lastIndexedHeight + 1;
  const clamped = clampIndexerHeightRange(nextFrom, tips.headHeight, tips.durableIndexThrough);
  if (clamped == null) return null;

  let { fromHeight, toHeight } = clamped;
  const cap = options?.maxBlocksPerTick;
  if (cap != null) {
    if (!Number.isInteger(cap) || cap < 1) {
      throw new RangeError('maxBlocksPerTick must be an integer >= 1');
    }
    const span = toHeight - fromHeight + 1;
    if (span > cap) {
      toHeight = fromHeight + cap - 1;
    }
  }

  return { tips, tipsSource, fromHeight, toHeight };
}
