/**
 * Indexer-oriented RPC batching: `boing_getLogs` has a max inclusive block span per call (default 128 on the node).
 * This module chunks wide ranges into compliant requests and merges results.
 */

import type { BoingClient } from './client.js';
import type { Block, ExecutionReceipt, GetLogsFilter, RpcLogEntry } from './types.js';

/** Default max inclusive block span per `boing_getLogs` (see `docs/RPC-API-SPEC.md`). */
export const DEFAULT_GET_LOGS_MAX_BLOCK_SPAN = 128;

export interface LogChunkFilter extends Omit<GetLogsFilter, 'fromBlock' | 'toBlock'> {
  fromBlock: number;
  toBlock: number;
}

export interface MapWithConcurrencyLimitOptions {
  signal?: AbortSignal;
}

/**
 * Map `items` with at most `limit` concurrent in-flight `fn` calls (default pattern for indexer backfill).
 * Results are in the **same order** as `items`. Throws if `signal` is aborted between tasks.
 */
export async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  options?: MapWithConcurrencyLimitOptions
): Promise<R[]> {
  if (limit < 1) throw new RangeError('limit must be >= 1');
  if (!Number.isInteger(limit)) throw new TypeError('limit must be an integer');
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let next = 0;
  const signal = options?.signal;

  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) {
        throw new Error('mapWithConcurrencyLimit aborted');
      }
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]!, idx);
    }
  }

  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/**
 * Plan inclusive `[from, to]` ranges each spanning at most `maxSpan` blocks.
 */
export function planLogBlockChunks(
  fromBlock: number,
  toBlock: number,
  maxSpan: number = DEFAULT_GET_LOGS_MAX_BLOCK_SPAN
): Array<{ fromBlock: number; toBlock: number }> {
  if (!Number.isInteger(fromBlock) || !Number.isInteger(toBlock)) {
    throw new TypeError('fromBlock and toBlock must be integers');
  }
  if (maxSpan < 1) throw new RangeError('maxSpan must be >= 1');
  if (fromBlock > toBlock) return [];

  const chunks: Array<{ fromBlock: number; toBlock: number }> = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = Math.min(start + maxSpan - 1, toBlock);
    chunks.push({ fromBlock: start, toBlock: end });
    start = end + 1;
  }
  return chunks;
}

function compareLogEntries(a: RpcLogEntry, b: RpcLogEntry): number {
  if (a.block_height !== b.block_height) return a.block_height - b.block_height;
  if (a.tx_index !== b.tx_index) return a.tx_index - b.tx_index;
  return a.log_index - b.log_index;
}

export interface GetLogsChunkedOptions {
  maxBlockSpan?: number;
  /**
   * Max concurrent `boing_getLogs` RPCs (default **1**). Increase only when your RPC operator allows it.
   */
  maxConcurrent?: number;
  signal?: AbortSignal;
}

/**
 * Run `boing_getLogs` over `[filter.fromBlock, filter.toBlock]` in chunks of at most `maxBlockSpan` blocks.
 * Results are merged and sorted by `(block_height, tx_index, log_index)`.
 */
export async function getLogsChunked(
  client: BoingClient,
  filter: LogChunkFilter,
  options?: GetLogsChunkedOptions
): Promise<RpcLogEntry[]> {
  const maxSpan = options?.maxBlockSpan ?? DEFAULT_GET_LOGS_MAX_BLOCK_SPAN;
  const concurrent = options?.maxConcurrent ?? 1;
  const { fromBlock, toBlock, ...rest } = filter;
  const chunks = planLogBlockChunks(fromBlock, toBlock, maxSpan);

  const parts = await mapWithConcurrencyLimit(
    chunks,
    concurrent,
    async (c) =>
      client.getLogs({
        ...rest,
        fromBlock: c.fromBlock,
        toBlock: c.toBlock,
      } as GetLogsFilter),
    { signal: options?.signal }
  );

  const rows: RpcLogEntry[] = [];
  for (const part of parts) {
    rows.push(...part);
  }
  rows.sort(compareLogEntries);
  return rows;
}

/**
 * Receipts for one block when the node returns them on `boing_getBlockByHeight(..., true)`.
 * Drops `null` slots (if any). Returns `[]` if the block is missing or has no `receipts` array.
 */
export async function fetchReceiptsForBlockHeight(
  client: BoingClient,
  height: number
): Promise<ExecutionReceipt[]> {
  const block = await client.getBlockByHeight(height, true);
  if (!block?.receipts?.length) return [];
  const out: ExecutionReceipt[] = [];
  for (const r of block.receipts) {
    if (r != null) out.push(r);
  }
  return out;
}

/** One block’s non-null receipts (same order as txs in the block when the node fills `receipts`). */
export interface BlockReceiptsBundle {
  height: number;
  receipts: ExecutionReceipt[];
}

export type FetchReceiptsHeightRangeMissing = 'throw' | 'omit';

export interface FetchReceiptsForHeightRangeOptions {
  /**
   * When `boing_getBlockByHeight` returns `null` (pruned / unknown height).
   * - `throw` (default): stop with an error naming the height.
   * - `omit`: skip that height (output heights may have gaps vs the requested range).
   */
  onMissingBlock?: FetchReceiptsHeightRangeMissing;
  /** When set, checked between tasks; throws if aborted. */
  signal?: AbortSignal;
  /**
   * Max concurrent block fetches (default **1**). Results are still returned **sorted by height**.
   */
  maxConcurrent?: number;
}

/** Same options as {@link fetchReceiptsForHeightRange} — shared height-range fetch semantics. */
export type FetchBlocksWithReceiptsForHeightRangeOptions = FetchReceiptsForHeightRangeOptions;

/** Full block payload + height for replay-style ingestion (`transactions` + `receipts`). */
export interface BlockWithReceiptsBundle {
  height: number;
  block: Block;
}

/** Concatenate receipts from ordered bundles (e.g. after `fetchReceiptsForHeightRange`). */
export function flattenReceiptsFromBundles(
  bundles: readonly BlockReceiptsBundle[]
): ExecutionReceipt[] {
  const out: ExecutionReceipt[] = [];
  for (const b of bundles) {
    out.push(...b.receipts);
  }
  return out;
}

function assertIntHeight(name: string, h: number): void {
  if (!Number.isInteger(h)) {
    throw new TypeError(`${name} must be an integer`);
  }
  if (h < 0) {
    throw new RangeError(`${name} must be >= 0`);
  }
}

/**
 * Summary of which heights were missing after a ranged fetch with **`onMissingBlock: 'omit'`**.
 * Persist **`missingHeightRangesInclusive`** (or **`omittedHeights`**) so indexers do not claim completeness across pruned gaps.
 */
export interface IndexerFetchGapSummary {
  requestedFromHeight: number;
  requestedToHeight: number;
  /** Sorted heights in `[requestedFromHeight, requestedToHeight]` with no block returned. */
  omittedHeights: number[];
  /** Merged inclusive ranges of {@link omittedHeights}. */
  missingHeightRangesInclusive: Array<{ fromHeight: number; toHeight: number }>;
  /**
   * Highest **H** such that every height in `[requestedFromHeight, H]` appears in **`fetchedHeights`**.
   * **`null`** when **`requestedFromHeight`** itself was omitted (no contiguous prefix).
   */
  lastContiguousFromStart: number | null;
}

function mergeOmittedIntoRanges(sortedOmitted: readonly number[]): Array<{ fromHeight: number; toHeight: number }> {
  if (sortedOmitted.length === 0) return [];
  const out: Array<{ fromHeight: number; toHeight: number }> = [];
  let start = sortedOmitted[0]!;
  let prev = start;
  for (let i = 1; i < sortedOmitted.length; i++) {
    const h = sortedOmitted[i]!;
    if (h === prev + 1) {
      prev = h;
      continue;
    }
    out.push({ fromHeight: start, toHeight: prev });
    start = h;
    prev = h;
  }
  out.push({ fromHeight: start, toHeight: prev });
  return out;
}

/**
 * Given an inclusive requested range and the heights actually returned (e.g. from **`fetchBlocksWithReceiptsForHeightRange`**
 * or **`fetchReceiptsForHeightRange`** with **`onMissingBlock: 'omit'`**), compute omitted heights and a contiguous prefix watermark.
 * Duplicate entries in **`fetchedHeights`** are ignored.
 */
export function summarizeIndexerFetchGaps(
  requestedFromHeight: number,
  requestedToHeight: number,
  fetchedHeights: readonly number[]
): IndexerFetchGapSummary {
  assertIntHeight('requestedFromHeight', requestedFromHeight);
  assertIntHeight('requestedToHeight', requestedToHeight);
  if (requestedFromHeight > requestedToHeight) {
    return {
      requestedFromHeight,
      requestedToHeight,
      omittedHeights: [],
      missingHeightRangesInclusive: [],
      lastContiguousFromStart: null,
    };
  }

  const present = new Set<number>();
  for (const h of fetchedHeights) {
    if (!Number.isInteger(h)) {
      throw new TypeError('each fetched height must be an integer');
    }
    if (h < 0) throw new RangeError('each fetched height must be >= 0');
    present.add(h);
  }

  const omittedHeights: number[] = [];
  for (let h = requestedFromHeight; h <= requestedToHeight; h++) {
    if (!present.has(h)) omittedHeights.push(h);
  }

  let lastContiguousFromStart: number | null = null;
  if (present.has(requestedFromHeight)) {
    let h = requestedFromHeight;
    while (h <= requestedToHeight && present.has(h)) {
      h += 1;
    }
    lastContiguousFromStart = h - 1;
  }

  return {
    requestedFromHeight,
    requestedToHeight,
    omittedHeights,
    missingHeightRangesInclusive: mergeOmittedIntoRanges(omittedHeights),
    lastContiguousFromStart,
  };
}

/**
 * Fetch `include_receipts` blocks for each height in `[fromHeight, toHeight]` (inclusive).
 * Default **sequential** (`maxConcurrent` 1); set `maxConcurrent` > 1 to parallelize (respect RPC limits).
 */
export async function fetchReceiptsForHeightRange(
  client: BoingClient,
  fromHeight: number,
  toHeight: number,
  options?: FetchReceiptsForHeightRangeOptions
): Promise<BlockReceiptsBundle[]> {
  assertIntHeight('fromHeight', fromHeight);
  assertIntHeight('toHeight', toHeight);
  if (fromHeight > toHeight) return [];

  const onMissing = options?.onMissingBlock ?? 'throw';
  const signal = options?.signal;
  const concurrent = options?.maxConcurrent ?? 1;

  const heights: number[] = [];
  for (let h = fromHeight; h <= toHeight; h++) {
    heights.push(h);
  }

  const bundles = await mapWithConcurrencyLimit(
    heights,
    concurrent,
    async (h) => {
      const block = await client.getBlockByHeight(h, true);
      if (block == null) {
        if (onMissing === 'omit') return null;
        throw new Error(`missing block at height ${h}`);
      }
      const receipts: ExecutionReceipt[] = [];
      if (block.receipts?.length) {
        for (const r of block.receipts) {
          if (r != null) receipts.push(r);
        }
      }
      return { height: h, receipts } satisfies BlockReceiptsBundle;
    },
    { signal }
  );

  const out: BlockReceiptsBundle[] = [];
  for (const b of bundles) {
    if (b != null) out.push(b);
  }
  out.sort((a, b) => a.height - b.height);
  return out;
}

/**
 * Fetch `boing_getBlockByHeight(h, true)` for each `h` in `[fromHeight, toHeight]` (inclusive).
 * Use this for the **canonical** indexer replay path (txs + receipts in one snapshot per height).
 */
export async function fetchBlocksWithReceiptsForHeightRange(
  client: BoingClient,
  fromHeight: number,
  toHeight: number,
  options?: FetchBlocksWithReceiptsForHeightRangeOptions
): Promise<BlockWithReceiptsBundle[]> {
  assertIntHeight('fromHeight', fromHeight);
  assertIntHeight('toHeight', toHeight);
  if (fromHeight > toHeight) return [];

  const onMissing = options?.onMissingBlock ?? 'throw';
  const signal = options?.signal;
  const concurrent = options?.maxConcurrent ?? 1;

  const heights: number[] = [];
  for (let h = fromHeight; h <= toHeight; h++) {
    heights.push(h);
  }

  const raw = await mapWithConcurrencyLimit(
    heights,
    concurrent,
    async (h) => {
      const block = await client.getBlockByHeight(h, true);
      if (block == null) {
        if (onMissing === 'omit') return null;
        throw new Error(`missing block at height ${h}`);
      }
      return { height: h, block } satisfies BlockWithReceiptsBundle;
    },
    { signal }
  );

  const out: BlockWithReceiptsBundle[] = [];
  for (const b of raw) {
    if (b != null) out.push(b);
  }
  out.sort((a, b) => a.height - b.height);
  return out;
}
