import { describe, expect, it } from 'vitest';
import {
  DEFAULT_READINESS_ARM_WHEN_LAG_LTE,
  computeReadinessReady,
  effectiveReadinessArmWhenLagLte,
  parseReadinessArmWhenLagLte,
  parseReadinessMaxLagFinalized,
  readinessFailureReasons,
} from '../src/readiness.js';

describe('parseReadinessMaxLagFinalized', () => {
  it('returns null for empty or invalid', () => {
    expect(parseReadinessMaxLagFinalized(undefined)).toBeNull();
    expect(parseReadinessMaxLagFinalized('')).toBeNull();
    expect(parseReadinessMaxLagFinalized('   ')).toBeNull();
    expect(parseReadinessMaxLagFinalized('-1')).toBeNull();
    expect(parseReadinessMaxLagFinalized('x')).toBeNull();
  });
  it('parses nonnegative integers', () => {
    expect(parseReadinessMaxLagFinalized('0')).toBe(0);
    expect(parseReadinessMaxLagFinalized(' 128 ')).toBe(128);
  });
});

describe('parseReadinessArmWhenLagLte / effectiveReadinessArmWhenLagLte', () => {
  it('parses nonnegative integers', () => {
    expect(parseReadinessArmWhenLagLte('64')).toBe(64);
  });
  it('effective defaults when unset', () => {
    expect(effectiveReadinessArmWhenLagLte(undefined)).toBe(DEFAULT_READINESS_ARM_WHEN_LAG_LTE);
    expect(effectiveReadinessArmWhenLagLte('')).toBe(DEFAULT_READINESS_ARM_WHEN_LAG_LTE);
    expect(effectiveReadinessArmWhenLagLte('256')).toBe(256);
  });
});

describe('computeReadinessReady', () => {
  const base = {
    d1Ok: true,
    rpcOk: true,
    lastCommittedHeight: 100,
    lagVsFinalized: 2,
    maxLagFinalized: null as number | null,
    readinessLagGuardArmed: true,
  };

  it('false when d1 or rpc down', () => {
    expect(computeReadinessReady({ ...base, d1Ok: false })).toBe(false);
    expect(computeReadinessReady({ ...base, rpcOk: false })).toBe(false);
  });

  it('true when fresh DB and lag huge (max lag ignored)', () => {
    expect(
      computeReadinessReady({
        ...base,
        lastCommittedHeight: -1,
        lagVsFinalized: 99_999,
        maxLagFinalized: 10,
        readinessLagGuardArmed: true,
      })
    ).toBe(true);
  });

  it('true when guard not armed yet even if lag exceeds max (catch-up)', () => {
    expect(
      computeReadinessReady({
        ...base,
        lastCommittedHeight: 0,
        lagVsFinalized: 500,
        maxLagFinalized: 128,
        readinessLagGuardArmed: false,
      })
    ).toBe(true);
  });

  it('false when armed and lag exceeds max and cursor established', () => {
    expect(
      computeReadinessReady({
        ...base,
        lastCommittedHeight: 0,
        lagVsFinalized: 500,
        maxLagFinalized: 128,
        readinessLagGuardArmed: true,
      })
    ).toBe(false);
    expect(
      computeReadinessReady({
        ...base,
        lastCommittedHeight: 0,
        lagVsFinalized: 128,
        maxLagFinalized: 128,
        readinessLagGuardArmed: true,
      })
    ).toBe(true);
  });

  it('true when lag unknown (null)', () => {
    expect(
      computeReadinessReady({
        ...base,
        lagVsFinalized: null,
        maxLagFinalized: 0,
        readinessLagGuardArmed: true,
      })
    ).toBe(true);
  });
});

describe('readinessFailureReasons', () => {
  it('lists d1, rpc, and lag when armed', () => {
    expect(
      readinessFailureReasons({
        d1Ok: false,
        rpcOk: false,
        lastCommittedHeight: 10,
        lagVsFinalized: 99,
        maxLagFinalized: 5,
        readinessLagGuardArmed: true,
      }).sort()
    ).toEqual(['d1_unreachable', 'lag_vs_finalized_exceeds_max', 'rpc_unreachable'].sort());
  });

  it('does not list lag when not armed', () => {
    expect(
      readinessFailureReasons({
        d1Ok: true,
        rpcOk: true,
        lastCommittedHeight: 10,
        lagVsFinalized: 999,
        maxLagFinalized: 5,
        readinessLagGuardArmed: false,
      })
    ).toEqual([]);
  });
});
