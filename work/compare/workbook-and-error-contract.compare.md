---
type: Compare
title: One in-memory workbook for every element, and what an error is
description: "How <sheetpane-excel> and <sheetpane-errors> share one workbook, the error schema, the DOM contract. Verdict for W-01 and W-02 (closes W-07; rules B-021, B-022)."
status: decided
decided: 2026-10-18
decided_by: "Arpit (Cowork, claude-fable-5-1) — ruling 'resolve all the blockers', 2026-10-18; verdict drafted by the session, open to override"
---

# One in-memory workbook for every element, and what an error is

> **Verdict:** decided · **a module-level registry of workbook stores keyed by
> the `pane` attribute**, with a `workbook` property as the escape hatch; a
> framework-free store (`subscribe` / `getSnapshot`) that both elements read
> and write; **selection syncs, scroll follows selection** (B-021 ruled);
> **a matching edit does not auto-resolve an error — it marks it "matches
> suggestion"** (B-022 ruled); errors are versioned JSON; the contract is
> attributes, properties, methods and `sheetpane-*` events only · confidence
> **high** · **reopen if** two elements on one page with the same `pane` are
> ever observed out of step, or a host cannot save and reload a review from
> the events alone.

> **Extended 2026-10-18** by [`grid-events-and-host-rules.compare.md`](grid-events-and-host-rules.compare.md): editing events, column rules, `author: "host"`.

## Context

L7 says the view, edit and error components read **one** in-memory workbook
and keep no private copy; L6 and L9 say that workbook is JavaScript objects in
the page; L4 says the public contract is the DOM's. The host may mount the two
elements in different tabs, different React roots, or inside a dialog, in any
order.

## Options — how elements find the workbook

| | registry by `pane` attribute | `workbook` property set by host | ancestor `<sheetpane-provider>` |
|---|---|---|---|
| plain HTML works | yes | needs script | yes |
| different React roots | yes | yes | no |
| mount order free | yes | yes | mostly |
| explicit for advanced hosts | no | yes | no |

**Chosen: registry + property.** `pane="q3"` on both elements is the whole
story for plain HTML. A host that wants control creates the store itself
(`createWorkbook()`) and assigns it to `el.workbook`; a provider element is
unnecessary.

## Decisions

### The store

1. `createWorkbook(): WorkbookStore` — framework-free; `subscribe(fn)`,
   `getSnapshot()`, and mutators. One instance per `pane` id, created by the
   first element that asks and shared by every later one; released when the
   last element with that id disconnects.
2. **Shared state (L7, synced):** the loaded workbook (sheets, cells with raw
   value + display text, merges, widths, hidden flags); **cell changes** as a
   map `sheet!ref → { was, now }`; **errors**; the selected cell and sheet
   (B-021 ruled: selection syncs; the sheet scrolls the selected cell into view
   when the selection changes from outside it); mode (`view` | `edit`).
3. **Local state (per element):** scroll position, zoom, find text, filter in
   the errors list, the form draft. Not synced.
4. **Flag issue** sets `composing = { ref }` on the store. If a
   `<sheetpane-errors>` is connected to the pane, it shows the form; if none is,
   `<sheetpane-excel>` shows its inline form. Exactly one form, decided by the
   store, never both.

### The error

```ts
interface SheetpaneError {
  v: 1;                       // schema version
  id: string;                 // "ERR-0003" — stable, never reused in a session
  sheet: string;
  range: string;              // A1 cell "I6" or whole row "A14:J14"
  type: string;               // id from errorTypes: "wrong-value" …
  severity: "error" | "warning" | "note";
  found: string;              // the UPLOADED display text — never the edit
  expected: string;           // may be ""
  message: string;
  cellChanged: boolean;       // "Also change the cell" was ticked
  status: "open" | "resolved";
  matchesExpected: boolean;   // B-022: computed, the cell now equals expected
  author: string;             // from the element's `author` attribute, or ""
  createdAt: string;          // ISO 8601
}
```

5. **B-022 ruled:** an edit that equals `expected` sets `matchesExpected`
   and shows a "matches suggestion" tag; it does **not** resolve the error.
   Resolving stays a human act, so a review can be audited.
6. **Deleting an error that changed a cell keeps the cell change.** The change
   is a workbook change in its own right; Revert on the cell undoes it.
7. **Found is frozen** at creation from the uploaded display text.

### The DOM contract (working names, settled here)

| kind | name | on |
|---|---|---|
| attribute | `pane` | both — the shared id |
| attribute / property | `src` (URL or base64), `file` (File / Blob / ArrayBuffer, property only) | excel |
| attribute | `mode` = `view` \| `edit`; `display` = `tab` \| `popup`; `open`; `author` | excel (`author` both) |
| attribute | `readonly` | errors |
| property | `workbook` (get/set a `WorkbookStore`), `errors` (get/set `SheetpaneError[]`), `errorTypes` | both |
| method | `load(src)`, `export(): Promise<Blob>`, `select(sheet, ref)` | excel |
| method | `getErrors()`, `setErrors(list)` | both |
| event | `sheetpane-load`, `sheetpane-change` `{sheet, ref, was, now}`, `sheetpane-errors` `{errors}`, `sheetpane-select` `{sheet, ref}`, `sheetpane-mode` `{mode}`, `sheetpane-close`, `sheetpane-export` `{blob, kind}`, `sheetpane-reveal` `{error}` | bubbling, composed |

8. **Persistence is the host's.** It listens to `sheetpane-errors` and
   `sheetpane-change`, stores what it likes, and gives errors back through
   `setErrors()`; a saved error whose cell no longer holds `found` is shown
   with a "stale" tag, never silently moved.
9. **Undo/redo: in scope** — B-027 was promoted to W-23 by the plugins verdict and built: one stack per pane over every change and error mutation ([SR-GRID](../../records/0105_GRID.md) decision 7).

## Consequences

- W-01 DoD 1, 7, 9, 10 and W-02 DoD 1–8, 10 are fully specified.
- Two React roots, a dialog, or two host tabs all work with the `pane` id.
- B-021 and B-022 leave the backlog; their rulings are written into SR-LAW-7.

## References

- [`work/reference/specs/react/react-useSyncExternalStore.md`](../reference/specs/react/react-useSyncExternalStore.md) — the subscribe/snapshot shape (framework aside).
- [`work/reference/specs/web/mdn-using-custom-elements.md`](../reference/specs/web/mdn-using-custom-elements.md).
- [`work/reference/design/README.md`](../reference/design/README.md) — boards `Main`, `Host-Tab-Edit`, `Host-Linked-Tabs`.
- Laws: [SR-LAW-4](../../records/0006_LAW-4-web-component.md), [SR-LAW-6](../../records/0008_LAW-6-edits-in-memory-export-with-changes.md), [SR-LAW-7](../../records/0009_LAW-7-surfaces-always-in-sync.md), [SR-LAW-9](../../records/0011_LAW-9-memory-is-a-javascript-object.md).

## Reopen-trigger

Two elements sharing a `pane` observed out of step (the cross-component sync
test of B-020 fails), or a host unable to save and reload a review from the
events and `setErrors()` alone. **Check:** the sync test once B-020 lands.
