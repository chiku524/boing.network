import { describe, expect, it } from 'vitest';
import {
  blockHeightGapRowsForInsert,
  mergeInclusiveHeightRanges,
  nextContiguousIndexedHeightAfterOmittedFetch,
  subtractInclusiveRangeFromRanges,
  unionInclusiveHeightRanges,
} from '../src/indexerGaps.js';
import { summarizeIndexerFetchGaps } from '../src/indexerBatch.js';

describe('mergeInclusiveHeightRanges', () => {
  it('returns empty for empty input', () => {
    expect(mergeInclusiveHeightRanges([])).toEqual([]);
  });

  it('merges adjacent ranges', () => {
    expect(
      mergeInclusiveHeightRanges([
        { fromHeight: 1, toHeight: 2 },
        { fromHeight: 3, toHeight: 4 },
      ])
    ).toEqual([{ fromHeight: 1, toHeight: 4 }]);
  });

  it('merges overlapping ranges', () => {
    expect(
      mergeInclusiveHeightRanges([
        { fromHeight: 1, toHeight: 5 },
        { fromHeight: 3, toHeight: 7 },
      ])
    ).toEqual([{ fromHeight: 1, toHeight: 7 }]);
  });

  it('keeps disjoint ranges separate', () => {
    expect(
      mergeInclusiveHeightRanges([
        { fromHeight: 0, toHeight: 1 },
        { fromHeight: 5, toHeight: 6 },
      ])
    ).toEqual([
      { fromHeight: 0, toHeight: 1 },
      { fromHeight: 5, toHeight: 6 },
    ]);
  });

  it('throws when from > to', () => {
    expect(() => mergeInclusiveHeightRanges([{ fromHeight: 2, toHeight: 1 }])).toThrow(RangeError);
  });
});

describe('unionInclusiveHeightRanges', () => {
  it('normalizes union', () => {
    expect(
      unionInclusiveHeightRanges(
        [{ fromHeight: 1, toHeight: 2 }],
        [{ fromHeight: 2, toHeight: 3 }]
      )
    ).toEqual([{ fromHeight: 1, toHeight: 3 }]);
  });
});

describe('subtractInclusiveRangeFromRanges', () => {
  it('returns empty when indexed covers all gaps', () => {
    expect(subtractInclusiveRangeFromRanges({ fromHeight: 0, toHeight: 20 }, [{ fromHeight: 5, toHeight: 10 }])).toEqual(
      []
    );
  });

  it('splits a gap when clearing the middle', () => {
    expect(subtractInclusiveRangeFromRanges({ fromHeight: 5, toHeight: 10 }, [{ fromHeight: 0, toHeight: 20 }])).toEqual(
      [
        { fromHeight: 0, toHeight: 4 },
        { fromHeight: 11, toHeight: 20 },
      ]
    );
  });

  it('trims left', () => {
    expect(subtractInclusiveRangeFromRanges({ fromHeight: 0, toHeight: 5 }, [{ fromHeight: 0, toHeight: 10 }])).toEqual([
      { fromHeight: 6, toHeight: 10 },
    ]);
  });

  it('no overlap leaves gaps unchanged', () => {
    expect(subtractInclusiveRangeFromRanges({ fromHeight: 20, toHeight: 30 }, [{ fromHeight: 0, toHeight: 3 }])).toEqual(
      [{ fromHeight: 0, toHeight: 3 }]
    );
  });

  it('normalizes overlapping input gaps before subtracting', () => {
    const out = subtractInclusiveRangeFromRanges({ fromHeight: 5, toHeight: 5 }, [
      { fromHeight: 1, toHeight: 3 },
      { fromHeight: 3, toHeight: 6 },
    ]);
    expect(out).toEqual([
      { fromHeight: 1, toHeight: 4 },
      { fromHeight: 6, toHeight: 6 },
    ]);
  });
});

describe('blockHeightGapRowsForInsert', () => {
  it('merges ranges and maps snake_case columns', () => {
    const rows = blockHeightGapRowsForInsert({
      chainId: 'dev',
      ranges: [
        { fromHeight: 1, toHeight: 2 },
        { fromHeight: 3, toHeight: 4 },
      ],
      reason: 'pruned',
      recordedAtSec: 1700000000,
    });
    expect(rows).toEqual([
      {
        chain_id: 'dev',
        from_height: 1,
        to_height: 4,
        reason: 'pruned',
        recorded_at: 1700000000,
      },
    ]);
  });
});

describe('nextContiguousIndexedHeightAfterOmittedFetch', () => {
  it('throws when requestedFrom does not follow cursor', () => {
    const s = summarizeIndexerFetchGaps(5, 5, [5]);
    expect(() => nextContiguousIndexedHeightAfterOmittedFetch(3, s)).toThrow(RangeError);
  });

  it('full range: advances to requestedTo', () => {
    const s = summarizeIndexerFetchGaps(0, 2, [0, 1, 2]);
    expect(nextContiguousIndexedHeightAfterOmittedFetch(-1, s)).toBe(2);
  });

  it('gap at start: no advance', () => {
    const s = summarizeIndexerFetchGaps(0, 1, [1]);
    expect(nextContiguousIndexedHeightAfterOmittedFetch(-1, s)).toBe(-1);
  });

  it('gap in middle: stops at last contiguous prefix', () => {
    const s = summarizeIndexerFetchGaps(0, 2, [0, 2]);
    expect(nextContiguousIndexedHeightAfterOmittedFetch(-1, s)).toBe(0);
  });

  it('matches summarize + middle gap from heights', () => {
    const s = summarizeIndexerFetchGaps(10, 14, [10, 11, 12, 14]);
    expect(nextContiguousIndexedHeightAfterOmittedFetch(9, s)).toBe(12);
  });
});
