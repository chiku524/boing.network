/**
 * Load `KEY=value` pairs from a `.env` file into `process.env` without overriding existing keys.
 * Supports optional double/single quotes around values. No dependency on `dotenv`.
 */
import { existsSync, readFileSync } from 'node:fs';

/**
 * @param {string} absPath
 */
export function loadDotEnvFile(absPath) {
  if (!existsSync(absPath)) {
    return { loaded: false, path: absPath };
  }
  const text = readFileSync(absPath, 'utf8');
  let n = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key.startsWith('#')) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] !== undefined) continue;
    process.env[key] = val;
    n += 1;
  }
  return { loaded: true, path: absPath, appliedPairs: n };
}
