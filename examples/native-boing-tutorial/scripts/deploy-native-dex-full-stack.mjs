#!/usr/bin/env node
/**
 * One script: native CP pool + DEX factory/directory → routers (swap2, ledger v2/v3) → LP vault + LP share
 * → on-chain wiring (`set_minter_once` + vault `configure`). Configuration and secrets come from **`.env`**
 * in the tutorial package root (loaded first; does not override variables already set in the shell).
 *
 * Prerequisites: same as `bootstrap-native-pool-and-dex.mjs` + aux + LP aux (cargo dump examples, funded key).
 *
 * **`.env`** (copy from `.env.example`): at minimum **`BOING_SECRET_HEX`**. See `.env.example` for toggles and
 * forwarded vars (`BOING_RPC_URL`, `BOING_BOOTSTRAP_REGISTER_PAIR`, router/LP skips, etc.).
 *
 * Phase skips (set `1` or `true`):
 *   BOING_FULL_STACK_SKIP_POOL_FACTORY — skip pool + factory bootstrap
 *   BOING_FULL_STACK_SKIP_ROUTERS     — skip swap2 + ledger v2/v3 (+ optional ledger v1)
 *   BOING_FULL_STACK_SKIP_LP          — skip LP vault + share token deploys
 *   BOING_FULL_STACK_SKIP_WIRE        — skip share `set_minter_once` + vault `configure`
 *
 * If you skip a deploy phase but still run **wire**, set **`BOING_WIRE_POOL_HEX`**, **`BOING_WIRE_VAULT_HEX`**,
 * **`BOING_WIRE_SHARE_HEX`** (0x + 64 hex each).
 *
 * **`BOING_AUTO_FAUCET_REQUEST=1`** — run **`fund-deployer-from-env`** first (`boing_faucetRequest`) so the deployer
 * exists in VM state (avoids **`Account not found`** during simulate when `boing_getAccount` looked fine).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDotEnvFile } from './tutorial-dotenv.mjs';
import { parseScriptStdoutJson } from './tutorial-script-json.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const tutorialRoot = path.resolve(scriptDir, '..');

const dotenvResult = loadDotEnvFile(path.join(tutorialRoot, '.env'));
if (!dotenvResult.loaded) {
  console.warn(
    `[deploy-native-dex-full-stack] No .env at ${dotenvResult.path} — using process environment only. Copy .env.example → .env`
  );
}

const secretHex = process.env.BOING_SECRET_HEX?.trim();
if (!secretHex) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: 'missing_BOING_SECRET_HEX',
        hint: 'Set BOING_SECRET_HEX in .env (0x + 64 hex). Never commit .env.',
        dotenv: dotenvResult.loaded ? dotenvResult.path : 'not found',
      },
      null,
      2
    )
  );
  process.exit(1);
}

function truthy(name) {
  const v = process.env[name];
  return v === '1' || v === 'true';
}

const skipPoolFactory = truthy('BOING_FULL_STACK_SKIP_POOL_FACTORY');
const skipRouters = truthy('BOING_FULL_STACK_SKIP_ROUTERS');
const skipLp = truthy('BOING_FULL_STACK_SKIP_LP');
const skipWire = truthy('BOING_FULL_STACK_SKIP_WIRE');

const userSkipDump = truthy('BOING_SKIP_DUMP');

function runNodeScript(relScript, args, extraEnv) {
  const r = spawnSync(process.execPath, [path.join(scriptDir, relScript), ...(args ?? [])], {
    cwd: tutorialRoot,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  return {
    ok: r.status === 0,
    status: r.status ?? 1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

function parseDeployJson(stdout) {
  return parseScriptStdoutJson(stdout);
}

function main() {
  /** @type {Record<string, unknown>} */
  const report = {
    ok: true,
    dotenv: dotenvResult,
    phases: {},
  };

  if (truthy('BOING_AUTO_FAUCET_REQUEST')) {
    console.warn('[full-stack] BOING_AUTO_FAUCET_REQUEST: fund-deployer-from-env (boing_faucetRequest)…');
    const f = runNodeScript('fund-deployer-from-env.mjs', [], {});
    if (!f.ok) {
      console.error(f.stderr || f.stdout);
      process.exit(f.status ?? 1);
    }
    try {
      report.phases.preflightFaucet = parseDeployJson(f.stdout);
    } catch {
      report.phases.preflightFaucet = { stdout: f.stdout.trim() };
    }
  }

  let forcedSkipDump = false;
  if (!userSkipDump) {
    console.warn('[full-stack] dump-native-bytecodes…');
    const d = runNodeScript('dump-native-bytecodes.mjs', [], {});
    if (!d.ok) {
      console.error(d.stderr || d.stdout);
      process.exit(d.status ?? 1);
    }
    forcedSkipDump = true;
  }

  const childBase = forcedSkipDump ? { BOING_SKIP_DUMP: '1' } : {};

  /** @type {string | undefined} */
  let poolHex;
  /** @type {Record<string, unknown> | undefined} */
  let poolFactoryBundle;

  if (!skipPoolFactory) {
    console.warn('[full-stack] bootstrap-native-pool-and-dex (pool + factory)…');
    const b = runNodeScript('bootstrap-native-pool-and-dex.mjs', [], { ...childBase });
    if (!b.ok) {
      console.error(b.stderr || b.stdout);
      process.exit(b.status ?? 1);
    }
    let bootJson;
    try {
      bootJson = parseDeployJson(b.stdout);
    } catch (e) {
      console.error(b.stdout);
      throw e;
    }
    report.phases.poolFactory = bootJson;
    poolHex = bootJson?.pool?.predictedPoolHex;
    poolFactoryBundle = bootJson;
  } else {
    report.phases.poolFactory = { skipped: true };
    poolHex = process.env.BOING_WIRE_POOL_HEX?.trim() || process.env.BOING_POOL_HEX?.trim();
  }

  if (!skipRouters) {
    console.warn('[full-stack] deploy-native-dex-aux-contracts (routers)…');
    const a = runNodeScript('deploy-native-dex-aux-contracts.mjs', [], { ...childBase });
    if (!a.ok) {
      console.error(a.stderr || a.stdout);
      process.exit(a.status ?? 1);
    }
    try {
      report.phases.routers = parseDeployJson(a.stdout);
    } catch (e) {
      console.error(a.stdout);
      throw e;
    }
  } else {
    report.phases.routers = { skipped: true };
  }

  /** @type {string | undefined} */
  let vaultHex;
  /** @type {string | undefined} */
  let shareHex;

  if (!skipLp) {
    console.warn('[full-stack] deploy-native-dex-lp-aux-contracts (vault + share)…');
    const lp = runNodeScript('deploy-native-dex-lp-aux-contracts.mjs', [], { ...childBase });
    if (!lp.ok) {
      console.error(lp.stderr || lp.stdout);
      process.exit(lp.status ?? 1);
    }
    let lpJson;
    try {
      lpJson = parseDeployJson(lp.stdout);
    } catch (e) {
      console.error(lp.stdout);
      throw e;
    }
    report.phases.lpAux = lpJson;
    const amm = lpJson?.results?.ammLpVault;
    const sh = lpJson?.results?.lpShareToken;
    vaultHex =
      typeof amm === 'object' && amm && 'predictedContractHex' in amm
        ? String(amm.predictedContractHex)
        : undefined;
    shareHex =
      typeof sh === 'object' && sh && 'predictedContractHex' in sh
        ? String(sh.predictedContractHex)
        : undefined;
  } else {
    report.phases.lpAux = { skipped: true };
    vaultHex = process.env.BOING_WIRE_VAULT_HEX?.trim() || process.env.BOING_VAULT_HEX?.trim();
    shareHex =
      process.env.BOING_WIRE_SHARE_HEX?.trim() ||
      process.env.BOING_SHARE_HEX?.trim() ||
      process.env.BOING_LP_SHARE_HEX?.trim();
  }

  if (!skipWire) {
    const p = poolHex?.trim();
    const v = vaultHex?.trim();
    const s = shareHex?.trim();
    if (!p || !v || !s) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            phase: 'wire_precheck',
            error: 'missing_pool_vault_or_share_hex',
            poolHex: p ?? null,
            vaultHex: v ?? null,
            shareHex: s ?? null,
            hint: 'Run full deploy without skips, or set BOING_WIRE_POOL_HEX, BOING_WIRE_VAULT_HEX, BOING_WIRE_SHARE_HEX',
          },
          null,
          2
        )
      );
      process.exit(1);
    }

    console.warn('[full-stack] native-lp-share-submit set_minter_once (vault as minter)…');
    const minter = runNodeScript(
      'native-lp-share-submit-contract-call.mjs',
      [],
      {
        ...childBase,
        BOING_LP_SHARE_ACTION: 'set_minter_once',
        BOING_LP_SHARE_HEX: s,
        BOING_MINTER_HEX: v,
      }
    );
    if (!minter.ok) {
      console.error(minter.stderr || minter.stdout);
      process.exit(minter.status ?? 1);
    }
    try {
      report.phases.lpShareSetMinter = parseDeployJson(minter.stdout);
    } catch (e) {
      console.error(minter.stdout);
      throw e;
    }

    console.warn('[full-stack] native-amm-lp-vault-submit configure(pool, share)…');
    const cfg = runNodeScript(
      'native-amm-lp-vault-submit-contract-call.mjs',
      [],
      {
        ...childBase,
        BOING_LP_VAULT_ACTION: 'configure',
        BOING_VAULT_HEX: v,
        BOING_POOL_HEX: p,
        BOING_SHARE_HEX: s,
      }
    );
    if (!cfg.ok) {
      console.error(cfg.stderr || cfg.stdout);
      process.exit(cfg.status ?? 1);
    }
    try {
      report.phases.lpVaultConfigure = parseDeployJson(cfg.stdout);
    } catch (e) {
      console.error(cfg.stdout);
      throw e;
    }
  } else {
    report.phases.wire = { skipped: true };
  }

  report.summary = {
    poolHex: poolHex ?? null,
    vaultHex: vaultHex ?? null,
    shareHex: shareHex ?? null,
    registerPairSubmitted: Boolean(poolFactoryBundle?.dexDirectory?.register_tx_hash),
  };

  /** @type {string[]} */
  const warnings = [];
  if (poolFactoryBundle && typeof poolFactoryBundle === 'object' && poolFactoryBundle.pool) {
    const poolJ = poolFactoryBundle.pool;
    const dexJ = poolFactoryBundle.dexDirectory;
    if (poolJ && poolJ.create2 === false) {
      warnings.push(
        'Pool is at a nonce-derived AccountId (CREATE2 slot was occupied or USE_CREATE2=0). summary.poolHex does not match native_cp_pool_v1 in scripts/canonical-testnet-dex-predicted.json — use this JSON for routing and LP vault wiring.',
      );
    }
    if (dexJ && dexJ.create2 === false) {
      warnings.push(
        'DEX pair directory is nonce-derived; predictedFactoryHex does not match native_dex_factory in scripts/canonical-testnet-dex-predicted.json.',
      );
    }
  }
  if (warnings.length > 0) {
    report.warnings = warnings;
  }

  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
