// Playwright runs e2e/ against the built app (`__SHEETPANE_RUN__ preview`), in Chromium.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: '__SHEETPANE_URL__', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: '__SHEETPANE_RUN__ preview', url: '__SHEETPANE_URL__', reuseExistingServer: !process.env.CI, timeout: 180_000 },
});
