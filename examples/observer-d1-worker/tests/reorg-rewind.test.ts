import { describe, expect, it } from 'vitest';
import {
  ABSOLUTE_MAX_REORG_REWIND_STEPS,
  DEFAULT_MAX_REORG_REWIND_STEPS,
  compareCanonicalBlockHash,
  parseMaxReorgRewindSteps,
} from '../src/reorg-rewind.js';
import { normalizeObserverBlockHash } from '../src/persist-d1.js';

const A = '0x' + 'aa'.repeat(32);
const B = '0x' + 'bb'.repeat(32);

describe('normalizeObserverBlockHash', () => {
  it('lowercases 0x-prefixed 64 hex', () => {
    expect(normalizeObserverBlockHash('0x' + 'AB'.repeat(32))).toBe('0x' + 'ab'.repeat(32));
  });
  it('adds 0x for bare hex', () => {
    expect(normalizeObserverBlockHash('cc'.repeat(32))).toBe('0x' + 'cc'.repeat(32));
  });
});

describe('parseMaxReorgRewindSteps', () => {
  it('uses default when unset or invalid', () => {
    expect(parseMaxReorgRewindSteps(undefined)).toBe(DEFAULT_MAX_REORG_REWIND_STEPS);
    expect(parseMaxReorgRewindSteps('')).toBe(DEFAULT_MAX_REORG_REWIND_STEPS);
    expect(parseMaxReorgRewindSteps('0')).toBe(DEFAULT_MAX_REORG_REWIND_STEPS);
    expect(parseMaxReorgRewindSteps('nope')).toBe(DEFAULT_MAX_REORG_REWIND_STEPS);
  });
  it('parses positive integers', () => {
    expect(parseMaxReorgRewindSteps('1')).toBe(1);
    expect(parseMaxReorgRewindSteps('8192')).toBe(8192);
  });
  it('clamps to absolute max', () => {
    expect(parseMaxReorgRewindSteps(String(ABSOLUTE_MAX_REORG_REWIND_STEPS + 1))).toBe(
      ABSOLUTE_MAX_REORG_REWIND_STEPS
    );
  });
});

describe('compareCanonicalBlockHash', () => {
  it('detects match with case normalization', () => {
    expect(compareCanonicalBlockHash(A, '0x' + 'AA'.repeat(32))).toBe('match');
  });
  it('detects mismatch', () => {
    expect(compareCanonicalBlockHash(A, B)).toBe('mismatch');
  });
  it('handles missing rpc hash', () => {
    expect(compareCanonicalBlockHash(undefined, A)).toBe('rpc_missing');
    expect(compareCanonicalBlockHash('', A)).toBe('rpc_missing');
  });
  it('handles missing db hash', () => {
    expect(compareCanonicalBlockHash(A, undefined)).toBe('db_missing');
    expect(compareCanonicalBlockHash(A, '')).toBe('db_missing');
  });
});
