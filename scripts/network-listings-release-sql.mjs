#!/usr/bin/env node
/**
 * Thin wrapper: run from repo root. Implementation lives in website/scripts/.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(here);
const script = join(repoRoot, 'website', 'scripts', 'network-listings-release-sql.mjs');
const r = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
