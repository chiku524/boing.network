#!/usr/bin/env node
/**
 * Raw JSON-RPC probe — no SDK build. Shows which `boing_*` methods the URL answers.
 *
 *   BOING_RPC_URL=http://127.0.0.1:8545 node scripts/rpc-endpoint-check.mjs
 *
 * npm (repo root): npm run rpc-endpoint-check
 */
const base = (process.env.BOING_RPC_URL ?? 'http://127.0.0.1:8545').replace(/\/$/, '');

async function call(method, params) {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) {
    return { ok: false, code: j.error.code, message: j.error.message };
  }
  return { ok: true, result: j.result };
}

function summarize(r) {
  if (!r.ok) return `error ${r.code} — ${r.message}`;
  const s = JSON.stringify(r.result);
  return s.length > 100 ? `${s.slice(0, 97)}…` : s;
}

const checks = [
  ['boing_health', []],
  ['boing_clientVersion', []],
  ['boing_rpcSupportedMethods', []],
  ['boing_chainHeight', []],
  ['boing_getSyncState', []],
  ['boing_getNetworkInfo', []],
  ['boing_getRpcMethodCatalog', []],
  ['boing_getRpcOpenApi', []],
  ['boing_getBlockByHeight', [0, false]],
  ['boing_getLogs', [{ fromBlock: 0, toBlock: 0 }]],
  ['boing_getTransactionReceipt', [`0x${'00'.repeat(32)}`]],
];

async function main() {
  console.log(`RPC ${base}\n`);
  try {
    const root = await fetch(base, { method: 'GET' });
    const allow = root.headers.get('allow');
    const rootMark =
      root.status === 405 && allow?.includes('POST') ? 'ok' : root.ok ? '??' : '--';
    console.log(
      `${rootMark} ${'GET /'.padEnd(32)} HTTP ${root.status}${allow ? ` Allow=${allow}` : ''}`
    );
  } catch (e) {
    console.log(`! ${'GET /'.padEnd(32)} ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const opt = await fetch(base, { method: 'OPTIONS' });
    const oa = opt.headers.get('allow');
    const optMark =
      (opt.status === 204 || opt.status === 200) && oa?.includes('POST')
        ? 'ok'
        : opt.ok
          ? '??'
          : '--';
    console.log(
      `${optMark} ${'OPTIONS /'.padEnd(32)} HTTP ${opt.status}${oa ? ` Allow=${oa}` : ''}`
    );
  } catch (e) {
    console.log(`! ${'OPTIONS /'.padEnd(32)} ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const lr = await fetch(`${base}/live`, { method: 'GET' });
    console.log(`${lr.ok ? 'ok' : '??'} ${'GET /live'.padEnd(32)} HTTP ${lr.status}`);
  } catch (e) {
    console.log(`! ${'GET /live'.padEnd(32)} ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const hd = await fetch(base, { method: 'HEAD' });
    const ha = hd.headers.get('allow');
    const hm =
      hd.status === 405 && ha?.includes('HEAD') ? 'ok' : hd.ok ? '??' : '--';
    console.log(
      `${hm} ${'HEAD /'.padEnd(32)} HTTP ${hd.status}${ha ? ` Allow=${ha}` : ''}`
    );
  } catch (e) {
    console.log(`! ${'HEAD /'.padEnd(32)} ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const oa = await fetch(`${base}/openapi.json`, { method: 'GET' });
    const oj = oa.ok ? await oa.json().catch(() => null) : null;
    const om = oa.ok && oj && typeof oj === 'object' && 'openapi' in oj ? 'ok' : oa.ok ? '??' : '--';
    console.log(`${om} ${'GET /openapi.json'.padEnd(32)} HTTP ${oa.status}`);
  } catch (e) {
    console.log(`! ${'GET /openapi.json'.padEnd(32)} ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const wk = await fetch(`${base}/.well-known/boing-rpc`, { method: 'GET' });
    const wj = wk.ok ? await wk.json().catch(() => null) : null;
    const wm =
      wk.ok && wj && typeof wj === 'object' && 'schema_version' in wj ? 'ok' : wk.ok ? '??' : '--';
    console.log(`${wm} ${'GET /.well-known/boing-rpc'.padEnd(32)} HTTP ${wk.status}`);
  } catch (e) {
    console.log(
      `! ${'GET /.well-known/boing-rpc'.padEnd(32)} ${e instanceof Error ? e.message : String(e)}`
    );
  }
  for (const [method, params] of checks) {
    try {
      const r = await call(method, params);
      const mark = r.ok ? 'ok' : r.code === -32601 ? '--' : '??';
      console.log(`${mark} ${method.padEnd(32)} ${summarize(r)}`);
    } catch (e) {
      console.log(`! ${method.padEnd(32)} ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  try {
    const br = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { jsonrpc: '2.0', id: 1, method: 'boing_chainHeight', params: [] },
        { jsonrpc: '2.0', id: 2, method: 'boing_clientVersion', params: [] },
      ]),
    });
    const bj = await br.json();
    const batchOk =
      br.ok && Array.isArray(bj) && bj.length === 2 && bj[0]?.result != null && bj[1]?.result != null;
    console.log(`${batchOk ? 'ok' : '??'} ${'POST / (batch x2)'.padEnd(32)} HTTP ${br.status}`);
  } catch (e) {
    console.log(`! ${'POST / (batch x2)'.padEnd(32)} ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log(`
Interpretation:
  Current boing.network tree implements all of the above on the same POST / handler.
  If some lines show error -32601 while boing_chainHeight works, the process on this port
  is not that build (old binary, different install) or a proxy is stripping method names.

Find which program owns the port:`);
  if (process.platform === 'win32') {
    console.log(`  netstat -ano | findstr :8545`);
    console.log(`  tasklist /FI "PID eq <pid>" /V`);
  } else {
    console.log(`  ss -tlnp | grep 8545    # or: lsof -i :8545`);
  }
  console.log(`Run from this repo: cargo run -p boing-node -- --validator --rpc-port 8545`);
  console.log(`(or: cargo build -p boing-node --release && target/release/boing-node …)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
