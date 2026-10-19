// Rewrites test/durations.json — each test file's wall time — from a Vitest JSON report, so CI's
// shards stay balanced (vitest.config.ts, SR-BUILD decision 8). Usage (or `just test-durations`):
//   pnpm exec vitest run --reporter=json --outputFile=.vitest/report.json
//   node scripts/test-durations.mjs .vitest/report.json
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const report = JSON.parse(readFileSync(process.argv[2] ?? '.vitest/report.json', 'utf8'));
const out = {};
for (const r of report.testResults ?? []) {
  const key = relative(root, r.name).split(sep).join('/');
  out[key] = Math.max(out[key] ?? 0, Math.round(r.endTime - r.startTime));
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
writeFileSync(new URL('../test/durations.json', import.meta.url), JSON.stringify(sorted, null, 2) + '\n');
console.log(`test/durations.json: ${Object.keys(sorted).length} files, ${Math.round(Object.values(sorted).reduce((s, x) => s + x, 0) / 1000)} s in all`);
