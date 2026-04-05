#!/usr/bin/env node
/**
 * Regenerates `defaultReferenceFungibleTemplateBytecodeHex.ts` from
 * `cargo run -p boing-execution --example dump_reference_token_artifacts` (2nd 0x line).
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'defaultReferenceFungibleTemplateBytecodeHex.ts');

const raw = execFileSync(
  'cargo',
  ['run', '-q', '-p', 'boing-execution', '--example', 'dump_reference_token_artifacts'],
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
const lines = raw.split('\n').filter((l) => l.startsWith('0x'));
const hex = lines[1]?.trim();
if (!hex?.startsWith('0x')) {
  throw new Error('expected second stdout line starting with 0x (fungible template)');
}

const ts =
  '/**\n' +
  ' * Pinned `reference_fungible_template_bytecode()` from `boing-execution`.\n' +
  ' * Regenerate: `node boing-sdk/scripts/embed-reference-fungible-template-hex.mjs`\n' +
  ' */\n' +
  `export const DEFAULT_REFERENCE_FUNGIBLE_TEMPLATE_BYTECODE_HEX = \`${hex}\` as const;\n`;

writeFileSync(out, ts, 'utf8');
console.log('wrote', out);
