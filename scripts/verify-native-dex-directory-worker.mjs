#!/usr/bin/env node
/**
 * Smoke-check the Cloudflare native-dex-indexer directory HTTP API (D1).
 *
 *   npm run verify-native-dex-directory-worker
 *
 * Env:
 *   BOING_NATIVE_DEX_DIRECTORY_BASE_URL — worker origin (no trailing path); default is the
 *   deploy recorded in docs/HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md.
 *
 * Requires boing-sdk built: npm run build --prefix boing-sdk
 */
import {
  collectAllNativeDexDirectoryPools,
  fetchNativeDexDirectoryMeta,
  fetchNativeDexDirectoryPoolsPage,
} from '../boing-sdk/dist/nativeDexDirectoryApi.js';

const DEFAULT_BASE = 'https://boing-native-dex-indexer.nico-chikuji.workers.dev';

async function main() {
  const base = (process.env.BOING_NATIVE_DEX_DIRECTORY_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  console.log(`Directory worker: ${base}\n`);

  const meta = await fetchNativeDexDirectoryMeta(base);
  console.log('GET /v1/directory/meta', JSON.stringify(meta));

  const first = await fetchNativeDexDirectoryPoolsPage(base, { limit: 5 });
  console.log(
    'GET /v1/directory/pools?limit=5',
    JSON.stringify({
      limit: first.limit,
      cursor: first.cursor,
      nextCursor: first.nextCursor,
      hasMore: first.hasMore,
      poolCount: first.pools.length,
    }),
  );

  if (meta.poolCount > 0 && first.pools.length === 0 && !first.hasMore) {
    console.error('Inconsistent: meta.poolCount > 0 but first pools page is empty.');
    process.exit(1);
  }

  const all = await collectAllNativeDexDirectoryPools(base, { pageLimit: 100, maxPages: 500 });
  if (meta.poolCount !== all.length) {
    console.warn(`Note: meta.poolCount (${meta.poolCount}) !== collected pools (${all.length}) — check worker/D1 if unexpected.`);
  } else {
    console.log(`Cursor walk: ${all.length} pool(s) (matches meta.poolCount).`);
  }

  let cursor = null;
  let pages = 0;
  let walked = 0;
  for (;;) {
    const page = await fetchNativeDexDirectoryPoolsPage(base, { limit: 20, cursor });
    pages += 1;
    walked += page.pools.length;
    if (!page.hasMore) break;
    if (!page.nextCursor) {
      console.error('hasMore true but nextCursor missing');
      process.exit(1);
    }
    cursor = page.nextCursor;
    if (pages > 500) {
      console.error('Too many pages (loop guard)');
      process.exit(1);
    }
  }
  if (walked !== meta.poolCount && meta.poolCount > 0) {
    console.warn(`Walked ${walked} rows in ${pages} page(s); meta says ${meta.poolCount}.`);
  } else {
    console.log(`Manual cursor walk: ${pages} page(s), ${walked} pool row(s).`);
  }

  console.log('\nOK');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  if (e && typeof e === 'object' && 'status' in e) console.error('status', e.status, 'url', e.url);
  process.exit(1);
});
