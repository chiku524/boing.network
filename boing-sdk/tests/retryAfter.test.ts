import { describe, expect, it } from 'vitest';
import { parseRetryAfterMs } from '../src/retryAfter.js';

describe('parseRetryAfterMs', () => {
  it('parses integer seconds', () => {
    expect(parseRetryAfterMs('0')).toBe(0);
    expect(parseRetryAfterMs('3')).toBe(3000);
    expect(parseRetryAfterMs('  2  ')).toBe(2000);
  });

  it('returns undefined for empty or invalid', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('')).toBeUndefined();
    expect(parseRetryAfterMs('not-a-number')).toBeUndefined();
  });

  it('parses HTTP-date in the future', () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = parseRetryAfterMs(future);
    expect(ms).toBeDefined();
    expect(ms!).toBeGreaterThan(4000);
    expect(ms!).toBeLessThanOrEqual(5000 + 2000);
  });
});
