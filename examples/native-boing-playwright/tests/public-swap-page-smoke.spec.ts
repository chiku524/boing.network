/**
 * Headless Chromium — no extension. Verifies the public swap URL loads over the network.
 * For full Boing Express + panel flows see native-amm-smoke.spec.ts.
 */
import { test, expect } from '@playwright/test';

const swapUrl =
  process.env.BOING_E2E_SWAP_URL?.trim() || 'https://boing.finance/swap';
const requireNativePanel =
  process.env.BOING_E2E_REQUIRE_NATIVE_PANEL === '1' ||
  process.env.BOING_E2E_REQUIRE_NATIVE_PANEL === 'true';

test.describe('Public swap page (headless)', () => {
  test('swap URL responds and renders document', async ({ page }) => {
    const response = await page.goto(swapUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(response, 'navigation should return a response').toBeTruthy();
    expect(response!.ok(), `expected HTTP success, got ${response!.status()}`).toBe(
      true
    );

    await expect(page.locator('body')).toBeVisible();
    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('optional: native AMM panel test id when BOING_E2E_REQUIRE_NATIVE_PANEL=1', async ({
    page,
  }) => {
    test.skip(!requireNativePanel, 'set BOING_E2E_REQUIRE_NATIVE_PANEL=1 to enable');

    await page.goto(swapUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    const panel = page.getByTestId('native-amm-panel');
    await expect(panel).toBeVisible({ timeout: 30_000 });
  });
});
