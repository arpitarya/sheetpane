// W-54 DoD 3, the Node side: every case through `check()` from `@sheetpane/grid/check`, with the
// plugins a host would give, equals golden/parity.json — which `parity.test.ts` holds the pane in
// a real browser to. `UPDATE_GOLDEN=1` rewrites the golden from Node; review the diff, then run the
// browser side: both passing is the parity.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { check } from '@sheetpane/grid/check';
import { validation } from '@sheetpane/validation/check';
import { comments } from '@sheetpane/comments';
import { formulas } from '@sheetpane/formulas';
import { numfmt } from '@sheetpane/numfmt';
import { cases, outcome, validate, type Outcome } from './parity.js';

const GOLDEN = join(import.meta.dirname, 'golden', 'parity.json');
// In Node the formula engine's .wasm is read from disk: the default (beside wasm.js) is a URL fetch
const engine = join(dirname(createRequire(join(import.meta.dirname, '../../formulas/package.json')).resolve('@ironcalc/wasm')), 'wasm_bg.wasm');
const wasm = readFileSync(engine);

describe('check() in Node gives what the pane gives (W-54 DoD 3)', () => {
  it('every fixture, and 20,000 generated rows, equal the golden', async () => {
    const got: Record<string, Outcome> = {};
    for (const c of await cases()) {
      try {
        const errors = await check(await c.data(), { name: c.name, rules: c.rules, columns: c.columns, validate, plugins: [numfmt(), validation(), comments(), formulas({ wasm })] });
        got[c.id] = outcome(errors);
      } catch (e) {
        got[c.id] = { refused: (e as { spCode?: string }).spCode ?? String(e) };
      }
    }
    if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(got, null, 2) + '\n');
    expect(got).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')));
    // not vacuous: the rules, the async validate and every checking plugin each found something
    const all = Object.values(got).flatMap((o) => ('errors' in o ? o.errors : []));
    for (const t of ['column-rule', 'cell-rule', 'validation', 'comment']) expect(all.some((e) => e.type === t), t).toBe(true);
    expect(all.some((e) => e.message.endsWith('still to be decided'))).toBe(true);
    expect(Object.values(got).filter((o) => 'refused' in o)).toHaveLength(2);
  }, 120_000);

  it('check() returns its errors in one order: sheet, row, column', async () => {
    const c = (await cases()).find((x) => x.id === 'showcase.xlsx')!;
    const errors = await check(await c.data(), { name: c.name, rules: c.rules, columns: c.columns, validate, plugins: [validation()] });
    const sheets = ['Numbers', 'Styles', 'Formulas', 'Validation', 'CondFmt', 'Images', 'Charts', 'Comments'];
    const pos = errors.map((e) => { const m = /^([A-Z]+)(\d+)/.exec(e.range)!; return [sheets.indexOf(e.sheet), Number(m[2]), m[1]!.length, m[1]!] as const; });
    expect(pos.length).toBeGreaterThan(3);
    for (let i = 1; i < pos.length; i++) {
      const [a, b] = [pos[i - 1]!, pos[i]!];
      expect(a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && (a[2] < b[2] || (a[2] === b[2] && a[3] <= b[3])))))).toBe(true);
    }
  });
});
