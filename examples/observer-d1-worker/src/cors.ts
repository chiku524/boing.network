/** CORS: default permissive (`*`) or allow-list via **`BOING_CORS_ORIGINS`** (comma-separated). */

export interface CorsEnv {
  BOING_CORS_ORIGINS?: string;
}

function parseAllowList(env: CorsEnv): string[] | null {
  const raw = env.BOING_CORS_ORIGINS?.trim();
  if (raw == null || raw === '' || raw === '*') return null;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return null;
  return list;
}

/** `*` in open mode; mirrored origin when allow-listed; **`null`** when no header should be sent. */
export function corsAllowOrigin(req: Request, env: CorsEnv): string | null {
  const list = parseAllowList(env);
  if (list == null) return '*';
  const origin = req.headers.get('Origin');
  if (origin == null || origin === '') return null;
  if (list.includes(origin)) return origin;
  return null;
}

/** Browser sent **`Origin`** but it is not in the allow-list. */
export function corsForbiddenForBrowser(req: Request, env: CorsEnv): boolean {
  const list = parseAllowList(env);
  if (list == null) return false;
  const origin = req.headers.get('Origin');
  if (origin == null || origin === '') return false;
  return !list.includes(origin);
}

const MAX_PUBLIC_CACHE_SEC = 86400;

export interface HeadersJsonOpts {
  /**
   * When set and **> 0**, sets **`Cache-Control: public, max-age=<sec>`** (capped at **86400**).
   * Omit or **≤ 0** for **`no-store`** (default for dynamic / control-plane JSON).
   */
  cacheMaxAgeSec?: number;
}

export function headersJson(req: Request, env: CorsEnv, opts?: HeadersJsonOpts): Headers {
  const maxAge = opts?.cacheMaxAgeSec;
  const cacheControl =
    maxAge != null && maxAge > 0
      ? `public, max-age=${Math.min(Math.floor(maxAge), MAX_PUBLIC_CACHE_SEC)}`
      : 'no-store';
  const h = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cacheControl,
    'x-content-type-options': 'nosniff',
  });
  const acao = corsAllowOrigin(req, env);
  if (acao != null) {
    h.set('access-control-allow-origin', acao);
    if (acao !== '*') h.append('Vary', 'Origin');
  }
  return h;
}

export function headersText(req: Request, env: CorsEnv): Headers {
  const h = new Headers({ 'content-type': 'text/plain; charset=utf-8' });
  const acao = corsAllowOrigin(req, env);
  if (acao != null) {
    h.set('access-control-allow-origin', acao);
    if (acao !== '*') h.append('Vary', 'Origin');
  }
  return h;
}

export function handleOptions(req: Request, env: CorsEnv): Response {
  if (corsForbiddenForBrowser(req, env)) {
    return new Response(null, { status: 403, headers: headersText(req, env) });
  }
  const h = new Headers({
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-max-age': '86400',
  });
  const acao = corsAllowOrigin(req, env);
  if (acao != null) {
    h.set('access-control-allow-origin', acao);
    if (acao !== '*') h.append('Vary', 'Origin');
  }
  return new Response(null, { status: 204, headers: h });
}

export function jsonRes(
  req: Request,
  env: CorsEnv,
  body: unknown,
  status = 200,
  opts?: HeadersJsonOpts
): Response {
  return new Response(JSON.stringify(body), { status, headers: headersJson(req, env, opts) });
}

/**
 * Parse env like **`BOING_READ_CACHE_MAX_AGE`**: positive integer seconds.
 * Returns **`undefined`** when unset, non-numeric, or **≤ 0** (caller should use **`no-store`**).
 */
export function parsePositiveCacheMaxAgeSec(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}
