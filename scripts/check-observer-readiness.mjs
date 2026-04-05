#!/usr/bin/env node
/**
 * Probe an observer Worker (or compatible) **`GET /api/readiness`** / **`HEAD /api/readiness`**.
 *
 *   npm run check-observer-readiness -- https://your-worker.workers.dev
 *   BOING_OBSERVER_BASE=https://your-worker.workers.dev node scripts/check-observer-readiness.mjs
 *
 * Exit **0**: HTTP **200**; with **GET**, JSON has **`ready: true`** (and **`ok: true`** when present).
 *   During indexer backfill, **`ready`** may stay **true** even with large **`lagVsFinalized`** until **`readinessLagGuardArmed`** is set by the Worker (see [OBSERVER-HOSTED-SERVICE.md](../docs/OBSERVER-HOSTED-SERVICE.md) §8.1).
 * Exit **1**: fetch error, wrong status, **`ready: false`**, or invalid JSON on **GET**.
 *
 * Optional:
 *   **`BOING_OBSERVER_USE_HEAD=1`** — **HEAD** request only (no body); **200** = pass (**503** = fail).
 *   **`BOING_OBSERVER_READINESS_PATH=/api/readiness`** — path on the base URL (default **`/api/readiness`**).
 *
 * Aligns with **`examples/observer-d1-worker`** and [docs/OBSERVER-HOSTED-SERVICE.md](../docs/OBSERVER-HOSTED-SERVICE.md) §8.1.
 */
const useHead =
  process.env.BOING_OBSERVER_USE_HEAD === '1' ||
  process.env.BOING_OBSERVER_USE_HEAD === 'true';
const path =
  (process.env.BOING_OBSERVER_READINESS_PATH ?? '/api/readiness').trim() || '/api/readiness';

function normalizeBase(raw) {
  const s = raw.replace(/\/$/, '');
  return s;
}

function buildUrl(base) {
  const b = normalizeBase(base);
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

async function main() {
  const arg = process.argv[2]?.trim();
  const fromEnv = process.env.BOING_OBSERVER_BASE?.trim();
  const base = arg || fromEnv;
  if (!base) {
    console.error(
      'Usage: npm run check-observer-readiness -- <https://observer-worker.example>\n' +
        '   or: BOING_OBSERVER_BASE=https://... node scripts/check-observer-readiness.mjs\n' +
        'Optional: BOING_OBSERVER_USE_HEAD=1  BOING_OBSERVER_READINESS_PATH=/api/readiness'
    );
    process.exit(2);
  }

  const url = buildUrl(base);
  const method = useHead ? 'HEAD' : 'GET';

  let res;
  try {
    res = await fetch(url, { method, redirect: 'follow' });
  } catch (e) {
    console.error(`check-observer-readiness: fetch failed: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  if (res.status !== 200) {
    console.error(
      `check-observer-readiness: ${method} ${url} → HTTP ${res.status} (expected 200)`
    );
    if (!useHead && res.status === 503) {
      try {
        const text = await res.text();
        const j = JSON.parse(text);
        if (j.reasons?.length) {
          console.error(`  reasons: ${j.reasons.join(', ')}`);
        }
        if (j.lagVsFinalized != null && j.readinessMaxLagFinalized != null) {
          console.error(
            `  lagVsFinalized=${j.lagVsFinalized} max=${j.readinessMaxLagFinalized}`
          );
        }
      } catch {
        /* ignore */
      }
    }
    process.exit(1);
  }

  if (useHead) {
    console.log(`check-observer-readiness: ${method} ${url} → 200 ok`);
    process.exit(0);
  }

  let body;
  try {
    body = await res.json();
  } catch (e) {
    console.error(`check-observer-readiness: invalid JSON body: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  const ready = body.ready === true;
  const ok = body.ok !== false;
  if (!ready || !ok) {
    console.error(
      `check-observer-readiness: GET ${url} → ready=${body.ready} ok=${body.ok} reasons=${JSON.stringify(body.reasons ?? [])}`
    );
    process.exit(1);
  }

  console.log(`check-observer-readiness: GET ${url} → 200 ready=true`);
  process.exit(0);
}

main();
