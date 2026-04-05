/**
 * Composite readiness for hosted observer ops (k8s / synthetic checks).
 * See docs/OBSERVER-HOSTED-SERVICE.md § observability.
 */

/** Parse optional max lag (finalized_height − last_committed) before `/api/readiness` returns 503. */
export function parseReadinessMaxLagFinalized(raw: string | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t === '') return null;
  const n = parseInt(t, 10);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/**
 * When **`BOING_READINESS_MAX_LAG_FINALIZED`** is set, the worker arms the guard (persists **`readiness_lag_guard_armed`**) after observing **`lagVsFinalized <= armWhenLagLte`** on a scheduled tick.
 * Default **128** if env unset.
 */
export const DEFAULT_READINESS_ARM_WHEN_LAG_LTE = 128;

export function parseReadinessArmWhenLagLte(raw: string | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t === '') return null;
  const n = parseInt(t, 10);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function effectiveReadinessArmWhenLagLte(raw: string | undefined): number {
  return parseReadinessArmWhenLagLte(raw) ?? DEFAULT_READINESS_ARM_WHEN_LAG_LTE;
}

export function computeReadinessReady(input: {
  d1Ok: boolean;
  rpcOk: boolean;
  lastCommittedHeight: number;
  lagVsFinalized: number | null;
  maxLagFinalized: number | null;
  /** Lag guard enforces **`maxLagFinalized`** only after scheduled ingest has armed it (post catch-up). */
  readinessLagGuardArmed: boolean;
}): boolean {
  if (!input.d1Ok || !input.rpcOk) return false;
  if (
    input.readinessLagGuardArmed &&
    input.maxLagFinalized != null &&
    input.lastCommittedHeight >= 0 &&
    input.lagVsFinalized != null &&
    input.lagVsFinalized > input.maxLagFinalized
  ) {
    return false;
  }
  return true;
}

export function readinessFailureReasons(input: {
  d1Ok: boolean;
  rpcOk: boolean;
  lastCommittedHeight: number;
  lagVsFinalized: number | null;
  maxLagFinalized: number | null;
  readinessLagGuardArmed: boolean;
}): string[] {
  const reasons: string[] = [];
  if (!input.d1Ok) reasons.push('d1_unreachable');
  if (!input.rpcOk) reasons.push('rpc_unreachable');
  if (
    input.readinessLagGuardArmed &&
    input.maxLagFinalized != null &&
    input.lastCommittedHeight >= 0 &&
    input.lagVsFinalized != null &&
    input.lagVsFinalized > input.maxLagFinalized
  ) {
    reasons.push('lag_vs_finalized_exceeds_max');
  }
  return reasons;
}
