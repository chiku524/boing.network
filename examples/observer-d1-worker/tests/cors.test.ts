import { describe, expect, it } from 'vitest';
import {
  corsAllowOrigin,
  corsForbiddenForBrowser,
  handleOptions,
  headersJson,
  jsonRes,
  parsePositiveCacheMaxAgeSec,
} from '../src/cors.js';

function req(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe('corsAllowOrigin', () => {
  it('uses * when BOING_CORS_ORIGINS unset', () => {
    expect(corsAllowOrigin(req('https://x/'), {})).toBe('*');
    expect(corsAllowOrigin(req('https://x/'), { BOING_CORS_ORIGINS: '  *  ' })).toBe('*');
    expect(corsAllowOrigin(req('https://x/'), { BOING_CORS_ORIGINS: '' })).toBe('*');
  });

  it('treats empty allow-list tokens as open mode', () => {
    expect(corsAllowOrigin(req('https://x/'), { BOING_CORS_ORIGINS: ' , , ' })).toBe('*');
  });

  it('echoes allowed Origin', () => {
    const env = { BOING_CORS_ORIGINS: 'https://a.com,https://b.com' };
    expect(corsAllowOrigin(req('https://x/', { headers: { Origin: 'https://a.com' } }), env)).toBe(
      'https://a.com'
    );
  });

  it('returns null without Origin in allow-list mode', () => {
    const env = { BOING_CORS_ORIGINS: 'https://a.com' };
    expect(corsAllowOrigin(req('https://x/'), env)).toBeNull();
  });

  it('returns null for disallowed Origin', () => {
    const env = { BOING_CORS_ORIGINS: 'https://a.com' };
    expect(corsAllowOrigin(req('https://x/', { headers: { Origin: 'https://evil.com' } }), env)).toBeNull();
  });
});

describe('corsForbiddenForBrowser', () => {
  it('is false in open mode', () => {
    expect(corsForbiddenForBrowser(req('https://x/', { headers: { Origin: 'https://evil.com' } }), {})).toBe(
      false
    );
  });

  it('is false without Origin', () => {
    expect(corsForbiddenForBrowser(req('https://x/'), { BOING_CORS_ORIGINS: 'https://a.com' })).toBe(false);
  });

  it('is true for unknown Origin when allow-listed', () => {
    const env = { BOING_CORS_ORIGINS: 'https://a.com' };
    expect(corsForbiddenForBrowser(req('https://x/', { headers: { Origin: 'https://b.com' } }), env)).toBe(
      true
    );
  });
});

describe('handleOptions', () => {
  it('returns 204 in open mode', () => {
    const r = handleOptions(req('https://w/', { method: 'OPTIONS' }), {});
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('returns 403 for disallowed Origin', () => {
    const env = { BOING_CORS_ORIGINS: 'https://ok.test' };
    const r = handleOptions(
      req('https://w/', { method: 'OPTIONS', headers: { Origin: 'https://no.test' } }),
      env
    );
    expect(r.status).toBe(403);
  });

  it('returns 204 for allowed Origin with echo', () => {
    const env = { BOING_CORS_ORIGINS: 'https://ok.test' };
    const r = handleOptions(
      req('https://w/', { method: 'OPTIONS', headers: { Origin: 'https://ok.test' } }),
      env
    );
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe('https://ok.test');
  });
});

describe('headersJson + jsonRes', () => {
  it('sets Vary when echoing origin', () => {
    const env = { BOING_CORS_ORIGINS: 'https://app.example' };
    const h = headersJson(req('https://w/', { headers: { Origin: 'https://app.example' } }), env);
    expect(h.get('access-control-allow-origin')).toBe('https://app.example');
    expect(h.get('Vary')).toContain('Origin');
  });

  it('jsonRes stringifies body', async () => {
    const res = jsonRes(req('https://w/'), {}, { ok: true, n: 1 });
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.json()).toEqual({ ok: true, n: 1 });
  });

  it('defaults to no-store', () => {
    const h = headersJson(req('https://w/'), {});
    expect(h.get('cache-control')).toBe('no-store');
  });

  it('sets public max-age when cacheMaxAgeSec > 0', () => {
    const h = headersJson(req('https://w/'), {}, { cacheMaxAgeSec: 120 });
    expect(h.get('cache-control')).toBe('public, max-age=120');
  });

  it('caps cache max-age at 86400', () => {
    const h = headersJson(req('https://w/'), {}, { cacheMaxAgeSec: 999_999 });
    expect(h.get('cache-control')).toBe('public, max-age=86400');
  });

  it('parsePositiveCacheMaxAgeSec', () => {
    expect(parsePositiveCacheMaxAgeSec(undefined)).toBeUndefined();
    expect(parsePositiveCacheMaxAgeSec('')).toBeUndefined();
    expect(parsePositiveCacheMaxAgeSec('0')).toBeUndefined();
    expect(parsePositiveCacheMaxAgeSec('-1')).toBeUndefined();
    expect(parsePositiveCacheMaxAgeSec('x')).toBeUndefined();
    expect(parsePositiveCacheMaxAgeSec(' 60 ')).toBe(60);
  });
});
