---
type: Handoff
name: W-26
description: "Arpit asked on 2026-10-18 for events that tell a host which cell the user is on and what they are typing, and let it refuse an edit. Design settled by W-25."
item: W-26
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-26 — Editing and position events on `<sheetpane-excel>`

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Add the events W-25 rules on: edit start, typing, before save, cancel, sheet switch | a host sees every step of an edit | ⏳ W-25 |
| 2 | Put the column's index, letter and header title on every event | "you're in Email, row 7", no guesswork | ⏳ |
| 3 | Let `editstart` and `beforechange` be cancelled | a host can lock a cell or refuse a value | ⏳ |

**Arpit, 2026-10-18:** *"Events, callbacks, which could be helpful whenever
somebody is editing something or which cell they are on."*

**Model:** Sonnet — every event can be checked by a browser test.

## Goal

The event set in W-25's verdict, built on the DOM contract (L4). Starting
point: the events table in [W-25](W-25-research-events-rules-hooks.md).

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
| 1 · events | every event W-25 names fires at the moment it names, bubbling and composed, with the payload it names | ⏳ |
| 2 · column | every payload carries `column: { index, letter, header }`, the header read from the configured title row (W-25 question 7) | ⏳ |
| 3 · cancel | a cancelled `editstart` keeps the cell read-only; a cancelled `beforechange` leaves the cell as it was: not in the change map, the undo stack (W-23) or `derive` (W-16) — L6 | ⏳ |
| 4 · batches | paste and fill follow W-25's ruling (per cell or per batch) | ⏳ |
| 5 · sync | an edit made through one element fires its events once, on the element where it happened; the other elements see it as the store update they already receive (L7) | ⏳ |
| 6 · tests | browser tests for each event, each cancel and a paste, in the testing verdict's engine | ⏳ |
| 7 · docs | the README's event table; W-01's component record gains the events | ⏳ |

## Blockers

Waiting on **W-25** (the names and rulings) and **W-01** (the element).

## Record affected

W-01's component record (the DOM contract), in the same change.

## Hazards

- **`sheetpane-input` fires on every keystroke.** Keep the payload small and
  never copy the sheet into it.
- **Cancelling must be synchronous.** A host can't `await` inside an event
  handler and still cancel; async checks belong to W-27's `validate`.

## Reference

- [W-25](W-25-research-events-rules-hooks.md) · [W-01](W-01-sheetpane-excel.md) · [W-23](W-23-undo-redo.md) · [`../compare/workbook-and-error-contract.compare.md`](../compare/workbook-and-error-contract.compare.md)
