#!/usr/bin/env node
/**
 * One script: native CP pool + DEX factory/directory → routers (swap2, ledger v2/v3) → LP vault + LP share
 * → on-chain wiring (`set_minter_once` + vault `configure`) → **kickstart liquidity** (vault `deposit_add` when
 * vault+share exist, otherwise direct pool `add_liquidity` if LP phases were skipped). Configuration and secrets
 * come from **`.env`** in the tutorial package root (loaded first; does not override variables already set in the shell).
 *
 * **Operator RPC flow:** run against a node (or testnet RPC) that is producing blocks — not inside `boing-node`.
 * For a fresh private network use **`BOING_AUTO_FAUCET_REQUEST=1`** so the deployer account exists before simulates.
 *
 * Prerequisites: same as `bootstrap-native-pool-and-dex.mjs` + aux + LP aux (cargo dump examples, funded key).
 *
 * **`.env`** (copy from `.env.example`): at minimum **`BOING_SECRET_HEX`**. See `.env.example` for toggles and
 * forwarded vars (`BOING_RPC_URL`, `BOING_BOOTSTRAP_REGISTER_PAIR`, router/LP skips, etc.).
 *
 * **Pair registration:** If **`BOING_BOOTSTRAP_REGISTER_PAIR`** is unset, this script passes **`1`** to bootstrap
 * only (synthetic token ids unless `BOING_DEX_TOKEN_A_HEX` / `BOING_DEX_TOKEN_B_HEX` are set). Set
 * **`BOING_BOOTSTRAP_REGISTER_PAIR=0`** to skip `register_pair`.
 *
 * **Kickstart reserves:** After wire, **`native-amm-lp-vault-submit-contract-call`** runs with **`deposit_add`**
 * using **`BOING_KICKSTART_AMOUNT_A`** / **`BOING_KICKSTART_AMOUNT_B`** (defaults `1000000` / `2000000`).
 * Skip with **`BOING_FULL_STACK_SKIP_SEED=1`**. If LP was skipped, uses **`native-amm-submit-contract-call`**
 * **`add_liquidity`** on the pool only (set token envs for native AMM v2 access lists if required).
 *
 * Phase skips (set `1` or `true`):
 *   BOING_FULL_STACK_SKIP_POOL_FACTORY — skip pool + factory bootstrap
 *   BOING_FULL_STACK_SKIP_ROUTERS     — skip swap2 + ledger v2/v3 (+ optional ledger v1)
 *   BOING_FULL_STACK_SKIP_LP          — skip LP vault + share token deploys
 *   BOING_FULL_STACK_SKIP_WIRE        — skip share `set_minter_once` + vault `configure`
 *   BOING_FULL_STACK_SKIP_SEED        — skip kickstart liquidity
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
const skipSeed = truthy('BOING_FULL_STACK_SKIP_SEED');

const userSkipDump = truthy('BOING_SKIP_DUMP');

/**
 * Default `register_pair` on for full-stack when operator did not set it (fresh devnet kickstart).
 * Set `BOING_BOOTSTRAP_REGISTER_PAIR=0` in `.env` to disable.
 */
function bootstrapChildEnv(base) {
  const out = { ...base };
  if (process.env.BOING_BOOTSTRAP_REGISTER_PAIR === undefined) {
    out.BOING_BOOTSTRAP_REGISTER_PAIR = '1';
  }
  return out;
}

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
    const b = runNodeScript('bootstrap-native-pool-and-dex.mjs', [], bootstrapChildEnv(childBase));
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

  const pFinal = (poolHex ?? process.env.BOING_WIRE_POOL_HEX ?? process.env.BOING_POOL_HEX)?.trim();
  const vFinal = (vaultHex ?? process.env.BOING_WIRE_VAULT_HEX ?? process.env.BOING_VAULT_HEX)?.trim();
  const sFinal = (
    shareHex ??
    process.env.BOING_WIRE_SHARE_HEX ??
    process.env.BOING_SHARE_HEX ??
    process.env.BOING_LP_SHARE_HEX
  )?.trim();

  if (!skipSeed && pFinal) {
    const amountA = (process.env.BOING_KICKSTART_AMOUNT_A ?? process.env.BOING_AMOUNT_A ?? '1000000').trim();
    const amountB = (process.env.BOING_KICKSTART_AMOUNT_B ?? process.env.BOING_AMOUNT_B ?? '2000000').trim();

    if (vFinal && sFinal) {
      console.warn(
        `[full-stack] native-amm-lp-vault-submit deposit_add (kickstart reserves via vault; A=${amountA} B=${amountB})…`
      );
      const dep = runNodeScript(
        'native-amm-lp-vault-submit-contract-call.mjs',
        [],
        {
          ...childBase,
          BOING_LP_VAULT_ACTION: 'deposit_add',
          BOING_VAULT_HEX: vFinal,
          BOING_POOL_HEX: pFinal,
          BOING_SHARE_HEX: sFinal,
          BOING_AMOUNT_A: amountA,
          BOING_AMOUNT_B: amountB,
          BOING_MIN_LIQUIDITY: process.env.BOING_MIN_LIQUIDITY ?? '0',
          BOING_VAULT_MIN_LP: process.env.BOING_VAULT_MIN_LP ?? '0',
        }
      );
      if (!dep.ok) {
        console.error(dep.stderr || dep.stdout);
        process.exit(dep.status ?? 1);
      }
      try {
        report.phases.kickstartLiquidity = parseDeployJson(dep.stdout);
      } catch (e) {
        console.error(dep.stdout);
        throw e;
      }
    } else if (!skipLp) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            phase: 'kickstart_liquidity',
            error: 'missing_vault_or_share_for_deposit_add',
            hint: 'Kickstart expects LP vault + share after wire. Set BOING_FULL_STACK_SKIP_SEED=1, or deploy LP + wire, or supply BOING_WIRE_VAULT_HEX / BOING_WIRE_SHARE_HEX.',
          },
          null,
          2
        )
      );
      process.exit(1);
    } else {
      console.warn(
        `[full-stack] native-amm-submit-contract-call add_liquidity (pool-only kickstart; A=${amountA} B=${amountB})…`
      );
      const ta = process.env.BOING_DEX_TOKEN_A_HEX?.trim() || process.env.BOING_TOKEN_A_HEX?.trim();
      const tb = process.env.BOING_DEX_TOKEN_B_HEX?.trim() || process.env.BOING_TOKEN_B_HEX?.trim();
      const poolAddEnv = {
        ...childBase,
        BOING_NATIVE_AMM_ACTION: 'add_liquidity',
        BOING_POOL_HEX: pFinal,
        BOING_AMOUNT_A: amountA,
        BOING_AMOUNT_B: amountB,
        BOING_MIN_LIQUIDITY: process.env.BOING_MIN_LIQUIDITY ?? '0',
        ...(ta ? { BOING_TOKEN_A_HEX: ta } : {}),
        ...(tb ? { BOING_TOKEN_B_HEX: tb } : {}),
      };
      const add = runNodeScript('native-amm-submit-contract-call.mjs', [], poolAddEnv);
      if (!add.ok) {
        console.error(add.stderr || add.stdout);
        process.exit(add.status ?? 1);
      }
      try {
        report.phases.kickstartLiquidity = parseDeployJson(add.stdout);
      } catch (e) {
        console.error(add.stdout);
        throw e;
      }
    }
  } else if (skipSeed) {
    report.phases.kickstartLiquidity = { skipped: true };
  }

  let kickstartSummary = 'not_run';
  if (skipSeed) kickstartSummary = 'skipped';
  else if (report.phases.kickstartLiquidity && report.phases.kickstartLiquidity.skipped !== true) {
    kickstartSummary = 'completed';
  }

  report.summary = {
    poolHex: poolHex ?? null,
    vaultHex: vaultHex ?? null,
    shareHex: shareHex ?? null,
    registerPairSubmitted: Boolean(poolFactoryBundle?.dexDirectory?.register_tx_hash),
    kickstartLiquidity: kickstartSummary,
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
