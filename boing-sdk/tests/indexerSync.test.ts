import { describe, expect, it, vi } from 'vitest';
import { BoingRpcError } from '../src/errors.js';
import {
  clampIndexerHeightRange,
  getIndexerChainTips,
  planIndexerCatchUp,
  planIndexerChainTipsWithFallback,
} from '../src/indexerSync.js';
import type { BoingClient } from '../src/client.js';

describe('getIndexerChainTips', () => {
  it('maps getSyncState into camelCase tips', async () => {
    const getSyncState = vi.fn().mockResolvedValue({
      head_height: 10,
      finalized_height: 9,
      latest_block_hash: '0x' + 'ab'.repeat(32),
    });
    const client = { getSyncState } as unknown as BoingClient;

    const tips = await getIndexerChainTips(client);
    expect(tips).toEqual({
      headHeight: 10,
      finalizedHeight: 9,
      durableIndexThrough: 9,
      latestBlockHash: '0x' + 'ab'.repeat(32),
    });
  });
});

describe('clampIndexerHeightRange', () => {
  it('caps toHeight to durableIndexThrough', () => {
    expect(clampIndexerHeightRange(1, 100, 50)).toEqual({ fromHeight: 1, toHeight: 50 });
  });

  it('returns null when from > to', () => {
    expect(clampIndexerHeightRange(5, 3, 10)).toBeNull();
  });

  it('returns null when range is entirely past durable tip', () => {
    expect(clampIndexerHeightRange(20, 30, 10)).toBeNull();
  });

  it('rejects non-integers', () => {
    expect(() => clampIndexerHeightRange(0.5, 1, 1)).toThrow(TypeError);
  });
});

describe('planIndexerChainTipsWithFallback', () => {
  it('uses getSyncState when available', async () => {
    const getSyncState = vi.fn().mockResolvedValue({
      head_height: 3,
      finalized_height: 3,
      latest_block_hash: '0x' + 'cd'.repeat(32),
    });
    const client = { getSyncState, chainHeight: vi.fn(), getBlockByHeight: vi.fn() } as unknown as BoingClient;
    const r = await planIndexerChainTipsWithFallback(client);
    expect(r.tipsSource).toBe('sync_state');
    expect(r.tips.headHeight).toBe(3);
    expect(client.chainHeight).not.toHaveBeenCalled();
  });

  it('falls back to chainHeight + tip block hash on -32601', async () => {
    const getSyncState = vi.fn().mockRejectedValue(
      new BoingRpcError(-32601, 'Method not found', undefined, 'boing_getSyncState')
    );
    const chainHeight = vi.fn().mockResolvedValue(5);
    const getBlockByHeight = vi.fn().mockResolvedValue({
      hash: '0x' + 'ef'.repeat(32),
      header: { height: 5 },
      transactions: [],
    });
    const client = { getSyncState, chainHeight, getBlockByHeight } as unknown as BoingClient;
    const r = await planIndexerChainTipsWithFallback(client);
    expect(r.tipsSource).toBe('chain_height');
    expect(r.tips).toEqual({
      headHeight: 5,
      finalizedHeight: 5,
      durableIndexThrough: 5,
      latestBlockHash: '0x' + 'ef'.repeat(32),
    });
  });
});

describe('planIndexerCatchUp', () => {
  it('returns null when caught up', async () => {
    const getSyncState = vi.fn().mockResolvedValue({
      head_height: 2,
      finalized_height: 2,
      latest_block_hash: '0x' + 'ab'.repeat(32),
    });
    const client = { getSyncState } as unknown as BoingClient;
    expect(await planIndexerCatchUp(client, 2)).toBeNull();
  });

  it('plans from genesis when lastIndexed is -1', async () => {
    const getSyncState = vi.fn().mockResolvedValue({
      head_height: 1,
      finalized_height: 1,
      latest_block_hash: '0x' + 'ab'.repeat(32),
    });
    const client = { getSyncState } as unknown as BoingClient;
    const p = await planIndexerCatchUp(client, -1);
    expect(p).not.toBeNull();
    expect(p!.fromHeight).toBe(0);
    expect(p!.toHeight).toBe(1);
  });

  it('caps range with maxBlocksPerTick', async () => {
    const getSyncState = vi.fn().mockResolvedValue({
      head_height: 100,
      finalized_height: 100,
      latest_block_hash: '0x' + 'ab'.repeat(32),
    });
    const client = { getSyncState } as unknown as BoingClient;
    const p = await planIndexerCatchUp(client, -1, { maxBlocksPerTick: 3 });
    expect(p!.fromHeight).toBe(0);
    expect(p!.toHeight).toBe(2);
  });
});
