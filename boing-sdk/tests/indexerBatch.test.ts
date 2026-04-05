import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GET_LOGS_MAX_BLOCK_SPAN,
  fetchBlocksWithReceiptsForHeightRange,
  fetchReceiptsForHeightRange,
  flattenReceiptsFromBundles,
  getLogsChunked,
  mapWithConcurrencyLimit,
  planLogBlockChunks,
  summarizeIndexerFetchGaps,
} from '../src/indexerBatch.js';
import type { BoingClient } from '../src/client.js';
import type { Block, RpcLogEntry } from '../src/types.js';

describe('summarizeIndexerFetchGaps', () => {
  it('empty range yields no omissions', () => {
    expect(summarizeIndexerFetchGaps(3, 2, [1, 2])).toEqual({
      requestedFromHeight: 3,
      requestedToHeight: 2,
      omittedHeights: [],
      missingHeightRangesInclusive: [],
      lastContiguousFromStart: null,
    });
  });

  it('full hit: contiguous through tip', () => {
    expect(summarizeIndexerFetchGaps(10, 12, [10, 11, 12])).toEqual({
      requestedFromHeight: 10,
      requestedToHeight: 12,
      omittedHeights: [],
      missingHeightRangesInclusive: [],
      lastContiguousFromStart: 12,
    });
  });

  it('single gap in middle', () => {
    expect(summarizeIndexerFetchGaps(0, 2, [0, 2])).toEqual({
      requestedFromHeight: 0,
      requestedToHeight: 2,
      omittedHeights: [1],
      missingHeightRangesInclusive: [{ fromHeight: 1, toHeight: 1 }],
      lastContiguousFromStart: 0,
    });
  });

  it('merges adjacent omitted into one range', () => {
    expect(summarizeIndexerFetchGaps(0, 4, [4])).toEqual({
      requestedFromHeight: 0,
      requestedToHeight: 4,
      omittedHeights: [0, 1, 2, 3],
      missingHeightRangesInclusive: [{ fromHeight: 0, toHeight: 3 }],
      lastContiguousFromStart: null,
    });
  });

  it('splits non-adjacent gap ranges', () => {
    expect(summarizeIndexerFetchGaps(0, 4, [0, 2, 4])).toEqual({
      requestedFromHeight: 0,
      requestedToHeight: 4,
      omittedHeights: [1, 3],
      missingHeightRangesInclusive: [
        { fromHeight: 1, toHeight: 1 },
        { fromHeight: 3, toHeight: 3 },
      ],
      lastContiguousFromStart: 0,
    });
  });

  it('dedupes duplicate fetched heights', () => {
    expect(summarizeIndexerFetchGaps(1, 2, [1, 1, 2])).toEqual({
      requestedFromHeight: 1,
      requestedToHeight: 2,
      omittedHeights: [],
      missingHeightRangesInclusive: [],
      lastContiguousFromStart: 2,
    });
  });
});

describe('planLogBlockChunks', () => {
  it('returns empty when from > to', () => {
    expect(planLogBlockChunks(5, 4)).toEqual([]);
  });

  it('single chunk when range fits', () => {
    expect(planLogBlockChunks(1, 10, 128)).toEqual([{ fromBlock: 1, toBlock: 10 }]);
  });

  it('splits at maxSpan', () => {
    expect(planLogBlockChunks(1, 130, 128)).toEqual([
      { fromBlock: 1, toBlock: 128 },
      { fromBlock: 129, toBlock: 130 },
    ]);
  });

  it('default span is 128', () => {
    const c = planLogBlockChunks(0, 127);
    expect(c).toHaveLength(1);
    expect(c[0]).toEqual({ fromBlock: 0, toBlock: 127 });
  });
});

describe('getLogsChunked', () => {
  it('merges and sorts by placement', async () => {
    const logs: RpcLogEntry[] = [
      {
        block_height: 2,
        tx_index: 0,
        tx_id: '0x' + 'ab'.repeat(32),
        log_index: 1,
        address: null,
        topics: [],
        data: '0x',
      },
      {
        block_height: 1,
        tx_index: 0,
        tx_id: '0x' + 'aa'.repeat(32),
        log_index: 0,
        address: null,
        topics: [],
        data: '0x',
      },
    ];
    const getLogs = vi.fn().mockResolvedValueOnce([logs[0]]).mockResolvedValueOnce([logs[1]]);
    const client = { getLogs } as unknown as BoingClient;

    const out = await getLogsChunked(
      client,
      { fromBlock: 1, toBlock: 200 },
      { maxBlockSpan: 100 }
    );

    expect(getLogs).toHaveBeenCalledTimes(2);
    expect(out.map((e) => e.block_height)).toEqual([1, 2]);
  });

  it('uses default block span constant', () => {
    expect(DEFAULT_GET_LOGS_MAX_BLOCK_SPAN).toBe(128);
  });

  it('respects maxConcurrent on overlapping chunk fetches', async () => {
    let inFlight = 0;
    let peak = 0;
    const getLogs = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight -= 1;
      return [];
    });
    const client = { getLogs } as unknown as BoingClient;

    await getLogsChunked(client, { fromBlock: 0, toBlock: 299 }, { maxBlockSpan: 100, maxConcurrent: 2 });
    expect(getLogs).toHaveBeenCalledTimes(3);
    expect(peak).toBe(2);

    peak = 0;
    inFlight = 0;
    getLogs.mockClear();
    await getLogsChunked(client, { fromBlock: 0, toBlock: 299 }, { maxBlockSpan: 100, maxConcurrent: 1 });
    expect(peak).toBe(1);
  });
});

describe('fetchReceiptsForHeightRange', () => {
  const receipt = (tx: string) => ({
    tx_id: tx,
    block_height: 0,
    tx_index: 0,
    success: true,
    gas_used: '0',
    return_data: '0x',
    logs: [],
  });

  it('returns bundles per height', async () => {
    const getBlockByHeight = vi.fn(async (h: number, inc: boolean) => {
      if (!inc) return null;
      if (h === 1) return { receipts: [receipt('0x' + 'aa'.repeat(32))] };
      if (h === 2) return { receipts: [null, receipt('0x' + 'bb'.repeat(32))] };
      return null;
    });
    const client = { getBlockByHeight } as unknown as BoingClient;

    const out = await fetchReceiptsForHeightRange(client, 1, 2);
    expect(out).toHaveLength(2);
    expect(out[0]!.height).toBe(1);
    expect(out[0]!.receipts).toHaveLength(1);
    expect(out[1]!.height).toBe(2);
    expect(out[1]!.receipts).toHaveLength(1);
  });

  it('throws on missing block by default', async () => {
    const client = {
      getBlockByHeight: vi.fn().mockResolvedValue(null),
    } as unknown as BoingClient;
    await expect(fetchReceiptsForHeightRange(client, 0, 0)).rejects.toThrow('missing block');
  });

  it('omits missing with onMissingBlock omit', async () => {
    const client = {
      getBlockByHeight: vi.fn().mockResolvedValue(null),
    } as unknown as BoingClient;
    const out = await fetchReceiptsForHeightRange(client, 0, 1, { onMissingBlock: 'omit' });
    expect(out).toEqual([]);
  });

  it('returns empty for fromHeight > toHeight', async () => {
    const client = { getBlockByHeight: vi.fn() } as unknown as BoingClient;
    expect(await fetchReceiptsForHeightRange(client, 5, 3)).toEqual([]);
    expect(client.getBlockByHeight).not.toHaveBeenCalled();
  });

  it('fetchBlocksWithReceiptsForHeightRange returns full blocks sorted by height', async () => {
    const getBlockByHeight = vi.fn(async (h: number, inc: boolean) => {
      if (!inc) return null;
      const z = '0x' + '00'.repeat(32);
      return {
        header: {
          parent_hash: z,
          height: h,
          timestamp: 0,
          proposer: z,
          tx_root: z,
          receipts_root: z,
          state_root: z,
        },
        transactions: [],
        receipts: [],
      } satisfies Block;
    });
    const client = { getBlockByHeight } as unknown as BoingClient;

    const out = await fetchBlocksWithReceiptsForHeightRange(client, 2, 3);
    expect(out.map((b) => b.height)).toEqual([2, 3]);
    expect(out[0]!.block.header.height).toBe(2);
  });

  it('fetchBlocksWithReceiptsForHeightRange throws on missing block by default', async () => {
    const client = {
      getBlockByHeight: vi.fn().mockResolvedValue(null),
    } as unknown as BoingClient;
    await expect(fetchBlocksWithReceiptsForHeightRange(client, 0, 0)).rejects.toThrow('missing block');
  });

  it('fetchBlocksWithReceiptsForHeightRange omits missing with onMissingBlock omit', async () => {
    const z = '0x' + '00'.repeat(32);
    const getBlockByHeight = vi.fn(async (h: number, inc: boolean) => {
      if (!inc) return null;
      if (h === 1) return null;
      return {
        header: {
          parent_hash: z,
          height: h,
          timestamp: 0,
          proposer: z,
          tx_root: z,
          receipts_root: z,
          state_root: z,
        },
        transactions: [],
        receipts: [],
      } satisfies Block;
    });
    const client = { getBlockByHeight } as unknown as BoingClient;
    const out = await fetchBlocksWithReceiptsForHeightRange(client, 0, 2, { onMissingBlock: 'omit' });
    expect(out.map((b) => b.height)).toEqual([0, 2]);
  });

  it('sorts bundles by height when fetches complete out of order', async () => {
    const delays = new Map([
      [1, 25],
      [2, 5],
      [3, 15],
    ]);
    const getBlockByHeight = vi.fn(async (h: number, inc: boolean) => {
      if (!inc) return null;
      const ms = delays.get(h) ?? 0;
      await new Promise((r) => setTimeout(r, ms));
      return { receipts: [receipt(`0x${String(h).repeat(64)}`)] };
    });
    const client = { getBlockByHeight } as unknown as BoingClient;

    const out = await fetchReceiptsForHeightRange(client, 1, 3, { maxConcurrent: 3 });
    expect(out.map((b) => b.height)).toEqual([1, 2, 3]);
    expect(out[0]!.receipts[0]!.tx_id).toMatch(/^0x1+$/);
  });
});

describe('mapWithConcurrencyLimit', () => {
  it('preserves order', async () => {
    const out = await mapWithConcurrencyLimit([1, 2, 3], 2, async (x) => x * 2);
    expect(out).toEqual([2, 4, 6]);
  });

  it('rejects limit < 1', async () => {
    await expect(mapWithConcurrencyLimit([], 0, async () => 0)).rejects.toThrow(RangeError);
  });

  it('aborts when signal aborts', async () => {
    const ac = new AbortController();
    const p = mapWithConcurrencyLimit([1, 2, 3, 4], 2, async (x) => {
      if (x === 2) ac.abort();
      await new Promise((r) => setTimeout(r, 30));
      return x;
    }, { signal: ac.signal });
    await expect(p).rejects.toThrow(/aborted/);
  });
});

describe('flattenReceiptsFromBundles', () => {
  it('concatenates in bundle order', () => {
    const r = (id: string) =>
      ({
        tx_id: id,
        block_height: 0,
        tx_index: 0,
        success: true,
        gas_used: '0',
        return_data: '0x',
        logs: [],
      }) as const;
    const flat = flattenReceiptsFromBundles([
      { height: 1, receipts: [r('0xaa'), r('0xbb')] },
      { height: 2, receipts: [r('0xcc')] },
    ]);
    expect(flat.map((x) => x.tx_id)).toEqual(['0xaa', '0xbb', '0xcc']);
  });
});
