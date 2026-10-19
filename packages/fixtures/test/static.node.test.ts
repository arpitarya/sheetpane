// W-67 DoD 2, the Node side: every case loaded with `loadWorkbook()` and the plugins a host would
// give, the one edit made, then every sheet rendered by `renderStatic()` in both themes. The result
// equals golden/static.json — which `static.test.ts` holds the browser's render to, after checking
// it cell by cell against the grid's computed styles. `UPDATE_GOLDEN=1` rewrites the golden.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorkbook, renderStatic } from '@sheetpane/grid/static';
import { validation } from '@sheetpane/validation/check';
import { comments } from '@sheetpane/comments';
import { condfmt } from '@sheetpane/condfmt';
import { numfmt } from '@sheetpane/numfmt';
import { styles } from '@sheetpane/styles';
import { edit, staticCases, type Rendered } from './static.js';

const GOLDEN = join(import.meta.dirname, 'golden', 'static.json');
const turn = () => new Promise<void>((r) => setTimeout(r, 0));

describe('renderStatic() in Node draws what the browser was checked against (W-67 DoD 2)', () => {
  it('every sheet of every case, light and dark, equals the golden', async () => {
    const got: Rendered = {};
    for (const c of await staticCases()) {
      const book = await loadWorkbook(await c.data(), { name: c.name, rules: c.rules, plugins: [numfmt(), styles(), condfmt(), validation(), comments()] });
      edit(c.id, book);
      for (let i = 0; i < 3; i++) { while (book.ruleProgress !== undefined) await turn(); await turn(); }
      for (const s of book.book!.sheets) for (const theme of ['light', 'dark'] as const) got[`${c.id}|${s.name}|${theme}`] = renderStatic(book, { sheet: s.name, theme });
    }
    if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(got, null, 2) + '\n');
    expect(got).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')));
    // not vacuous: marks, a merge, a stale and a changed cell, a decorate fill, a hidden row or column left out
    const all = Object.values(got).join('');
    for (const s of ['data-sp-mark="error"', 'data-sp-mark="warning"', 'data-sp-mark="note"', 'colspan=', 'data-sp-stale', 'data-sp-changed', 'data-sp-badge', 'linear-gradient(90deg']) expect(all, s).toContain(s);
    expect(all).not.toMatch(/<script|font-family|url\(|\bon\w+=|class=/i);
  }, 60_000);
});
