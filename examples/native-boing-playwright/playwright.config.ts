import { defineConfig } from '@playwright/test';

/**
 * - **extension**: headed persistent context in spec (Boing Express).
 * - **public**: headless load of the public swap URL (no extension).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  projects: [
    {
      name: 'extension',
      testMatch: /native-amm-smoke\.spec\.ts$/,
    },
    {
      name: 'public',
      testMatch: /public-swap-page-smoke\.spec\.ts$/,
      timeout: 90_000,
      retries: 2,
      use: {
        headless: true,
      },
    },
  ],
});
