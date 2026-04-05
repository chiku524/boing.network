/** Query helpers for D1 read routes (MVP explorer API). */

/** Max inclusive block span for **`/api/blocks`** summaries. */
export const MAX_BLOCK_SUMMARY_RANGE = 64;

/** Hard cap on log rows returned (aligns with `boing_getLogs` result cap spirit). */
export const MAX_LOG_ROWS = 2048;

/** Max inclusive block span for **`/api/logs?from_height=&to_height=`** (RPC log chunk default). */
export const MAX_LOG_BLOCK_SPAN = 128;

/** Max inclusive block span for **`/api/txs?from_height=&to_height=`**. */
export const MAX_TX_BLOCK_SPAN = 64;

/** Max rows returned by **`/api/txs`**. */
export const MAX_TX_ROWS = 2048;

/** Max comma-separated **`tx_id`** values on **`GET /api/transactions/batch`** / **`/api/receipts/batch`**. */
export const MAX_BATCH_TX_IDS = 32;

/** Max rows on **`GET /api/blocks/recent`**. */
export const MAX_RECENT_BLOCK_SUMMARIES = 32;

export function parseNonNegIntHeight(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/** Normalize to `0x` + 64 lowercase hex (tx id, account id, or 32-byte log topic). */
export function normalizeTxIdHex32(raw: string | null): string | null {
  if (raw == null || raw === '') return null;
  const s = raw.trim();
  const hex = s.startsWith('0x') || s.startsWith('0X') ? s.slice(2) : s;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return `0x${hex.toLowerCase()}`;
}

/** Up to four 32-byte log topics (aligned with **`boing_getLogs`**-style positional topics). */
export type LogTopicFilters = readonly [string | null, string | null, string | null, string | null];

const TOPIC_PARAM_KEYS = [
  ['topic0', 'topic_0'],
  ['topic1', 'topic_1'],
  ['topic2', 'topic_2'],
  ['topic3', 'topic_3'],
] as const;

const NULL_TOPICS: LogTopicFilters = [null, null, null, null];

/** Optional **`address`** / **`contract`** and **`topic0`…`topic3`** (or **`topic_0`…`topic_3`**). */
export function parseLogFilters(sp: {
  get(name: string): string | null;
}): { address: string | null; topics: LogTopicFilters; error: string | null } {
  const rawAddr = sp.get('address') ?? sp.get('contract');
  let address: string | null = null;
  if (rawAddr != null && rawAddr !== '') {
    address = normalizeTxIdHex32(rawAddr);
    if (address === null) return { address: null, topics: NULL_TOPICS, error: 'invalid_address' };
  }

  const topics: [string | null, string | null, string | null, string | null] = [null, null, null, null];
  for (let i = 0; i < 4; i++) {
    let rawVal: string | null = null;
    for (const key of TOPIC_PARAM_KEYS[i]!) {
      const raw = sp.get(key);
      if (raw != null && raw !== '') {
        rawVal = raw;
        break;
      }
    }
    if (rawVal === null) continue;
    const norm = normalizeTxIdHex32(rawVal);
    if (norm === null) {
      return { address: null, topics: NULL_TOPICS, error: `invalid_topic${i}` };
    }
    topics[i] = norm;
  }
  return { address, topics, error: null };
}

export function parsePositiveIntLimit(raw: string | null, fallback: number, hardMax: number): number {
  if (raw == null || raw === '') return Math.min(fallback, hardMax);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return Math.min(fallback, hardMax);
  return Math.min(n, hardMax);
}

/** Comma-separated **`0x`+64hex** tx ids for batch read (max {@link MAX_BATCH_TX_IDS}). */
export function parseCommaSeparatedTxIds(raw: string | null): { ids: string[] } | { error: string } {
  if (raw == null || raw.trim() === '') return { error: 'missing_tx_ids' };
  const parts = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) return { error: 'missing_tx_ids' };
  if (parts.length > MAX_BATCH_TX_IDS) {
    return { error: `too_many_tx_ids_max_${MAX_BATCH_TX_IDS}` };
  }
  const ids: string[] = [];
  for (const p of parts) {
    const n = normalizeTxIdHex32(p);
    if (n === null) return { error: 'invalid_tx_id_in_list' };
    ids.push(n);
  }
  return { ids };
}

export function parseInclusiveHeightRange(
  fromRaw: string | null,
  toRaw: string | null,
  maxSpan: number
): { from: number; to: number } | null {
  const from = parseNonNegIntHeight(fromRaw);
  const to = parseNonNegIntHeight(toRaw);
  if (from === null || to === null || from > to) return null;
  if (to - from + 1 > maxSpan) return null;
  return { from, to };
}

export type LogRowParsed = {
  id: number;
  tx_id: string;
  log_index: number;
  block_height: number;
  address: string | null;
  topics: string[];
  data_hex: string;
};

function parseTopicsJson(s: string): string[] {
  try {
    const a = JSON.parse(s) as unknown;
    return Array.isArray(a) ? a.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function mapLogRow(r: {
  id: number;
  tx_id: string;
  log_index: number;
  block_height: number;
  address: string | null;
  topics_json: string;
  data_hex: string;
}): LogRowParsed {
  return {
    id: r.id,
    tx_id: r.tx_id,
    log_index: r.log_index,
    block_height: r.block_height,
    address: r.address,
    topics: parseTopicsJson(r.topics_json),
    data_hex: r.data_hex,
  };
}

export async function getLogsByTxId(
  db: D1Database,
  txId: string,
  limit: number,
  filters: { address: string | null; topics: LogTopicFilters } = { address: null, topics: NULL_TOPICS }
): Promise<LogRowParsed[]> {
  let sql = `SELECT id, tx_id, log_index, block_height, address, topics_json, data_hex
       FROM logs WHERE tx_id = ?`;
  const binds: unknown[] = [txId];
  if (filters.address != null) {
    sql += ' AND address IS NOT NULL AND lower(address) = lower(?)';
    binds.push(filters.address);
  }
  for (let i = 0; i < 4; i++) {
    const t = filters.topics[i];
    if (t != null) {
      sql += ` AND lower(json_extract(topics_json, '$[${i}]')) = lower(?)`;
      binds.push(t);
    }
  }
  sql += ' ORDER BY log_index ASC LIMIT ?';
  binds.push(limit);

  const { results } = await db
    .prepare(sql)
    .bind(...binds)
    .all<{
      id: number;
      tx_id: string;
      log_index: number;
      block_height: number;
      address: string | null;
      topics_json: string;
      data_hex: string;
    }>();
  return (results ?? []).map(mapLogRow);
}

type LogBlockSpec = { kind: 'height'; height: number } | { kind: 'range'; from: number; to: number };

async function queryLogsForBlockSpec(
  db: D1Database,
  spec: LogBlockSpec,
  limit: number,
  addressFilter: string | null,
  topicFilters: LogTopicFilters
): Promise<LogRowParsed[]> {
  let sql = `SELECT id, tx_id, log_index, block_height, address, topics_json, data_hex FROM logs WHERE `;
  const binds: unknown[] = [];
  if (spec.kind === 'height') {
    sql += 'block_height = ?';
    binds.push(spec.height);
  } else {
    sql += 'block_height >= ? AND block_height <= ?';
    binds.push(spec.from, spec.to);
  }
  if (addressFilter != null) {
    sql += ' AND address IS NOT NULL AND lower(address) = lower(?)';
    binds.push(addressFilter);
  }
  for (let i = 0; i < 4; i++) {
    const t = topicFilters[i];
    if (t != null) {
      sql += ` AND lower(json_extract(topics_json, '$[${i}]')) = lower(?)`;
      binds.push(t);
    }
  }
  if (spec.kind === 'height') {
    sql += ' ORDER BY tx_id ASC, log_index ASC LIMIT ?';
  } else {
    sql += ' ORDER BY block_height ASC, tx_id ASC, log_index ASC LIMIT ?';
  }
  binds.push(limit);

  const { results } = await db
    .prepare(sql)
    .bind(...binds)
    .all<{
      id: number;
      tx_id: string;
      log_index: number;
      block_height: number;
      address: string | null;
      topics_json: string;
      data_hex: string;
    }>();
  return (results ?? []).map(mapLogRow);
}

export async function getLogsByBlockHeight(
  db: D1Database,
  height: number,
  limit: number,
  addressFilter: string | null = null,
  topicFilters: LogTopicFilters = NULL_TOPICS
): Promise<LogRowParsed[]> {
  return queryLogsForBlockSpec(db, { kind: 'height', height }, limit, addressFilter, topicFilters);
}

export async function getLogsByBlockHeightRange(
  db: D1Database,
  from: number,
  to: number,
  limit: number,
  addressFilter: string | null = null,
  topicFilters: LogTopicFilters = NULL_TOPICS
): Promise<LogRowParsed[]> {
  return queryLogsForBlockSpec(db, { kind: 'range', from, to }, limit, addressFilter, topicFilters);
}

export type TransactionListRow = {
  tx_id: string;
  block_height: number;
  tx_index: number;
  sender: string | null;
  payload_kind: string | null;
};

export async function getTransactionsByBlockHeight(
  db: D1Database,
  height: number,
  limit: number
): Promise<TransactionListRow[]> {
  const { results } = await db
    .prepare(
      `SELECT tx_id, block_height, tx_index, sender, payload_kind
       FROM transactions WHERE block_height = ? ORDER BY tx_index ASC LIMIT ?`
    )
    .bind(height, limit)
    .all<TransactionListRow>();
  return results ?? [];
}

export async function getTransactionsByBlockHeightRange(
  db: D1Database,
  from: number,
  to: number,
  limit: number
): Promise<TransactionListRow[]> {
  const { results } = await db
    .prepare(
      `SELECT tx_id, block_height, tx_index, sender, payload_kind
       FROM transactions WHERE block_height >= ? AND block_height <= ?
       ORDER BY block_height ASC, tx_index ASC LIMIT ?`
    )
    .bind(from, to, limit)
    .all<TransactionListRow>();
  return results ?? [];
}

export async function getBlockSummariesInRange(
  db: D1Database,
  from: number,
  to: number
): Promise<Array<{ height: number; block_hash: string; parent_hash: string }>> {
  const { results } = await db
    .prepare(
      `SELECT height, block_hash, parent_hash FROM blocks
       WHERE height >= ? AND height <= ? ORDER BY height ASC`
    )
    .bind(from, to)
    .all<{ height: number; block_hash: string; parent_hash: string }>();
  return results ?? [];
}

/** Newest blocks first (`height` descending). */
export async function getRecentBlockSummaries(
  db: D1Database,
  limit: number
): Promise<Array<{ height: number; block_hash: string; parent_hash: string }>> {
  const lim = Math.min(Math.max(1, limit), MAX_RECENT_BLOCK_SUMMARIES);
  const { results } = await db
    .prepare(
      `SELECT height, block_hash, parent_hash FROM blocks ORDER BY height DESC LIMIT ?`
    )
    .bind(lim)
    .all<{ height: number; block_hash: string; parent_hash: string }>();
  return results ?? [];
}

export type BlockHeightGapRow = {
  from_height: number;
  to_height: number;
  reason: string;
  recorded_at: number;
};

export async function getBlockHeightGapRowsForChain(
  db: D1Database,
  chainId: string
): Promise<BlockHeightGapRow[]> {
  const { results } = await db
    .prepare(
      `SELECT from_height, to_height, reason, recorded_at
       FROM block_height_gaps WHERE chain_id = ? ORDER BY from_height ASC`
    )
    .bind(chainId)
    .all<BlockHeightGapRow>();
  return results ?? [];
}

/** Highest indexed block in **`blocks`** (null when empty). */
export async function getBlockChainTip(
  db: D1Database
): Promise<{ height: number; block_hash: string } | null> {
  const row = await db
    .prepare(
      `SELECT height, block_hash FROM blocks WHERE height = (SELECT MAX(height) FROM blocks) LIMIT 1`
    )
    .first<{ height: number; block_hash: string }>();
  return row ?? null;
}

export async function getBlockByHeight(
  db: D1Database,
  height: number
): Promise<{
  height: number;
  block_hash: string;
  parent_hash: string;
  block: unknown;
} | null> {
  const row = await db
    .prepare('SELECT height, block_hash, parent_hash, block_json FROM blocks WHERE height = ?')
    .bind(height)
    .first<{ height: number; block_hash: string; parent_hash: string; block_json: string }>();
  if (!row) return null;
  let block: unknown;
  try {
    block = JSON.parse(row.block_json) as unknown;
  } catch {
    block = { parseError: true, raw: row.block_json };
  }
  return {
    height: row.height,
    block_hash: row.block_hash,
    parent_hash: row.parent_hash,
    block,
  };
}

export async function blockExistsAtHeight(db: D1Database, height: number): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS x FROM blocks WHERE height = ? LIMIT 1')
    .bind(height)
    .first<{ x: number }>();
  return row != null;
}

export async function blockExistsByHash(db: D1Database, blockHashHex32: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS x FROM blocks WHERE lower(block_hash) = lower(?) LIMIT 1')
    .bind(blockHashHex32)
    .first<{ x: number }>();
  return row != null;
}

export async function getBlockByHash(
  db: D1Database,
  blockHashHex32: string
): Promise<{
  height: number;
  block_hash: string;
  parent_hash: string;
  block: unknown;
} | null> {
  const row = await db
    .prepare(
      `SELECT height, block_hash, parent_hash, block_json FROM blocks
       WHERE lower(block_hash) = lower(?) LIMIT 1`
    )
    .bind(blockHashHex32)
    .first<{ height: number; block_hash: string; parent_hash: string; block_json: string }>();
  if (!row) return null;
  let block: unknown;
  try {
    block = JSON.parse(row.block_json) as unknown;
  } catch {
    block = { parseError: true, raw: row.block_json };
  }
  return {
    height: row.height,
    block_hash: row.block_hash,
    parent_hash: row.parent_hash,
    block,
  };
}

export type TransactionDetailRow = {
  tx_id: string;
  block_height: number;
  tx_index: number;
  sender: string | null;
  payload_kind: string | null;
  raw_hex: string | null;
};

export async function getTransactionByTxId(
  db: D1Database,
  txId: string
): Promise<TransactionDetailRow | null> {
  const row = await db
    .prepare(
      `SELECT tx_id, block_height, tx_index, sender, payload_kind, raw_hex
       FROM transactions WHERE tx_id = ?`
    )
    .bind(txId)
    .first<TransactionDetailRow>();
  return row ?? null;
}

export async function getTransactionsByTxIdsBulk(
  db: D1Database,
  txIds: string[]
): Promise<Map<string, TransactionDetailRow>> {
  const m = new Map<string, TransactionDetailRow>();
  if (txIds.length === 0) return m;
  const ph = txIds.map(() => '?').join(',');
  const sql = `SELECT tx_id, block_height, tx_index, sender, payload_kind, raw_hex
       FROM transactions WHERE tx_id IN (${ph})`;
  const { results } = await db.prepare(sql).bind(...txIds).all<TransactionDetailRow>();
  for (const r of results ?? []) {
    m.set(r.tx_id, r);
  }
  return m;
}

export async function transactionExistsByTxId(db: D1Database, txId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS x FROM transactions WHERE tx_id = ? LIMIT 1')
    .bind(txId)
    .first<{ x: number }>();
  return row != null;
}

export type ReceiptDetailRow = {
  tx_id: string;
  success: boolean;
  gas_used: string;
  return_data: string | null;
  error: string | null;
};

type ReceiptSqlRow = {
  tx_id: string;
  success: number;
  gas_used: string;
  return_data: string | null;
  error: string | null;
};

function mapReceiptSqlRow(row: ReceiptSqlRow): ReceiptDetailRow {
  return {
    tx_id: row.tx_id,
    success: row.success !== 0,
    gas_used: row.gas_used,
    return_data: row.return_data,
    error: row.error,
  };
}

export async function getReceiptByTxId(
  db: D1Database,
  txId: string
): Promise<ReceiptDetailRow | null> {
  const row = await db
    .prepare('SELECT tx_id, success, gas_used, return_data, error FROM receipts WHERE tx_id = ?')
    .bind(txId)
    .first<ReceiptSqlRow>();
  if (!row) return null;
  return mapReceiptSqlRow(row);
}

export async function getReceiptsByTxIdsBulk(
  db: D1Database,
  txIds: string[]
): Promise<Map<string, ReceiptDetailRow>> {
  const m = new Map<string, ReceiptDetailRow>();
  if (txIds.length === 0) return m;
  const ph = txIds.map(() => '?').join(',');
  const sql = `SELECT tx_id, success, gas_used, return_data, error FROM receipts WHERE tx_id IN (${ph})`;
  const { results } = await db.prepare(sql).bind(...txIds).all<ReceiptSqlRow>();
  for (const r of results ?? []) {
    m.set(r.tx_id, mapReceiptSqlRow(r));
  }
  return m;
}

export async function receiptExistsByTxId(db: D1Database, txId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS x FROM receipts WHERE tx_id = ? LIMIT 1')
    .bind(txId)
    .first<{ x: number }>();
  return row != null;
}

export async function getDatabaseStats(db: D1Database): Promise<{
  blocks: number;
  transactions: number;
  receipts: number;
  logs: number;
  ingestCursors: number;
  gapRows: number;
  blockHeightMin: number | null;
  blockHeightMax: number | null;
}> {
  const [b, t, r, l, ic, gr, range] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS c FROM blocks').first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) AS c FROM transactions').first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) AS c FROM receipts').first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) AS c FROM logs').first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) AS c FROM ingest_cursor').first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) AS c FROM block_height_gaps').first<{ c: number }>(),
    db.prepare('SELECT MIN(height) AS lo, MAX(height) AS hi FROM blocks').first<{
      lo: number | null;
      hi: number | null;
    }>(),
  ]);

  return {
    blocks: Number(b?.c ?? 0),
    transactions: Number(t?.c ?? 0),
    receipts: Number(r?.c ?? 0),
    logs: Number(l?.c ?? 0),
    ingestCursors: Number(ic?.c ?? 0),
    gapRows: Number(gr?.c ?? 0),
    blockHeightMin: range?.lo ?? null,
    blockHeightMax: range?.hi ?? null,
  };
}
