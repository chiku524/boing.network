import { describe, expect, it, vi } from 'vitest';
import { BoingClient } from '../src/client.js';

describe('BoingClient.requestBatch', () => {
  it('posts a JSON array and parses the response array', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify([
          { jsonrpc: '2.0', id: 1, result: 42 },
          { jsonrpc: '2.0', id: 2, result: 'boing-node/0.1.0' },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const client = new BoingClient({
      baseUrl: 'http://127.0.0.1:9',
      fetch: fetchMock as unknown as typeof fetch,
      timeoutMs: 0,
    });
    const out = await client.requestBatch([
      { method: 'boing_chainHeight', params: [] },
      { method: 'boing_clientVersion', params: [] },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].result).toBe(42);
    expect(out[1].result).toBe('boing-node/0.1.0');
    const body = fetchMock.mock.calls[0][1]?.body;
    expect(typeof body).toBe('string');
    const parsed = JSON.parse(body as string) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ method: 'boing_chainHeight', jsonrpc: '2.0' });
  });
});
