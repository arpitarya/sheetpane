---
name: sheetpane-test
description: The /sheetpane-test [workbook] command - writes one end-to-end test for a host page with sheetpane - load the .xlsx or .csv (or a fixture), edit a cell, read the download. Not for the testing techniques themselves (sheetpane-testing).
license: MIT
metadata:
  audience: host
---

# /sheetpane-test — one end-to-end test for the page with the sheet

The argument: **$ARGUMENTS** (in a tool that does not fill that in, it is the
text typed after the command).

| the argument | do |
|---|---|
| a `.xlsx` / `.csv` path | the test loads that file |
| nothing | use `showcase.xlsx` from `@sheetpane/fixtures` (it ships a rules sample too) |

## Steps

1. Read [sheetpane-testing](../sheetpane-testing/SKILL.md) — waiting for the
   load, reaching cells in the shadow root, reading the download, the
   fixtures — and follow it; do not invent selectors it does not name.
2. Find the app's test runner (Playwright, Vitest browser mode, …) and the
   page that renders `<sheetpane-excel>`. Write the test next to the app's
   other end-to-end tests, in their style. `@sheetpane/testing` has helpers
   for both runners; use it if the app already depends on it, or ask before
   adding it.
3. The test: open the page with the workbook; wait for the load; check one
   value; edit one cell; if the page has `<sheetpane-errors>`, check the
   error a rule should raise by its `SP-xxxx` code, not its text; download
   and read the changed value back.
4. Run the test and make it pass. Report the file and the command that runs
   it.

## Pitfalls

- Rule errors on load arrive in slices: wait for the check to finish before
  asserting them (sheetpane-testing says how).
- Never assert a font or a pixel colour — the font is the host's.
