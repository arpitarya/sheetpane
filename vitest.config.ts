// One runner, two kinds of project (testing verdict decisions 1–2, 11):
// Node for @sheetpane/export and the repo-level checks; a real browser for
// every package that touches the DOM. SP_BROWSERS picks the engines
// (chromium per push; chromium,firefox,webkit nightly).
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const browsers = (process.env.SP_BROWSERS ?? 'chromium').split(',') as ('chromium' | 'firefox' | 'webkit')[];
const resolve = { conditions: ['source'] };
const browserPackages = ['import', 'grid', 'numfmt', 'formulas', 'styles', 'validation', 'condfmt', 'images', 'charts', 'comments'];

export default defineConfig({
  resolve,
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: { 'packages/export/src/**': { lines: 90 } },
    },
    projects: [
      { resolve, test: { name: 'repo', include: ['test/**/*.test.ts'], environment: 'node' } },
      { resolve, test: { name: 'export', include: ['packages/export/test/**/*.test.ts'], environment: 'node' } },
      ...browserPackages.map((name) => ({
        resolve,
        test: {
          name,
          include: [`packages/${name}/test/**/*.test.ts`],
          passWithNoTests: true,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: browsers.map((browser) => ({ browser })),
          },
        },
      })),
    ],
  },
});
