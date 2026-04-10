/**
 * Extract and parse the first top-level `{ ... }` from mixed script stdout.
 * Replaces the unsafe `lastIndexOf('{')` pattern, which breaks on nested JSON (e.g. bootstrap output).
 */

/**
 * @param {string} s
 * @returns {string | null}
 */
export function extractFirstJsonObjectString(s) {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * @param {string} stdout
 * @returns {unknown}
 */
export function parseScriptStdoutJson(stdout) {
  const t = stdout.trim();
  const jsonStr = extractFirstJsonObjectString(t);
  if (!jsonStr) {
    throw new Error('No JSON object in script stdout');
  }
  return JSON.parse(jsonStr);
}
