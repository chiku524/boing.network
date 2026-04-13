/**
 * Cloudflare Worker: **universal contract deploy registry** (D1 + HTTP).
 *
 * - **Cron:** scans `boing_getBlockByHeight` from a persisted cursor through tip (bounded blocks/tick).
 * - **GET /v1/deployments** — cursor pagination by monotonic `id`.
 * - **GET /v1/deployments/stream** — **SSE** (`text/event-stream`): emits JSON rows for new deploys and `ping` when idle (clients reconnect as needed).
 *
 * Pair with **`BoingNewHeadsWs`** on the node (or poll chain height) if you want tighter client-side scheduling;
 * this worker advances on **cron** by default.
 */

import {
  createClient,
  extractUniversalContractDeploymentsFromBlock,
  type UniversalContractDeploymentRow,
} from 'boing-sdk';

type Env = {
  DEPLOY_REGISTRY_DB: D1Database;
  DEPLOY_REGISTRY_RPC_URL?: string;
  DEPLOY_REGISTRY_FROM_HEIGHT?: string;
  DEPLOY_REGISTRY_MAX_BLOCKS_PER_TICK?: string;
};

const cors: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, ...extra } });
}

function parseIntOpt(raw: string | undefined, fallback: number): number {
  if (raw == null || !String(raw).trim()) return fallback;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : fallback;
}

async function readNextHeight(db: D1Database, fallback: number): Promise<number> {
  const r = await db.prepare(`SELECT v FROM ingest_state WHERE k = ?`).bind('next_height').first<{ v: string }>();
  if (r?.v != null) {
    const n = parseInt(r.v, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return fallback;
}

async function writeNextHeight(db: D1Database, h: number): Promise<void> {
  await db
    .prepare(`INSERT INTO ingest_state (k, v) VALUES ('next_height', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`)
    .bind(String(h))
    .run();
}

async function insertDeploymentRow(db: D1Database, row: UniversalContractDeploymentRow): Promise<number> {
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO contract_deployments
       (contract_hex, block_height, tx_index, tx_id_hex, sender_hex, payload_kind, purpose_category, asset_name, asset_symbol)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.contractHex.toLowerCase(),
      row.blockHeight,
      row.txIndex,
      row.txIdHex.toLowerCase(),
      row.senderHex.toLowerCase(),
      row.payloadKind,
      row.purposeCategory ?? null,
      row.assetName ?? null,
      row.assetSymbol ?? null,
    )
    .run();
  return typeof res.meta?.changes === 'number' ? res.meta.changes : 0;
}

export async function syncDeployRegistry(env: Env): Promise<{ indexedBlocks: number; rowsInserted: number; nextHeight: number }> {
  const baseUrl = String(env.DEPLOY_REGISTRY_RPC_URL || '').trim();
  if (!baseUrl) return { indexedBlocks: 0, rowsInserted: 0, nextHeight: 0 };

  const client = createClient({ baseUrl });
  const head = await client.chainHeight();
  const fromDefault = parseIntOpt(env.DEPLOY_REGISTRY_FROM_HEIGHT, 0);
  const maxPer = Math.min(256, Math.max(1, parseIntOpt(env.DEPLOY_REGISTRY_MAX_BLOCKS_PER_TICK, 8)));

  let cursor = await readNextHeight(env.DEPLOY_REGISTRY_DB, fromDefault);
  let indexedBlocks = 0;
  let rowsInserted = 0;

  const tip = typeof head === 'number' && Number.isFinite(head) ? head : 0;
  let h = cursor;
  while (indexedBlocks < maxPer && h <= tip) {
    const block = await client.getBlockByHeight(h, false);
    if (block) {
      const rows = extractUniversalContractDeploymentsFromBlock(block as unknown);
      for (const row of rows) {
        rowsInserted += await insertDeploymentRow(env.DEPLOY_REGISTRY_DB, row);
      }
    }
    h += 1;
    indexedBlocks += 1;
  }

  await writeNextHeight(env.DEPLOY_REGISTRY_DB, h);
  return { indexedBlocks, rowsInserted, nextHeight: h };
}

function sseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' },
      });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'boing-deploy-registry-indexer' });
    }

    if (url.pathname === '/v1/deployments' && req.method === 'GET') {
      const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
      const cursor = parseInt(url.searchParams.get('cursor') || '0', 10);
      const cur = Number.isFinite(cursor) ? cursor : 0;
      const r = await env.DEPLOY_REGISTRY_DB.prepare(
        `SELECT id, contract_hex, block_height, tx_index, tx_id_hex, sender_hex, payload_kind, purpose_category, asset_name, asset_symbol
         FROM contract_deployments WHERE id > ? ORDER BY id ASC LIMIT ?`,
      )
        .bind(cur, limit)
        .all();
      const rows = (r.results || []) as Record<string, unknown>[];
      const lastId = rows.length ? (rows[rows.length - 1]!.id as number) : cur;
      const nextCursor = rows.length === limit ? String(lastId) : null;
      return json({ rows, nextCursor, schemaVersion: 1 });
    }

    if (url.pathname === '/v1/deployments/stream' && req.method === 'GET') {
      const sinceRaw = url.searchParams.get('since_id');
      let lastId = sinceRaw != null && sinceRaw !== '' ? parseInt(sinceRaw, 10) : 0;
      if (!Number.isFinite(lastId)) lastId = 0;

      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          const enc = new TextEncoder();
          try {
            const r = await env.DEPLOY_REGISTRY_DB.prepare(
              `SELECT id, contract_hex, block_height, tx_index, tx_id_hex, sender_hex, payload_kind, purpose_category, asset_name, asset_symbol
               FROM contract_deployments WHERE id > ? ORDER BY id ASC LIMIT 25`,
            )
              .bind(lastId)
              .all();
            const rows = (r.results || []) as { id: number }[];
            if (rows.length) {
              for (const row of rows) {
                controller.enqueue(enc.encode(`data: ${JSON.stringify(row)}\n\n`));
                lastId = row.id;
              }
            } else {
              controller.enqueue(enc.encode(`event: ping\ndata: {}\n\n`));
            }
          } catch (e) {
            controller.enqueue(
              enc.encode(`event: error\ndata: ${JSON.stringify({ message: String(e) })}\n\n`),
            );
          }
          await new Promise((res) => setTimeout(res, 2500));
        },
      });

      return new Response(stream, { headers: sseHeaders() });
    }

    return json({ error: 'not_found', path: url.pathname }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          await syncDeployRegistry(env);
        } catch (e) {
          console.error('deploy-registry sync failed', e);
        }
      })(),
    );
  },
};
