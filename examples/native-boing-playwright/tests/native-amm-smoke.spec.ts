/**
 * Headed Chrome + unpacked Boing Express. Requires operator attention to unlock the wallet
 * after the window opens (see README).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test, expect, chromium, type BrowserContext } from '@playwright/test';

function resolveExtensionDir(): string | null {
  const raw = process.env.BOING_EXPRESS_EXTENSION_PATH?.trim();
  if (!raw) return null;
  const abs = path.resolve(raw);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    return null;
  }
  return abs;
}

const extensionDir = resolveExtensionDir();
const swapUrl =
  process.env.BOING_E2E_SWAP_URL?.trim() || 'https://boing.finance/swap';
const panelUnlockMs = Number(process.env.BOING_E2E_PANEL_TIMEOUT_MS ?? '120000');
const pauseAfterGoto = process.env.BOING_E2E_PAUSE === '1' || process.env.BOING_E2E_PAUSE === 'true';

test.describe.serial('Boing Express + native AMM panel', () => {
  let context: BrowserContext | undefined;

  test.beforeAll(async () => {
    if (!extensionDir) {
      test.skip(
        true,
        'Set BOING_EXPRESS_EXTENSION_PATH to an existing unpacked Boing Express extension directory (see README).'
      );
      return;
    }
    const userDataDir = path.join(
      os.tmpdir(),
      `boing-native-amm-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: false,
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
      ],
    });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('native AMM panel visible and Refresh reserves responds', async () => {
    if (!context) {
      throw new Error('Browser context not started');
    }
    const page = await context.newPage();
    test.setTimeout(Math.max(panelUnlockMs + 120_000, 180_000));

    await page.goto(swapUrl, { waitUntil: 'domcontentloaded' });

    if (pauseAfterGoto) {
      // eslint-disable-next-line no-console
      console.log(
        'BOING_E2E_PAUSE: connect wallet / unlock in the browser, then resume in Playwright inspector.'
      );
      await page.pause();
    }

    const panel = page.getByTestId('native-amm-panel');
    await expect(panel).toBeVisible({ timeout: panelUnlockMs });

    const refresh = page.getByRole('button', { name: /refresh reserves/i });
    await expect(refresh).toBeVisible();
    await refresh.click();

    await expect(panel).toBeVisible();
    await page.close();
  });
});
