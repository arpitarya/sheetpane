---
type: Handoff
name: W-19
description: "Arpit asked on 2026-10-18 for conditional formatting as a separate package; this item builds the plugin on the `decorate` hook, after styles."
item: W-19
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: agent
---

# W-19 — Build `@sheetpane/condfmt`: conditional formatting rendered, as a plugin

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Read `<conditionalFormatting>` and the `dxf` styles it points at | the rules and the looks they apply | ⏳ |
| 2 | Evaluate `cellIs`, `containsText`, `duplicateValues`, `top10`, `colorScale`, `dataBar` per cell through `decorate`, after `styles` | cells look conditional the way Excel shows them | ⏳ |
| 3 | `expression` rules only when `formulas` is installed | honest coverage, counted | ⏳ |
| 4 | Render only — no authoring in v1 | a reviewer sees, does not write, conditional rules | ⏳ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Sonnet — rule evaluation against the spec with fixtures; no UI.

## Goal

A plugin that renders the conditional formats a workbook carries. It is a second `decorate` provider ordered after `@sheetpane/styles`, so a rule's `dxf` overrides the static style per property, as in Excel.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/condfmt/` builds to ESM, no runtime dependency; `@sheetpane/grid` and `@sheetpane/styles` peers; no `./ui` | ⏳ |
| 2 · rules | the six types above with `priority` and `stopIfTrue` honoured; ranges with multiple `sqref` areas; `dxf` fills, fonts and borders mapped through the same allow-list as styles | ⏳ |
| 3 · scales | `colorScale` with 2 and 3 colours interpolated in sRGB; `dataBar` as a background gradient sized to the cell, min/max per the rule | ⏳ |
| 4 · expression | evaluated through `formulas` when present (relative references shifted per cell); skipped and counted otherwise | ⏳ |
| 5 · live | a change re-evaluates the rules whose range holds the changed cell or whose scale depends on it | ⏳ |
| 6 · tests | an Excel fixture per rule type; rendered properties compared cell by cell; the override order against styles | ⏳ |
| 7 · record | a component record; Ownership rows for `packages/condfmt/` | ⏳ |

## Blockers

Waiting on **W-17** (styles — the allow-list and the ordering it comes after).

## Record affected

A new component record on completion. Until then this item owns `packages/condfmt/`.

## Hazards

- **Priority order** is per sheet and global across rules; implement it once, with the `stopIfTrue` test.
- **Icon sets** are out of v1 (they need glyphs); a rule of that type is counted as skipped.
- **Performance:** scales over large ranges need the range's min/max cached per change, not recomputed per cell.

## Reference

- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — `decorate` ordering
- [W-17](W-17-styles.md) · [W-16](W-16-formulas.md)

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-19 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   work/compare/plugins.compare.md and this file (work/open/W-19-condfmt.md).
2. Plan the modules and the fixture list in this file's body before writing code.
3. Implement. Start from the fixture per rule type; the rule evaluator is a pure function over (cell, rule, rangeStats) — test it headless before wiring the hook.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
