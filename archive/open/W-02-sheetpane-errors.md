---
type: Handoff
name: W-02
description: "Arpit asked on 2026-10-18 for the error component — <sheetpane-errors>, the error list and form of the sheetpane package, always in sync with <sheetpane-excel>."
item: W-02
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-02 — Build the error component, `<sheetpane-errors>`

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Wait for the in-memory workbook the sheet builds (contract already decided) | one source to read and write | ✅ |
| 2 | List the flagged errors: filter, expand, resolve, delete | a reviewer's checklist the host can put anywhere | ✅ |
| 3 | Hold the New error form the sheet's **Flag issue** opens | what's wrong and what it should be, typed once | ✅ |
| 4 | **Show in sheet** tells the host to switch tab or open the pop-up | errors and sheet in different places, still in sync | ✅ |

**Arpit, 2026-10-18:** *"Second one, to build out the error component."* —
and, earlier the same day: *"It should always be linked. It will always be
linked."*

**Model:** Opus — list and form behaviour are judged by use, not by tests;
close to Sonnet because the DoD below is mostly checkable.

## Goal

`<sheetpane-errors pane="…">` (working name): the error component of the
`@sheetpane/grid` package — a custom element (L4) the host places anywhere: beside
the sheet, in its own side column, in another tab, inside the pop-up. It reads
and writes the **same in-memory workbook** as `<sheetpane-excel>`, so errors,
corrections and cell changes show in both at once (L7).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · element | `customElements.define` registers it; DOM-only contract (attributes, properties, methods, events); no framework peer dependency (L4) | ✅ registers on import; DOM-only contract (SR-ERRORS decision 1); no framework peer — test |
| 2 · in sync | it keeps **no private copy** of errors or workbook data; with a `<sheetpane-excel>` on the same `pane`, every add, correction, resolve and delete shows in both at once (L7); there is **no "linked/not linked" chip** and **no export footer** (Arpit, 2026-10-18) | ✅ renders only from the store; no linked chip, no export footer; the L7 sync test in both mount orders |
| 3 · list | open count; severity filter (All · ✕ · ! · i); each row shows number, type, Found → Should be, range, severity, and a "matches suggestion" or "stale" tag when it applies; picking a row selects the cell in the sheet (selection syncs) | ✅ open count, severity filter with counts, rows with number, type, Found → Should be, range, severity, tags (cell changed · resolved · matches suggestion · stale); picking selects the cell — tests |
| 4 · act | Resolve / Reopen and Delete on the expanded row; resolved rows strike through and the sheet's pin turns ✓ | ✅ Resolve / Reopen, Delete on the expanded row; resolved rows strike through; the sheet's pin turns ✓ — test |
| 5 · form | when the sheet's **Flag issue** fires, the form opens here: Found (the **original** value), column, row; type chips; What's wrong; What it should be; **Also change the cell to this value**; severity Error/Warning/Note with its help line; the example for the chosen type; Add error and ⌘↵; Cancel | ✅ Found (the upload), Column (header + letter), Row; type chips; What’s wrong; What it should be; Also change the cell; severity + help line; the type's example; Add error, ⌘/Ctrl+↵, Cancel, Esc — test |
| 6 · types | an `errorTypes` property; the default catalog is the seven types plus Other from the board `Edit-Examples`, each with a default severity | ✅ `errorTypes` property; default catalog = the seven types + Other from `Edit-Examples` (`DEFAULT_ERROR_TYPES`) — test |
| 7 · reveal | **Show in sheet** dispatches `sheetpane-reveal` `{error}` (bubbling, composed), so the host can switch tab or open the pop-up (board `Host-Linked-Tabs`) | ✅ Show in sheet selects the cell and dispatches `sheetpane-reveal {error}`, bubbling and composed — test |
| 8 · read-only | a `readonly` attribute hides the form, Resolve and Delete (a sign-off screen) | ✅ `readonly` hides the form, Resolve and Delete (and Undo/Redo) — test |
| 9 · font | no font ships; the host's font reaches the list and every form control (L5) | ✅ list rows, chips, textarea and input compute to the host's font — test |
| 10 · contract | errors are `SheetpaneError` v1 exactly as the contract verdict states; every add, change, resolve and delete dispatches `sheetpane-errors` `{errors}`; `getErrors()` / `setErrors()` / the `errors` property round-trip a saved review | ✅ SheetpaneError v1 exactly; `sheetpane-errors {errors, plugins}` on every add, change, resolve, delete; `getErrors()` / `setErrors()` / `errors` round-trip a saved review — tests |
| 11 · access | list rows and chips are real buttons with labels; severity is glyph plus colour, never colour alone | ✅ rows and chips are buttons with labels; severity glyph + colour; axe-core clean — test |
| 12 · tests | element tests for DoD 2–8 beside a `<sheetpane-excel>` fixture, in a real browser engine | ✅ `packages/grid/test/errors.test.ts` — 11 tests in Chromium (WebKit, Firefox nightly) |
| 13 · record | a component record (next free from `0101`); the Ownership row for `packages/grid/src/errors/` moved from W-02 to it | ✅ [SR-ERRORS](../../records/0106_ERRORS.md) (0106); Ownership `packages/grid/src/errors/` → SR-ERRORS |
## Blockers

None.

## Record affected

**[SR-ERRORS](../../records/0106_ERRORS.md)** — written by this item.

## Hazards

- **Ruled (2026-10-18):** selection syncs; a matching edit marks, never
  resolves; deleting an error that changed a cell keeps the change; Found is
  the uploaded value. All in the contract verdict and SR-LAW-7 Consequences.
- **Two forms, one workbook.** The store's `composing` field decides which
  form opens; this element shows it whenever it is connected to the pane.

## Reference

- Design: [`../reference/design/boards/Plugin-Validation.dc.html`](../reference/design/boards/Plugin-Validation.dc.html) — the author filter (Person · Workbook · File) and workbook rows, a W-18 addition
- Design: [`../reference/design/boards/Plugin-Comments.dc.html`](../reference/design/boards/Plugin-Comments.dc.html) — file notes (read-only) and a thread with replies, a W-22 addition
- Design: [`../reference/design/boards/Pane-Sync.dc.html`](../reference/design/boards/Pane-Sync.dc.html) — an edit in one host tab reaching the errors in another (L7)
- The design: [`../reference/design/README.md`](../reference/design/README.md) — boards
  `Errors`, `Host-Tab-Edit`, `Host-Linked-Tabs`, `Host-Popup-Edit`, `Edit-Examples`.
- The laws: [SR-LAW-4](../../records/0006_LAW-4-web-component.md) ·
  [SR-LAW-5](../../records/0007_LAW-5-host-font.md) ·
  [SR-LAW-7](../../records/0009_LAW-7-surfaces-always-in-sync.md).

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-02 in the sheetpane monorepo: the <sheetpane-errors> web
component.

1. Explore. Read CLAUDE.md and every law record it lists, work/INTERVIEW.md,
   this file (work/open/W-02-sheetpane-errors.md), W-01's record and its
   workbook store under packages/grid/src/, the contract verdict
   work/compare/workbook-and-error-contract.compare.md, and the boards Errors, Host-Tab-Edit, Host-Linked-Tabs and
   Edit-Examples as source.
2. Plan the element and its tests in this file's body.
3. Implement under packages/grid/src/errors/, reading and writing only
   the shared in-memory workbook. No private copy, no linked chip, no export
   footer.
4. Verify. just check; exercise it beside
   <sheetpane-excel> in a browser; tick DoD rows only with evidence. Then do
   what SR-WORK-DOCS decision 10 says every task owes.
```
