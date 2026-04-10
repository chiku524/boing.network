import { describe, expect, it } from 'vitest';
import {
  NATIVE_DEX_DIRECTORY_API_ID,
  NATIVE_DEX_DIRECTORY_SCHEMA_VERSION,
  parseNativeDexDirectoryMetaResponse,
  parseNativeDexDirectoryPoolsPageResponse,
  parseNativeDexDirectoryPoolEventsPageResponse,
  parseNativeDexDirectoryUserEventsPageResponse,
  normalizeNativeDexDirectoryWorkerBaseUrl,
} from '../src/nativeDexDirectoryApi.js';

describe('normalizeNativeDexDirectoryWorkerBaseUrl', () => {
  it('trims and removes trailing slashes', () => {
    expect(normalizeNativeDexDirectoryWorkerBaseUrl(' https://x.test/ ')).toBe('https://x.test');
    expect(normalizeNativeDexDirectoryWorkerBaseUrl('https://x.test///')).toBe('https://x.test');
  });
});

describe('parseNativeDexDirectoryMetaResponse', () => {
  it('accepts valid meta', () => {
    expect(
      parseNativeDexDirectoryMetaResponse({
        api: NATIVE_DEX_DIRECTORY_API_ID,
        poolCount: 0,
        latestSyncBatch: null,
      }),
    ).toEqual({
      api: NATIVE_DEX_DIRECTORY_API_ID,
      poolCount: 0,
      latestSyncBatch: null,
    });
    expect(
      parseNativeDexDirectoryMetaResponse({
        api: NATIVE_DEX_DIRECTORY_API_ID,
        poolCount: 3,
        latestSyncBatch: '2026-04-10T12:00:00.000Z',
      })?.poolCount,
    ).toBe(3);
  });

  it('accepts optional eventCount', () => {
    const p = parseNativeDexDirectoryMetaResponse({
      api: NATIVE_DEX_DIRECTORY_API_ID,
      poolCount: 1,
      eventCount: 42,
      latestSyncBatch: null,
    });
    expect(p?.eventCount).toBe(42);
  });

  it('accepts schemaVersion and indexed tip fields', () => {
    const h = '0x' + 'ab'.repeat(32);
    const p = parseNativeDexDirectoryMetaResponse({
      api: NATIVE_DEX_DIRECTORY_API_ID,
      schemaVersion: NATIVE_DEX_DIRECTORY_SCHEMA_VERSION,
      poolCount: 0,
      latestSyncBatch: null,
      nftOwnerRowCount: 0,
      indexedTipHeight: 99,
      indexedTipBlockHash: h,
      indexedParentBlockHash: h,
    });
    expect(p?.schemaVersion).toBe(NATIVE_DEX_DIRECTORY_SCHEMA_VERSION);
    expect(p?.indexedTipHeight).toBe(99);
    expect(p?.indexedTipBlockHash?.toLowerCase()).toBe(h.toLowerCase());
    expect(p?.indexedParentBlockHash?.toLowerCase()).toBe(h.toLowerCase());
    expect(p?.nftOwnerRowCount).toBe(0);
  });

  it('accepts optional receiptLogCount', () => {
    const p = parseNativeDexDirectoryMetaResponse({
      api: NATIVE_DEX_DIRECTORY_API_ID,
      poolCount: 0,
      latestSyncBatch: null,
      receiptLogCount: 12,
    });
    expect(p?.receiptLogCount).toBe(12);
  });

  it('rejects wrong api id', () => {
    expect(parseNativeDexDirectoryMetaResponse({ api: 'other', poolCount: 0, latestSyncBatch: null })).toBeNull();
  });

  it('rejects bad poolCount', () => {
    expect(
      parseNativeDexDirectoryMetaResponse({
        api: NATIVE_DEX_DIRECTORY_API_ID,
        poolCount: -1,
        latestSyncBatch: null,
      }),
    ).toBeNull();
  });
});

describe('parseNativeDexDirectoryPoolsPageResponse', () => {
  const poolHex = '0x' + 'ce'.repeat(32);
  const tokenAHex = '0x' + 'aa'.repeat(32);
  const tokenBHex = '0x' + 'bb'.repeat(32);

  it('accepts valid page', () => {
    const p = parseNativeDexDirectoryPoolsPageResponse({
      api: NATIVE_DEX_DIRECTORY_API_ID,
      limit: 20,
      cursor: null,
      nextCursor: poolHex,
      hasMore: true,
      pools: [
        {
          poolHex,
          tokenAHex,
          tokenBHex,
          swapCount: 1,
          swapCount24h: 0,
          swaps24h: 0,
          volume24hApprox: '0',
          volumeScanWindowApprox: '1',
          tvlApprox: 'x',
          note: 'n',
        },
      ],
    });
    expect(p?.pools).toHaveLength(1);
    expect(p?.pools[0]?.poolHex.toLowerCase()).toBe(poolHex.toLowerCase());
  });

  it('drops pools with invalid hex', () => {
    const p = parseNativeDexDirectoryPoolsPageResponse({
      api: NATIVE_DEX_DIRECTORY_API_ID,
      limit: 20,
      cursor: null,
      nextCursor: null,
      hasMore: false,
      pools: [{ poolHex: '0xbad', tokenAHex, tokenBHex }],
    });
    expect(p?.pools).toHaveLength(0);
  });
});

describe('parseNativeDexDirectoryPoolEventsPageResponse', () => {
  const poolHex = '0x' + 'ee'.repeat(32);
  const callerHex = '0x' + 'cc'.repeat(32);

  it('accepts valid page', () => {
    const p = parseNativeDexDirectoryPoolEventsPageResponse({
      api: NATIVE_DEX_DIRECTORY_API_ID,
      poolHex,
      limit: 10,
      cursor: null,
      nextCursor: '99',
      hasMore: true,
      events: [
        {
          kind: 'swap',
          poolHex,
          blockHeight: 1,
          txId: '0xaa',
          logIndex: 0,
          callerHex,
          payload: { direction: '0', amountIn: '1', amountOutAfterFee: '1' },
        },
      ],
    });
    expect(p?.events).toHaveLength(1);
    expect(p?.events[0]?.kind).toBe('swap');
  });

  it('drops events with bad payload', () => {
    const p = parseNativeDexDirectoryPoolEventsPageResponse({
      api: NATIVE_DEX_DIRECTORY_API_ID,
      poolHex,
      limit: 10,
      cursor: null,
      nextCursor: null,
      hasMore: false,
      events: [{ kind: 'swap', poolHex, blockHeight: 1, txId: '0x1', logIndex: 0, callerHex, payload: { x: 1 } }],
    });
    expect(p?.events).toHaveLength(0);
  });
});

describe('parseNativeDexDirectoryUserEventsPageResponse', () => {
  const poolHex = '0x' + 'ee'.repeat(32);
  const callerHex = '0x' + 'cc'.repeat(32);

  it('accepts valid user events page', () => {
    const p = parseNativeDexDirectoryUserEventsPageResponse({
      api: NATIVE_DEX_DIRECTORY_API_ID,
      callerHex,
      limit: 5,
      cursor: null,
      nextCursor: null,
      hasMore: false,
      events: [
        {
          kind: 'swap',
          poolHex,
          blockHeight: 1,
          txId: '0xaa',
          logIndex: 0,
          callerHex,
          payload: { direction: '0', amountIn: '1', amountOutAfterFee: '1' },
        },
      ],
    });
    expect(p?.callerHex.toLowerCase()).toBe(callerHex.toLowerCase());
    expect(p?.events).toHaveLength(1);
  });
});
