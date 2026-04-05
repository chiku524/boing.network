import { describe, expect, it, vi } from 'vitest';
import { BoingClient } from '../src/client.js';
import { BoingRpcError, isRetriableBoingRpcError } from '../src/errors.js';

describe('BoingClient retries', () => {
  it('retries on HTTP 429 then succeeds', async () => {
    let n = 0;
    const fetchImpl = vi.fn().mockImplementation(async () => {
      n += 1;
      if (n === 1) {
        return new Response('slow down', { status: 429, statusText: 'Too Many' });
      }
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result: 42 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new BoingClient({
      baseUrl: 'http://127.0.0.1:9',
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 2,
      retryBaseDelayMs: 1,
    });

    const h = await client.chainHeight();
    expect(h).toBe(42);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('parses JSON-RPC error from HTTP 429 body and attaches retryAfterMs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32016, message: 'Rate limit exceeded.' },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '2',
          },
        }
      )
    );
    const client = new BoingClient({
      baseUrl: 'http://127.0.0.1:9',
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 0,
    });
    await expect(client.chainHeight()).rejects.toMatchObject({
      code: -32016,
      retryAfterMs: 2000,
    });
  });

  it('respects Retry-After over short exponential backoff on retry', async () => {
    vi.useFakeTimers();
    let n = 0;
    const fetchImpl = vi.fn().mockImplementation(async () => {
      n += 1;
      if (n === 1) {
        return new Response('busy', {
          status: 503,
          headers: { 'Retry-After': '10' },
        });
      }
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result: 7 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    const client = new BoingClient({
      baseUrl: 'http://127.0.0.1:9',
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 2,
      retryBaseDelayMs: 1,
    });
    const p = client.chainHeight();
    await Promise.resolve();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    const h = await p;
    expect(h).toBe(7);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not retry QA rejection', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32050, message: 'QA rejected' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const client = new BoingClient({
      baseUrl: 'http://127.0.0.1:9',
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 3,
      retryBaseDelayMs: 1,
    });

    await expect(client.submitTransaction('0x00')).rejects.toBeInstanceOf(BoingRpcError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('isRetriableBoingRpcError', () => {
  it('is false for QA errors', () => {
    expect(isRetriableBoingRpcError(new BoingRpcError(-32050, 'no'))).toBe(false);
  });

  it('is true for rate limit and HTTP 503 wrapper', () => {
    expect(isRetriableBoingRpcError(new BoingRpcError(-32016, 'limit'))).toBe(true);
    expect(isRetriableBoingRpcError(new BoingRpcError(-32000, 'HTTP 503:'))).toBe(true);
  });
});
