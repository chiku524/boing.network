import { describe, expect, it, vi } from 'vitest';
import { BoingRpcError } from '../src/errors.js';
import {
  countAvailableBoingRpcMethods,
  explainBoingRpcProbeGaps,
  probeBoingRpcCapabilities,
} from '../src/rpcCapabilities.js';
import type { BoingClient } from '../src/client.js';

describe('probeBoingRpcCapabilities', () => {
  it('marks -32601 as unavailable with code', async () => {
    const client = {
      clientVersion: vi.fn().mockRejectedValue(new BoingRpcError(-32601, 'n', undefined, 'boing_clientVersion')),
      rpcSupportedMethods: vi.fn().mockRejectedValue(
        new BoingRpcError(-32601, 'n', undefined, 'boing_rpcSupportedMethods')
      ),
      chainHeight: vi.fn().mockResolvedValue(1),
      getSyncState: vi.fn().mockRejectedValue(new BoingRpcError(-32601, 'Method not found: boing_getSyncState', undefined, 'boing_getSyncState')),
      getBlockByHeight: vi.fn().mockResolvedValue(null),
      getLogs: vi.fn().mockResolvedValue([]),
      getTransactionReceipt: vi.fn().mockResolvedValue(null),
      getNetworkInfo: vi.fn().mockResolvedValue({}),
    } as unknown as BoingClient;

    const probe = await probeBoingRpcCapabilities(client);
    expect(probe.clientVersion).toBeNull();
    expect(probe.supportedMethods).toBeNull();
    expect(probe.methods.boing_chainHeight.available).toBe(true);
    expect(probe.methods.boing_getSyncState.available).toBe(false);
    expect(probe.methods.boing_getSyncState.code).toBe(-32601);
    expect(probe.methods.boing_getBlockByHeight.available).toBe(true);
    expect(probe.methods.boing_getLogs.available).toBe(true);
    expect(probe.methods.boing_getTransactionReceipt.available).toBe(true);
    expect(probe.methods.boing_getNetworkInfo.available).toBe(true);
    expect(countAvailableBoingRpcMethods(probe)).toBe(5);
  });

  it('counts all six when every call succeeds', async () => {
    const client = {
      clientVersion: vi.fn().mockResolvedValue('boing-node/0.1.0'),
      rpcSupportedMethods: vi.fn().mockResolvedValue(['boing_chainHeight']),
      chainHeight: vi.fn().mockResolvedValue(0),
      getSyncState: vi.fn().mockResolvedValue({
        head_height: 0,
        finalized_height: 0,
        latest_block_hash: '0x' + 'ab'.repeat(32),
      }),
      getBlockByHeight: vi.fn().mockResolvedValue(null),
      getLogs: vi.fn().mockResolvedValue([]),
      getTransactionReceipt: vi.fn().mockResolvedValue(null),
      getNetworkInfo: vi.fn().mockResolvedValue({}),
    } as unknown as BoingClient;

    const probe = await probeBoingRpcCapabilities(client);
    expect(probe.clientVersion).toBe('boing-node/0.1.0');
    expect(countAvailableBoingRpcMethods(probe)).toBe(6);
    expect(explainBoingRpcProbeGaps(probe)).toBeUndefined();
  });

  it('explainBoingRpcProbeGaps describes -32601 skew when chainHeight works', async () => {
    const client = {
      clientVersion: vi.fn().mockResolvedValue('boing-node/0.0-old'),
      rpcSupportedMethods: vi.fn().mockResolvedValue([
        'boing_chainHeight',
        'boing_getSyncState',
        'boing_getLogs',
        'boing_getTransactionReceipt',
      ]),
      chainHeight: vi.fn().mockResolvedValue(1),
      getSyncState: vi.fn().mockRejectedValue(new BoingRpcError(-32601, 'Method not found: boing_getSyncState')),
      getBlockByHeight: vi.fn().mockResolvedValue(null),
      getLogs: vi.fn().mockRejectedValue(new BoingRpcError(-32601, 'Method not found: boing_getLogs')),
      getTransactionReceipt: vi.fn().mockRejectedValue(
        new BoingRpcError(-32601, 'Method not found: boing_getTransactionReceipt')
      ),
      getNetworkInfo: vi.fn().mockResolvedValue({}),
    } as unknown as BoingClient;

    const probe = await probeBoingRpcCapabilities(client);
    const msg = explainBoingRpcProbeGaps(probe);
    expect(msg).toContain('-32601');
    expect(msg).toContain('boing_getSyncState');
    expect(msg).toContain('boing_getLogs');
    expect(msg).toContain('boing_getTransactionReceipt');
    expect(msg).toMatch(/RUNBOOK|boing-node/i);
    expect(msg).toContain('Contradiction');
    expect(msg).toContain('boing-node/0.0-old');
  });
});
