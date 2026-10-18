---
type: Handoff
name: W-25
description: "Research filed 2026-10-18 at Arpit's request: what the grid adds to its contract for editing and position events, host-supplied column rules that check what a user types, and React hooks. Feeds W-26, W-27 and W-28."
item: W-25
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: cowork
---

# W-25 — Research: editing events, column rules and React hooks for the grid

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Name the events for "which cell am I on" and "what am I typing", and say which ones can stop an edit | a host can follow and steer every edit | ✅ |
| 2 | Design column rules a host writes as data ("Age: a number from 18 to 99"), plus a function for anything else | wrong values are caught as they are typed, not after export | ✅ |
| 3 | Fit the rules onto the plugin host's `validate` hook, so their errors appear in the error list like any other | one error list, always in sync (L7) | ✅ |
| 4 | Lay out the React hooks, as a package or as copy-paste recipes | React apps follow the sheet in a few lines | ✅ |
| 5 | Arpit rules on the open questions below | W-26, W-27 and W-28 can start | ✅ 2026-10-18 — every recommendation taken |

**Arpit, 2026-10-18:** *"Can you create some React hooks and some events,
callbacks, which could be helpful whenever somebody is editing something or
which cell they are on? … in the Excel sheet, there are going to be three
columns, four columns … is there some events or callbacks that can be exposed
so that we can check, okay, this is the column, this is the title, and this
is what they're typing in the cell, whether that is correct or not."* Then:
*"Create work item for everything present above."*

**Model:** Cowork — a reading-and-weighing task with no code (SR-WORK-OPEN-QUEUE rule 37a).

## Goal

A compare doc, `work/compare/grid-events-and-host-rules.compare.md`, with a
verdict. It extends the contract verdict
([`workbook-and-error-contract.compare.md`](../compare/workbook-and-error-contract.compare.md))
and fits the plugin verdict ([`plugins.compare.md`](../compare/plugins.compare.md))
without a seventh hook.

## The starting proposal (from the 2026-10-18 chat)

**Events.** Every `detail` carries `column: { index, letter, header }`, so a
host never has to work out what column `D` means.

| event | fires when | detail | cancellable |
|---|---|---|---|
| `sheetpane-select` (exists) | the selected cell moves | add `column`, `value` | no |
| `sheetpane-editstart` | the cell bar opens on a cell | `{sheet, ref, column, value}` | yes: the cell can't be edited |
| `sheetpane-input` | each keystroke, before the value is saved | `{sheet, ref, column, draft, was}` | no |
| `sheetpane-beforechange` | Enter / Tab / blur, before saving | `{sheet, ref, column, was, now}` | yes: the value is refused |
| `sheetpane-change` (exists) | after saving | `{sheet, ref, kind, was, now}` | no |
| `sheetpane-editcancel` | Esc | `{sheet, ref}` | no |
| `sheetpane-sheet` | the user switches sheet tab | `{sheet}` | no |

**Column rules** (properties on `<sheetpane-excel>`):

```ts
excel.headerRow = 1;
excel.columns = {
  'Name':   { required: true },
  'Email':  { required: true, pattern: '^[^@\\s]+@[^@\\s]+$', message: 'Not an email' },
  'Age':    { type: 'number', min: 18, max: 99 },
  'Status': { oneOf: ['Active', 'Inactive'], severity: 'warning' },
};
excel.onInvalid = 'flag';   // 'flag': save it and add an error · 'block': refuse the edit
excel.validate = async (ctx, signal) => null | { severity, message, expected };
// ctx = { phase: 'input'|'commit'|'load', sheet, ref, row, column, value, was, original, rowValues }
```

Phases:
- `input`: as the user types; an outline and a tooltip, nothing stored.
- `commit`: when the value is saved; an error is stored (`flag`) or the edit is refused (`block`).
- `load`: when the file opens; the whole sheet is checked once.

**React hooks:** `useWorkbook`, `useSelection`, `useCellEdit`, `useChanges`,
`useErrors`, `useSheetpaneEvent`, `useColumnRules`, each built on
`useSyncExternalStore` over the store's `subscribe` / `getSnapshot`.

## The questions

1. **Event names and payloads.** The list above, or a smaller set. Does
   `sheetpane-beforechange` fire for paste and fill too, and once per cell or
   once per batch?
2. **How a refused edit interacts with other items.** A cancelled
   `beforechange` never enters the change map, the undo stack (W-23) or
   `derive` (formulas, W-16). Confirm, and name the order these run in.
3. **The rule vocabulary.** `required`, `type` (text · number · integer ·
   date · boolean), `min` / `max`, `minLength` / `maxLength`, `pattern`,
   `oneOf`, `unique`, `message`, `severity`. Keep it plain JSON, so a rule
   set can be saved, diffed and audited. Should a rule set be loadable as a
   file?
4. **Where rules run.** Proposed: a core, built-in provider on the plugin
   host's `validate` hook, with errors carrying `author: "host"` beside W-18's
   `"workbook"`. Does that need `validate` to allow more than one provider?
   Can rules change after a workbook is loaded, when the plugin set is frozen
   per pane (plugins verdict, decision 3)?
5. **Auto-resolve.** W-18 makes workbook-authored errors resolve themselves
   once the cell passes, the only exception to the rule that edits never
   resolve errors (B-022). Should host-authored errors behave the same way?
   Person-authored errors stay human-resolved either way.
6. **`flag` vs `block`**, set per rule or for the whole element.
7. **Headers.** What the title row is (`headerRow`). How titles are matched
   (exact, trimmed, case-insensitive). What happens when a configured column
   is missing: refuse, warn, or ignore. What happens with duplicate titles.
8. **Scale and timing.** The `load` phase at 250,000 rows: run in chunks in
   idle time, and report progress? The `input` phase: wait for a pause in
   typing before checking? Async validators: cancel with `AbortSignal` and
   drop stale results.
9. **React hooks.** **(a)** a new `@sheetpane/react` package, which overrules
   the "no framework wrappers in v1" ruling in SR-LAW-4 Consequences, or
   **(b)** copy-paste recipes in the README and the W-09 React demo, with no
   package. Also: React 18 support (hooks only, through a `ref`), and whether
   hooks take a `ref` or a `pane` id.
10. **Laws.** L4: everything stays attributes, properties, methods and DOM
    events. L6: a refused value is never stored. L7: host errors sync through
    the store like every other error.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · doc | the compare doc exists with verdict, options, matrix, consequences, references, reopen-trigger | ✅ [`grid-events-and-host-rules.compare.md`](../compare/grid-events-and-host-rules.compare.md) |
| 2 · fit | every proposal checked against the contract and plugin verdicts; any conflict is named, never worked around | ✅ one consequence: `validate` takes several providers (W-14) |
| 3 · ruling | Arpit rules on questions 4, 5, 6, 7 and 9; the rulings are written into the compare doc and into W-26, W-27 and W-28; question 9 (a) also rewrites SR-LAW-4's Consequences | ✅ Arpit, 2026-10-18: "go with the recommendation" on all five — auto-resolve host errors; flag by default, block per rule; trimmed case-insensitive headers, missing/duplicate warn; rules may change after load; recipes, no package (SR-LAW-4 unchanged) |

## Blockers

None. **Closed 2026-10-18**: the verdict is [`grid-events-and-host-rules.compare.md`](../compare/grid-events-and-host-rules.compare.md).

## Record affected

**No SR affected** by the research. The rulings flow into W-01's component
record (events), W-14's (hooks), and SR-LAW-4 if question 9 goes (a).

## Hazards

- **Rules that change after load** may clash with the plugin set being frozen
  per pane (plugins verdict, decision 3). Say how both hold.
- **Async validators** can resolve after the user has moved on. A stale
  result must never mark the wrong cell.
- **A function is not auditable** the way a JSON rule is. Keep functions as
  the escape hatch, not the default.

## Reference

- [`../compare/workbook-and-error-contract.compare.md`](../compare/workbook-and-error-contract.compare.md) — the DOM contract and the store
- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — the `validate` hook, frozen plugin set, change kinds
- [W-14](W-14-plugin-host.md) · [W-18](W-18-validation.md) · [W-23](W-23-undo-redo.md) · [W-09](W-09-demo-apps.md)
- [`../reference/specs/react/react-useSyncExternalStore.md`](../reference/specs/react/react-useSyncExternalStore.md)
