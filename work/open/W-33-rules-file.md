---
type: Handoff
name: W-33
description: "Arpit asked on 2026-10-18 for predefined errors: a rules file, written while coding, that says which values are valid or invalid per sheet, column or cell; the grid checks it on render and the failures show only in the errors panel, with manual flagging and pop-ups switched off by a prop."
item: W-33
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-33 — A rules file: predefined errors, shown only in the errors panel

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Define one JSON rules document (`version`, per sheet, per column title, per cell or range) with a published JSON Schema | rules written once, beside the code, with autocomplete in the editor | ⏳ |
| 2 | Accept it as a `rules` property (object) or a `rules-src` attribute (URL to a `.json`) | link the file to the component; no rules → nothing changes | ⏳ |
| 3 | Run it through the existing column-rules engine (W-27), widened to sheet scope, cell ranges, `equals` and `noneOf` | one checker, no second engine | ⏳ |
| 4 | Add `flagging="off"`: no Flag issue, no `F` key, no composer, no callout card over the grid | errors appear only on the right, in `<sheetpane-errors>` | ⏳ |
| 5 | A **Rules file** tab in both demos (W-32's gallery) | anyone can see it work | ⏳ |

**Arpit, 2026-10-18:** *"While we are coding it out, we create some kind of file which says that this cell should have, this is a valid value and this is invalid value … And we link it with the tool … whenever that component gets rendered, if any value is incorrect, according to that file, it shows up on right-hand side section. And I don't want, in that case, any flag issues or to pop up. It should be an optional component which can be controlled through a prop."*

**Model:** Opus — sheet and range scoping meet the per-cell finding cache (SR-GRID 22b) and the load-time slicing; that is where a near-miss hides.

## Goal

A host ships a `sheetpane.rules.json` next to its code and points the grid at it. On load the grid checks every cell the file covers; each failure becomes an `author: "host"` error that resolves itself when the cell passes (as W-27's do). With `flagging="off"` the grid shows no Flag issue control and opens no pop-up card: the cell keeps its quiet error mark, and the errors panel is the only place errors are read. Without a rules file and without `flagging="off"` the grid behaves exactly as today.

### The file — JSON (decided at filing; see Research)

```json
{
  "$schema": "https://unpkg.com/@sheetpane/grid/rules.schema.json",
  "version": 1,
  "sheets": {
    "*": {
      "columns": { "Email": { "pattern": "^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$", "unique": true } }
    },
    "Accounts": {
      "headerRow": 2,
      "columns": {
        "Account ID": { "required": true, "pattern": "^AC-\\d{5}$", "message": "Account IDs are AC- and five digits" },
        "Units":      { "type": "integer", "min": 0 },
        "Status":     { "oneOf": ["Active", "Inactive"], "noneOf": ["TBD", "N/A"], "severity": "warning" }
      },
      "cells": {
        "B1":     { "equals": "Q3 review", "note": "the title cell the export pipeline reads" },
        "H3:H40": { "type": "number", "min": 0, "max": 1 }
      }
    }
  }
}
```

### The element

```html
<sheetpane-excel pane="q3" src="./q3.xlsx" rules-src="./sheetpane.rules.json" flagging="off"></sheetpane-excel>
<sheetpane-errors pane="q3"></sheetpane-errors>
```

```js
excel.rules = rulesJson;            // or an object parsed from YAML/TOML by the host
```

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · document | `version: 1`; `sheets` keyed by sheet name, `"*"` for every sheet (a named sheet's rule for the same title wins); each sheet has optional `headerRow`, `columns` (by title, W-27's matching) and `cells` (an A1 ref or range); an unknown key, an unknown version or a sheet/ref the file lacks is one `note` error naming it — never silent, never a throw at render | ⏳ |
| 2 · vocabulary | everything in SR-GRID 22a, plus `equals` (the one valid value), `noneOf` (listed invalid values) and `note` (free text for the author, never shown as the message); `oneOf` stays the valid list | ⏳ |
| 3 · schema | `packages/grid/rules.schema.json` (JSON Schema 2020-12) shipped in the package and exported as `@sheetpane/grid/rules.schema.json`; `$schema` gives VS Code autocomplete and red squiggles; a test validates the README example against it | ⏳ |
| 4 · linking | `rules` property takes the object; `rules-src` attribute loads a URL (same loader and same B-030 handling as `src`); setting either re-checks every row (SR-GRID 22c); `columns` and `validate` keep working and merge with the file (the file's rule wins for the same title, one `note`) | ⏳ |
| 5 · one engine | the file compiles to the existing `host-rules` provider: same `type: 'column-rule'` (or `cell-rule` for `cells`), same caching, 8 ms load slices and progress line; no second checker | ⏳ |
| 6 · `flagging="off"` | removes Flag issue from the cell bar and the context menu (W-31's places), the `F` key and its line in the `?` list; never opens the composer or the error callout card; the cell's error mark stays and clicking it selects the row in `<sheetpane-errors>`; `<sheetpane-errors>` hides "New error" when its pane is `flagging="off"`; default is `on` | ⏳ |
| 7 · panel | rule errors are read-only rows ("Rules file" in the author filter), grouped by sheet, each with **Show in sheet** | ⏳ |
| 8 · React | the React demo passes `rules` and `flagging` as props; `elements.d.ts` types both | ⏳ |
| 9 · demo | an 11th tab, **Rules file**, in both demos' gallery (W-32): the showcase workbook plus a checked-in `examples/shared/sheetpane.rules.json` that fails a handful of cells, `flagging="off"`, the errors panel open; `demo-check` asserts the expected error count, that no Flag issue control exists, and that pressing `F` and clicking a cell open no card | ⏳ |
| 10 · tests | in Chromium: `*` vs named sheet; column vs cell vs range; `equals`, `noneOf`; bad version / unknown key / missing sheet → notes; edit a failing cell to pass → error resolves; `flagging="off"` → no flag UI, no cards; 250,000 rows × the README file loads without a frame gap over 50 ms (measure and write the machine here) | ⏳ |
| 11 · docs + record | grid README "Rules file" section with the example and a YAML/TOML host-side recipe (parse yourself, pass the object); SR-GRID decision 22 gains 22d (the document, `rules`, `rules-src`) and the flagging attribute; SR-ERRORS for the hidden "New error" | ⏳ |

## Blockers

None. W-31 has landed (`f09b1fa`), so Flag issue's places are fixed. DoD 9 lands in W-32's gallery — build W-32 first, or add the tab in the same change.

## Record affected

[SR-GRID](../../records/0105_GRID.md) decision 22 (new 22d, 22a widened) · [SR-ERRORS](../../records/0106_ERRORS.md) (New error hidden under `flagging="off"`) · [SR-BUILD](../../records/0102_BUILD.md) decision 11 (the demo tab, with W-32).

## Hazards

- **Concurrent sessions** commit in this repo; re-derive `git status` before staging.
- **`rules-src` is a second `fetch`** — the open B-030 fork about SR-LAW-6's veto command. Follow whatever B-030 rules; if unruled, give it the same treatment as `src`, and say so in the change.
- **`pattern` comes from a file now**, not code review. Keep W-27's bound (no test over 10,000 characters; an invalid regex is a `note`, not a throw).
- **Not `@sheetpane/validation`.** That plugin reads data validation *authored in the workbook*; this file is *authored by the host*. Both feed the same panel; don't merge them.
- **A rule never edits a cell** (SR-GRID 22c).
- **No runtime dependency.** JSON is read with `JSON.parse`; a YAML or TOML parser in the package would be the grid's first third-party runtime dependency.

## Research — why JSON, how it's built

| | JSON | YAML | TOML |
|---|---|---|---|
| parser | built in (`JSON.parse`) | a dependency (`yaml` or `js-yaml`) | a dependency (`smol-toml`) |
| typing | exact: `"1.10"` stays a string | implicit: unquoted `1.10` → 1.1, `010`, `yes/no` traps (YAML 1.1) — risky in a file *about* valid values | exact |
| comments | no — use `note` | yes | yes |
| regex | double escape (`\\d`) | single in quotes | literal strings `'^AC-\d{5}$'` |
| editor help | JSON Schema: autocomplete, squiggles | via the same schema (YAML extension) | weak |
| nesting (sheet → column → rule) | natural | natural | verbose `[sheets.Accounts.columns."Account ID"]` |

**Verdict:** JSON as the one format the package reads — zero dependencies, deterministic types, schema-checked in the editor. A host that wants comments writes YAML or TOML and passes the parsed object to `rules`; the package never parses them.

**Prior art:** the [Frictionless Table Schema](https://specs.frictionlessdata.io/table-schema/) uses nearly the same constraint words (`required`, `unique`, `minimum`/`maximum`, `minLength`/`maxLength`, `pattern`, `enum`); W-27's names are close enough that a later importer is a small mapping — not part of this item.

**Build path:** parse → validate against the schema shape (hand-written checks, no Ajv) → compile each sheet's `columns`/`cells` into `ColumnRulesConfig`-like entries keyed by sheet → feed `store.setColumnRules` (widened with a sheet key and a cell-range matcher) → the existing provider caches, slices and resolves. `flagging` is an attribute read where W-31 renders Flag issue and where the card is chosen (`element.ts`, the `card = …` branch).

## Reference

- [W-27](../../archive/open/W-27-host-column-rules.md) — column rules, the engine this reuses
- [`../../records/0105_GRID.md`](../../records/0105_GRID.md) decisions 22–22c · [`../../packages/grid/README.md`](../../packages/grid/README.md) §Column rules
- `packages/grid/src/pane/rules.ts` — `ColumnRule`, `ColumnRulesConfig`, the provider
- [W-31](../../archive/open/W-31-docked-actions-one-download.md) — where Flag issue lives · [W-32](W-32-plugin-gallery-demos.md) — the demo gallery
- [`../compare/grid-events-and-host-rules.compare.md`](../compare/grid-events-and-host-rules.compare.md) — the rules verdict
- BACKLOG B-030 — `fetch` and SR-LAW-6's veto

## Prompt — paste into Claude Code

```text
You are building W-33 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, records/0105_GRID.md (decisions 22–22c),
   records/0106_ERRORS.md, packages/grid/src/pane/rules.ts, packages/grid/src/excel/element.ts,
   packages/grid/README.md (§Column rules), archive/open/W-27-host-column-rules.md and this file
   (work/open/W-33-rules-file.md). Check whether W-32 has landed.
2. Plan: the document shape and its JSON Schema, how sheet scope and cell ranges widen
   setColumnRules without a second engine, and where flagging="off" cuts the UI — before code.
3. Implement in packages/grid (rules.ts, store.ts, element.ts, the errors element, rules.schema.json).
4. Verify: just check; just demo-check; every DoD row above, including the 250,000-row measurement.
   Then do what SR-WORK-DOCS decision 10 says every task owes.
```
