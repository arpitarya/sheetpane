// One runner, two kinds of project (testing verdict decisions 1–2, 11):
// Node for @sheetpane/export and the repo-level checks; a real browser for
// every package that touches the DOM. SP_BROWSERS picks the engines
// (chromium per push; chromium,firefox,webkit nightly).
import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { playwright } from '@vitest/browser-playwright';
import { armDownload, takeDownload } from './test/commands.ts';

const browsers = (process.env.SP_BROWSERS ?? 'chromium').split(',') as ('chromium' | 'firefox' | 'webkit')[];
// Wall-clock budgets (frame gaps, pixels scrolled in 5 s) hold on a developer machine; on a
// shared CI runner (`CI` set) they are reported, not asserted — `budgets` in the grid's test helpers.
const provide = { timingBudgets: !process.env.CI };

// CI runs the suite in `--shard=k/n` jobs. Vitest's own shards split by path hash (one got 80 s,
// another 9 s); these balance by measured time — the longest file first, each into the lightest
// shard. test/durations.json is refreshed by `just test-durations`; a file not in it counts 1 s.
const durations: Record<string, number> = JSON.parse(readFileSync(new URL('./test/durations.json', import.meta.url), 'utf8'));
class BalancedSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { index, count } = this.ctx.config.shard!;
    const key = (s: TestSpecification) => relative(this.ctx.config.root, s.moduleId).split(sep).join('/');
    const ms = (s: TestSpecification) => durations[key(s)] ?? 1000;
    const id = (s: TestSpecification) => `${s.project.name} ${key(s)}`;
    const bins = Array.from({ length: count }, () => ({ ms: 0, files: [] as TestSpecification[] }));
    for (const f of [...files].sort((a, b) => ms(b) - ms(a) || (id(a) < id(b) ? -1 : 1))) {
      const bin = bins.reduce((min, b) => (b.ms < min.ms ? b : min));
      bin.ms += ms(f);
      bin.files.push(f);
    }
    return bins[index - 1]!.files;
  }
}
const resolve = { conditions: ['source'] };
// Node projects resolve through Vite's SSR environment, which needs the condition too.
const ssr = { resolve: { conditions: ['source'], externalConditions: ['source'] } };
// Workbook fixtures load in browser tests as assets (`?inline` data URLs).
const assetsInclude = ['**/*.xlsx', '**/*.csv'];
const browserPackages = ['export-browser', 'import', 'grid', 'numfmt', 'formulas', 'styles', 'validation', 'condfmt', 'images', 'charts', 'comments', 'visibility', 'tables', 'fixtures', 'testing'];
// the React hook recipes (W-28) run against the demo's own React 19
const testDirs: Record<string, string> = { 'export-browser': 'packages/export/test/**/*.browser.test.ts', 'react-recipes': 'examples/react/test/**/*.test.ts' };

export default defineConfig({
  resolve,
  assetsInclude,
  test: {
    sequence: { sequencer: BalancedSequencer },
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: { 'packages/export/src/**': { lines: 90 } },
    },
    projects: [
      { resolve, ssr, test: { name: 'repo', include: ['test/**/*.test.ts'], environment: 'node' } },
      { resolve, ssr, test: { name: 'export', include: ['packages/export/test/**/*.test.ts'], exclude: ['**/*.browser.test.ts'], environment: 'node' } },
      // a package's Node-only checks (`*.node.test.ts`), e.g. @sheetpane/fixtures' path() and bytes() from disk
      { resolve, ssr, test: { name: 'node', include: ['packages/*/test/**/*.node.test.ts'], environment: 'node' } },
      ...[...browserPackages, 'react-recipes'].map((name) => ({
        resolve,
        assetsInclude,
        test: {
          name,
          include: [testDirs[name] ?? `packages/${name}/test/**/*.test.ts`],
          exclude: ['**/*.node.test.ts', '**/node_modules/**'],
          passWithNoTests: true,
          provide,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            commands: { armDownload, takeDownload },
            instances: browsers.map((browser) => ({ browser, viewport: { width: 1280, height: 800 } })),
          },
        },
      })),
    ],
  },
});
