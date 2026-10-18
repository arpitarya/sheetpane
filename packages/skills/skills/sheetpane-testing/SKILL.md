---
name: sheetpane-testing
description: Use when writing end-to-end or browser tests for a host app that embeds sheetpane - reaching cells in shadow DOM, waiting for sheetpane-load, editing, reading a downloaded .xlsx back, known fixture files. Not for testing sheetpane itself.
license: MIT
metadata:
  audience: host
---

# Testing a host app

The elements use **open shadow roots**; Playwright locators pierce them, and
in plain DOM code use `el.shadowRoot.querySelector(…)`.

## Wait for the file

```js
await page.locator('sheetpane-excel').evaluate((el) =>
  el.workbook?.getSnapshot().load.status === 'ready' ||
  new Promise((r) => el.addEventListener('sheetpane-load', r, { once: true })));
```

## Reach a cell and edit it

Cells are `role="gridcell"` with ids `c<row>_<col>` (zero-based): B3 is
`#c2_1`. Editing goes through the cell bar input:

```js
const excel = page.locator('sheetpane-excel');
await excel.locator('#c2_1').click();
await excel.locator('input.cell').fill('42');
await excel.locator('input.cell').press('Enter');
```

Or through the store: `el.workbook.setCell('Sheet1', 'B3', '42')`,
`el.workbook.getErrors()`, `el.workbook.value(sheet, ref)`.

## Read the download back

```js
const [dl] = await Promise.all([page.waitForEvent('download'), excel.locator('button.export').click()]);
const { read } = await import('@sheetpane/import');           // in Node: give it a DOM shim, or read in the page
```

The repo's own browser check, [`scripts/demo-check.mjs`](https://github.com/arpitarya/sheetpane/blob/main/scripts/demo-check.mjs),
is a worked example of all of this.

## Known files

`@sheetpane/fixtures` ([SR-FIXTURES](https://github.com/arpitarya/sheetpane/blob/main/records/0115_FIXTURES.md)) ships a
showcase workbook, its rules sample, edge cases and CSV dialects with a
manifest of what each holds: `bytes('showcase.xlsx')`, `url(…)`, `path(…)`,
`info('showcase.rules.json').errors`.

## Pitfalls

- Clipboard actions need a secure context (https or localhost).
- The load check of rules is sliced: wait until `workbook.ruleProgress` is
  undefined before asserting rule errors.
- Assert errors by `code` / `spCode`, not message text ([SR-CODES](https://github.com/arpitarya/sheetpane/blob/main/records/0117_CODES.md)).

## Related

[sheetpane-events](../sheetpane-events/SKILL.md) · [sheetpane-troubleshoot](../sheetpane-troubleshoot/SKILL.md)
