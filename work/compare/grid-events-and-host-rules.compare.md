---
type: Compare
title: Editing events, host column rules and React hooks for the grid
description: "What @sheetpane/grid adds to its contract so a host can follow every edit, check typed values by column title, and use React hooks. Verdict for W-26, W-27, W-28 (closes W-25)."
status: decided
decided: 2026-10-18
decided_by: "Arpit (Cowork, claude-opus-5-5) — 'go with the recommendation' on questions 4, 5, 6, 7 and 9, 2026-10-18; the rest drafted by the session, open to override"
---

# Editing events, host column rules and React hooks for the grid

> **Verdict:** decided ·
> - **Seven events:** two cancellable, every payload carrying the column's
>   title.
> - **Column rules:** JSON rules keyed by header title, plus a `validate`
>   function. They run as a **core provider on the plugin host's `validate`
>   hook**, with errors `author: "host"`.
> - **Validity:** host errors **auto-resolve** once the cell passes. The
>   default is **`flag`**, overridable to **`block`** per rule.
> - **Headers:** matched **trimmed and case-insensitive**. A missing title
>   **warns**; a duplicate **warns and the first column wins**. Rules **may
>   change after load** and re-run.
> - **React:** the hooks ship as **recipes**, with no `@sheetpane/react`
>   package in v1.
>
> Confidence: **high** on events and rules, **medium** on the load-phase
> timing until W-27 measures it.
>
> **Reopen if:** two real host apps copy the hook recipes (then publish a
> package), or W-27's 250,000-row load with four rules blocks the page for
> more than 100 ms at a time.

## Context

Arpit asked on 2026-10-18 for events that tell a host which cell the user is
on and what they are typing. He also wants a way to check, by column and
title, whether a typed value is correct, and React hooks. The existing
contract ([`workbook-and-error-contract.compare.md`](workbook-and-error-contract.compare.md))
only reports an edit after it is saved (`sheetpane-change`). The plugin
verdict ([`plugins.compare.md`](plugins.compare.md)) already has a
`validate` hook. W-18 uses it for the workbook's own rules (`author:
"workbook"`, auto-resolving).

## Options

1. **Events only.** The host checks values in its own listeners. Rejected as
   the only path: every host re-implements rules, and the results never reach
   `<sheetpane-errors>`.
2. **Rules as a separate plugin package.** Rejected: column rules are host
   configuration, not a feature of the file, and a package would be frozen
   with the plugin set per pane.
3. **Events + JSON rules + a function, as a core `validate` provider:
   chosen.** One error list (L7); rules are data that can be audited; the
   function is the escape hatch.

## Matrix

| | events only | rules plugin | **events + core rules** |
|---|---|---|---|
| errors in `<sheetpane-errors>` | no | yes | **yes** |
| rules change after load | n/a | no (frozen set) | **yes** |
| auditable rules | no | yes | **yes (JSON)** |
| new hook needed | no | no | **no** |

## Decisions

### Events (W-26)

1. **The events.** All bubble and are composed. Every payload carries
   `column: { index, letter, header }`.

   | event | fires | detail | cancellable |
   |---|---|---|---|
   | `sheetpane-select` | the selected cell moves | `{sheet, ref, column, value}` | no |
   | `sheetpane-editstart` | the cell bar opens on a cell | `{sheet, ref, column, value}` | **yes**: the cell stays read-only |
   | `sheetpane-input` | each keystroke, before saving | `{sheet, ref, column, draft, was}` | no |
   | `sheetpane-beforechange` | Enter / Tab / blur / paste / fill, before saving | `{sheet, ref, column, was, now}` | **yes**: the value is refused |
   | `sheetpane-change` | after saving | `{sheet, ref, kind, was, now}` | no |
   | `sheetpane-editcancel` | Esc | `{sheet, ref}` | no |
   | `sheetpane-sheet` | the sheet tab changes | `{sheet}` | no |

2. **Paste and fill** fire `sheetpane-beforechange` **once per cell**. A
   refused cell is skipped and the rest are saved. This is simple, and it
   matches how errors are per cell.
3. **Order:** `beforechange` → (refused: stop) → change map → undo stack
   (W-23) → `derive` (W-16) → `validate` → `sheetpane-change`. A refused
   value never reaches the change map, the undo stack or `derive` (L6).
4. **The events fire on the element where the edit happened.** Other
   elements on the pane see the store update they already receive (L7).
   Cancelling is synchronous; async checks belong to decision 6.

### Column rules (W-27)

5. **The vocabulary,** as plain JSON keyed by header title:
   - `required`
   - `type`: `text` · `number` · `integer` · `date` · `boolean`
   - `min`, `max`, `minLength`, `maxLength`
   - `pattern`, `oneOf`, `unique`
   - `message`, `severity` (default `error`), `onInvalid`

   A rule set can be saved and loaded as a JSON file; the host does that.
6. **`validate(ctx, signal)`**, sync or async. It returns `null` or
   `{severity, message, expected?}`.
   - `ctx` is `{phase, sheet, ref, row, column, value, was, original, rowValues}`,
     where `rowValues` is keyed by title.
   - A newer edit to the same cell aborts the older check through `signal`.
     A stale result is dropped.
7. **Phases:**
   - `input`: after 150 ms without typing. An outline and a tooltip;
     nothing stored.
   - `commit`: on save. It flags or blocks (decision 9).
   - `load`: every row, in idle-time chunks, with the progress shown in the
     status line.
8. **Where rules run: a core provider on the `validate` hook** (no seventh
   hook). Its errors carry `author: "host"`, beside W-18's `"workbook"`.
   **`validate` takes several providers**, which SR-GRID decision 17 already
   allows (only `format` and `derive` are single-provider). The provider is
   built in, so the frozen plugin set is untouched. SR-GRID decision 17's
   "the one auto-resolve" widens to `host` errors (decision 10).
9. **Ruled (Arpit, Q6):** `onInvalid` defaults to **`flag`** (the value is
   saved and an error added). A rule can set **`block`**, which cancels
   through decision 1's `sheetpane-beforechange`. An element-wide
   `onInvalid` sets the default.
10. **Ruled (Arpit, Q5):** **host-authored errors resolve themselves** when
    the cell passes again, the same as workbook-authored ones (W-18).
    **Person-authored errors stay human-resolved** (B-022 unchanged).
11. **Ruled (Arpit, Q7):** `headerRow` (default 1) holds the titles.
    - **Matching:** trimmed and case-insensitive.
    - **A configured title the file lacks:** one `note` error naming it,
      and the file loads anyway.
    - **A duplicated title:** the first column wins, plus one `note` error.
      Never silent, never a refusal.
12. **Ruled (Arpit, Q4):** **rules may change after a workbook is loaded.**
    Setting `columns` or `validate` re-runs the `load` phase. Host errors no
    longer produced are removed; person-authored errors are never touched.
13. **A host rule never edits a cell.** It only reports.
14. **`pattern` is bounded:** values longer than 10,000 characters are not
    tested against it. The README warns against catastrophic patterns.

### React (W-28)

15. **Ruled (Arpit, Q9): recipes, no package in v1.** The "no framework
    wrappers in v1" ruling in SR-LAW-4's Consequences stands.
    - **Where the hooks live:** in the grid README and `examples/react/`
      (W-09).
    - **The hooks:** `useWorkbook`, `useSelection`, `useCellEdit`,
      `useChanges`, `useErrors`, `useSheetpaneEvent`, `useColumnRules`.
    - **How they work:** they take a `ref` and are built on
      `useSyncExternalStore` with stable selectors.
    - **Versions:** React 19 is the target. The hooks also work in React 18,
      where the element is wired through the same `ref`.

## Consequences

- W-26, W-27, W-28 are fully specified; W-25 closes.
- SR-GRID decision 17 gains `host` beside `workbook` in its auto-resolve rule, when W-27 lands.
- W-18's author filter in `<sheetpane-errors>` gains "host".
- No error-schema change: `author` already separates `person`, `workbook` and
  `host`.

## References

- [`workbook-and-error-contract.compare.md`](workbook-and-error-contract.compare.md) — the DOM contract this extends
- [`plugins.compare.md`](plugins.compare.md) — the `validate` hook and the frozen plugin set
- [SR-LAW-4](../../records/0006_LAW-4-web-component.md) (no wrappers) · [SR-LAW-6](../../records/0008_LAW-6-edits-in-memory-export-with-changes.md) · [SR-LAW-7](../../records/0009_LAW-7-surfaces-always-in-sync.md)
- [`../reference/specs/react/react-useSyncExternalStore.md`](../reference/specs/react/react-useSyncExternalStore.md)

## Reopen-trigger

- **React:** two real host apps copy the hook recipes. Then publish
  `@sheetpane/react`, and SR-LAW-4's Consequences change.
- **Timing:** W-27's 250,000-row load with four rules blocks the main thread
  for more than 100 ms at a time.

**Check:** W-27 DoD 7's measurement; the host list in the grid README.
