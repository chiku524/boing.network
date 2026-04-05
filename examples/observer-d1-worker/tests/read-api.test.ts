import { describe, expect, it } from 'vitest';
import {
  MAX_BATCH_TX_IDS,
  MAX_BLOCK_SUMMARY_RANGE,
  MAX_LOG_BLOCK_SPAN,
  normalizeTxIdHex32,
  parseCommaSeparatedTxIds,
  parseInclusiveHeightRange,
  parseLogFilters,
  parseNonNegIntHeight,
  parsePositiveIntLimit,
} from '../src/read-api.js';

const H64 = '0x' + 'ab'.repeat(32);

describe('normalizeTxIdHex32', () => {
  it('accepts 0x-prefixed 64 hex', () => {
    expect(normalizeTxIdHex32(H64)).toBe(H64.toLowerCase());
  });
  it('accepts bare 64 hex', () => {
    expect(normalizeTxIdHex32('AB'.repeat(32))).toBe(H64.toLowerCase());
  });
  it('rejects short or non-hex', () => {
    expect(normalizeTxIdHex32('0x00')).toBeNull();
    expect(normalizeTxIdHex32('0x' + 'gg'.repeat(32))).toBeNull();
    expect(normalizeTxIdHex32(null)).toBeNull();
    expect(normalizeTxIdHex32('')).toBeNull();
  });
});

describe('parseNonNegIntHeight', () => {
  it('parses non-negative integers', () => {
    expect(parseNonNegIntHeight('0')).toBe(0);
    expect(parseNonNegIntHeight('42')).toBe(42);
  });
  it('rejects negatives and floats', () => {
    expect(parseNonNegIntHeight('-1')).toBeNull();
    expect(parseNonNegIntHeight('1.5')).toBeNull();
    expect(parseNonNegIntHeight('')).toBeNull();
  });
});

describe('parseInclusiveHeightRange', () => {
  it('accepts valid span within max', () => {
    expect(parseInclusiveHeightRange('0', '63', MAX_BLOCK_SUMMARY_RANGE)).toEqual({ from: 0, to: 63 });
  });
  it('rejects inverted range', () => {
    expect(parseInclusiveHeightRange('10', '9', 64)).toBeNull();
  });
  it('rejects span over max', () => {
    expect(parseInclusiveHeightRange('0', String(MAX_LOG_BLOCK_SPAN), MAX_LOG_BLOCK_SPAN)).toBeNull();
  });
});

describe('parsePositiveIntLimit', () => {
  it('uses fallback when empty', () => {
    expect(parsePositiveIntLimit(null, 100, 500)).toBe(100);
    expect(parsePositiveIntLimit('', 100, 500)).toBe(100);
  });
  it('clamps to hard max', () => {
    expect(parsePositiveIntLimit('9999', 10, 100)).toBe(100);
  });
  it('falls back on invalid', () => {
    expect(parsePositiveIntLimit('0', 50, 200)).toBe(50);
    expect(parsePositiveIntLimit('x', 50, 200)).toBe(50);
  });
});

describe('parseCommaSeparatedTxIds', () => {
  const a = '0x' + 'aa'.repeat(32);
  const b = '0x' + 'bb'.repeat(32);

  it('parses one or more ids', () => {
    const r = parseCommaSeparatedTxIds(`${a}, ${b}`);
    expect('error' in r).toBe(false);
    if ('ids' in r) expect(r.ids).toEqual([a, b]);
  });
  it('rejects empty and oversize lists', () => {
    expect('error' in parseCommaSeparatedTxIds(null)).toBe(true);
    expect('error' in parseCommaSeparatedTxIds('')).toBe(true);
    const many = Array.from({ length: MAX_BATCH_TX_IDS + 1 }, () => a).join(',');
    expect('error' in parseCommaSeparatedTxIds(many)).toBe(true);
  });
  it('rejects invalid hex in list', () => {
    expect('error' in parseCommaSeparatedTxIds(`${a},0xbad`)).toBe(true);
  });
});

describe('parseLogFilters', () => {
  function sp(entries: Record<string, string>) {
    return new URLSearchParams(entries) as unknown as { get(name: string): string | null };
  }

  it('returns empty filters when no params', () => {
    const r = parseLogFilters(sp({}));
    expect(r.error).toBeNull();
    expect(r.address).toBeNull();
    expect(r.topics).toEqual([null, null, null, null]);
  });

  it('normalizes address and contract alias', () => {
    const bare = 'cd'.repeat(32);
    expect(parseLogFilters(sp({ address: `0x${bare}` })).address).toBe(`0x${bare}`);
    expect(parseLogFilters(sp({ contract: bare })).address).toBe(`0x${bare}`);
  });

  it('parses topic0 and topic_0 (first wins)', () => {
    const t = H64;
    const r = parseLogFilters(sp({ topic0: t }));
    expect(r.error).toBeNull();
    expect(r.topics[0]).toBe(t.toLowerCase());
    const r2 = parseLogFilters(sp({ topic_0: t }));
    expect(r2.topics[0]).toBe(t.toLowerCase());
  });

  it('fills topic slots independently', () => {
    const a = '0x' + '01'.repeat(32);
    const b = '0x' + '02'.repeat(32);
    const r = parseLogFilters(sp({ topic1: a, topic3: b }));
    expect(r.error).toBeNull();
    expect(r.topics).toEqual([null, a, null, b]);
  });

  it('returns invalid_address', () => {
    const r = parseLogFilters(sp({ address: '0xbad' }));
    expect(r.error).toBe('invalid_address');
  });

  it('returns invalid_topicN', () => {
    expect(parseLogFilters(sp({ topic2: 'not-hex' })).error).toBe('invalid_topic2');
  });
});
