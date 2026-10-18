# @sheetpane/testing

**Test helpers for apps that embed sheetpane — Playwright and Vitest browser mode, one API.**

```ts
// Playwright
import { sheetpane } from '@sheetpane/testing/playwright';
import { matchers } from '@sheetpane/testing';
expect.extend(matchers);

test('a reviewer edits and downloads', async ({ page }) => {
  await page.goto('/review');
  const sp = sheetpane(page);                       // the first <sheetpane-excel>, or { excel: 'css' }
  await sp.waitForLoad();
  await sp.edit({ column: 'Units', row: 4 }, '42');  // by title and row, or 'Sheet1!B4'
  await sp.flag('B5', { expected: '101.20', message: 'Stale price' });
  expect(await sp.errors()).toHaveError({ ref: 'B5', status: 'open' });
  expect(await sp.readDownload()).toHaveCell('Sheet1!F4', 42);
});
```

```ts
// Vitest browser mode: the same API on the element
import { sheetpane } from '@sheetpane/testing/dom';
const sp = sheetpane(document.querySelector('sheetpane-excel')!);
```

| helper | does |
|---|---|
| `waitForLoad()` | until `sheetpane-load` (ready) and the rule checks have finished |
| `ref(at)`, `select(at)`, `value(at)`, `text(at)` | a cell by `B3`, `Sheet1!B3` or `{ column, row }` (the title from `header-row`) |
| `edit(at, text)`, `paste(at, rows)`, `undo()`, `switchSheet(name)` | as a person would: the cell bar, a paste, the toolbar, the tabs |
| `flag(at, { type, severity, message, expected })`, `resolve(at \| index)` | the form in `<sheetpane-errors>` (or inline when none is connected) |
| `download()`, `readDownload()` | presses Download; the file, or its values |
| `readFile(bytes, name)`, `changesBetween(a, b)`, `valueAt(book, 'Sheet1!B2')` | `.xlsx` / `.csv` as values — in Node too (no DOM needed) |
| `matchers.toHaveCell`, `matchers.toHaveError` | for `expect.extend` (Vitest and Playwright) |

The helpers find things only by roles, labels and the grid's committed
`data-sp-*` hooks (SR-GRID decision 9a), never CSS classes — so a host's tests
survive restyling. Known files to test with: `@sheetpane/fixtures`.

The spec is the record [SR-TESTING](../../records/0118_TESTING.md).

**Using an AI coding agent?** `npx sheetpane-skills install` puts sheetpane's skills for Claude Code, Kiro and Codex into your repository.
