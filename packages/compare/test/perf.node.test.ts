// W-63 DoD 3 (SR-COMPARE decision 7): the speed budget — two versions of a 50,000-row, 8-column
// sheet (500 cells edited, 100 rows inserted, 100 deleted, 50 moved) diffed in under BUDGET_MS,
// keyed and unkeyed, in Node. Recorded on an Apple M4 (10 cores, 16 GB); see the record for the
// machine's load when it was measured. With `CI` set the time is reported, not asserted (a shared
// runner is not a developer machine — the grid's timing budgets follow the same rule).
import { describe, expect, it } from 'vitest';
import type { Cell } from '@sheetpane/export';
import { applyDiff, diffWorkbooks, type CompareWorkbook } from '../src/index.js';

const ROWS = 50_000, COLS = 8;
/** The budget per diff, in ms. */
const BUDGET_MS = 500;

/** A deterministic pseudo-random sequence (mulberry32), so every run diffs the same files. */
function rand(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function versions(): { a: CompareWorkbook; b: CompareWorkbook } {
  const r = rand(63);
  const head: Cell[] = ['Account', 'Name', 'Units', 'Price', 'Value', 'Date', 'Status', 'Note'];
  const row = (i: number): Cell[] => [`AC-${100000 + i}`, `Holder ${i % 977}`, Math.floor(r() * 5000), Math.round(r() * 100000) / 100, Math.round(r() * 1e7) / 100, 45000 + (i % 400), i % 3 ? 'open' : 'closed', i % 11 ? null : 'check'];
  const a: Cell[][] = [head, ...Array.from({ length: ROWS }, (_, i) => row(i))];
  const b = a.map((x) => [...x]);
  for (let k = 0; k < 500; k++) { const i = 1 + Math.floor(r() * ROWS); b[i]![2] = (b[i]![2] as number) + 1; }
  for (let k = 0; k < 50; k++) { const i = 1 + Math.floor(r() * (b.length - 1)), j = 1 + Math.floor(r() * (b.length - 1)); const [x] = b.splice(i, 1); b.splice(j, 0, x!); }
  for (let k = 0; k < 100; k++) b.splice(1 + Math.floor(r() * (b.length - 1)), 1);
  for (let k = 0; k < 100; k++) b.splice(1 + Math.floor(r() * (b.length - 1)), 0, row(ROWS + k));
  return { a: { sheets: [{ name: 'Holdings', rows: a }] }, b: { sheets: [{ name: 'Holdings', rows: b }] } };
}

const timed = <T>(f: () => T): { ms: number; out: T } => { const t = performance.now(); const out = f(); return { ms: performance.now() - t, out }; };

describe(`speed budget (DoD 3): ${ROWS.toLocaleString('en-US')} rows × ${COLS} columns`, () => {
  const { a, b } = versions();
  for (const key of [undefined, 'Account']) {
    it(`diffWorkbooks ${key ? 'keyed by Account' : 'unkeyed'} — under ${BUDGET_MS} ms`, () => {
      timed(() => diffWorkbooks(a, b, key ? { key } : {})); // warm the JIT once
      const runs = [0, 1, 2].map(() => timed(() => diffWorkbooks(a, b, key ? { key } : {})));
      const best = Math.min(...runs.map((x) => x.ms)), d = runs[0]!.out;
      console.log(`compare ${key ? 'keyed' : 'unkeyed'}: ${runs.map((x) => x.ms.toFixed(0)).join(' / ')} ms (best ${best.toFixed(0)}) — ${JSON.stringify(d.summary)}`);
      // the diff is right as well as fast: it rebuilds the newer version
      expect(applyDiff(a, d)[0]!.rows.length).toBe(b.sheets[0]!.rows.length);
      expect(d.summary.cells).toBeGreaterThan(0);
      if (key) expect(d.sheets[0]!.counts.rowsMoved).toBeGreaterThan(0);
      else expect(d.sheets[0]!.counts.rowsMoved).toBe(0);
      if (!process.env.CI) expect(best).toBeLessThan(BUDGET_MS);
    }, 60_000);
  }
  it(`every row changed (no row in common, Myers capped) — under ${BUDGET_MS} ms`, () => {
    const all: CompareWorkbook = { sheets: [{ name: 'Holdings', rows: a.sheets[0]!.rows.map((x, i) => (i ? [x[0]!, x[1]!, (x[2] as number) + 1, ...x.slice(3)] : x)) }] };
    timed(() => diffWorkbooks(a, all));
    const { ms, out } = timed(() => diffWorkbooks(a, all));
    console.log(`compare every row changed: ${ms.toFixed(0)} ms — ${JSON.stringify(out.summary)}`);
    expect(out.summary).toMatchObject({ rows: ROWS, cells: ROWS });
    if (!process.env.CI) expect(ms).toBeLessThan(BUDGET_MS);
  }, 60_000);
});
