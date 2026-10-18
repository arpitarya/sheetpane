// One runner, two kinds of project (testing verdict decisions 1–2, 11):
// Node for @sheetpane/export and the repo-level checks; a real browser for
// every package that touches the DOM. SP_BROWSERS picks the engines
// (chromium per push; chromium,firefox,webkit nightly).
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { armDownload, takeDownload } from './test/commands.ts';

const browsers = (process.env.SP_BROWSERS ?? 'chromium').split(',') as ('chromium' | 'firefox' | 'webkit')[];
const resolve = { conditions: ['source'] };
// Workbook fixtures load in browser tests as assets (`?inline` data URLs).
const assetsInclude = ['**/*.xlsx', '**/*.csv'];
const browserPackages = ['export-browser', 'import', 'grid', 'numfmt', 'formulas', 'styles', 'validation', 'condfmt', 'images', 'charts', 'comments'];

export default defineConfig({
  resolve,
  assetsInclude,
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: { 'packages/export/src/**': { lines: 90 } },
    },
    projects: [
      { resolve, test: { name: 'repo', include: ['test/**/*.test.ts'], environment: 'node' } },
      { resolve, test: { name: 'export', include: ['packages/export/test/**/*.test.ts'], exclude: ['**/*.browser.test.ts'], environment: 'node' } },
      ...browserPackages.map((name) => ({
        resolve,
        assetsInclude,
        test: {
          name,
          include: name === 'export-browser' ? ['packages/export/test/**/*.browser.test.ts'] : [`packages/${name}/test/**/*.test.ts`],
          passWithNoTests: true,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            commands: { armDownload, takeDownload },
            instances: browsers.map((browser) => ({ browser })),
          },
        },
      })),
    ],
  },
});
