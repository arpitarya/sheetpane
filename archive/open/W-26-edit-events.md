---
type: Handoff
name: W-26
description: "Arpit asked on 2026-10-18 for events that tell a host which cell the user is on and what they are typing, and let it refuse an edit. Design settled by W-25."
item: W-26
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-26 — Editing and position events on `<sheetpane-excel>`

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Add the events the verdict rules on: edit start, typing, before save, cancel, sheet switch | a host sees every step of an edit | ✅ |
| 2 | Put the column's index, letter and header title on every event | "you're in Email, row 7", no guesswork | ✅ |
| 3 | Let `editstart` and `beforechange` be cancelled | a host can lock a cell or refuse a value | ✅ |

**Arpit, 2026-10-18:** *"Events, callbacks, which could be helpful whenever
somebody is editing something or which cell they are on."*

**Model:** Sonnet — every event can be checked by a browser test.

## Goal

The event set in the verdict's verdict, built on the DOM contract (L4). Starting
point: the events table in the [events-and-rules verdict](../compare/grid-events-and-host-rules.compare.md).

```js
excel.addEventListener('sheetpane-select', e => show(e.detail.column.header, e.detail.value));
excel.addEventListener('sheetpane-input',  e => hint(e.detail.column.header, e.detail.draft));
excel.addEventListener('sheetpane-beforechange', e => {
  if (e.detail.column.header === 'Age' && +e.detail.now < 18) e.preventDefault();  // refused, never stored
});
```

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · events | every event the verdict names fires at the moment it names, bubbling and composed, with the payload it names | ✅ `sheetpane-select`, `-editstart`, `-input`, `-beforechange`, `-change`, `-editcancel`, `-sheet` — bubbling, composed, the verdict's payloads, in its order (`events.test.ts`) |
| 2 · column | every payload carries `column: { index, letter, header }`, the header read from the configured title row (verdict decision 11) | ✅ every payload carries `column: {index, letter, header}`; the header comes from `header-row` (default 1) — the test reads `Price` from row 2 |
| 3 · cancel | a cancelled `editstart` keeps the cell read-only; a cancelled `beforechange` leaves the cell as it was: not in the change map, the undo stack (W-23) or `derive` (W-16) — L6 | ✅ a cancelled `editstart` keeps the cell read-only; a cancelled `beforechange` leaves the cell as it was — not in the change map, not on the undo stack, never seen by `derive` (a spy plugin proves it) |
| 4 · batches | paste and fill fire `sheetpane-beforechange` once per cell; a refused cell is skipped, the rest saved (verdict decision 2) | ✅ paste (Ctrl/⌘+V) asks `beforechange` once per cell, skips refused cells, saves the rest as one undo step; the grid has no fill gesture, so fill has nothing to hook yet |
| 5 · sync | an edit made through one element fires its events once, on the element where it happened; the other elements see it as the store update they already receive (L7) | ✅ the events fire once, on the element where the edit happened; a `<sheetpane-errors>` on the same pane fires none of them — test |
| 6 · tests | browser tests for each event, each cancel and a paste, in the testing verdict's engine | ✅ `packages/grid/test/events.test.ts` — 6 tests in Chromium |
| 7 · docs | the README's event table; W-01's component record gains the events | ✅ the grid README's "Following an edit" table and example; [SR-GRID](../../records/0105_GRID.md) decisions 9 and 11a |
## Blockers

None.

## Record affected

**[SR-GRID](../../records/0105_GRID.md)** decisions 9 and 11a.

## Hazards

- **`sheetpane-input` fires on every keystroke.** Keep the payload small and
  never copy the sheet into it.
- **Cancelling must be synchronous.** A host can't `await` inside an event
  handler and still cancel; async checks belong to W-27's `validate`.

## Reference

- the [events-and-rules verdict](../compare/grid-events-and-host-rules.compare.md) · [W-01](W-01-sheetpane-excel.md) · W-23 (closed — [SR-GRID](../../records/0105_GRID.md)) · [`../compare/workbook-and-error-contract.compare.md`](../compare/workbook-and-error-contract.compare.md)
