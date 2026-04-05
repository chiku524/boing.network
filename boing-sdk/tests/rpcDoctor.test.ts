import { describe, expect, it } from 'vitest';
import { formatBoingRpcDoctorReport } from '../src/rpcDoctor.js';
import type { BoingRpcDoctorResult } from '../src/rpcDoctor.js';
import type { BoingRpcPreflightResult } from '../src/types.js';
import type { BoingRpcProbeBundle } from '../src/rpcCapabilities.js';

function stubPreflight(partial: Partial<BoingRpcPreflightResult>): BoingRpcPreflightResult {
  return {
    health: {
      ok: true,
      client_version: 'boing-node/0.0.0',
      chain_id: null,
      chain_name: null,
      head_height: 0,
    },
    supportedMethodCount: 1,
    catalogMethodCount: null,
    openApiPresent: false,
    httpLiveOk: true,
    httpReadyOk: true,
    jsonrpcBatchOk: true,
    httpOpenApiJsonOk: true,
    wellKnownBoingRpcOk: true,
    httpLiveJsonOk: true,
    ...partial,
  };
}

function stubProbe(): BoingRpcProbeBundle {
  const ok = { available: true as const };
  return {
    clientVersion: 'boing-node/0.0.0',
    supportedMethods: ['boing_chainHeight'],
    methods: {
      boing_chainHeight: ok,
      boing_getSyncState: ok,
      boing_getBlockByHeight: ok,
      boing_getLogs: ok,
      boing_getTransactionReceipt: ok,
      boing_getNetworkInfo: ok,
    },
  };
}

describe('formatBoingRpcDoctorReport', () => {
  it('includes ok and discovery flags', () => {
    const r: BoingRpcDoctorResult = {
      ok: true,
      preflight: stubPreflight({}),
      capabilityProbe: stubProbe(),
      missingRequiredMethods: [],
      messages: [],
    };
    const s = formatBoingRpcDoctorReport(r);
    expect(s).toContain('ok: true');
    expect(s).toContain('http_openapi_json: true');
    expect(s).toContain('well_known: true');
  });

  it('appends messages after separator when present', () => {
    const r: BoingRpcDoctorResult = {
      ok: false,
      preflight: stubPreflight({ httpLiveOk: false }),
      capabilityProbe: stubProbe(),
      missingRequiredMethods: [],
      messages: ['GET /live did not return HTTP 200.'],
    };
    const s = formatBoingRpcDoctorReport(r);
    expect(s).toContain('---');
    expect(s).toContain('GET /live');
  });
});
