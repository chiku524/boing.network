/**
 * Cloudflare Worker: native DEX indexer with KV-backed reserve history + D1 directory API.
 * - GET /stats, GET / — full indexer JSON (optional pools_page pools_page_size)
 * - GET /v1/directory/meta — row counts + last sync batch id
 * - GET /v1/directory/pools?limit=&cursor= — cursor pagination (stable order by pool_hex)
 * - GET /v1/history/pool/{pool_hex}/events?limit=&cursor= — materialized Log2 snapshot (newest first)
 * - POST /v1/directory/sync — refresh KV + D1 (requires Authorization: Bearer DIRECTORY_SYNC_SECRET)
 * - Cron: refresh KV + D1
 */

import {
  buildDexOverridesFromPlainEnv,
  buildNativeDexIndexerStatsForClient,
  collectNativeDexPoolEventsForPools,
  createClient,
  resolveNativeAmmVaultPoolMapping,
} from 'boing-sdk';
import {
  getDirectoryMeta,
  listDirectoryPoolEventsPage,
  listDirectoryPoolsPage,
  listDirectoryUserEventsPage,
  syncDirectoryIndexerTip,
  syncDirectoryPoolEventsFromPayload,
  syncDirectoryPoolsFromPayload,
} from './directoryD1';

type Env = {
  BOING_TESTNET_RPC_URL?: string;
  NATIVE_DEX_INDEXER_RPC_URL?: string;
  NATIVE_DEX_INDEXER_KV?: KVNamespace;
  DIRECTORY_DB?: D1Database;
  DIRECTORY_SYNC_SECRET?: string;
  NATIVE_DEX_INDEXER_REGISTER_FROM_BLOCK?: string;
  NATIVE_DEX_INDEXER_LOG_SCAN_BLOCKS?: string;
  NATIVE_DEX_INDEXER_TOKEN_USD_JSON?: string;
  NATIVE_DEX_INDEXER_TOKEN_DIRECTORY_JSON?: string;
  NATIVE_DEX_INDEXER_API_DISABLE?: string;
  [key: string]: string | KVNamespace | D1Database | undefined;
};

const corsJsonHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsJsonHeaders, ...extraHeaders },
  });
}

function parseIntOpt(raw: string | undefined, fallback: number): number {
  if (raw == null || !String(raw).trim()) return fallback;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Optional: `?pools_page=&pools_page_size=` (1–500) slices `pools` and adds `poolsPageMeta`. */
function sliceIndexerPoolsInPayload(payload: Record<string, unknown>, url: URL): Record<string, unknown> {
  const pageRaw = url.searchParams.get('pools_page');
  const sizeRaw = url.searchParams.get('pools_page_size');
  if (pageRaw == null || sizeRaw == null || pageRaw === '' || sizeRaw === '') return payload;
  const page = parseInt(String(pageRaw), 10);
  const pageSize = parseInt(String(sizeRaw), 10);
  if (!Number.isFinite(page) || page < 0) return payload;
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 500) return payload;
  const pools = Array.isArray(payload.pools) ? (payload.pools as unknown[]) : [];
  const total = pools.length;
  const start = page * pageSize;
  const slice = pools.slice(start, start + pageSize);
  return {
    ...payload,
    pools: slice,
    poolsPageMeta: { page, pageSize, total, returned: slice.length },
  };
}

async function buildPayload(env: Env) {
  const baseUrl = rpcBaseUrl(env);

  const client = createClient({ baseUrl });
  const overrides = buildDexOverridesFromPlainEnv(env as Record<string, string | undefined>);
  const regRaw = env.NATIVE_DEX_INDEXER_REGISTER_FROM_BLOCK;
  const registerFromBlock =
    regRaw != null && String(regRaw).trim() !== '' ? parseIntOpt(regRaw, NaN) : NaN;

  const kv = env.NATIVE_DEX_INDEXER_KV;
  const historyStore = kv
    ? {
        get: () => kv.get('native_dex_indexer_state_v1'),
        put: (body: string) => kv.put('native_dex_indexer_state_v1', body),
      }
    : null;

  return buildNativeDexIndexerStatsForClient(client, {
    overrides: Object.keys(overrides).length ? overrides : undefined,
    registerFromBlock: Number.isFinite(registerFromBlock) && registerFromBlock >= 0 ? registerFromBlock : undefined,
    logScanBlocks: parseIntOpt(env.NATIVE_DEX_INDEXER_LOG_SCAN_BLOCKS, 8000),
    historyStore,
    tokenUsdJson: env.NATIVE_DEX_INDEXER_TOKEN_USD_JSON,
    tokenDirectoryExtraJson: env.NATIVE_DEX_INDEXER_TOKEN_DIRECTORY_JSON,
  });
}

function rpcBaseUrl(env: Env): string {
  return (
    env.NATIVE_DEX_INDEXER_RPC_URL ||
    env.BOING_TESTNET_RPC_URL ||
    'https://testnet-rpc.boing.network'
  ).replace(/\/$/, '');
}

async function persistDirectoryIfBound(env: Env, payload: Awaited<ReturnType<typeof buildPayload>>): Promise<void> {
  const db = env.DIRECTORY_DB;
  if (!db) return;
  await syncDirectoryPoolsFromPayload(db, payload);

  const logScanBlocks = parseIntOpt(env.NATIVE_DEX_INDEXER_LOG_SCAN_BLOCKS, 8000);
  const head = payload.headHeight;
  const pools = Array.isArray(payload.pools) ? payload.pools : [];
  const poolHexes = pools
    .map((p) => String((p as { poolHex?: string }).poolHex || '').trim().toLowerCase())
    .filter((h) => /^0x[0-9a-f]{64}$/.test(h));

  try {
    const client = createClient({ baseUrl: rpcBaseUrl(env) });
    if (head == null || !Number.isFinite(head) || poolHexes.length === 0) {
      await syncDirectoryPoolEventsFromPayload(db, payload.updatedAt, []);
    } else {
      const toB = Math.floor(head);
      const fromB = Math.max(0, toB - logScanBlocks + 1);
      const events = await collectNativeDexPoolEventsForPools(client, poolHexes, { fromBlock: fromB, toBlock: toB });
      await syncDirectoryPoolEventsFromPayload(db, payload.updatedAt, events);
    }
    try {
      if (head == null || !Number.isFinite(head) || poolHexes.length === 0) {
        await syncDirectoryIndexerTip(db, payload.updatedAt, null, null);
      } else {
        const toB = Math.floor(head);
        let tipHash: string | null = null;
        try {
          const blk = await client.getBlockByHeight(toB, false);
          const h = blk?.hash;
          tipHash = typeof h === 'string' && /^0x[0-9a-f]{64}$/i.test(h) ? h.toLowerCase() : null;
        } catch {
          /* optional */
        }
        await syncDirectoryIndexerTip(db, payload.updatedAt, toB, tipHash);
      }
    } catch {
      /* directory_indexer_tip missing until migration 0003 */
    }
  } catch {
    /* keep previous directory_pool_events rows on RPC failure */
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const disable = String(env.NATIVE_DEX_INDEXER_API_DISABLE || '').trim();
    if (disable === '1' || disable.toLowerCase() === 'true') {
      return json({ error: 'disabled' }, 503);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    try {
      if (path === '/v1/directory/meta' && request.method === 'GET') {
        const db = env.DIRECTORY_DB;
        if (!db) {
          return json({ error: 'D1 not configured (DIRECTORY_DB binding missing)' }, 503);
        }
        const meta = await getDirectoryMeta(db);
        return json({
          api: 'boing-native-dex-directory/v1',
          resource: 'meta',
          ...meta,
        });
      }

      if (path === '/v1/directory/pools' && request.method === 'GET') {
        const db = env.DIRECTORY_DB;
        if (!db) {
          return json({ error: 'D1 not configured (DIRECTORY_DB binding missing)' }, 503);
        }
        const page = await listDirectoryPoolsPage(db, url);
        return json({
          api: 'boing-native-dex-directory/v1',
          resource: 'pools',
          ...page,
        });
      }

      const historyMatch = /^\/v1\/history\/pool\/(0x[0-9a-f]{64})\/events$/i.exec(path);
      if (historyMatch && request.method === 'GET') {
        const db = env.DIRECTORY_DB;
        if (!db) {
          return json({ error: 'D1 not configured (DIRECTORY_DB binding missing)' }, 503);
        }
        const poolHex = historyMatch[1]!.toLowerCase();
        const page = await listDirectoryPoolEventsPage(db, poolHex, url);
        return json({
          api: 'boing-native-dex-directory/v1',
          resource: 'pool_events',
          ...page,
        });
      }

      const userHistoryMatch = /^\/v1\/history\/user\/(0x[0-9a-f]{64})\/events$/i.exec(path);
      if (userHistoryMatch && request.method === 'GET') {
        const db = env.DIRECTORY_DB;
        if (!db) {
          return json({ error: 'D1 not configured (DIRECTORY_DB binding missing)' }, 503);
        }
        const callerHex = userHistoryMatch[1]!.toLowerCase();
        const page = await listDirectoryUserEventsPage(db, callerHex, url);
        return json({
          api: 'boing-native-dex-directory/v1',
          resource: 'user_pool_events',
          ...page,
        });
      }

      const vaultMapMatch = /^\/v1\/lp\/vault\/(0x[0-9a-f]{64})\/mapping$/i.exec(path);
      if (vaultMapMatch && request.method === 'GET') {
        const client = createClient({ baseUrl: rpcBaseUrl(env) });
        const vaultHex = vaultMapMatch[1]!.toLowerCase() as `0x${string}`;
        const mapping = await resolveNativeAmmVaultPoolMapping(client, vaultHex);
        return json({
          api: 'boing-native-dex-directory/v1',
          resource: 'lp_vault_mapping',
          ...mapping,
        });
      }

      if (path === '/v1/lp/positions' && request.method === 'GET') {
        return json(
          {
            api: 'boing-native-dex-directory/v1',
            resource: 'lp_positions',
            error: 'not_implemented',
            detail:
              'Aggregated LP positions across pools need model-specific enumeration (NFT indexer, vault share reads, or share-token balance scans). Model A: use GET /v1/lp/vault/{vault}/mapping and boing-sdk fetchNativeDexLpVaultSharePositionForOwner. Model B (NFT): enumerate mints via a dedicated indexer — no chain-wide owner enumeration RPC in this Worker.',
          },
          501,
        );
      }

      if (path === '/v1/directory/sync' && request.method === 'POST') {
        const secret = String(env.DIRECTORY_SYNC_SECRET || '').trim();
        if (!secret) {
          return json({ error: 'DIRECTORY_SYNC_SECRET not set on worker' }, 503);
        }
        const auth = request.headers.get('Authorization') || '';
        if (auth !== `Bearer ${secret}`) {
          return json({ error: 'unauthorized' }, 401);
        }
        const payload = await buildPayload(env);
        await persistDirectoryIfBound(env, payload);
        const meta = env.DIRECTORY_DB
          ? await getDirectoryMeta(env.DIRECTORY_DB)
          : {
              poolCount: 0,
              eventCount: 0,
              latestSyncBatch: null,
              indexedTipHeight: null,
              indexedTipBlockHash: null,
            };
        return json({
          ok: true,
          updatedAt: payload.updatedAt,
          poolCount: meta.poolCount,
          eventCount: meta.eventCount,
          latestSyncBatch: meta.latestSyncBatch,
          indexedTipHeight: meta.indexedTipHeight,
          indexedTipBlockHash: meta.indexedTipBlockHash,
        });
      }

      if (request.method === 'GET' && (path === '/stats' || path === '/')) {
        const payload = await buildPayload(env);
        const sliced = sliceIndexerPoolsInPayload(payload as Record<string, unknown>, url);
        return new Response(JSON.stringify(sliced), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=30',
          },
        });
      }

      return new Response(
        JSON.stringify({
          error: 'not_found',
          hint:
            'GET /stats, GET /v1/directory/*, GET /v1/history/pool|user/{hex}/events, GET /v1/lp/vault/{vault}/mapping, POST /v1/directory/sync',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsJsonHeaders } },
      );
    } catch (e) {
      return json(
        {
          error: e instanceof Error ? e.message : String(e),
        },
        500,
      );
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const disable = String(env.NATIVE_DEX_INDEXER_API_DISABLE || '').trim();
    if (disable === '1' || disable.toLowerCase() === 'true') return;
    ctx.waitUntil(
      (async () => {
        try {
          const payload = await buildPayload(env);
          await persistDirectoryIfBound(env, payload);
        } catch {
          /* ignore */
        }
      })(),
    );
  },
};
