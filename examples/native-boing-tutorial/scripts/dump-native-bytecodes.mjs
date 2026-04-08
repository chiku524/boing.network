#!/usr/bin/env node
/**
 * Regenerate native CP pool + native DEX factory bytecode hex files under `artifacts/`.
 *
 * Runs `cargo` from the monorepo root (three levels above this file). Requires Rust toolchain.
 *
 * Output:
 *   artifacts/pool-lines.hex          — stdout of dump_native_amm_pool (one 0x line per pool variant v1–v5)
 *   artifacts/pool-dump-meta.txt      — stderr (byte sizes / labels)
 *   artifacts/native-dex-factory.hex  — single-line 0x bytecode for the pair directory
 *
 * Env:
 *   BOING_CARGO — override cargo binary (default `cargo`)
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cargoBin = process.env.BOING_CARGO ?? 'cargo';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const tutorialRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(tutorialRoot, '..', '..');
const artifactsDir = path.join(tutorialRoot, 'artifacts');

function runCargoExample(example) {
  const r = spawnSync(
    cargoBin,
    ['run', '-q', '-p', 'boing-execution', '--example', example],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  if (r.error) {
    console.error(String(r.error));
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || `cargo exited ${r.status}`);
    process.exit(r.status ?? 1);
  }
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

mkdirSync(artifactsDir, { recursive: true });

const pool = runCargoExample('dump_native_amm_pool');
writeFileSync(path.join(artifactsDir, 'pool-lines.hex'), pool.stdout, 'utf8');
writeFileSync(path.join(artifactsDir, 'pool-dump-meta.txt'), pool.stderr, 'utf8');

const factory = runCargoExample('dump_native_dex_factory');
const factoryLine =
  factory.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith('0x')) ?? factory.stdout.trim();
writeFileSync(path.join(artifactsDir, 'native-dex-factory.hex'), `${factoryLine}\n`, 'utf8');

console.log(
  JSON.stringify(
    {
      ok: true,
      repoRoot,
      wrote: {
        poolLines: path.join('artifacts', 'pool-lines.hex'),
        poolMeta: path.join('artifacts', 'pool-dump-meta.txt'),
        dexFactory: path.join('artifacts', 'native-dex-factory.hex'),
      },
      hint: 'Use BOING_NATIVE_AMM_BYTECODE_FILE=artifacts/pool-lines.hex (v1=line 0, v2=line 1) and BOING_DEX_FACTORY_BYTECODE_FILE=artifacts/native-dex-factory.hex',
    },
    null,
    2
  )
);
